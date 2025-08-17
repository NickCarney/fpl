"use client";

import { useState } from "react";
import { Element, Pick, Team, ElementType } from "@/types/fpl";

interface CurrentSquadProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
}

export default function CurrentSquad({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
}: CurrentSquadProps) {
  const [isFormationView, setIsFormationView] = useState(true);

  const getPlayer = (elementId: number) => {
    return elements.find((el) => el.id === elementId);
  };

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  const startingXI = picks.filter((pick) => pick.position <= 11);
  const bench = picks.filter((pick) => pick.position > 11);

  // Group players by position for formation display
  const getPlayersByPosition = (positionId: number) => {
    return startingXI
      .filter((pick) => {
        const player = getPlayer(pick.element);
        return player?.element_type === positionId;
      })
      .sort((a, b) => a.position - b.position);
  };

  const goalkeepers = getPlayersByPosition(1); // GK
  const defenders = getPlayersByPosition(2); // DEF
  const midfielders = getPlayersByPosition(3); // MID
  const forwards = getPlayersByPosition(4); // FWD

  const renderPlayer = (
    pick: Pick,
    isBench: boolean = false,
    isFormation: boolean = false
  ) => {
    const player = getPlayer(pick.element);
    if (!player) return null;

    const team = getTeam(player.team);
    const position = getPosition(player.element_type);

    if (isFormation) {
      // Enhanced formation view with detailed stats
      return (
        <div
          key={pick.element}
          className={`relative flex flex-col p-3 rounded-lg border-2 transition-all hover:scale-105 min-h-[120px] ${
            pick.is_captain
              ? "bg-yellow-100 border-yellow-400"
              : pick.is_vice_captain
              ? "bg-yellow-50 border-yellow-300"
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
              <span className="px-2 py-1 bg-blue-200 text-xs rounded">
                {pick.multiplier}x
              </span>
            )}
          </div>
        </div>
      );
    }

    // Regular list view for bench
    return (
      <div
        key={pick.element}
        className={`p-3 rounded-lg border ${
          isBench ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200"
        } ${pick.is_captain ? "ring-2 ring-yellow-400" : ""} ${
          pick.is_vice_captain ? "ring-2 ring-yellow-200" : ""
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-sm">{player.web_name}</h3>
            <p className="text-xs text-gray-600">
              {team?.short_name} - {position?.singular_name_short}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{player.total_points}pts</p>
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
            {pick.is_captain && (
              <span className="px-1 py-0.5 bg-yellow-400 text-xs rounded font-bold">
                C
              </span>
            )}
            {pick.is_vice_captain && (
              <span className="px-1 py-0.5 bg-yellow-200 text-xs rounded font-bold">
                V
              </span>
            )}
            {pick.multiplier > 1 && (
              <span className="px-1 py-0.5 bg-blue-200 text-xs rounded">
                {pick.multiplier}x
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const totalPoints = picks.reduce((sum, pick) => {
    const player = getPlayer(pick.element);
    return sum + (player ? player.total_points * pick.multiplier : 0);
  }, 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Current Squad</h2>
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">View:</span>
            <button
              onClick={() => setIsFormationView(!isFormationView)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                isFormationView
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Formation
            </button>
            <button
              onClick={() => setIsFormationView(!isFormationView)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                !isFormationView
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              List
            </button>
          </div>

          {/* Stats */}
          <div className="text-right">
            <p className="text-sm text-gray-600">Gameweek {currentEvent}</p>
            <p className="text-xl font-bold">{totalPoints} points</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">
          {isFormationView ? "Starting XI - Formation View" : "Starting XI"}
        </h3>

        {isFormationView ? (
          <>
            {/* Football Pitch Background */}
            <div className="bg-gradient-to-b from-green-400 to-green-500 p-6 rounded-lg relative overflow-hidden">
              {/* Pitch Lines */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-16 border-2 border-white rounded-b-lg"></div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-16 border-2 border-white rounded-t-lg"></div>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white rounded-full"></div>
              </div>

              {/* Formation Layout */}
              <div className="relative z-10 space-y-8">
                {/* Forwards */}
                {forwards.length > 0 && (
                  <div className="flex justify-center">
                    <div
                      className={`grid gap-4 ${
                        forwards.length === 1
                          ? "grid-cols-1"
                          : forwards.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-3"
                      }`}
                    >
                      {forwards.map((pick) => renderPlayer(pick, false, true))}
                    </div>
                  </div>
                )}

                {/* Midfielders */}
                {midfielders.length > 0 && (
                  <div className="flex justify-center">
                    <div
                      className={`grid gap-4 ${
                        midfielders.length === 1
                          ? "grid-cols-1"
                          : midfielders.length === 2
                          ? "grid-cols-2"
                          : midfielders.length === 3
                          ? "grid-cols-3"
                          : midfielders.length === 4
                          ? "grid-cols-4"
                          : "grid-cols-5"
                      }`}
                    >
                      {midfielders.map((pick) =>
                        renderPlayer(pick, false, true)
                      )}
                    </div>
                  </div>
                )}

                {/* Defenders */}
                {defenders.length > 0 && (
                  <div className="flex justify-center">
                    <div
                      className={`grid gap-4 ${
                        defenders.length === 1
                          ? "grid-cols-1"
                          : defenders.length === 2
                          ? "grid-cols-2"
                          : defenders.length === 3
                          ? "grid-cols-3"
                          : defenders.length === 4
                          ? "grid-cols-4"
                          : "grid-cols-5"
                      }`}
                    >
                      {defenders.map((pick) => renderPlayer(pick, false, true))}
                    </div>
                  </div>
                )}

                {/* Goalkeeper */}
                {goalkeepers.length > 0 && (
                  <div className="flex justify-center">
                    <div className="grid grid-cols-1">
                      {goalkeepers.map((pick) =>
                        renderPlayer(pick, false, true)
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Formation Info */}
            <div className="mt-4 text-center text-sm text-gray-600">
              Formation: {defenders.length}-{midfielders.length}-
              {forwards.length}
            </div>
          </>
        ) : (
          /* List View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {startingXI.map((pick) => renderPlayer(pick, false, false))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Bench</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {bench.map((pick) => renderPlayer(pick, true))}
        </div>
      </div>
    </div>
  );
}
