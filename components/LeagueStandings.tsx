"use client";

import { useState, useEffect } from "react";
import { LeagueStanding, Element, Team, ElementType, Event } from "@/types/fpl";
import TeamFormationPopup from "./TeamFormationPopup";
import CommonLineup from "./CommonLineup";
import ChipIcon from "./ChipIcon";

interface LeagueStandingsProps {
  standings: LeagueStanding[];
  leagueName: string;
  userTeamId?: number;
  userPosition?: any;
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
}

interface TeamChips {
  [teamId: number]: string | null;
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
  const [teamChips, setTeamChips] = useState<TeamChips>({});
  const [isLoadingChips, setIsLoadingChips] = useState(true);
  const [liveStandingsEnabled, setLiveStandingsEnabled] = useState(false);
  const [liveStandingsLoading, setLiveStandingsLoading] = useState(false);
  const [updatedStandings, setUpdatedStandings] = useState<LeagueStanding[]>(
    []
  );

  // Check if user is in the current standings
  const userInStandings = userTeamId
    ? standings.find((s) => s.entry === userTeamId)
    : false;
  const shouldShowUserPosition = userPosition && !userInStandings;

  // Create a combined list of all teams (standings + user position if not in standings)
  // Use updated standings if live standings is enabled, otherwise use original
  const baseStandings =
    liveStandingsEnabled && updatedStandings.length > 0
      ? updatedStandings
      : standings;
  const allTeams = [...baseStandings];
  if (shouldShowUserPosition) {
    allTeams.push(userPosition);
  }

  // Sort teams by total points (starting XI only, as original)
  const sortedTeams = [...allTeams].sort((a, b) => b.total - a.total);

  // Debug logging
  //console.log("LeagueStandings Debug:", {
  //   userTeamId,
  //   userPosition,
  //   userInStandings: !!userInStandings,
  //   shouldShowUserPosition,
  // });

  const handleTeamClick = (standing: LeagueStanding, index?: number) => {
    if (index !== undefined) {
      setSelectedTeamIndex(index);
    } else {
      // Find the index of the clicked team
      const teamIndex = sortedTeams.findIndex(
        (team) => team.entry === standing.entry
      );
      setSelectedTeamIndex(teamIndex >= 0 ? teamIndex : null);
    }
  };

  const closeTeamPopup = () => {
    setSelectedTeamIndex(null);
  };

  const navigateToNextTeam = () => {
    if (
      selectedTeamIndex !== null &&
      selectedTeamIndex < sortedTeams.length - 1
    ) {
      setSelectedTeamIndex(selectedTeamIndex + 1);
    }
  };

  const navigateToPreviousTeam = () => {
    if (selectedTeamIndex !== null && selectedTeamIndex > 0) {
      setSelectedTeamIndex(selectedTeamIndex - 1);
    }
  };

  const selectedTeam =
    selectedTeamIndex !== null ? sortedTeams[selectedTeamIndex] : null;

  // Function to sync live standings by fetching actual team picks
  const syncLiveStandings = async () => {
    setLiveStandingsLoading(true);
    try {
      const updatedStandingsList = await Promise.all(
        sortedTeams.map(async (standing) => {
          try {
            // Fetch team picks for current gameweek
            const response = await fetch(
              `/api/team/${standing.entry}/event/${currentEvent}/picks`
            );
            if (!response.ok) {
              console.error(`Failed to fetch picks for team ${standing.entry}`);
              return standing; // Return original if fetch fails
            }

            const picksData = await response.json();

            // Calculate actual GW score from picks
            let actualGwScore = 0;

            if (picksData.picks) {
              // Get starting XI (positions 1-11)
              const startingXI = picksData.picks.filter(
                (pick: any) => pick.position <= 11
              );

              // For each pick, we need to get their gameweek points
              const pickScores = await Promise.all(
                startingXI.map(async (pick: any) => {
                  try {
                    const playerResponse = await fetch(
                      `/api/player/${pick.element}/gameweeks`
                    );
                    if (!playerResponse.ok) return 0;

                    const playerData = await playerResponse.json();
                    const gwData = playerData.history?.find(
                      (gw: any) => gw.round === currentEvent
                    );

                    if (gwData) {
                      // Apply multiplier (captain = 2x, vice = 1x, regular = 1x)
                      return (gwData.total_points || 0) * pick.multiplier;
                    }
                    return 0;
                  } catch (error) {
                    console.error(
                      `Error fetching player ${pick.element}:`,
                      error
                    );
                    return 0;
                  }
                })
              );

              actualGwScore = pickScores.reduce((sum, score) => sum + score, 0);
            }

            // Check if the score differs from what's in the table
            if (actualGwScore !== standing.event_total) {
              console.log(
                `Score mismatch for ${standing.entry_name}: Table shows ${standing.event_total}, actual is ${actualGwScore}`
              );

              // Return updated standing with corrected score
              return {
                ...standing,
                event_total: actualGwScore,
                // Note: We don't update 'total' as that's the season total
              };
            }

            return standing;
          } catch (error) {
            console.error(`Error syncing team ${standing.entry}:`, error);
            return standing; // Return original on error
          }
        })
      );

      setUpdatedStandings(updatedStandingsList);
    } catch (error) {
      console.error("Error syncing live standings:", error);
    } finally {
      setLiveStandingsLoading(false);
    }
  };

