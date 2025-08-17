"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Trophy, Play, Users, Award, Upload } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { MatchResultSubmission } from "./match-result-submission"

export function TournamentBracket({ tournament, isOrganizer, currentUser }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [participants, setParticipants] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)

  useEffect(() => {
    const fetchParticipants = async () => {
      if (tournament.tournament_participants) {
        setParticipants(tournament.tournament_participants)
      }
    }
    fetchParticipants()
  }, [tournament])

  const setMatchWinner = async (matchId, winnerId) => {
    if (!isOrganizer) return

    try {
      // Update the match with winner
      const { error } = await supabase
        .from("matches")
        .update({
          winner_id: winnerId,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", matchId)

      if (error) {
        console.error("Error setting winner:", error)
        alert("Failed to set winner")
        return
      }

      // Call bracket progression API to advance winner
      const response = await fetch("/api/bracket/advance-winner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, winnerId }),
      })

      if (!response.ok) {
        throw new Error("Failed to advance winner")
      }

      const result = await response.json()

      if (result.tournamentComplete) {
        alert(`🏆 Tournament Complete! Winner: ${getPlayerName(result.winner)}`)
      }

      router.refresh()
    } catch (error) {
      console.error("Error:", error)
      alert("An unexpected error occurred")
    }
  }

  useEffect(() => {
    if (!tournament.id) return

    // Subscribe to match updates
    const matchSubscription = supabase
      .channel(`tournament-${tournament.id}-matches`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${tournament.id}`,
        },
        (payload) => {
          console.log("Match updated:", payload)
          router.refresh()
        },
      )
      .subscribe()

    return () => {
      matchSubscription.unsubscribe()
    }
  }, [tournament.id, router])

  const generateBracket = async () => {
    if (!isOrganizer) return

    setLoading(true)
    try {
      // First, clear existing matches
      await supabase.from("matches").delete().eq("tournament_id", tournament.id)

      const tournamentParticipants = participants
      const numParticipants = tournamentParticipants.length

      if (numParticipants < 2) {
        alert("Need at least 2 participants to generate bracket")
        setLoading(false)
        return
      }

      // Shuffle participants for random seeding
      const shuffledParticipants = [...tournamentParticipants].sort(() => Math.random() - 0.5)

      // Calculate number of rounds needed
      const numRounds = Math.ceil(Math.log2(numParticipants))
      const matches = []

      // Generate first round matches
      for (let i = 0; i < shuffledParticipants.length; i += 2) {
        const player1 = shuffledParticipants[i]
        const player2 = shuffledParticipants[i + 1] || null

        matches.push({
          tournament_id: tournament.id,
          round: 1,
          match_number: Math.floor(i / 2) + 1,
          player1_id: player1.user_id,
          player2_id: player2?.user_id || null,
          status: player2 ? "pending" : "completed",
          winner_id: player2 ? null : player1.user_id, // Auto-advance if odd number
        })
      }

      // Generate subsequent rounds (empty matches to be filled as tournament progresses)
      let currentRoundMatches = Math.ceil(shuffledParticipants.length / 2)
      for (let round = 2; round <= numRounds; round++) {
        const nextRoundMatches = Math.ceil(currentRoundMatches / 2)
        for (let match = 1; match <= nextRoundMatches; match++) {
          matches.push({
            tournament_id: tournament.id,
            round,
            match_number: match,
            player1_id: null,
            player2_id: null,
            status: "pending",
            winner_id: null,
          })
        }
        currentRoundMatches = nextRoundMatches
      }

      const { error } = await supabase.from("matches").insert(matches)

      if (error) {
        console.error("Error generating bracket:", error)
        alert("Failed to generate bracket")
      } else {
        // Update tournament status to ongoing
        await supabase.from("tournaments").update({ status: "ongoing" }).eq("id", tournament.id)
        router.refresh()
      }
    } catch (error) {
      console.error("Error:", error)
      alert("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleMatchClick = (match) => {
    if (match.player1_id && match.player2_id && match.status !== "completed") {
      setSelectedMatch(match)
    }
  }

  const handleResultSubmitted = () => {
    setSelectedMatch(null)
    router.refresh()
  }

  const getPlayerName = (playerId) => {
    if (!playerId) return "TBD"

    const participant = participants.find((p) => p.user_id === playerId)
    if (participant?.profiles) {
      return participant.profiles.username || participant.profiles.full_name || "Unknown Player"
    }

    // Fallback for match data
    const match = tournament.matches?.find((m) => m.player1_id === playerId || m.player2_id === playerId)
    if (match) {
      if (match.player1_id === playerId && match.player1) {
        return match.player1.username || match.player1.full_name || "Player 1"
      }
      if (match.player2_id === playerId && match.player2) {
        return match.player2.username || match.player2.full_name || "Player 2"
      }
    }

    return "Unknown Player"
  }

  const matches = tournament.matches || []
  const rounds = matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = []
    acc[match.round].push(match)
    return acc
  }, {})

  const maxRound = Math.max(...Object.keys(rounds).map(Number), 0)

  return (
    <div className="space-y-8">
      {/* Tournament Overview */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Tournament Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{participants.length}</div>
              <div className="text-gray-400 text-sm">Total Participants</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {matches.filter((m) => m.status === "completed").length}
              </div>
              <div className="text-gray-400 text-sm">Completed Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{maxRound}</div>
              <div className="text-gray-400 text-sm">Total Rounds</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {tournament.tournament_type?.replace("_", " ").toUpperCase() || "SINGLE ELIMINATION"}
              </div>
              <div className="text-gray-400 text-sm">Format</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants List */}
      {participants.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="w-5 h-5" />
              Tournament Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {participants.map((participant, index) => (
                <div key={participant.id} className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {participant.profiles?.username || participant.profiles?.full_name || `Player ${index + 1}`}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Joined {new Date(participant.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match Result Submission Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Match {selectedMatch.match_number} - Round {selectedMatch.round}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMatch(null)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </Button>
            </div>
            <div className="p-4">
              <MatchResultSubmission
                match={selectedMatch}
                currentUser={currentUser}
                onResultSubmitted={handleResultSubmitted}
              />
            </div>
          </div>
        </div>
      )}

      {/* Generate Bracket Button */}
      {isOrganizer && matches.length === 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-bold text-white mb-4">Ready to Start Tournament?</h3>
            <p className="text-gray-400 mb-6">
              Generate the tournament bracket to begin matches. This will randomly seed all {participants.length}{" "}
              participants.
            </p>
            <Button
              onClick={generateBracket}
              disabled={loading || participants.length < 2}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Generating..." : `Generate Bracket (${participants.length} Players)`}
            </Button>
            {participants.length < 2 && (
              <p className="text-red-400 text-sm mt-2">Need at least 2 participants to generate bracket</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bracket Display */}
      {matches.length > 0 && (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-8 justify-center">
            {Object.keys(rounds)
              .sort((a, b) => Number(a) - Number(b))
              .map((roundNum) => (
                <div key={roundNum} className="space-y-4">
                  <h3 className="text-lg font-bold text-white text-center">
                    {Number(roundNum) === maxRound
                      ? "🏆 Final"
                      : Number(roundNum) === maxRound - 1
                        ? "🥉 Semi-Final"
                        : `Round ${roundNum}`}
                  </h3>
                  <div className="space-y-4">
                    {rounds[roundNum]
                      .sort((a, b) => a.match_number - b.match_number)
                      .map((match) => (
                        <Card
                          key={match.id}
                          className={`bg-slate-800 border-slate-700 w-72 transition-all ${
                            match.player1_id && match.player2_id && match.status !== "completed"
                              ? "cursor-pointer hover:border-blue-500 hover:shadow-lg"
                              : ""
                          }`}
                          onClick={() => handleMatchClick(match)}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-400 text-center flex items-center justify-center gap-2">
                              <Play className="w-3 h-3" />
                              Match {match.match_number}
                              {match.player1_id && match.player2_id && match.status !== "completed" && (
                                <Upload className="w-3 h-3 text-blue-400" title="Click to submit result" />
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {/* Player 1 */}
                            <div
                              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                                match.winner_id === match.player1_id
                                  ? "bg-green-600/20 border border-green-600 shadow-lg"
                                  : "bg-slate-700 hover:bg-slate-600"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <span className="text-white font-medium">{getPlayerName(match.player1_id)}</span>
                                  {match.winner_id === match.player1_id && (
                                    <div className="text-green-400 text-xs font-medium">WINNER</div>
                                  )}
                                </div>
                              </div>
                              {isOrganizer && match.player1_id && match.player2_id && match.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setMatchWinner(match.id, match.player1_id)}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                                >
                                  <Trophy className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            {/* VS Divider */}
                            <div className="text-center text-gray-500 text-xs font-bold py-1">VS</div>

                            {/* Player 2 */}
                            <div
                              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                                match.winner_id === match.player2_id
                                  ? "bg-green-600/20 border border-green-600 shadow-lg"
                                  : "bg-slate-700 hover:bg-slate-600"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <span className="text-white font-medium">{getPlayerName(match.player2_id)}</span>
                                  {match.winner_id === match.player2_id && (
                                    <div className="text-green-400 text-xs font-medium">WINNER</div>
                                  )}
                                </div>
                              </div>
                              {isOrganizer && match.player1_id && match.player2_id && match.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setMatchWinner(match.id, match.player2_id)}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                                >
                                  <Trophy className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            {/* Match Status */}
                            <div className="text-center pt-2">
                              <Badge
                                variant={match.status === "completed" ? "default" : "secondary"}
                                className={
                                  match.status === "completed"
                                    ? "bg-green-600 text-white"
                                    : match.player1_id && match.player2_id
                                      ? "bg-yellow-600 text-white"
                                      : "bg-gray-600 text-white"
                                }
                              >
                                {match.status === "completed"
                                  ? "✅ Completed"
                                  : match.player1_id && match.player2_id
                                    ? "📤 Submit Result"
                                    : "⏸️ Waiting for Players"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Tournament Winner */}
          {maxRound > 0 && rounds[maxRound] && rounds[maxRound][0]?.winner_id && (
            <Card className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 border-yellow-400 shadow-2xl">
              <CardContent className="pt-6 text-center">
                <Trophy className="w-16 h-16 text-white mx-auto mb-4 animate-bounce" />
                <h2 className="text-3xl font-bold text-white mb-2">🏆 Tournament Champion! 🏆</h2>
                <p className="text-yellow-100 text-xl font-semibold">
                  {getPlayerName(rounds[maxRound][0].winner_id)} wins the tournament!
                </p>
                <div className="mt-4 text-yellow-200">Congratulations on an outstanding performance! 🎉</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* No Matches Yet */}
      {matches.length === 0 && !isOrganizer && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Play className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Bracket Not Generated Yet</h3>
            <p className="text-gray-400">The tournament organizer hasn't generated the bracket yet.</p>
            <p className="text-gray-500 text-sm mt-2">{participants.length} participants are ready to compete!</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
