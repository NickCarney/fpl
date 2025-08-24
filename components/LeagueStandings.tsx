"use client";

import { useState } from "react";
import { LeagueStanding, Element, Team, ElementType, Event } from "@/types/fpl";
import TeamFormationPopup from "./TeamFormationPopup";
import CommonLineup from "./CommonLineup";

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
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(
    null
  );
  const [showCommonLineup, setShowCommonLineup] = useState(true);

  // Check if user is in the current standings
  const userInStandings = userTeamId
    ? standings.find((s) => s.entry === userTeamId)
    : false;
  const shouldShowUserPosition = userPosition && !userInStandings;

  // Create a combined list of all teams (standings + user position if not in standings)
  const allTeams = [...standings];
  if (shouldShowUserPosition) {
    allTeams.push(userPosition);
  }

  // Debug logging
  console.log("LeagueStandings Debug:", {
    userTeamId,
    userPosition,
    userInStandings: !!userInStandings,
    shouldShowUserPosition,
  });

  const handleTeamClick = (standing: LeagueStanding, index?: number) => {
    if (index !== undefined) {
      setSelectedTeamIndex(index);
    } else {
      // Find the index of the clicked team
      const teamIndex = allTeams.findIndex(
        (team) => team.entry === standing.entry
      );
      setSelectedTeamIndex(teamIndex >= 0 ? teamIndex : null);
    }
  };

  const closeTeamPopup = () => {
    setSelectedTeamIndex(null);
  };

  const navigateToNextTeam = () => {
    if (selectedTeamIndex !== null && selectedTeamIndex < allTeams.length - 1) {
      setSelectedTeamIndex(selectedTeamIndex + 1);
    }
  };

  const navigateToPreviousTeam = () => {
    if (selectedTeamIndex !== null && selectedTeamIndex > 0) {
      setSelectedTeamIndex(selectedTeamIndex - 1);
    }
  };

  const selectedTeam =
    selectedTeamIndex !== null ? allTeams[selectedTeamIndex] : null;

  return (
    <div className="space-y-6">
      {/* League Standings Table */}
      <div className="bg-white p-6 rounded-lg shadow-md">
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
              {standings.map((standing, index) => {
                const isUserTeam = userTeamId === standing.entry;
                const movement = standing.last_rank - standing.rank;

                return (
                  <tr
                    key={standing.entry}
                    onClick={() => handleTeamClick(standing, index)}
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
                    onClick={() =>
                      handleTeamClick(userPosition, standings.length)
                    }
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
        {/* Toggle for Common Lineup */}
        <div className="bg-white p-4 rounded-lg shadow-md mt-4 border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">League Analysis</h3>
              <p className="text-sm text-gray-600">
                View most popular players among top performers
              </p>
            </div>
            <button
              onClick={() => setShowCommonLineup(!showCommonLineup)}
              className={`px-4 py-2 rounded-md transition-colors ${
                showCommonLineup
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {showCommonLineup ? "Hide Analysis" : "Show Analysis"}
            </button>
          </div>
        </div>

        {/* Common Lineup Analysis */}
        {showCommonLineup && (
          <CommonLineup
            standings={standings}
            elements={elements}
            teams={teams}
            elementTypes={elementTypes}
            currentEvent={currentEvent}
            events={events}
          />
        )}

        {standings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No standings data available
          </div>
        )}

        {/* Help text */}
        <div className="mt-4 text-center text-sm text-gray-500">
          Click on any team name to view their formation and squad
        </div>
      </div>

      {/* Team Formation Popup */}
      {selectedTeam && selectedTeamIndex !== null && (
        <TeamFormationPopup
          teamId={selectedTeam.entry}
          teamName={selectedTeam.entry_name}
          managerName={selectedTeam.player_name}
          elements={elements}
          teams={teams}
          elementTypes={elementTypes}
          currentEvent={currentEvent}
          events={events}
          isOpen={!!selectedTeam}
          onClose={closeTeamPopup}
          // Navigation props
          currentIndex={selectedTeamIndex}
          totalTeams={allTeams.length}
          onNavigateNext={navigateToNextTeam}
          onNavigatePrevious={navigateToPreviousTeam}
          canNavigateNext={selectedTeamIndex < allTeams.length - 1}
          canNavigatePrevious={selectedTeamIndex > 0}
        />
      )}
    </div>
  );
}
