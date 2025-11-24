"use client";

import { useState, useEffect } from "react";
import Popup from "reactjs-popup";
import {
  Element,
  Team,
  ElementType,
  Pick,
  TeamPicks,
  Event,
} from "@/types/fpl";
import { getTeamPicks } from "@/lib/fpl-api";
import PlayerDetailPopup from "./PlayerDetailPopup";
import PointsBreakdownModal from "./PointsBreakdownModal";

interface TeamFormationPopupProps {
  teamId: number;
  teamName: string;
  managerName: string;
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
  isOpen: boolean;
  onClose: () => void;

  // Navigation props
  currentIndex?: number;
  totalTeams?: number;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;

  // Add standing data
  standingData?: any;
}

export default function TeamFormationPopup({
  teamId,
  teamName,
  managerName,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
  isOpen,
  onClose,
  currentIndex,
  totalTeams,
  onNavigateNext,
  onNavigatePrevious,
  canNavigateNext,
  canNavigatePrevious,
  standingData,
}: TeamFormationPopupProps) {
  const [teamPicks, setTeamPicks] = useState<TeamPicks | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    pick: Pick;
    player: Element;
    team: Team;
    position: ElementType;
  } | null>(null);
  const [showGameweekStats, setShowGameweekStats] = useState(true);
  const [gameweekData, setGameweekData] = useState<{ [key: number]: any }>({});
  const [pointsBreakdownPlayer, setPointsBreakdownPlayer] = useState<{
    playerId: number;
    playerName: string;
    points: number | string;
    position: number;
    multiplier?: number;
    isCaptain?: boolean;
    isViceCaptain?: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen && teamId) {
      loadTeamData();
    }
  }, [isOpen, teamId, currentEvent]);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      const picksData = await getTeamPicks(teamId, currentEvent);
      setTeamPicks(picksData);

      // Fetch gameweek data for all players
      if (picksData?.picks) {
        const gameweekPromises = picksData.picks.map((pick) =>
          fetchPlayerGameweekData(pick.element)
        );
        await Promise.all(gameweekPromises);
      }
    } catch (error) {
      console.error("Error fetching team picks:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerGameweekData = async (playerId: number) => {
    if (gameweekData[playerId]) return gameweekData[playerId];

    try {
      const response = await fetch(`/api/player/${playerId}/gameweeks`);
      const data = await response.json();

      // Find the specific gameweek data from history array
      const gameweekHistory = data.history?.find(
        (gw: any) => gw.round === currentEvent
      );

      setGameweekData((prev) => ({
        ...prev,
        [playerId]: gameweekHistory || null,
      }));

      return gameweekHistory;
    } catch (error) {
      console.error(
        `Error fetching gameweek data for player ${playerId}:`,
        error
      );
      return null;
    }
  };

  const getPlayer = (elementId: number) => {
    return elements.find((el) => el.id === elementId);
  };

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  const handlePlayerClick = (pick: Pick) => {
    const player = getPlayer(pick.element);
    const team = getTeam(player?.team || 0);
    const position = getPosition(player?.element_type || 0);

    if (player && team && position) {
      setSelectedPlayer({ pick, player, team, position });
    }
  };

  const closePlayerPopup = () => {
    setSelectedPlayer(null);
  };

  const handlePointsClick = (e: React.MouseEvent, player: Element, stats: any) => {
    console.log("Points clicked!", player.web_name, stats.points);
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering the player card click
    if (showGameweekStats) {
      console.log("Opening points breakdown for", player.web_name);
      // Extract numeric points or pass the string if it's YTP/DNP
      let pointsValue: number | string = stats.points;

      // If stats.points is a string like "7pts", extract the number
      if (typeof stats.points === 'string' && stats.points.endsWith('pts')) {
        const numericPoints = parseInt(stats.points.replace('pts', ''));
        pointsValue = isNaN(numericPoints) ? stats.points : numericPoints;
      }

      // Find the pick to get the multiplier
      const currentPick = teamPicks?.picks.find(p => p.element === player.id);

      setPointsBreakdownPlayer({
        playerId: player.id,
        playerName: player.web_name,
        points: pointsValue,
        position: player.element_type,
        multiplier: currentPick?.multiplier || 1,
        isCaptain: currentPick?.is_captain || false,
        isViceCaptain: currentPick?.is_vice_captain || false,
      });
    } else {
      console.log("Not showing gameweek stats, points not clickable");
    }
  };

  const closePointsBreakdown = () => {
    setPointsBreakdownPlayer(null);
  };

  // Group players by position for formation display
  const getPlayersByPosition = (positionId: number, picks: Pick[]) => {
    return picks
      .filter((pick) => {
        const player = getPlayer(pick.element);
        return player?.element_type === positionId;
      })
      .sort((a, b) => a.position - b.position);
  };

  const getPlayerStats = (player: Element, pick: Pick) => {
    const playerGameweekData = gameweekData[player.id];

    if (showGameweekStats && playerGameweekData) {
      // Gameweek-specific stats
      const gameweekPoints = playerGameweekData.total_points || 0;
      const gameweekMinutes = playerGameweekData.minutes || 0;

      // Check game status
      let pointsDisplay: string;
      let minutesDisplay: string;
      let statusColor: string;

      if (playerGameweekData.kickoff_time) {
        const kickoffTime = new Date(playerGameweekData.kickoff_time);
        const currentTime = new Date();
        const gameHasStarted = currentTime >= kickoffTime;

        if (gameHasStarted) {
          if (gameweekMinutes > 0) {
            pointsDisplay = `${gameweekPoints * pick.multiplier}pts`;
            minutesDisplay = `${gameweekMinutes} mins`;
            statusColor =
              gameweekPoints > 0 ? "text-green-700" : "text-gray-700";
          } else {
            pointsDisplay = "DNP";
            minutesDisplay = "DNP";
            statusColor = "text-gray-500";
          }
        } else {
          pointsDisplay = "YTP";
          minutesDisplay = "YTP";
          statusColor = "text-blue-500";
        }
      } else {
        pointsDisplay = "YTP";
        minutesDisplay = "YTP";
        statusColor = "text-blue-500";
      }

      return {
        points: pointsDisplay,
        minutes: minutesDisplay,
        statusColor,
        isGameweek: true,
        form: player.form,
        price: (player.now_cost / 10).toFixed(1),
        // Additional gameweek stats if available
        goals: playerGameweekData.goals_scored || 0,
        assists: playerGameweekData.assists || 0,
        cleanSheets: playerGameweekData.clean_sheets || 0,
        yellowCards: playerGameweekData.yellow_cards || 0,
        redCards: playerGameweekData.red_cards || 0,
        bonus: playerGameweekData.bonus || 0,
      };
    } else {
      // Season stats
      return {
        points: `${player.total_points}pts`,
        minutes: `${player.minutes} mins`,
        statusColor: "text-green-700",
        isGameweek: false,
        form: player.form,
        price: (player.now_cost / 10).toFixed(1),
        // Season stats
        goals: player.goals_scored,
        assists: player.assists,
        cleanSheets: player.clean_sheets,
        yellowCards: player.yellow_cards,
        redCards: player.red_cards,
        bonus: player.bonus,
        ppg: player.points_per_game,
      };
    }
  };

  const renderPlayer = (pick: Pick) => {
    const player = getPlayer(pick.element);
    if (!player) return null;

    const team = getTeam(player.team);
    const position = getPosition(player.element_type);
    const stats = getPlayerStats(player, pick);

    return (
      <div
        key={pick.element}
        onClick={(e) => {
          // Check if the click came from the points element
          const target = e.target as HTMLElement;
          if (target.classList.contains('points-clickable')) {
            return; // Don't open player detail if clicking on points
          }
          handlePlayerClick(pick);
        }}
        className={`relative flex flex-col p-1 md:p-3 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg cursor-pointer w-16 md:w-24 h-20 md:h-36 ${
          pick.is_captain
            ? "border-yellow-400"
            : pick.is_vice_captain
            ? "border-yellow-300"
            : "border-green-300"
        }`}
      >
        {/* Player Name and Team */}
        <div className="text-center mb-0.5 md:mb-2">
          <h3 className="font-semibold text-[10px] md:text-sm leading-tight">
            {player.web_name}
          </h3>
          <p className="text-[8px] md:text-xs text-gray-600">
            {team?.short_name} - {position?.singular_name_short}
          </p>
        </div>

        {/* Stats */}
        <div className="text-center relative z-10">
          <p
            onClick={(e) => handlePointsClick(e, player, stats)}
            className={`points-clickable text-[10px] md:text-sm font-bold cursor-pointer hover:underline ${stats.statusColor} ${
              showGameweekStats ? "hover:text-blue-600" : ""
            }`}
            title={showGameweekStats ? "Click to see points breakdown" : ""}
          >
            {stats.points}
          </p>
          <p className="text-[8px] md:text-xs text-gray-600">£{stats.price}m</p>
        </div>

        {/* Additional Stats - Hidden on mobile */}
        <div className="hidden md:block text-center text-xs text-gray-600 mb-2">
          {stats.isGameweek ? (
            <div>
              <div>Form: {stats.form}</div>
              <div className={stats.statusColor}>{stats.minutes}</div>
              {/* {stats.goals > 0 && (
                <div className="text-green-600">G {stats.goals}</div>
              )}
              {stats.assists > 0 && (
                <div className="text-blue-600">A {stats.assists}</div>
              )}
              {stats.cleanSheets > 0 && (
                <div className="text-purple-600">CS {stats.cleanSheets}</div>
              )}
              {stats.bonus > 0 && (
                <div className="text-orange-600">BP {stats.bonus}</div>
              )} */}
            </div>
          ) : (
            <div>
              <div>Form: {stats.form}</div>
              <div>PPG: {stats.ppg}</div>
              <div className="flex justify-center gap-1 text-xs">
                <span className="text-green-600">G{stats.goals}</span>
                <span className="text-blue-600">A{stats.assists}</span>
                {stats.cleanSheets > 0 && (
                  <span className="text-purple-600">CS{stats.cleanSheets}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Captain/Vice-Captain Badges */}
        <div className="flex justify-center gap-0.5 md:gap-1 mt-auto">
          {pick.is_captain && (
            <span className="px-0.5 md:px-2 py-0.5 md:py-1 bg-yellow-400 text-[8px] md:text-xs rounded font-bold">
              C
            </span>
          )}
          {pick.is_vice_captain && (
            <span className="px-0.5 md:px-2 py-0.5 md:py-1 bg-yellow-200 text-[8px] md:text-xs rounded font-bold">
              V
            </span>
          )}
        </div>
      </div>
    );
  };

  if (!teamPicks) {
    return (
      <Popup open={isOpen} onClose={onClose} modal nested>
        <div className="bg-white p-6 rounded-lg max-w-6xl mx-auto max-h-[90vh] overflow-y-auto scrolly">
          {/* Header with Navigation */}
          <div className="flex items-center justify-between mb-6">
            {/* Previous Button */}
            <button
              onClick={onNavigatePrevious}
              disabled={!canNavigatePrevious}
              className={`p-2 rounded-full transition-colors ${
                canNavigatePrevious
                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Team Info */}
            <div className="text-center">
              <h2 className="text-2xl font-bold">{teamName}</h2>
              <p className="text-gray-600">Manager: {managerName}</p>
              {currentIndex !== undefined && totalTeams && (
                <p className="text-sm text-gray-500 mt-1">
                  {currentIndex + 1} of {totalTeams}
                </p>
              )}
            </div>

            {/* Next Button */}
            <button
              onClick={onNavigateNext}
              disabled={!canNavigateNext}
              className={`p-2 rounded-full transition-colors ${
                canNavigateNext
                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="text-lg">Loading team data...</div>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              Failed to load team data
            </div>
          )}
        </div>
      </Popup>
    );
  }

  const startingXI = teamPicks.picks.filter((pick) => pick.position <= 11);
  const bench = teamPicks.picks.filter((pick) => pick.position > 11);

  const goalkeepers = getPlayersByPosition(1, startingXI);
  const defenders = getPlayersByPosition(2, startingXI);
  const midfielders = getPlayersByPosition(3, startingXI);
  const forwards = getPlayersByPosition(4, startingXI);

  // Calculate total points based on current view
  const totalPoints = showGameweekStats
    ? standingData?.event_total || 0 // Gameweek points from league standing
    : standingData?.total || 0; // Total season points from league standing

  return (
    <>
      <Popup open={isOpen} onClose={onClose} modal nested>
        <div className="bg-white p-6 rounded-lg max-w-6xl mx-auto max-h-[90vh] overflow-y-auto scrolly">
          {/* Header with Navigation */}
          <div className="flex items-center justify-between mb-6">
            {/* Previous Button */}
            <button
              onClick={onNavigatePrevious}
              disabled={!canNavigatePrevious}
              className={`p-2 rounded-full transition-colors ${
                canNavigatePrevious
                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Team Info */}
            <div className="text-center">
              <h2 className="text-2xl font-bold">{teamName}</h2>
              <p className="text-gray-600">Manager: {managerName}</p>
              <p className="text-sm text-gray-500">
                {showGameweekStats ? `Gameweek ${currentEvent}` : "Season"} •{" "}
                {totalPoints} points
              </p>
              {currentIndex !== undefined && totalTeams && (
                <p className="text-sm text-gray-500 mt-1">
                  {currentIndex + 1} of {totalTeams}
                </p>
              )}
            </div>

            {/* Next Button */}
            <button
              onClick={onNavigateNext}
              disabled={!canNavigateNext}
              className={`p-2 rounded-full transition-colors ${
                canNavigateNext
                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <div className="flex justify-center">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl px-2"
            >
              ×
            </button>
          </div>
          {/* Stats Toggle */}
          <div className="flex justify-center mb-6 mt-6">
            <button
              onClick={() => setShowGameweekStats(!showGameweekStats)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border-2 ${
                showGameweekStats
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  : "bg-white text-blue-600 border-blue-600 hover:bg-blue-50"
              }`}
            >
              {showGameweekStats
                ? `Showing GW${currentEvent} Stats`
                : "Showing Season Stats"}
            </button>
          </div>

          {/* Formation View */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-center">
              Starting XI - Formation View
            </h3>

            {/* Football Pitch Background */}
            <div className="bg-gradient-to-b from-green-400 to-green-500 p-6 rounded-lg relative overflow-hidden">
              {/* Center circle and markings */}
              <div className="absolute inset-0">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/30 rounded-full"></div>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-8 border-2 border-white/30 border-t-0 rounded-b-lg"></div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-8 border-2 border-white/30 border-b-0 rounded-t-lg"></div>
              </div>

              {/* Players positioned in formation */}
              <div className="relative z-10 space-y-4 sm:space-y-12 md:space-y-20">
                {/* Forwards */}
                {forwards.length > 0 && (
                  <div className="flex justify-center gap-1 md:gap-4 flex-wrap">
                    {forwards.map((pick) => renderPlayer(pick))}
                  </div>
                )}

                {/* Midfielders */}
                {midfielders.length > 0 && (
                  <div className="flex justify-center gap-1 md:gap-4 flex-wrap">
                    {midfielders.map((pick) => renderPlayer(pick))}
                  </div>
                )}

                {/* Defenders */}
                {defenders.length > 0 && (
                  <div className="flex justify-center gap-1 md:gap-4 flex-wrap">
                    {defenders.map((pick) => renderPlayer(pick))}
                  </div>
                )}

                {/* Goalkeeper */}
                {goalkeepers.length > 0 && (
                  <div className="flex justify-center">
                    {goalkeepers.map((pick) => renderPlayer(pick))}
                  </div>
                )}
              </div>
            </div>

            {/* Formation Info */}
            <div className="mt-4 text-center text-sm text-gray-600">
              Formation: {defenders.length}-{midfielders.length}-
              {forwards.length}
            </div>
          </div>

          {/* Bench */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Bench</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {bench.map((pick) => {
                const player = getPlayer(pick.element);
                if (!player) return null;

                const team = getTeam(player.team);
                const position = getPosition(player.element_type);
                const stats = getPlayerStats(player, pick);

                return (
                  <div
                    key={pick.element}
                    onClick={() => handlePlayerClick(pick)}
                    className="relative p-3 rounded-lg border cursor-pointer transition-all hover:shadow-lg bg-gray-50 border-gray-300"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-sm">
                          {player.web_name}
                        </h3>
                        <p className="text-xs text-gray-600">
                          {team?.short_name} - {position?.singular_name_short}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${stats.statusColor}`}>
                          {stats.points}
                          <span className="text-xs text-gray-500 block">
                            {stats.isGameweek ? `GW${currentEvent}` : "Season"}
                          </span>
                        </p>
                        <p className="text-xs text-gray-600">£{stats.price}m</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-600">
                        Form: {stats.form} |{" "}
                        {stats.isGameweek
                          ? stats.minutes
                          : `${stats.minutes} total`}
                        {stats.isGameweek && stats.goals > 0 && (
                          <span className="ml-1 text-green-600">
                            G {stats.goals}
                          </span>
                        )}
                        {stats.isGameweek && stats.assists > 0 && (
                          <span className="ml-1 text-blue-600">
                            A {stats.assists}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {pick.multiplier > 1 && (
                          <span className="px-2 py-1 bg-gray-200 text-xs rounded">
                            {pick.multiplier}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Popup>

      {/* Player Detail Popup */}
      {selectedPlayer && (
        <PlayerDetailPopup
          player={selectedPlayer.player}
          team={selectedPlayer.team}
          position={selectedPlayer.position}
          teams={teams}
          isOpen={!!selectedPlayer}
          onClose={closePlayerPopup}
          isCaptain={selectedPlayer.pick.is_captain}
          isViceCaptain={selectedPlayer.pick.is_vice_captain}
        />
      )}

      {/* Points Breakdown Modal */}
      {pointsBreakdownPlayer && (
        <PointsBreakdownModal
          playerId={pointsBreakdownPlayer.playerId}
          playerName={pointsBreakdownPlayer.playerName}
          gameweek={currentEvent}
          totalPoints={pointsBreakdownPlayer.points}
          isOpen={!!pointsBreakdownPlayer}
          onClose={closePointsBreakdown}
          playerPosition={pointsBreakdownPlayer.position}
          multiplier={pointsBreakdownPlayer.multiplier}
          isCaptain={pointsBreakdownPlayer.isCaptain}
          isViceCaptain={pointsBreakdownPlayer.isViceCaptain}
        />
      )}
    </>
  );
}
