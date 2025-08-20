"use client";

import { useState } from "react";
import { LeagueStanding, Element, Team, ElementType, Event } from "@/types/fpl";
import TeamFormationPopup from "./TeamFormationPopup";

interface LeagueStandingsProps {
  standings: LeagueStanding[];
  leagueName: string;
  userTeamId?: number;
  userPosition?: any; // Changed from LeagueStanding to any since we're using userStats
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
}

export default function LeagueStandings({
  standings,
  leagueName,
  userTeamId,
  userPosition,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
}: LeagueStandingsProps) {
  const [selectedTeam, setSelectedTeam] = useState<{
    teamId: number;
    teamName: string;
    managerName: string;
  } | null>(null);
  // Check if user is in the current standings
  const userInStandings = userTeamId
    ? standings.find((s) => s.entry === userTeamId)
    : false;
  const shouldShowUserPosition = userPosition && !userInStandings;

  // Debug logging
  console.log("LeagueStandings Debug:", {
    userTeamId,
    userPosition,
    userInStandings: !!userInStandings,
    shouldShowUserPosition,
  });

  const handleTeamClick = (standing: LeagueStanding) => {
    setSelectedTeam({
      teamId: standing.entry,
      teamName: standing.entry_name,
      managerName: standing.player_name,
    });
  };

  const closeTeamPopup = () => {
    setSelectedTeam(null);
  };

  return (
    <div className=" p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {leagueName} - Standings
      </h2>

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
                  onClick={() => handleTeamClick(standing)}
                  className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                    isUserTeam ? "bg-blue-50 font-semibold" : ""
                  }`}
                >
                  <td className="py-3">{standing.rank}</td>
                  <td className="py-3 text-blue-600 hover:text-blue-800 font-medium">
                    {standing.entry_name}
                  </td>
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
                    {movement === 0 && <span className=" text-xs">-</span>}
                  </td>
                </tr>
              );
            })}

            {/* Show user position if they're not in the top results */}
            {shouldShowUserPosition && (
              <>
                <tr
                  className="border-b font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleTeamClick(userPosition)}
                >
                  <td className="py-3 font-normal">You</td>
                  <td className="py-3 text-blue-600 hover:text-blue-800 font-medium">
                    {userPosition.entry_name}
                  </td>
                  <td className="py-3">{userPosition.player_name}</td>
                  <td className="py-3 text-right">
                    {userPosition.event_total}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {userPosition.total}
                  </td>
                  <td className="py-3 text-center text-gray-500">-</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {standings.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No standings data available
        </div>
      )}

      {/* Help text */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Click on any team name to view their formation and squad
      </div>

      {/* Team Formation Popup */}
      {selectedTeam && (
        <TeamFormationPopup
          teamId={selectedTeam.teamId}
          teamName={selectedTeam.teamName}
          managerName={selectedTeam.managerName}
          elements={elements}
          teams={teams}
          elementTypes={elementTypes}
          currentEvent={currentEvent}
          events={events}
          isOpen={!!selectedTeam}
          onClose={closeTeamPopup}
        />
      )}
    </div>
  );
}
