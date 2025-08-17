import { createClient } from "@/lib/supabase/server"

export class NotificationService {
  constructor() {
    this.supabase = createClient()
  }

  async checkNotificationsTableExists() {
    try {
      const { error } = await this.supabase.from("notifications").select("id").limit(1)

      return !error
    } catch (error) {
      return false
    }
  }

  async sendMatchReminders() {
    try {
      const tableExists = await this.checkNotificationsTableExists()
      if (!tableExists) {
        console.log("[v0] Notifications table not found, skipping match reminders")
        return { sent: 0 }
      }

      const now = new Date()
      const reminderTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now

      // Find matches starting within 2 hours that haven't had reminders sent
      const { data: upcomingMatches, error } = await this.supabase
        .from("matches")
        .select(`
          *,
          tournaments(title),
          player1:profiles!matches_player1_id_fkey(id, username),
          player2:profiles!matches_player2_id_fkey(id, username)
        `)
        .eq("status", "active")
        .lte("scheduled_at", reminderTime.toISOString())
        .is("reminder_sent", null)

      if (error) throw error

      for (const match of upcomingMatches) {
        const notifications = []

        if (match.player1_id) {
          notifications.push({
            user_id: match.player1_id,
            tournament_id: match.tournament_id,
            match_id: match.id,
            type: "match_reminder",
            title: "Match Starting Soon",
            message: `Your ${match.tournaments.title} match starts in 2 hours. Get ready!`,
            scheduled_for: now.toISOString(),
          })
        }

        if (match.player2_id) {
          notifications.push({
            user_id: match.player2_id,
            tournament_id: match.tournament_id,
            match_id: match.id,
            type: "match_reminder",
            title: "Match Starting Soon",
            message: `Your ${match.tournaments.title} match starts in 2 hours. Get ready!`,
            scheduled_for: now.toISOString(),
          })
        }

        if (notifications.length > 0) {
          await this.supabase.from("notifications").insert(notifications)

          // Mark reminder as sent
          await this.supabase.from("matches").update({ reminder_sent: now.toISOString() }).eq("id", match.id)
        }
      }

      return { sent: upcomingMatches.length * 2 }
    } catch (error) {
      console.error("Error sending match reminders:", error)
      return { sent: 0 }
    }
  }

  async sendDeadlineWarnings() {
    try {
      const tableExists = await this.checkNotificationsTableExists()
      if (!tableExists) {
        console.log("[v0] Notifications table not found, skipping deadline warnings")
        return { sent: 0 }
      }

      const now = new Date()
      const warningTime = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes from now

      // Find matches with deadlines within 30 minutes that haven't been completed
      const { data: urgentMatches, error } = await this.supabase
        .from("matches")
        .select(`
          *,
          tournaments(title),
          player1:profiles!matches_player1_id_fkey(id, username),
          player2:profiles!matches_player2_id_fkey(id, username)
        `)
        .eq("status", "active")
        .lte("deadline", warningTime.toISOString())
        .is("deadline_warning_sent", null)

      if (error) throw error

      for (const match of urgentMatches) {
        const notifications = []

        // Only warn players who haven't submitted yet
        if (match.player1_id && !match.player1_submitted_at) {
          notifications.push({
            user_id: match.player1_id,
            tournament_id: match.tournament_id,
            match_id: match.id,
            type: "deadline_warning",
            title: "⚠️ Match Deadline Approaching",
            message: `Your ${match.tournaments.title} match deadline is in 30 minutes! Submit your result now to avoid forfeit.`,
            scheduled_for: now.toISOString(),
          })
        }

        if (match.player2_id && !match.player2_submitted_at) {
          notifications.push({
            user_id: match.player2_id,
            tournament_id: match.tournament_id,
            match_id: match.id,
            type: "deadline_warning",
            title: "⚠️ Match Deadline Approaching",
            message: `Your ${match.tournaments.title} match deadline is in 30 minutes! Submit your result now to avoid forfeit.`,
            scheduled_for: now.toISOString(),
          })
        }

        if (notifications.length > 0) {
          await this.supabase.from("notifications").insert(notifications)

          // Mark warning as sent
          await this.supabase.from("matches").update({ deadline_warning_sent: now.toISOString() }).eq("id", match.id)
        }
      }

      return { sent: urgentMatches.length }
    } catch (error) {
      console.error("Error sending deadline warnings:", error)
      return { sent: 0 }
    }
  }

