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
  const [liveGameweekData, setLiveGameweekData] = useState<any>(null);

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

  // Only add user position if they're not already in the standings
  if (shouldShowUserPosition) {
    // Check if user is already in baseStandings (could be in updatedStandings after sync)
    const userAlreadyInStandings = baseStandings.some(
      (s) => s.entry === userPosition.entry
    );
    if (!userAlreadyInStandings) {
      allTeams.push(userPosition);
    }
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
  // Fetch live gameweek data for bonus calculations
  useEffect(() => {
    const fetchLiveData = async () => {
      if (liveStandingsEnabled) {
        try {
          const response = await fetch(`/api/event/${currentEvent}/live`);
          const data = await response.json();
          setLiveGameweekData(data);
        } catch (error) {
          console.error("Error fetching live gameweek data:", error);
        }
      }
    };

    fetchLiveData();
  }, [liveStandingsEnabled, currentEvent]);

  // Calculate predicted bonus points based on ALL players in each fixture
  const calculatePredictedBonus = () => {
    if (!liveGameweekData || !liveGameweekData.elements) {
      return {};
    }

    const bonusPredictions: { [playerId: number]: number } = {};

    // Group ALL players in the game by fixture (not just team's players)
    const fixtureGroups: { [fixtureId: number]: Array<{ id: number; bps: number; bonus: number; minutes: number }> } = {};
    const fixtureHasBonus: { [fixtureId: number]: boolean } = {};

    // Build fixture groups from ALL players in the live data
    liveGameweekData.elements.forEach((playerLiveData: any) => {
      if (playerLiveData.explain && playerLiveData.explain.length > 0) {
        const fixtureId = playerLiveData.explain[0].fixture;
        const bps = playerLiveData.stats.bps || 0;
        const bonus = playerLiveData.stats.bonus || 0;
        const minutes = playerLiveData.stats.minutes || 0;

        // Track if any player in this fixture has bonus awarded
        if (bonus > 0) {
          fixtureHasBonus[fixtureId] = true;
        }

        // Collect all players who played (we'll filter later)
        if (minutes > 0) {
          if (!fixtureGroups[fixtureId]) {
            fixtureGroups[fixtureId] = [];
          }
          fixtureGroups[fixtureId].push({
            id: playerLiveData.id,
            bps,
            bonus,
            minutes
          });
        }
      }
    });

    // Calculate bonus for each fixture - only if bonus hasn't been awarded yet
    Object.entries(fixtureGroups).forEach(([fixtureId, players]) => {
      // Skip this fixture if bonus has already been awarded
      if (fixtureHasBonus[Number(fixtureId)]) {
        return;
      }
      // Sort by BPS descending
      const sortedPlayers = players.sort((a, b) => b.bps - a.bps);

      if (sortedPlayers.length === 0) return;

      // Find top BPS value(s) - 3 bonus points
      const topBPS = sortedPlayers[0].bps;
      if (topBPS === 0) return; // No bonus if no BPS

      const topPlayers = sortedPlayers.filter(p => p.bps === topBPS);
      topPlayers.forEach(p => {
        bonusPredictions[p.id] = 3;
      });

      // Find second highest BPS value(s) - 2 bonus points
      const remainingAfterTop = sortedPlayers.filter(p => p.bps < topBPS);
      if (remainingAfterTop.length > 0) {
        const secondBPS = remainingAfterTop[0].bps;
        if (secondBPS > 0) {
          const secondPlayers = remainingAfterTop.filter(p => p.bps === secondBPS);
          secondPlayers.forEach(p => {
            bonusPredictions[p.id] = 2;
          });

          // Find third highest BPS value(s) - 1 bonus point
          const remainingAfterSecond = remainingAfterTop.filter(p => p.bps < secondBPS);
          if (remainingAfterSecond.length > 0) {
            const thirdBPS = remainingAfterSecond[0].bps;
            if (thirdBPS > 0) {
              const thirdPlayers = remainingAfterSecond.filter(p => p.bps === thirdBPS);
              thirdPlayers.forEach(p => {
                bonusPredictions[p.id] = 1;
              });
            }
          }
        }
      }
    });

    return bonusPredictions;
  };

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

            // Calculate actual GW score from picks with substitutions
            let actualGwScore = 0;

            // Check if bench boost chip is active
            const isBenchBoost = picksData.active_chip === "bboost";

            if (picksData.picks) {
              // Calculate bonus predictions based on ALL players in the game
              const bonusPredictions = calculatePredictedBonus();

              // Fetch all player data (starting XI + bench) in parallel
              const allPlayerData = await Promise.all(
                picksData.picks.map(async (pick: any) => {
                  try {
                    const playerResponse = await fetch(
                      `/api/player/${pick.element}/gameweeks`
                    );
                    if (!playerResponse.ok) return null;

                    const playerData = await playerResponse.json();
                    const gwData = playerData.history?.find(
                      (gw: any) => gw.round === currentEvent
                    );

                    // Find player element type from elements array
                    const playerInfo = elements.find(
                      (el) => el.id === pick.element
                    );

                    return {
                      pick,
                      gwData,
                      elementType: playerInfo?.element_type,
                      didNotPlay: gwData ? gwData.minutes === 0 : true,
                    };
                  } catch (error) {
                    console.error(
                      `Error fetching player ${pick.element}:`,
                      error
                    );
                    return null;
                  }
                })
              );

              // Filter out nulls and separate starting XI and bench with their data
              const startingXIData = allPlayerData
                .filter((data) => data && data.pick.position <= 11)
                .map((data) => data!);

              const benchData = allPlayerData
                .filter((data) => data && data.pick.position > 11)
                .map((data) => data!)
                .sort((a, b) => a.pick.position - b.pick.position); // Sort by bench order

              // If bench boost is active, count all players
              if (isBenchBoost) {
                actualGwScore = allPlayerData
                  .filter((data) => data !== null)
                  .reduce((sum, data) => {
                    if (data!.gwData) {
                      // Use multiplier if > 0, otherwise use 1 (for bench players)
                      const multiplier = data!.pick.multiplier > 0 ? data!.pick.multiplier : 1;
                      const currentBonus = data!.gwData.bonus || 0;
                      const predictedBonus = (currentBonus === 0) ? (bonusPredictions[data!.pick.element] || 0) : 0;
                      return sum + (data!.gwData.total_points + predictedBonus) * multiplier;
                    }
                    return sum;
                  }, 0);
              } else {
                // Process automatic substitutions for non-bench boost teams
                let finalLineup = [...startingXIData];

                // Handle goalkeeper substitutions (position 1)
                const gkData = startingXIData.find(
                  (data) => data.pick.position === 1
                );
                if (gkData && gkData.didNotPlay) {
                  // Find backup GK on bench (element_type 1 = GK)
                  const backupGK = benchData.find(
                    (data) => data.elementType === 1
                  );
                  if (backupGK && !backupGK.didNotPlay) {
                    // Swap GK
                    finalLineup = finalLineup.map((data) =>
                      data.pick.position === 1 ? backupGK : data
                    );
                  }
                }

                // Handle outfield player substitutions
                // Element types: 1=GK, 2=DEF, 3=MID, 4=FWD
                const outfieldStarters = finalLineup.filter(
                  (data) => data.pick.position > 1
                );

                // Find DNP outfield players
                const dnpPlayers = outfieldStarters.filter(
                  (data) => data.didNotPlay
                );

                // Get available outfield subs (not GK, not already subbed in, and actually played)
                const availableSubs = benchData.filter(
                  (data) =>
                    data.elementType !== 1 &&
                    !data.didNotPlay &&
                    !finalLineup.some((starter) => starter.pick.element === data.pick.element)
                );

                // Process substitutions in bench order
                for (const sub of availableSubs) {
                  if (dnpPlayers.length === 0) break;

                  // Check if we can make this substitution while maintaining formation rules
                  // Must have at least: 3 DEF, 3 MID, 1 FWD
                  for (let i = 0; i < dnpPlayers.length; i++) {
                    const dnpPlayer = dnpPlayers[i];

                    // Try substitution
                    const testLineup = finalLineup.map((data) =>
                      data.pick.element === dnpPlayer.pick.element ? sub : data
                    );

                    // Count positions in test lineup (excluding GK)
                    const outfieldTestLineup = testLineup.filter(
                      (data) => data.pick.position > 1 || data.elementType !== 1
                    );
                    const defCount = outfieldTestLineup.filter(
                      (data) => data.elementType === 2
                    ).length;
                    const midCount = outfieldTestLineup.filter(
                      (data) => data.elementType === 3
                    ).length;
                    const fwdCount = outfieldTestLineup.filter(
                      (data) => data.elementType === 4
                    ).length;

                    // Check formation rules
                    if (defCount >= 3 && midCount >= 3 && fwdCount >= 1) {
                      // Valid substitution
                      finalLineup = testLineup;
                      dnpPlayers.splice(i, 1);
                      break; // Move to next sub
                    }
                  }
                }

                // Calculate score from final lineup
                actualGwScore = finalLineup.reduce((sum, data) => {
                  if (data.gwData) {
                    // Use multiplier if > 0, otherwise use 1 (for subbed-in players from bench)
                    const multiplier = data.pick.multiplier > 0 ? data.pick.multiplier : 1;
                    const currentBonus = data.gwData.bonus || 0;
                    const predictedBonus = (currentBonus === 0) ? (bonusPredictions[data.pick.element] || 0) : 0;
                    return sum + (data.gwData.total_points + predictedBonus) * multiplier;
                  }
                  return sum;
                }, 0);
              }
            }

            // Check if the score differs from what's in the table
            if (actualGwScore !== standing.event_total) {
              console.log(
                `Score mismatch for ${standing.entry_name}: Table shows ${standing.event_total}, actual is ${actualGwScore}`
              );

              // Return updated standing with corrected score
              return {
                ...standing,
                total: standing.total + actualGwScore - standing.event_total,
                event_total: actualGwScore,
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
                // Use standing.rank for proper rank display, fallback to index + 1 if not available
                const displayRank = standing.rank;
                const movement = standing.last_rank - displayRank;
                const activeChip = teamChips[standing.entry];

                return (
                  <tr
                    key={`${standing.entry}-${index}`}
                    onClick={() => handleTeamClick(standing, index)}
                    className={`border-b hover:bg-gray-50 cursor-pointer transition-colors h-12 ${
                      isUserTeam ? "bg-blue-50 font-semibold" : ""
                    }`}
                  >
                    <td className="py-2 px-1 md:py-3 md:px-3">{displayRank}</td>
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
          // Live standings
          liveStandingsEnabled={liveStandingsEnabled}
        />
      )}
    </div>
  );
}
