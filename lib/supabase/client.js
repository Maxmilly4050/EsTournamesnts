import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

export const createClient = () => {
  const client = createClientComponentClient()

  client.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") {
      console.log("Token refreshed automatically")
    }

    if (event === "SIGNED_OUT") {
      // Clear any cached data when user signs out
      console.log("User signed out, clearing cache")
    }
  })

  return client
}

// Create a singleton instance of the Supabase client for Client Components
export const supabase = createClient()
