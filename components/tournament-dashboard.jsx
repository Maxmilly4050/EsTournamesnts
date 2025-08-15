import { CheckCircle, XCircle, AlertTriangle, Clock, Trophy, Flag, Eye, MessageSquare, BarChart3 } from "lucide-react"

export function TournamentDashboard({ tournament, matchResults, disputes, user }) {
  return (
    <div className="space-y-8">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{tournament.title}</h1>
            <p className="text-slate-400">Tournament Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm border ${
                tournament.status === "active"
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : tournament.status === "completed"
                    ? "bg-gray-500/20 text-gray-400 border-gray-500/30"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30"
              }`}
            >
              {tournament.status || "Draft"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold text-white">Tournament Info</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Game:</span>
                <span className="text-white">{tournament.game}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Participants:</span>
                <span className="text-white">
                  {tournament.current_participants || 0}/{tournament.max_participants}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Format:</span>
                <span className="text-white">{tournament.tournament_type || "Single Elimination"}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Match Results</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Pending:</span>
                <span className="text-yellow-400">{matchResults.filter((r) => r.status === "pending").length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Approved:</span>
                <span className="text-green-400">{matchResults.filter((r) => r.status === "approved").length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Disputed:</span>
                <span className="text-red-400">{disputes.filter((d) => d.status === "open").length}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold text-white">Recent Activity</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="text-slate-300">
                {matchResults.length > 0 ? `${matchResults.length} match results submitted` : "No recent activity"}
              </div>
              <div className="text-slate-300">
                {disputes.length > 0 ? `${disputes.length} disputes filed` : "No disputes"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {matchResults.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Pending Match Results</h2>
          <div className="space-y-4">
            {matchResults
              .filter((result) => result.status === "pending")
              .map((result) => (
                <div key={result.id} className="bg-slate-700/30 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-white">
                        Round {result.matches?.round} - Match {result.matches?.match_number}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {result.matches?.player1?.username} vs {result.matches?.player2?.username}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Approve
                      </button>
                      <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                        <XCircle className="w-4 h-4 inline mr-1" />
                        Reject
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-300">
                    Winner: {result.winner_profile?.username} | Score: {result.player1_score}-{result.player2_score}
                  </div>
                  {result.screenshot_url && (
                    <div className="mt-2">
                      <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        View Screenshot
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {disputes.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Active Disputes</h2>
          <div className="space-y-4">
            {disputes
              .filter((dispute) => dispute.status === "open")
              .map((dispute) => (
                <div key={dispute.id} className="bg-slate-700/30 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-white flex items-center gap-2">
                        <Flag className="w-4 h-4 text-red-400" />
                        Round {dispute.matches?.round} - Match {dispute.matches?.match_number}
                      </h3>
                      <p className="text-slate-400 text-sm">Disputed by {dispute.disputed_by_profile?.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                        <MessageSquare className="w-4 h-4 inline mr-1" />
                        Resolve
                      </button>
                      <button className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        Escalate
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-300">Reason: {dispute.reason}</div>
                  {dispute.evidence_url && (
                    <div className="mt-2">
                      <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        View Evidence
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TournamentDashboard
