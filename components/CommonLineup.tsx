"use client";

import { useState, useEffect } from "react";
import {
  Element,
  Team,
  ElementType,
  Event,
  LeagueStanding,
  Pick,
} from "@/types/fpl";
import { getTeamPicks } from "@/lib/fpl-api";
import PlayerDetailPopup from "./PlayerDetailPopup";

interface CommonLineupProps {
  standings: LeagueStanding[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
}

interface PlayerCount {
  element: Element;
  count: number;
  percentage: number;
  teams: string[];
}

interface CommonLineupData {
  goalkeepers: PlayerCount[];
  defenders: PlayerCount[];
  midfielders: PlayerCount[];
  forwards: PlayerCount[];
  totalTeamsAnalyzed: number;
}

export default function CommonLineup({
  standings,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
}: CommonLineupProps) {
  const [commonLineup, setCommonLineup] = useState<CommonLineupData | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    element: Element;
    team: Team;
    position: ElementType;
  } | null>(null);

  useEffect(() => {
    if (standings.length > 0) {
      analyzeCommonLineup();
    }
  }, [standings, currentEvent]);

  const analyzeCommonLineup = async () => {
    setLoading(true);
    try {
      // Calculate how many teams to analyze (top half, max 24)
      const totalTeams = standings.length;
      const teamsToAnalyze = Math.min(24, Math.ceil(totalTeams / 2));
      const topTeams = standings.slice(0, teamsToAnalyze);

      console.log(
        `Analyzing ${teamsToAnalyze} teams out of ${totalTeams} total teams`
      );

      // Fetch all team picks
      const teamPicksPromises = topTeams.map((team) =>
        getTeamPicks(team.entry, currentEvent).catch((error) => {
          console.error(`Failed to fetch picks for team ${team.entry}:`, error);
          return null;
        })
      );

      const allTeamPicks = await Promise.all(teamPicksPromises);
      const validTeamPicks = allTeamPicks.filter((picks) => picks !== null);

      console.log(
        `Successfully fetched picks for ${validTeamPicks.length} teams`
      );

      // Count player occurrences
      const playerCounts = new Map<
        number,
        { count: number; teams: string[] }
      >();

      validTeamPicks.forEach((teamPicks, index) => {
        if (!teamPicks) return;

        const teamName = topTeams[index]?.entry_name || `Team ${index + 1}`;

        teamPicks.picks.forEach((pick: Pick) => {
          if (!playerCounts.has(pick.element)) {
            playerCounts.set(pick.element, { count: 0, teams: [] });
          }
          const current = playerCounts.get(pick.element)!;
          current.count++;
          current.teams.push(teamName);
        });
      });

      // Group by position and sort by count
      const groupedPlayers = {
        1: [] as PlayerCount[], // Goalkeepers
        2: [] as PlayerCount[], // Defenders
        3: [] as PlayerCount[], // Midfielders
        4: [] as PlayerCount[], // Forwards
      };

      playerCounts.forEach((data, elementId) => {
        const element = elements.find((el) => el.id === elementId);
        if (!element) return;

        const playerCount: PlayerCount = {
          element,
          count: data.count,
          percentage: (data.count / validTeamPicks.length) * 100,
          teams: data.teams,
        };

        groupedPlayers[
          element.element_type as keyof typeof groupedPlayers
        ].push(playerCount);
      });

      // Sort each position by count (descending)
      Object.keys(groupedPlayers).forEach((pos) => {
        groupedPlayers[pos as unknown as keyof typeof groupedPlayers].sort(
          (a, b) => b.count - a.count
        );
      });

      setCommonLineup({
        goalkeepers: groupedPlayers[1].slice(0, 2), // Top 2 goalkeepers
        defenders: groupedPlayers[2].slice(0, 5), // Top 5 defenders
        midfielders: groupedPlayers[3].slice(0, 5), // Top 5 midfielders
        forwards: groupedPlayers[4].slice(0, 3), // Top 3 forwards
        totalTeamsAnalyzed: validTeamPicks.length,
      });
    } catch (error) {
      console.error("Error analyzing common lineup:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  const handlePlayerClick = (playerCount: PlayerCount) => {
    const team = getTeam(playerCount.element.team);
    const position = getPosition(playerCount.element.element_type);

    if (team && position) {
      setSelectedPlayer({
        element: playerCount.element,
        team,
        position,
      });
    }
  };

  const closePlayerPopup = () => {
    setSelectedPlayer(null);
  };

  const renderPlayer = (
    playerCount: PlayerCount,
    showCount: boolean = true
  ) => {
    const { element, count, percentage } = playerCount;
    const team = getTeam(element.team);
    const position = getPosition(element.element_type);

    return (
      <div
        key={element.id}
        onClick={() => handlePlayerClick(playerCount)}
        className="relative flex flex-col p-3 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg cursor-pointer w-28 h-36 overflow-y-auto bg-white border-purple-300 scrolly"
      >
        {/* Popularity indicator */}
        <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
          {count}
        </div>

        {/* Player Name and Team */}
        <div className="text-center mb-2">
          <h3 className="font-semibold text-sm leading-tight">
            {element.web_name}
          </h3>
          <p className="text-xs text-gray-600">
            {team?.short_name} - {position?.singular_name_short}
          </p>
        </div>

        {/* Stats */}
        <div className="text-center mb-2">
          <p className="text-sm font-bold text-green-700">
            {element.total_points}pts
          </p>
          <p className="text-xs text-gray-600">
            £{(element.now_cost / 10).toFixed(1)}m
          </p>
        </div>

        {/* Popularity percentage */}
        <div className="text-center text-xs text-purple-600 mb-2">
          <div className="font-semibold">{percentage.toFixed(0)}% owned</div>
          <div>Form: {element.form}</div>
        </div>

        {/* Show teams that own this player (truncated) */}
        <div className="text-center text-xs text-gray-500 mb-1">
          {showCount && playerCount.teams.length > 0 && (
            <div title={`Owned by: ${playerCount.teams.join(", ")}`}>
              {playerCount.teams.length > 2
                ? `${playerCount.teams.slice(0, 2).join(", ")} +${
                    playerCount.teams.length - 2
                  } more`
                : playerCount.teams.join(", ")}
            </div>
          )}
        </div>

        {/* Ownership indicator bar */}
        <div className="mt-auto">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full"
              style={{ width: `${Math.min(100, percentage)}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-bold mb-4 text-center">
          Common Lineup Analysis
        </h2>
        <div className="flex justify-center items-center h-40">
          <div className="text-lg">Analyzing top teams...</div>
        </div>
      </div>
    );
  }

  if (!commonLineup) {
    return null;
  }

  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Common Lineup Analysis</h2>
          <p className="text-gray-600">
            Most popular players among the top {commonLineup.totalTeamsAnalyzed}{" "}
            teams
          </p>
          <p className="text-sm text-gray-500">
            Click on any player to see detailed stats
          </p>
        </div>

        {/* Formation View */}
        <div className="bg-gradient-to-b from-green-400 to-green-500 p-6 rounded-lg relative overflow-hidden">
          {/* Center circle and markings */}
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/30 rounded-full"></div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-8 border-2 border-white/30 border-t-0 rounded-b-lg"></div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-8 border-2 border-white/30 border-b-0 rounded-t-lg"></div>
          </div>

          {/* Players positioned in formation */}
          <div className="relative z-10 space-y-8">
            {/* Forwards */}
            {commonLineup.forwards.length > 0 && (
              <div className="flex justify-center gap-4">
                {commonLineup.forwards.map((playerCount) =>
                  renderPlayer(playerCount)
                )}
              </div>
            )}

            {/* Midfielders */}
            {commonLineup.midfielders.length > 0 && (
              <div className="flex justify-center gap-4">
                {commonLineup.midfielders.map((playerCount) =>
                  renderPlayer(playerCount)
                )}
              </div>
            )}

            {/* Defenders */}
            {commonLineup.defenders.length > 0 && (
              <div className="flex justify-center gap-4">
                {commonLineup.defenders.map((playerCount) =>
                  renderPlayer(playerCount)
                )}
              </div>
            )}

            {/* Goalkeepers */}
            {commonLineup.goalkeepers.length > 0 && (
              <div className="flex justify-center gap-4">
                {commonLineup.goalkeepers.map((playerCount) =>
                  renderPlayer(playerCount)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
            <span>Number = teams owning player</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 bg-purple-500 rounded"></div>
            <span>Bar = ownership percentage</span>
          </div>
        </div>

        {/* Additional Insights */}
        <div className="mt-6 bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-800 mb-3">Key Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-purple-700">
                Most Popular Pick:
              </div>
              <div className="text-gray-700">
                {(() => {
                  const allPlayers = [
                    ...commonLineup.goalkeepers,
                    ...commonLineup.defenders,
                    ...commonLineup.midfielders,
                    ...commonLineup.forwards,
                  ].sort((a, b) => b.percentage - a.percentage);
                  const top = allPlayers[0];
                  return top
                    ? `${top.element.web_name} (${top.percentage.toFixed(0)}%)`
                    : "N/A";
                })()}
              </div>
            </div>
            <div>
              <div className="font-medium text-purple-700">
                Average Ownership:
              </div>
              <div className="text-gray-700">
                {(() => {
                  const allPlayers = [
                    ...commonLineup.goalkeepers,
                    ...commonLineup.defenders,
                    ...commonLineup.midfielders,
                    ...commonLineup.forwards,
                  ];
                  const avgOwnership =
                    allPlayers.reduce((sum, p) => sum + p.percentage, 0) /
                    allPlayers.length;
                  return `${avgOwnership.toFixed(0)}%`;
                })()}
              </div>
            </div>
            <div>
              <div className="font-medium text-purple-700">
                Total Squad Value:
              </div>
              <div className="text-gray-700">
                £
                {(() => {
                  const totalValue =
                    [
                      ...commonLineup.goalkeepers,
                      ...commonLineup.defenders,
                      ...commonLineup.midfielders,
                      ...commonLineup.forwards,
                    ].reduce((sum, p) => sum + p.element.now_cost, 0) / 10;
                  return totalValue.toFixed(1);
                })()}
                m
              </div>
            </div>
            <div>
              <div className="font-medium text-purple-700">
                Consensus Level:
              </div>
              <div className="text-gray-700">
                {(() => {
                  const allPlayers = [
                    ...commonLineup.goalkeepers,
                    ...commonLineup.defenders,
                    ...commonLineup.midfielders,
                    ...commonLineup.forwards,
                  ];
                  const avgOwnership =
                    allPlayers.reduce((sum, p) => sum + p.percentage, 0) /
                    allPlayers.length;
                  return avgOwnership > 70
                    ? "High"
                    : avgOwnership > 40
                    ? "Medium"
                    : "Low";
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Detail Popup */}
      {selectedPlayer && (
        <PlayerDetailPopup
          player={selectedPlayer.element}
          team={selectedPlayer.team}
          position={selectedPlayer.position}
          teams={teams}
          isOpen={!!selectedPlayer}
          onClose={closePlayerPopup}
        />
      )}
    </>
  );
}
