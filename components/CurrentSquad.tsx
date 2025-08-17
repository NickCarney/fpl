"use client";

import { useState } from "react";
import { Element, Pick, Team, ElementType, Event } from "@/types/fpl";
import PlayerDetailPopup from "./PlayerDetailPopup";
import TeamInsights from "./TeamInsights";
import TransferSuggestions from "./TransferSuggestions";

interface CurrentSquadProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
}

export default function CurrentSquad({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
}: CurrentSquadProps) {
  const [isFormationView, setIsFormationView] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    pick: Pick;
    player: Element;
    team: Team;
    position: ElementType;
  } | null>(null);

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

  const handlePlayerClick = (pick: Pick) => {
    const player = getPlayer(pick.element);
    const team = getTeam(player?.team || 0);
    const position = getPosition(player?.element_type || 0);

    if (player && team && position) {
      setSelectedPlayer({ pick, player, team, position });
    }
  };

  const closePopup = () => {
    setSelectedPlayer(null);
  };

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
          onClick={() => handlePlayerClick(pick)}
          className={`relative flex flex-col p-3 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg cursor-pointer w-24 h-32 overflow-y-auto ${
            pick.is_captain
              ? "border-yellow-400"
              : pick.is_vice_captain
              ? " border-yellow-300"
              : " border-green-300"
          }`}
        >
          {/* Player Name and Team */}
          <div className="text-center mb-2">
            <h3 className="font-semibold text-sm leading-tight">
              {player.web_name}
            </h3>
            <p className="text-xs ">
              {team?.short_name} - {position?.singular_name_short}
            </p>
          </div>

          {/* Stats */}
          <div className="text-center mb-2">
            <p className="text-sm font-bold text-green-700">
              {player.total_points}pts
            </p>
            <p className="text-xs ">£{(player.now_cost / 10).toFixed(1)}m</p>
          </div>

          {/* Form and Minutes */}
          <div className="text-center text-xs  mb-2">
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
              <span className="px-2 py-1  text-xs rounded">
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
        onClick={() => handlePlayerClick(pick)}
        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${
          isBench ? " border-gray-300" : " border-gray-200"
        } ${pick.is_captain ? "ring-2 ring-yellow-400" : ""} ${
          pick.is_vice_captain ? "ring-2 ring-yellow-200" : ""
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-sm">{player.web_name}</h3>
            <p className="text-xs ">
              {team?.short_name} - {position?.singular_name_short}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{player.total_points}pts</p>
            <p className="text-xs ">£{(player.now_cost / 10).toFixed(1)}m</p>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="text-xs ">
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
              <span className="px-1 py-0.5  text-xs rounded">
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
    <div className=" p-6 rounded-lg">
      <div className="flex items-center mb-6 justify-center flex-col">
        <h2 className="text-2xl font-bold">Current Squad</h2>
        <div className="flex items-center gap-4 flex-col pt-2">
          {/* View Toggle */}
          <div className="flex items-center justify-center gap-2 w-full">
            {/* <span className="text-sm ">View:</span> */}
            <button
              onClick={() => setIsFormationView(true)}
              className={`flex-1 min-w-[120px] max-w-[160px] py-1 rounded-md text-sm font-medium transition-colors text-center ${
                isFormationView ? "text-white bg-green-600" : ""
              }`}
              style={{ marginRight: 4 }}
            >
              Formation
            </button>
            <button
              onClick={() => setIsFormationView(false)}
              className={`flex-1 min-w-[120px] max-w-[160px] py-1 rounded-md text-sm font-medium transition-colors text-center ${
                !isFormationView ? " text-white bg-green-600" : ""
              }`}
              style={{ marginLeft: 4 }}
            >
              List
            </button>
          </div>

          {/* Stats */}
          <div className="text-right">
            <p className="text-sm ">Gameweek {currentEvent}</p>
            <p className="text-xl font-bold">{totalPoints} points</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-center">
          {isFormationView ? "Starting XI - Formation View" : "Starting XI"}
        </h3>

        {isFormationView ? (
          <>
            {/* Football Pitch Background */}
            <div className="bg-gradient-to-b from-green-400 to-green-500 p-6 rounded-lg relative overflow-hidden">
              {/* Vertical Stripes - Center 60% only */}
              <div className="absolute inset-0">
                <div className="flex h-full">
                  {/* Left 20% - no stripes */}
                  <div className="w-1/5 bg-[#4ade80]"></div>

                  {/* Center 60% - with stripes */}
                  <div className="w-3/5 flex">
                    <div className="flex-1 bg-green-100 opacity-20"></div>
                    <div className="flex-1"></div>
                    <div className="flex-1 bg-green-100 opacity-20"></div>
                    <div className="flex-1"></div>
                    <div className="flex-1 bg-green-100 opacity-20"></div>
                    <div className="flex-1"></div>
                    <div className="flex-1 bg-green-100 opacity-20"></div>
                    <div className="flex-1"></div>
                  </div>

                  {/* Right 20% - no stripes */}
                  <div className="w-1/5 bg-[#4ade80]"></div>
                </div>
              </div>

              {/* Pitch Lines */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-16 border-2 border-white rounded-b-lg"></div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-16 border-2 border-white rounded-t-lg"></div>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 "></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white rounded-full"></div>
              </div>

              {/* Formation Layout */}
              <div className="relative z-10 space-y-12">
                {/* Forwards */}
                {forwards.length > 0 && (
                  <div className="flex justify-center">
                    <div className="flex gap-4 justify-center">
                      {forwards.map((pick) => renderPlayer(pick, false, true))}
                    </div>
                  </div>
                )}

                {/* Midfielders */}
                {midfielders.length > 0 && (
                  <div className="flex justify-center">
                    <div className="flex gap-4 justify-center flex-wrap">
                      {midfielders.map((pick) =>
                        renderPlayer(pick, false, true)
                      )}
                    </div>
                  </div>
                )}

                {/* Defenders */}
                {defenders.length > 0 && (
                  <div className="flex justify-center">
                    <div className="flex gap-4 justify-center flex-wrap">
                      {defenders.map((pick) => renderPlayer(pick, false, true))}
                    </div>
                  </div>
                )}

                {/* Goalkeeper */}
                {goalkeepers.length > 0 && (
                  <div className="flex justify-center">
                    <div className="flex justify-center">
                      {goalkeepers.map((pick) =>
                        renderPlayer(pick, false, true)
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Formation Info */}
            <div className="mt-4 text-center text-sm ">
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

      {/* Team Insights */}
      <div className="mt-6">
        <TeamInsights
          picks={picks}
          elements={elements}
          teams={teams}
          elementTypes={elementTypes}
          currentEvent={currentEvent}
          totalPoints={totalPoints}
          events={events}
        />
      </div>

      {/* Transfer Suggestions */}
      <div className="mt-6">
        <TransferSuggestions
          picks={picks}
          elements={elements}
          teams={teams}
          elementTypes={elementTypes}
          currentEvent={currentEvent}
          events={events}
          totalPoints={totalPoints}
        />
      </div>

      {/* Player Detail Popup */}
      {selectedPlayer && (
        <PlayerDetailPopup
          player={selectedPlayer.player}
          team={selectedPlayer.team}
          position={selectedPlayer.position}
          teams={teams}
          isOpen={!!selectedPlayer}
          onClose={closePopup}
          isCaptain={selectedPlayer.pick.is_captain}
          isViceCaptain={selectedPlayer.pick.is_vice_captain}
        />
      )}
    </div>
  );
}
