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

  // New navigation props
  currentIndex?: number;
  totalTeams?: number;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;
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
}: TeamFormationPopupProps) {
  const [teamPicks, setTeamPicks] = useState<TeamPicks | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    pick: Pick;
    player: Element;
    team: Team;
    position: ElementType;
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
    } catch (error) {
      console.error("Error fetching team picks:", error);
    } finally {
      setLoading(false);
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

  // Group players by position for formation display
  const getPlayersByPosition = (positionId: number, picks: Pick[]) => {
    return picks
      .filter((pick) => {
        const player = getPlayer(pick.element);
        return player?.element_type === positionId;
      })
      .sort((a, b) => a.position - b.position);
  };

  const renderPlayer = (pick: Pick) => {
    const player = getPlayer(pick.element);
    if (!player) return null;

    const team = getTeam(player.team);
    const position = getPosition(player.element_type);

    return (
      <div
        key={pick.element}
        onClick={() => handlePlayerClick(pick)}
        className={`relative flex flex-col p-3 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg cursor-pointer w-24 h-32 overflow-y-auto scrolly ${
          pick.is_captain
            ? "border-yellow-400 bg-yellow-50"
            : pick.is_vice_captain
            ? "bg-yellow-25 border-yellow-300"
            : "bg-white border-green-300"
        }`}
      >
        {/* Player Name and Team */}
        <div className="text-center mb-2">
          <h3 className="font-semibold text-sm leading-tight">
            {player.web_name}
          </h3>
          <p className="text-xs text-gray-600">
            {team?.short_name} - {position?.singular_name_short}
          </p>
        </div>

        {/* Stats */}
        <div className="text-center mb-2">
          <p className="text-sm font-bold text-green-700">
            {player.total_points}pts
          </p>
          <p className="text-xs text-gray-600">
            £{(player.now_cost / 10).toFixed(1)}m
          </p>
        </div>

        {/* Form and Minutes */}
        <div className="text-center text-xs text-gray-600 mb-2">
          <div>Form: {player.form}</div>
          <div>{player.minutes} mins</div>
        </div>

        {/* Captain/Vice-Captain Badges */}
        <div className="flex justify-center gap-1 mt-auto">
          {pick.is_captain && (
            <span className="px-2 py-1 bg-yellow-400 text-xs rounded font-bold">
              C
            </span>
          )}
          {pick.is_vice_captain && (
            <span className="px-2 py-1 bg-yellow-200 text-xs rounded font-bold">
              V
            </span>
          )}
          {pick.multiplier > 1 && (
            <span className="px-2 py-1 bg-gray-200 text-xs rounded">
              {pick.multiplier}x
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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {teamName} - {managerName}
            </h2>
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

  const totalPoints = teamPicks.picks.reduce((sum, pick) => {
    const player = getPlayer(pick.element);
    return sum + (player ? player.total_points * pick.multiplier : 0);
  }, 0);

  return (
    <>
      <Popup open={isOpen} onClose={onClose} modal nested>
        <div className="bg-white p-6 rounded-lg max-w-6xl mx-auto max-h-[90vh] overflow-y-auto scrolly">
          {/* Header with navigation controls */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onNavigatePrevious}
              disabled={!canNavigatePrevious}
              className={`p-2 rounded-full ${
                canNavigatePrevious
                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              ←
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold">{teamName}</h2>
              <p className="text-gray-600">{managerName}</p>
              {currentIndex !== undefined && totalTeams && (
                <p className="text-sm text-gray-500">
                  {currentIndex + 1} of {totalTeams}
                </p>
              )}
            </div>

            <button
              onClick={onNavigateNext}
              disabled={!canNavigateNext}
              className={`p-2 rounded-full ${
                canNavigateNext
                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              →
            </button>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">{teamName}</h2>
              <p className="text-gray-600">Manager: {managerName}</p>
              <p className="text-sm text-gray-500">
                Gameweek {currentEvent} • {totalPoints} points
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
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
              <div className="relative z-10 space-y-8">
                {/* Forwards */}
                {forwards.length > 0 && (
                  <div className="flex justify-center gap-4">
                    {forwards.map((pick) => renderPlayer(pick))}
                  </div>
                )}

                {/* Midfielders */}
                {midfielders.length > 0 && (
                  <div className="flex justify-center gap-4">
                    {midfielders.map((pick) => renderPlayer(pick))}
                  </div>
                )}

                {/* Defenders */}
                {defenders.length > 0 && (
                  <div className="flex justify-center gap-4">
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
                        <p className="text-sm font-bold">
                          {player.total_points}pts
                        </p>
                        <p className="text-xs text-gray-600">
                          £{(player.now_cost / 10).toFixed(1)}m
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-600">
                        Form: {player.form} | {player.minutes} mins
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
    </>
  );
}
