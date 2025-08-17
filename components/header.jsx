"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Menu, Plus, User, LogOut, Shield, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { signOut } from "@/lib/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { useTransition, useEffect, useState, useRef } from "react"

// List of admin user IDs - in production, this would be stored in database
const ADMIN_USER_IDS = [
  // Add admin user IDs here
]

export function Header() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)
  const supabase = createClient()
  const router = useRouter()

  const mockTournaments = [
    {
      id: 1,
      name: "eFootball 2026 Championship",
      game: "eFootball 2026",
      participants: "24/32 players",
      prize: "TZS 50,000",
    },
    {
      id: 2,
      name: "FC Mobile World Cup",
      game: "FC Mobile",
      participants: "47/64 players",
      prize: "TZS 75,000",
    },
    {
      id: 3,
      name: "eFootball Pro League",
      game: "eFootball 2026",
      participants: "16/16 players",
      prize: "TZS 30,000",
    },
    {
      id: 4,
      name: "FC Mobile Champions League",
      game: "FC Mobile",
      participants: "31/48 players",
      prize: "Free Entry",
    },
    {
      id: 5,
      name: "Ultimate eFootball Tournament",
      game: "eFootball 2026",
      participants: "8/16 players",
      prize: "TZS 100,000",
    },
  ]

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const filtered = mockTournaments
        .filter(
          (tournament) =>
            tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tournament.game.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .slice(0, 3) // Show only first 3 suggestions

      setSuggestions(filtered)
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/tournaments?search=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push("/tournaments")
    }
    setShowSuggestions(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch(e)
    }
  }

  const handleSuggestionClick = (tournament) => {
    setSearchQuery(tournament.name)
    setShowSuggestions(false)
    router.push(`/tournaments?search=${encodeURIComponent(tournament.name)}`)
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("Session error:", sessionError)
          setUser(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        if (!session) {
          // No session exists, user is not authenticated
          setUser(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // Session exists, get user details
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          if (userError.message?.includes("jwt") || userError.message?.includes("expired")) {
            // Token is expired, try to refresh
            const {
              data: { session: refreshedSession },
              error: refreshError,
            } = await supabase.auth.refreshSession()

            if (refreshError) {
              console.error("Token refresh failed:", refreshError)
              // Sign out user if refresh fails
              await supabase.auth.signOut()
              setUser(null)
              setIsAdmin(false)
              setLoading(false)
              return
            }
            setUser(refreshedSession?.user || null)
          } else {
            console.error("Auth error:", userError)
            setUser(null)
            setIsAdmin(false)
          }
        } else {
          setUser(user)
        }

        // Check if user is admin
        const currentUser = user || session?.user
        if (currentUser) {
          const adminCheck = ADMIN_USER_IDS.includes(currentUser.id) || currentUser.email?.endsWith("@admin.com")
          setIsAdmin(adminCheck)
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        console.error("Failed to get user:", error)
        setUser(null)
        setIsAdmin(false)
      }

      setLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event)

      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully")
      }

      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        setUser(null)
        setIsAdmin(false)
        setLoading(false)
        return
      }

      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const adminCheck = ADMIN_USER_IDS.includes(currentUser.id) || currentUser.email?.endsWith("@admin.com")
        setIsAdmin(adminCheck)
      } else {
        setIsAdmin(false)
      }

      setLoading(false)
    })

    return () => {
      try {
        if (subscription && typeof subscription.unsubscribe === "function") {
          subscription.unsubscribe()
        }
      } catch (error) {
        console.error("Error unsubscribing from auth state changes:", error)
      }
    }
  }, [supabase.auth])

  const SignOutButton = () => {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const handleSignOut = async () => {
      startTransition(async () => {
        const result = await signOut()
        if (result.success && result.redirect) {
          router.push(result.redirect)
          router.refresh()
        }
      })
    }

    return (
      <button
        onClick={handleSignOut}
        disabled={isPending}
        className="flex items-center w-full text-gray-300 hover:text-white"
      >
        <LogOut className="w-4 h-4 mr-2" />
        {isPending ? "Signing out..." : "Sign Out"}
      </button>
    )
  }

  if (loading) {
    return (
      <header className="sticky top-0 z-50 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">E</span>
                </div>
                <span className="text-xl font-bold text-white">EsTournaments</span>
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-20 h-9 bg-slate-700 rounded animate-pulse"></div>
              <div className="w-16 h-9 bg-slate-700 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <span className="text-xl font-bold text-white">EsTournaments</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/tournaments" className="text-gray-300 hover:text-white transition-colors">
                Tournaments
              </Link>
              <Link href="/games" className="text-gray-300 hover:text-white transition-colors">
                Games
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block" ref={searchRef}>
              <Input
                placeholder="Search tournaments..."
                className="w-64 bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => searchQuery.trim().length > 0 && setShowSuggestions(true)}
              />
              <button
                onClick={handleSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                  {suggestions.map((tournament) => (
                    <div
                      key={tournament.id}
                      onClick={() => handleSuggestionClick(tournament)}
                      className="flex items-center gap-3 p-3 hover:bg-slate-700 cursor-pointer transition-colors border-b border-slate-700 last:border-b-0"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">
                          {tournament.game === "eFootball 2026" ? "eF" : "FC"}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-white font-medium text-sm truncate">{tournament.name}</div>
                        <div className="text-gray-400 text-xs">
                          {tournament.game} • {tournament.participants}
                        </div>
                      </div>
                      <div className="text-blue-400 text-xs font-medium">{tournament.prize}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <div className="flex items-center space-x-2">
                <Link href="/tournaments/create">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Tournament
                  </Button>
                </Link>

                {isAdmin && (
                  <Link href="/admin">
                    <Button className="bg-red-600 hover:bg-red-700 text-white">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                    <DropdownMenuItem asChild className="text-gray-300 hover:text-white hover:bg-slate-700">
                      <Link href="/profile" className="flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="text-gray-300 hover:text-white hover:bg-slate-700">
                      <Link href="/my-tournaments" className="flex items-center">
                        <Trophy className="w-4 h-4 mr-2" />
                        My Tournaments
                      </Link>
                    </DropdownMenuItem>

                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem asChild className="text-red-300 hover:text-red-200 hover:bg-slate-700">
                          <Link href="/admin" className="flex items-center">
                            <Shield className="w-4 h-4 mr-2" />
                            Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator className="bg-slate-700" />
                    <DropdownMenuItem asChild>
                      <SignOutButton />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/auth/login">
                  <Button variant="ghost" className="text-gray-300 hover:text-white">
                    Log in
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">Sign up</Button>
                </Link>
              </div>
            )}

            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