  async sendResultNotification(matchId, winnerId, loserId, type = "match_result") {
    try {
      const tableExists = await this.checkNotificationsTableExists()
      if (!tableExists) {
        console.log("[v0] Notifications table not found, skipping result notification")
        return { success: true }
      }

      const { data: match, error } = await this.supabase
        .from("matches")
        .select(`
          *,
          tournaments(title),
          winner:profiles!matches_winner_id_fkey(username)
        `)
        .eq("id", matchId)
        .single()

      if (error) throw error

      const notifications = [
        {
          user_id: winnerId,
          tournament_id: match.tournament_id,
          match_id: matchId,
          type: "result_notification",
          title: "🏆 Match Victory!",
          message: `Congratulations! You won your ${match.tournaments.title} match and advance to the next round.`,
        },
        {
          user_id: loserId,
          tournament_id: match.tournament_id,
          match_id: matchId,
          type: "result_notification",
          title: "Match Result",
          message: `Your ${match.tournaments.title} match has concluded. Better luck next time!`,
        },
      ]

      await this.supabase.from("notifications").insert(notifications)
      return { success: true }
    } catch (error) {
      console.error("Error sending result notifications:", error)
      return { success: false }
    }
  }

  async sendAdminDecisionNotification(matchId, decision, affectedPlayerIds, adminNotes = "") {
    try {
      const tableExists = await this.checkNotificationsTableExists()
      if (!tableExists) {
        console.log("[v0] Notifications table not found, skipping admin decision notification")
        return { success: true }
      }

      const { data: match, error } = await this.supabase
        .from("matches")
        .select(`
          *,
          tournaments(title)
        `)
        .eq("id", matchId)
        .single()

      if (error) throw error

      const notifications = affectedPlayerIds.map((playerId) => ({
        user_id: playerId,
        tournament_id: match.tournament_id,
        match_id: matchId,
        type: "admin_decision",
        title: "Admin Decision",
        message: `Tournament admin has made a decision on your ${match.tournaments.title} match. ${
          adminNotes ? `Note: ${adminNotes}` : ""
        }`,
      }))

      await this.supabase.from("notifications").insert(notifications)
      return { success: true }
    } catch (error) {
      console.error("Error sending admin decision notifications:", error)
      return { success: false }
    }
  }

  async sendTournamentNotification(tournamentId, userIds, type, title, message) {
    try {
      const tableExists = await this.checkNotificationsTableExists()
      if (!tableExists) {
        console.log("[v0] Notifications table not found, skipping tournament notification")
        return { success: true }
      }

      const notifications = userIds.map((userId) => ({
        user_id: userId,
        tournament_id: tournamentId,
        type,
        title,
        message,
      }))

      await this.supabase.from("notifications").insert(notifications)
      return { success: true }
    } catch (error) {
      console.error("Error sending tournament notifications:", error)
      return { success: false }
    }
  }

  async markAsRead(notificationIds, userId) {
    try {
      const tableExists = await this.checkNotificationsTableExists()
      if (!tableExists) {
        console.log("[v0] Notifications table not found, skipping mark as read")
        return { success: true }
      }

      const { error } = await this.supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", notificationIds)
        .eq("user_id", userId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error("Error marking notifications as read:", error)
      return { success: false }
    }
  }

  async getUserNotifications(userId, limit = 20) {
    try {
      const tableExists = await this.checkNotificationsTableExists()
      if (!tableExists) {
        console.log("[v0] Notifications table not found, returning empty notifications")
        return []
      }

      const { data: notifications, error } = await this.supabase
        .from("notifications")
        .select(`
          *,
          tournaments(title),
          matches(round, match_number)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) throw error
      return notifications
    } catch (error) {
      console.error("Error getting user notifications:", error)
      return []
    }
  }
}
