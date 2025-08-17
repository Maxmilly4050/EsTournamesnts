import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { PopularGames } from "@/components/popular-games"
import { TournamentSection } from "@/components/tournament-section"
import { Footer } from "@/components/footer"
import { Suspense } from "react"

function TournamentSectionSkeleton() {
  return (
    <section className="py-12 px-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-48 bg-slate-700 rounded animate-pulse"></div>
          <div className="h-10 w-32 bg-slate-700 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-lg overflow-hidden">
              <div className="h-32 md:h-48 bg-slate-700 animate-pulse"></div>
              <div className="p-3 md:p-4">
                <div className="h-4 bg-slate-700 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-slate-700 rounded animate-pulse mb-2 w-3/4"></div>
                <div className="h-3 bg-slate-700 rounded animate-pulse mb-3 w-1/2"></div>
                <div className="flex justify-between">
                  <div className="h-8 w-16 bg-slate-700 rounded animate-pulse"></div>
                  <div className="h-3 w-20 bg-slate-700 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Header />
      <main>
        <HeroSection />
        <PopularGames />
        <Suspense fallback={<TournamentSectionSkeleton />}>
          <TournamentSection title="Upcoming tournaments" status="upcoming" />
        </Suspense>
        <Suspense fallback={<TournamentSectionSkeleton />}>
          <TournamentSection title="Ongoing tournaments" status="ongoing" />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
