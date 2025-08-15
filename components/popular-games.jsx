import Link from "next/link"

export function PopularGames() {
  const games = [
    {
      name: "eFootball 2026",
      image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1665460/8ab1221163d79fb5cc64ce59cf96fa39f7af0d35/capsule_616x353.jpg?t=1755123708",
      players: "1.8K",
      slug: "efootball-2026", // Added slug for URL routing
    },
    {
      name: "FC Mobile",
      image: "https://wallpapercave.com/wp/wp15596619.jpg",
      players: "1.2K",
      slug: "fc-mobile", // Added slug for URL routing
    },
  ]

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Popular Games</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-2xl mx-auto">
          {games.map((game) => (
            <Link key={game.name} href={`/tournaments?game=${game.slug}`} className="group cursor-pointer">
              <div className="relative overflow-hidden rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                <img
                  src={game.image || "/placeholder.svg"}
                  alt={game.name}
                  className="w-full h-24 md:h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="p-2 md:p-3">
                  <h3 className="font-semibold text-white text-xs md:text-sm mb-1 line-clamp-2">{game.name}</h3>
                  <p className="text-xs text-gray-400">{game.players} players</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
