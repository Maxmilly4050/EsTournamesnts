import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { TournamentDashboard } from "@/components/tournament-dashboard"
import Header from "@/components/header"

export default async function TournamentDashboardPage({ params }) {
  if (params.id === "create" || isNaN(Number.parseInt(params.id))) {
    redirect("/tournaments")
  }

  const supabase = createClient()
  let tournament = null
  let user = null
  let matchResults = []
  let disputes = []

  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      redirect("/auth/login")
    }
    user = userData.user

    // Check if tables exist
    const { error: tableCheckError } = await supabase.from("tournaments").select("id").limit(1)

    if (tableCheckError && tableCheckError.message.includes("does not exist")) {
      // Tables don't exist, use fallback data
      tournament = {
        id: params.id,
        title: `Tournament #${params.id}`,
        game: "Sample Game",
        organizer_id: user.id,
        status: "ongoing",
      }
      matchResults = []
      disputes = []
    } else {
      // Fetch tournament data
      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select(`
          *,
          profiles:organizer_id (username, full_name),
          matches (
            id,
            round,
            match_number,
            player1_id,
            player2_id,
            winner_id,
            status,
            player1:player1_id (username, full_name),
            player2:player2_id (username, full_name)
          )
        `)
        .eq("id", params.id)
        .single()

      if (tournamentError) {
        notFound()
      }

      tournament = tournamentData

      // Check if user is the organizer
      if (tournament.organizer_id !== user.id) {
        redirect(`/tournaments/${params.id}`)
      }

      // Fetch match results
      const { data: resultsData } = await supabase
        .from("match_results")
        .select(`
          *,
          matches (
            id,
            round,
            match_number,
            player1_id,
            player2_id,
            player1:player1_id (username, full_name),
            player2:player2_id (username, full_name)
          ),
          submitted_by_profile:submitted_by (username, full_name),
          winner_profile:winner_id (username, full_name)
        `)
        .in("match_id", tournament.matches?.map((m) => m.id) || [])
        .order("submitted_at", { ascending: false })

      matchResults = resultsData || []

      // Fetch disputes
      const { data: disputesData } = await supabase
        .from("match_disputes")
        .select(`
          *,
          matches (
            id,
            round,
            match_number,
            player1_id,
            player2_id,
            player1:player1_id (username, full_name),
            player2:player2_id (username, full_name)
          ),
          disputed_by_profile:disputed_by (username, full_name)
        `)
        .in("match_id", tournament.matches?.map((m) => m.id) || [])
        .order("created_at", { ascending: false })

      disputes = disputesData || []
    }
  } catch (error) {
    console.error("Dashboard error:", error)
    notFound()
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-slate-900 pt-20 py-12">
        <div className="container mx-auto px-4">
          <TournamentDashboard tournament={tournament} matchResults={matchResults} disputes={disputes} user={user} />
        </div>
      </div>
    </>
  )
}
