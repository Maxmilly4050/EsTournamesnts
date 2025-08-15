import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin-dashboard"

// List of admin user IDs - in production, this would be stored in database
const ADMIN_USER_IDS = [
  // Add admin user IDs here
]

export default async function AdminPage() {
  const supabase = createClient()
  let user = null
  let tournaments = []
  let disputes = []
  let users = []
  let matchResults = []

  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      redirect("/auth/login")
    }
    user = userData.user

    // Check if user is admin (in production, check against database role)
    const isAdmin = ADMIN_USER_IDS.includes(user.id) || user.email?.endsWith("@admin.com")
    if (!isAdmin) {
      notFound()
    }

    // Check if tables exist
    const { error: tableCheckError } = await supabase.from("tournaments").select("id").limit(1)

    if (tableCheckError && tableCheckError.message.includes("does not exist")) {
      // Tables don't exist, use fallback data
      tournaments = []
      disputes = []
      users = []
      matchResults = []
    } else {
      // Fetch all tournaments
      const { data: tournamentsData } = await supabase
        .from("tournaments")
        .select(`
          *,
          profiles:organizer_id (username, full_name),
          tournament_participants (count)
        `)
        .order("created_at", { ascending: false })

      tournaments = tournamentsData || []

      // Fetch all disputes
      const { data: disputesData } = await supabase
        .from("match_disputes")
        .select(`
          *,
          matches (
            id,
            round,
            match_number,
            tournament_id,
            tournaments (title, game)
          ),
          disputed_by_profile:disputed_by (username, full_name, email)
        `)
        .order("created_at", { ascending: false })

      disputes = disputesData || []

      // Fetch all match results
      const { data: resultsData } = await supabase
        .from("match_results")
        .select(`
          *,
          matches (
            id,
            round,
            match_number,
            tournament_id,
            tournaments (title, game)
          ),
          submitted_by_profile:submitted_by (username, full_name, email)
        `)
        .order("submitted_at", { ascending: false })
        .limit(50)

      matchResults = resultsData || []

      // Fetch user profiles
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      users = usersData || []
    }
  } catch (error) {
    console.error("Admin dashboard error:", error)
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-900 py-12">
      <div className="container mx-auto px-4">
        <AdminDashboard
          tournaments={tournaments}
          disputes={disputes}
          users={users}
          matchResults={matchResults}
          currentUser={user}
        />
      </div>
    </div>
  )
}
