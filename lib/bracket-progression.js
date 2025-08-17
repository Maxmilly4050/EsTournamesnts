import { createClient } from "@/lib/supabase/server"

export class BracketProgressionService {
  constructor() {
    this.supabase = createClient()
  }

  async advanceWinner(matchId, winnerId) {
    try {
      // Get the completed match details
      const { data: match, error: matchError } = await this.supabase
        .from("matches")
        .select("*, tournament_id, round, match_number")
        .eq("id", matchId)
        .single()

      if (matchError || !match) {
        throw new Error("Match not found")
      }

      // Find the next round match where this winner should advance
      const nextRound = match.round + 1
      const nextMatchNumber = Math.ceil(match.match_number / 2)

      const { data: nextMatch, error: nextMatchError } = await this.supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", match.tournament_id)
        .eq("round", nextRound)
        .eq("match_number", nextMatchNumber)
        .single()

      if (nextMatchError || !nextMatch) {
        // This was the final match - tournament is complete
        await this.completeTournament(match.tournament_id, winnerId)
        return { tournamentComplete: true, winner: winnerId }
      }

      // Determine which slot the winner should fill (player1 or player2)
      const isFirstSlot = match.match_number % 2 === 1
      const updateField = isFirstSlot ? "player1_id" : "player2_id"

      // Update the next match with the advancing player
      const { error: updateError } = await this.supabase
        .from("matches")
        .update({ [updateField]: winnerId })
        .eq("id", nextMatch.id)

      if (updateError) {
        throw new Error("Failed to advance winner")
      }

      // Check if both players are now assigned to the next match
      const updatedNextMatch = {
        ...nextMatch,
        [updateField]: winnerId,
      }

      if (updatedNextMatch.player1_id && updatedNextMatch.player2_id) {
        // Both players assigned - activate the match
        await this.supabase.from("matches").update({ status: "active" }).eq("id", nextMatch.id)

        // Send notifications to both players
        await this.sendMatchNotifications(updatedNextMatch)
      }

      // Log the advancement
      await this.supabase.from("tournament_logs").insert({
        tournament_id: match.tournament_id,
        match_id: matchId,
        user_id: winnerId,
        action_type: "auto_advance",
        description: `Winner advanced to Round ${nextRound}`,
        metadata: { fromRound: match.round, toRound: nextRound },
      })

      return { success: true, nextMatch: updatedNextMatch }
    } catch (error) {
      console.error("Error advancing winner:", error)
      throw error
    }
  }

  async checkRoundCompletion(tournamentId, round) {
    try {
      const { data: roundMatches, error } = await this.supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", round)

      if (error) throw error

      const allCompleted = roundMatches.every((match) => match.status === "completed")

      if (allCompleted) {
        // Update round status to completed
        await this.supabase
          .from("tournament_rounds")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("tournament_id", tournamentId)
          .eq("round_number", round)

        // Activate next round if it exists
        const { data: nextRound } = await this.supabase
          .from("tournament_rounds")
          .select("*")
          .eq("tournament_id", tournamentId)
          .eq("round_number", round + 1)
          .single()

        if (nextRound) {
          await this.supabase.from("tournament_rounds").update({ status: "active" }).eq("id", nextRound.id)

          // Set deadlines for next round matches
          await this.setRoundDeadlines(tournamentId, round + 1)
        }

        return { roundComplete: true, nextRoundActivated: !!nextRound }
      }

      return { roundComplete: false }
    } catch (error) {
      console.error("Error checking round completion:", error)
      throw error
    }
  }

  async processDeadlineForfeits(tournamentId) {
    try {
      const now = new Date().toISOString()

      // Find matches past deadline with no result
      const { data: expiredMatches, error } = await this.supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("status", "active")
        .lt("deadline", now)

      if (error) throw error

      for (const match of expiredMatches) {
        // Check submission status
        const hasPlayer1Submitted = match.player1_submitted_at
        const hasPlayer2Submitted = match.player2_submitted_at

        let winnerId = null
        let forfeitReason = ""

        if (hasPlayer1Submitted && !hasPlayer2Submitted) {
          winnerId = match.player1_id
          forfeitReason = "Player 2 forfeit (missed deadline)"
        } else if (!hasPlayer1Submitted && hasPlayer2Submitted) {
          winnerId = match.player2_id
          forfeitReason = "Player 1 forfeit (missed deadline)"
        } else if (!hasPlayer1Submitted && !hasPlayer2Submitted) {
          // Both missed deadline - advance random player or handle as double forfeit
          forfeitReason = "Both players forfeit (missed deadline)"
          // For now, we'll mark as completed without winner - admin can decide
        }

        // Update match with forfeit result
        await this.supabase
          .from("matches")
          .update({
            winner_id: winnerId,
            status: "completed",
            completed_at: now,
            admin_notes: forfeitReason,
          })
          .eq("id", match.id)

        // Log the forfeit
        await this.supabase.from("tournament_logs").insert({
          tournament_id: tournamentId,
          match_id: match.id,
          user_id: winnerId,
          action_type: "auto_forfeit",
          description: forfeitReason,
          metadata: { deadline: match.deadline },
        })

        // Advance winner if there is one
        if (winnerId) {
          await this.advanceWinner(match.id, winnerId)
        }
      }

      return { processedForfeits: expiredMatches.length }
    } catch (error) {
      console.error("Error processing deadline forfeits:", error)
      throw error
    }
  }

  async setRoundDeadlines(tournamentId, round, deadline = null) {
    try {
      // If no deadline provided, set default (24 hours from now)
      const roundDeadline = deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      // Update all matches in the round
      const { error } = await this.supabase
        .from("matches")
        .update({ deadline: roundDeadline })
        .eq("tournament_id", tournamentId)
        .eq("round", round)

      if (error) throw error

      // Update the round record
      await this.supabase
        .from("tournament_rounds")
        .update({ deadline: roundDeadline })
        .eq("tournament_id", tournamentId)
        .eq("round_number", round)

      return { success: true, deadline: roundDeadline }
    } catch (error) {
      console.error("Error setting round deadlines:", error)
      throw error
    }
  }

  async completeTournament(tournamentId, winnerId) {
    try {
      // Update tournament status
      await this.supabase
        .from("tournaments")
        .update({
          status: "completed",
          end_date: new Date().toISOString(),
        })
        .eq("id", tournamentId)

      // Log tournament completion
      await this.supabase.from("tournament_logs").insert({
        tournament_id: tournamentId,
        user_id: winnerId,
        action_type: "tournament_complete",
        description: `Tournament completed - Winner declared`,
        metadata: { winner: winnerId },
      })

      // Send winner notification
      await this.supabase.from("notifications").insert({
        user_id: winnerId,
        tournament_id: tournamentId,
        type: "tournament_winner",
        title: "🏆 Tournament Champion!",
        message: "Congratulations! You have won the tournament!",
      })

      return { success: true }
    } catch (error) {
      console.error("Error completing tournament:", error)
      throw error
    }
  }

  async sendMatchNotifications(match) {
    try {
      const notifications = [
        {
          user_id: match.player1_id,
          tournament_id: match.tournament_id,
          match_id: match.id,
          type: "match_ready",
          title: "Match Ready",
          message: `Your Round ${match.round} match is ready to begin!`,
        },
        {
          user_id: match.player2_id,
          tournament_id: match.tournament_id,
          match_id: match.id,
          type: "match_ready",
          title: "Match Ready",
          message: `Your Round ${match.round} match is ready to begin!`,
        },
      ]

      await this.supabase.from("notifications").insert(notifications)
    } catch (error) {
      console.error("Error sending match notifications:", error)
    }
  }
}
