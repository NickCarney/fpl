"use client";

import { LeagueStanding } from "@/types/fpl";

interface LeagueStandingsProps {
  standings: LeagueStanding[];
  leagueName: string;
  userTeamId?: number;
}

export default function LeagueStandings({
  standings,
  leagueName,
  userTeamId,
}: LeagueStandingsProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">{leagueName} - Standings</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Rank</th>
              <th className="text-left py-2">Team</th>
              <th className="text-left py-2">Manager</th>
              <th className="text-right py-2">GW Points</th>
              <th className="text-right py-2">Total</th>
              <th className="text-center py-2">Movement</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => {
              const isUserTeam = userTeamId === standing.entry;
              const movement = standing.last_rank - standing.rank;

              return (
                <tr
                  key={standing.entry}
                  className={`border-b hover:bg-gray-50 ${
                    isUserTeam ? "bg-blue-50 font-semibold" : ""
                  }`}
                >
                  <td className="py-3">{standing.rank}</td>
                  <td className="py-3">{standing.entry_name}</td>
                  <td className="py-3">{standing.player_name}</td>
                  <td className="py-3 text-right">{standing.event_total}</td>
                  <td className="py-3 text-right font-semibold">
                    {standing.total}
                  </td>
                  <td className="py-3 text-center">
                    {movement > 0 && (
                      <span className="text-green-600 text-xs">
                        ↑ {movement}
                      </span>
                    )}
                    {movement < 0 && (
                      <span className="text-red-600 text-xs">
                        ↓ {Math.abs(movement)}
                      </span>
                    )}
                    {movement === 0 && (
                      <span className="text-gray-500 text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {standings.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No standings data available
        </div>
      )}
    </div>
  );
}