  // Toggle live standings
  const handleLiveStandingsToggle = async () => {
    if (!liveStandingsEnabled) {
      // Turning on - sync the standings
      setLiveStandingsEnabled(true);
      await syncLiveStandings();
    } else {
      // Turning off - reset to original standings
      setLiveStandingsEnabled(false);
      setUpdatedStandings([]);
    }
  };

  // Fetch chips for all teams
  useEffect(() => {
    const fetchTeamChips = async () => {
      setIsLoadingChips(true);
      const chipData: TeamChips = {};

      // Create array of all team IDs to fetch
      const teamIds = [...standings.map((s) => s.entry)];
      if (shouldShowUserPosition) {
        teamIds.push(userPosition.entry);
      }

      try {
        // Fetch chips for all teams in parallel
        const chipPromises = teamIds.map(async (teamId) => {
          try {
            const response = await fetch(
              `/api/team/${teamId}/event/${currentEvent}/picks`
            );
            if (response.ok) {
              const data = await response.json();
              return { teamId, chip: data.active_chip || null };
            }
            return { teamId, chip: null };
          } catch (error) {
            console.error(`Failed to fetch chips for team ${teamId}:`, error);
            return { teamId, chip: null };
          }
        });

        const results = await Promise.all(chipPromises);

        results.forEach(({ teamId, chip }) => {
          chipData[teamId] = chip;
        });

        setTeamChips(chipData);
      } catch (error) {
        console.error("Error fetching team chips:", error);
      } finally {
        setIsLoadingChips(false);
      }
    };

    if (standings.length > 0) {
      fetchTeamChips();
    }
  }, [standings, currentEvent, shouldShowUserPosition, userPosition]);

  return (
    <div className="space-y-6">
      {/* League Standings Table */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">
          {leagueName} - Standings
        </h2>

        {/* Live Standings Toggle */}
        <div className="bg-white p-4 rounded-lg shadow-md mt-4 border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Live League Standings</h3>
              <p className="text-sm text-gray-600">
                Sync GW scores with live team data
              </p>
            </div>
            <div className="flex items-center gap-3">
              {liveStandingsLoading && (
                <span className="text-sm text-gray-500">Syncing...</span>
              )}
              <button
                onClick={handleLiveStandingsToggle}
                disabled={liveStandingsLoading}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                  liveStandingsEnabled ? "bg-green-600" : "bg-gray-300"
                } ${
                  liveStandingsLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-gray-500 transition-transform ${
                    liveStandingsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-black">
                {liveStandingsEnabled ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-spacing-x-[50%] text-center overflow-x-hidden">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-1 md:px-3">Rank</th>
                <th className="text-center py-2 px-1 md:px-3 border-l">Team</th>
                <th className="text-center py-2 px-1 md:px-3 border-l hidden md:table-cell">
                  Manager
                </th>
                <th className="text-center py-2 px-1 md:px-3 border-l">GW</th>
                <th className="text-center py-2 px-1 md:px-3 border-l">
                  Total
                </th>
                <th className="text-center py-2 px-1 md:px-3 border-l hidden md:table-cell">
                  Chip
                </th>
                <th className="text-center py-2 px-1 md:px-3 border-l hidden md:table-cell">
                  Movement
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((standing, index) => {
                const isUserTeam = userTeamId === standing.entry;
                const movement = standing.last_rank - (index + 1);
                const activeChip = teamChips[standing.entry];

                return (
                  <tr
                    key={standing.entry}
                    onClick={() => handleTeamClick(standing, index)}
                    className={`border-b hover:bg-gray-50 cursor-pointer transition-colors h-12 ${
                      isUserTeam ? "bg-blue-50 font-semibold" : ""
                    }`}
                  >
                    <td className="py-2 px-1 md:py-3 md:px-3">{index + 1}</td>
                    <td className="py-2 px-1 md:py-3 md:px-3 text-blue-600 hover:text-blue-800 font-medium border-l text-xs md:text-sm">
                      {standing.entry_name}
                    </td>
                    <td className="py-2 px-1 md:py-3 md:px-3 border-l hidden md:table-cell">
                      {standing.player_name}
                    </td>
                    <td className="py-2 px-1 md:py-3 md:px-3 text-center border-l">
                      {standing.event_total}
                    </td>
                    <td className="py-2 px-1 md:py-3 md:px-3 text-center font-semibold border-l">
                      {standing.total}
                    </td>
                    <td
                      className="py-2 px-1 md:py-3 md:px-3 text-center border-l hidden md:table-cell relative overflow-visible"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isLoadingChips ? (
                        <span className="text-gray-400 text-xs">...</span>
                      ) : activeChip ? (
                        <ChipIcon chip={activeChip} />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-2 px-1 md:py-3 md:px-3 text-center border-l hidden md:table-cell">
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
              className={`px-4 py-2 rounded-md transition-all ${
                showCommonLineup
                  ? "bg-gradient-to-r from-cyan-500 via-green-500 to-purple-500 text-white"
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
          totalTeams={sortedTeams.length}
          onNavigateNext={navigateToNextTeam}
          onNavigatePrevious={navigateToPreviousTeam}
          canNavigateNext={selectedTeamIndex < sortedTeams.length - 1}
          canNavigatePrevious={selectedTeamIndex > 0}
          // Add standing data
          standingData={selectedTeam}
        />
      )}
    </div>
  );
}
