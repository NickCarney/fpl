"use client";

import { useState, useEffect } from "react";
import { Element, Pick, Team, ElementType, Event } from "@/types/fpl";
import { getFixtures } from "@/lib/fpl-api";

interface TeamPickerProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
  teamPicks?: any;
}

interface DraggedPlayer {
  player: Element;
  pick: Pick;
  fromBench: boolean;
}

interface PlayerCardProps {
  pick: Pick;
  player: Element;
  team: Team;
  position: ElementType;
  nextFixture?: any;
  isFormationView: boolean;
  isBench: boolean;
  isSelected?: boolean;
  onDragStart: (player: Element, pick: Pick, fromBench: boolean) => void;
  onDrop: (targetPick: Pick) => void;
  onDragOver: (e: React.DragEvent) => void;
  onClick: (pick: Pick) => void;
  onCaptainSelect: (pick: Pick) => void;
  className?: string;
}

const PlayerCard = ({
  pick,
  player,
  team,
  position,
  nextFixture,
  isFormationView,
  isBench,
  isSelected = false,
  onDragStart,
  onDrop,
  onDragOver,
  onClick,
  onCaptainSelect,
  className = "",
}: PlayerCardProps) => {
  const fixtureText = nextFixture
    ? `${nextFixture.isHome ? "vs" : "@"} ${nextFixture.opponent}`
    : "No fixture";

  const fixtureDifficulty = nextFixture?.difficulty || 3;
  const difficultyColor =
    fixtureDifficulty <= 2
      ? "bg-green-100 text-green-700"
      : fixtureDifficulty <= 3
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  const formColor =
    parseFloat(player.form) >= 4
      ? "text-green-600"
      : parseFloat(player.form) >= 2
      ? "text-yellow-600"
      : "text-red-600";

  if (isFormationView && !isBench) {
    // Formation view for starting XI
    return (
      <div
        draggable
        onDragStart={() => onDragStart(player, pick, false)}
        onDrop={() => onDrop(pick)}
        onDragOver={onDragOver}
        onClick={() => onClick(pick)}
        className={`relative flex flex-col py-2 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg cursor-pointer w-20 h-24 overflow-y-scroll ${
          isSelected
            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
            : pick.is_captain
            ? "border-yellow-400 bg-yellow-50"
            : pick.is_vice_captain
            ? "border-yellow-300 bg-yellow-50"
            : "border-green-300 bg-white"
        } ${className}`}
      >
        <div className="flex w-full gap-1">
          {/* Position indicator */}
          <div
            className={`relative w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              position.id === 1
                ? "bg-purple-500"
                : position.id === 2
                ? "bg-blue-500"
                : position.id === 3
                ? "bg-green-500"
                : "bg-red-500"
            }`}
          >
            {position.singular_name_short.charAt(0)}
          </div>

          {/* Next fixture */}
          {nextFixture && (
            <div
              className={`w-fit text-xs px-1 py-0.5 rounded text-center ${difficultyColor}`}
            >
              {nextFixture.opponent}
            </div>
          )}

          {/* Captain/Vice indicators with click handlers */}
          <div className=" flex items-end flex-col gap-0.5">
            {pick.is_captain && (
              <div
                className="bg-yellow-400 text-xs font-bold rounded min-w-3 min-h-3 flex items-center justify-center cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onCaptainSelect(pick);
                }}
              >
                C
              </div>
            )}
            {!pick.is_captain && !pick.is_vice_captain && !isBench && (
              <div
                className="bg-gray-200 text-xs font-bold rounded min-w-3 min-h-3 flex items-center justify-center cursor-pointer hover:bg-yellow-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onCaptainSelect(pick);
                }}
              >
                +
              </div>
            )}
          </div>
        </div>

        {/* Player info */}
        <div className="text-center">
          <div className="font-semibold text-xs leading-tight mb-0.5">
            {player.web_name}
          </div>
          <div className="text-xs text-gray-600 mb-0.5">{team.short_name}</div>
          <div className="text-xs font-bold text-green-600">
            £{(player.now_cost / 10).toFixed(1)}m
          </div>
          <div className="text-xs text-gray-600 mb-0.5">
            ppg: {player.points_per_game}
          </div>
        </div>
      </div>
    );
  }

  // List view for bench or detailed view
  return (
    <div
      draggable
      onDragStart={() => onDragStart(player, pick, isBench)}
      onDrop={() => onDrop(pick)}
      onDragOver={onDragOver}
      onClick={() => onClick(pick)}
      className={`relative p-3 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${
        isSelected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
          : isBench
          ? "border-gray-300 bg-gray-50"
          : "border-green-300 bg-white"
      } ${pick.is_captain ? "ring-2 ring-yellow-400" : ""} ${
        pick.is_vice_captain ? "ring-2 ring-yellow-300" : ""
      } ${className}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                position.id === 1
                  ? "bg-purple-500"
                  : position.id === 2
                  ? "bg-blue-500"
                  : position.id === 3
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            >
              {position.singular_name_short.charAt(0)}
            </div>
            <h3 className="font-semibold text-sm">{player.web_name}</h3>
          </div>
          <p className="text-xs text-gray-600">
            {team.short_name} • {position.singular_name_short}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">{player.total_points}pts</p>
          <p className="text-xs text-green-600 font-medium">
            £{(player.now_cost / 10).toFixed(1)}m
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-600">
          <span className={`font-medium ${formColor}`}>
            Form: {player.form}
          </span>
          <span className="ml-2">PPG: {player.points_per_game}</span>
          {nextFixture && (
            <div
              className={`inline-block ml-2 px-2 py-1 rounded ${difficultyColor}`}
            >
              {fixtureText} ({fixtureDifficulty})
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {pick.is_captain && (
            <span
              className="px-1 py-0.5 bg-yellow-400 text-xs rounded font-bold cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onCaptainSelect(pick);
              }}
            >
              C
            </span>
          )}
          {pick.is_vice_captain && (
            <span
              className="px-1 py-0.5 bg-yellow-300 text-xs rounded font-bold cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onCaptainSelect(pick);
              }}
            >
              V
            </span>
          )}
          {!pick.is_captain && !pick.is_vice_captain && !isBench && (
            <span
              className="px-1 py-0.5 bg-gray-200 text-xs rounded font-bold cursor-pointer hover:bg-yellow-200"
              onClick={(e) => {
                e.stopPropagation();
                onCaptainSelect(pick);
              }}
            >
              +
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function TeamPicker({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
  teamPicks,
}: TeamPickerProps) {
  const [currentPicks, setCurrentPicks] = useState<Pick[]>(picks);
  const [isFormationView, setIsFormationView] = useState(true);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [draggedPlayer, setDraggedPlayer] = useState<DraggedPlayer | null>(
    null
  );
  const [selectedPlayer, setSelectedPlayer] = useState<Pick | null>(null);

  const nextGameweek = events.find((event) => event.is_next);
  const nextGameweekId = nextGameweek?.id || currentEvent + 1;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fixturesData = await getFixtures().catch(() => []);
        setFixtures(fixturesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [currentEvent]);

  const getPlayer = (elementId: number) =>
    elements.find((el) => el.id === elementId);
  const getTeam = (teamId: number) => teams.find((team) => team.id === teamId);
  const getPosition = (elementTypeId: number) =>
    elementTypes.find((type) => type.id === elementTypeId);
  const calculateSuggestedLineup = (fixturesData: any[], teamNewsData: any) => {
    // This is a simplified version of the logic from CurrentSquad
    const nextGameweekFixtures = fixturesData.filter(
      (fixture) => fixture.event === nextGameweekId
    );

    const scoredPlayers = currentPicks
      .map((pick) => {
        const player = getPlayer(pick.element);
        if (!player) return null;

        const formScore = parseFloat(player.form) || 0;
        const ppgScore = parseFloat(player.points_per_game) || 0;
        const expectedScore =
          (parseFloat(player.expected_goals) || 0) +
          (parseFloat(player.expected_assists) || 0);

        // Get fixture info
        const playerFixture = nextGameweekFixtures.find(
          (fixture) =>
            fixture.team_h === player.team || fixture.team_a === player.team
        );

        let fixtureBonus = 1.0;
        if (playerFixture) {
          const isHome = playerFixture.team_h === player.team;
          const difficulty = isHome
            ? playerFixture.team_h_difficulty
            : playerFixture.team_a_difficulty;

          if (difficulty <= 2) fixtureBonus = 2.0;
          else if (difficulty <= 3) fixtureBonus = 1.2;
          else fixtureBonus = 0.6;

          if (isHome) fixtureBonus += 0.2;
        }

        const totalScore =
          (formScore + ppgScore + expectedScore) * fixtureBonus;

        return {
          pick,
          player,
          score: totalScore,
          captaincyScore: (formScore * 1.5 + ppgScore * 2.0) * fixtureBonus,
        };
      })
      .filter(Boolean);

    // Group by position and select best XI
    const playersByPosition = {
      1: scoredPlayers
        .filter((p) => p!.player.element_type === 1)
        .sort((a, b) => b!.score - a!.score),
      2: scoredPlayers
        .filter((p) => p!.player.element_type === 2)
        .sort((a, b) => b!.score - a!.score),
      3: scoredPlayers
        .filter((p) => p!.player.element_type === 3)
        .sort((a, b) => b!.score - a!.score),
      4: scoredPlayers
        .filter((p) => p!.player.element_type === 4)
        .sort((a, b) => b!.score - a!.score),
    };

    // Select optimal formation
    const formations = [
      { def: 3, mid: 4, fwd: 3, name: "3-4-3" },
      { def: 3, mid: 5, fwd: 2, name: "3-5-2" },
      { def: 4, mid: 3, fwd: 3, name: "4-3-3" },
      { def: 4, mid: 4, fwd: 2, name: "4-4-2" },
      { def: 4, mid: 5, fwd: 1, name: "4-5-1" },
    ];

    let bestFormation = formations[0];
    let bestScore = 0;

    formations.forEach((formation) => {
      if (
        playersByPosition[2].length >= formation.def &&
        playersByPosition[3].length >= formation.mid &&
        playersByPosition[4].length >= formation.fwd
      ) {
        const formationScore =
          playersByPosition[2]
            .slice(0, formation.def)
            .reduce((sum, p) => sum + p!.score, 0) +
          playersByPosition[3]
            .slice(0, formation.mid)
            .reduce((sum, p) => sum + p!.score, 0) +
          playersByPosition[4]
            .slice(0, formation.fwd)
            .reduce((sum, p) => sum + p!.score, 0);

        if (formationScore > bestScore) {
          bestScore = formationScore;
          bestFormation = formation;
        }
      }
    });

    const suggestedXI = [
      ...playersByPosition[1].slice(0, 1),
      ...playersByPosition[2].slice(0, bestFormation.def),
      ...playersByPosition[3].slice(0, bestFormation.mid),
      ...playersByPosition[4].slice(0, bestFormation.fwd),
    ];

    // Select captain and vice-captain
    const captainCandidates = suggestedXI
      .filter((p) => p!.player.element_type >= 3)
      .sort((a, b) => b!.captaincyScore - a!.captaincyScore);

    const captain = captainCandidates[0];

    return {
      startingXI: suggestedXI.map((p) => p!.pick),
      captain: captain?.player,
      formation: bestFormation,
    };
  };

  const getNextFixture = (player: Element) => {
    const fixture = fixtures.find(
      (f) =>
        f.event === nextGameweekId &&
        (f.team_h === player.team || f.team_a === player.team)
    );

    if (!fixture) return null;

    const isHome = fixture.team_h === player.team;
    const opponentId = isHome ? fixture.team_a : fixture.team_h;
    const opponent = teams.find((t) => t.id === opponentId);

    return {
      opponent: opponent?.short_name || "TBD",
      isHome,
      difficulty: isHome
        ? fixture.team_h_difficulty
        : fixture.team_a_difficulty,
    };
  };

  const handleDragStart = (player: Element, pick: Pick, fromBench: boolean) => {
    setDraggedPlayer({ player, pick, fromBench });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetPick: Pick) => {
    if (!draggedPlayer) return;

    const draggedPlayerData = getPlayer(draggedPlayer.pick.element);
    const targetPlayerData = getPlayer(targetPick.element);

    if (!draggedPlayerData || !targetPlayerData) return;

    const newPicks = [...currentPicks];
    const draggedIndex = newPicks.findIndex(
      (p) => p.element === draggedPlayer.pick.element
    );
    const targetIndex = newPicks.findIndex(
      (p) => p.element === targetPick.element
    );

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Swap positions
    const draggedPosition = newPicks[draggedIndex].position;
    const targetPosition = newPicks[targetIndex].position;

    newPicks[draggedIndex].position = targetPosition;
    newPicks[targetIndex].position = draggedPosition;

    // Validate the formation after the swap
    const validation = validateFormation(newPicks);

    if (validation.isValid) {
      // Valid formation, apply the swap
      setCurrentPicks(newPicks);
    } else {
      // Invalid formation, show error message
      alert(
        `Invalid formation! Must have: 1 GK (${validation.goalkeepers}), 3+ DEF (${validation.defenders}), 3+ MID (${validation.midfielders}), 1+ FWD (${validation.forwards})`
      );
    }

    setDraggedPlayer(null);
  };

  // Formation validation function
  const validateFormation = (picks: Pick[]) => {
    const startingXI = picks.filter((p) => p.position <= 11);
    const positions = startingXI.reduce((acc, pick) => {
      const player = getPlayer(pick.element);
      if (player) {
        const pos = player.element_type;
        acc[pos] = (acc[pos] || 0) + 1;
      }
      return acc;
    }, {} as Record<number, number>);

    return {
      goalkeepers: positions[1] || 0,
      defenders: positions[2] || 0,
      midfielders: positions[3] || 0,
      forwards: positions[4] || 0,
      isValid:
        (positions[1] || 0) === 1 &&
        (positions[2] || 0) >= 3 &&
        (positions[3] || 0) >= 3 &&
        (positions[4] || 0) >= 1,
    };
  };

  // Handle player click for selection
  const handlePlayerClick = (pick: Pick) => {
    if (selectedPlayer?.element === pick.element) {
      // Deselect if clicking the same player
      setSelectedPlayer(null);
    } else if (selectedPlayer) {
      // Swap players if another is already selected
      handlePlayerSwap(selectedPlayer, pick);
      setSelectedPlayer(null);
    } else {
      // Select the player
      setSelectedPlayer(pick);
    }
  };

  // Handle player swapping with formation validation
  const handlePlayerSwap = (player1: Pick, player2: Pick) => {
    const player1Data = getPlayer(player1.element);
    const player2Data = getPlayer(player2.element);

    if (!player1Data || !player2Data) return;

    // Try to swap the selected player with the clicked player
    const newPicks = [...currentPicks];
    const selectedIndex = newPicks.findIndex(
      (p: Pick) => p.element === player1.element
    );
    const clickedIndex = newPicks.findIndex(
      (p: Pick) => p.element === player2.element
    );

    if (selectedIndex !== -1 && clickedIndex !== -1) {
      // Temporarily swap positions
      const tempPosition = newPicks[selectedIndex].position;
      newPicks[selectedIndex].position = newPicks[clickedIndex].position;
      newPicks[clickedIndex].position = tempPosition;

      // Validate the formation
      const validation = validateFormation(newPicks);

      if (validation.isValid) {
        // Valid formation, apply the swap
        setCurrentPicks(newPicks);
      } else {
        // Invalid formation, show error message
        alert(
          `Invalid formation! Must have: 1 GK (${validation.goalkeepers}), 3+ DEF (${validation.defenders}), 3+ MID (${validation.midfielders}), 1+ FWD (${validation.forwards})`
        );
      }
    }
  };

  const handleCaptainSelect = (pick: Pick) => {
    const newPicks = [...currentPicks];
    const playerIndex = newPicks.findIndex((p) => p.element === pick.element);

    if (playerIndex === -1) return;

    const currentPick = newPicks[playerIndex];

    if (currentPick.is_captain) {
      // Captain toggle
      currentPick.is_captain = false;
      currentPick.multiplier = 1;
    } else {
      // None -> Captain (remove existing captain first)
      newPicks.forEach((p) => {
        p.is_captain = false;
        p.multiplier = 1;
      });

      currentPick.is_captain = true;
      currentPick.multiplier = 2;
    }

    setCurrentPicks(newPicks);
  };

  const startingXI = currentPicks
    .filter((pick) => pick.position <= 11)
    .sort((a, b) => a.position - b.position);
  const bench = currentPicks
    .filter((pick) => pick.position > 11)
    .sort((a, b) => a.position - b.position);

  // Group starting XI by position for formation view
  const getPlayersByPosition = (positionId: number) => {
    return startingXI.filter((pick) => {
      const player = getPlayer(pick.element);
      return player?.element_type === positionId;
    });
  };

  const goalkeepers = getPlayersByPosition(1);
  const defenders = getPlayersByPosition(2);
  const midfielders = getPlayersByPosition(3);
  const forwards = getPlayersByPosition(4);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Team Selection for Gameweek {nextGameweekId}
        </h2>
        <p className="text-gray-600">
          Drag players between starting XI and bench to optimize your lineup
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 w-full">
        {/* <span className="text-sm ">View:</span> */}
        <button
          onClick={() => setIsFormationView(true)}
          className={`flex-1 min-w-[120px] max-w-[160px] py-1 rounded-md text-sm font-medium transition-colors text-center ${
            isFormationView ? "text-white bg-green-600" : " !bg-transparent"
          }`}
        >
          Formation
        </button>
        <button
          onClick={() => setIsFormationView(false)}
          className={`flex-1 min-w-[120px] max-w-[160px] py-1 rounded-md text-sm font-medium transition-colors text-center ${
            !isFormationView ? " text-white bg-green-600" : " !bg-transparent"
          }`}
          style={{ marginLeft: 4 }}
        >
          List
        </button>
      </div>

      {/* Starting XI */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">
          Starting XI ({startingXI.length}/11)
        </h3>

        {isFormationView ? (
          /* Formation View */
          <div className="bg-gradient-to-b from-green-400 to-green-500 p-4 rounded-lg relative min-h-64">
            {/* Pitch markings */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/2 left-0 right-0 h-0.5"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white rounded-full"></div>
            </div>

            <div className="relative z-10 space-y-6">
              {/* Forwards */}
              {forwards.length > 0 && (
                <div className="flex justify-center">
                  <div className="flex gap-3">
                    {forwards.map((pick) => {
                      const player = getPlayer(pick.element);
                      const team = getTeam(player?.team || 0);
                      const position = getPosition(player?.element_type || 0);
                      const nextFixture = player
                        ? getNextFixture(player)
                        : null;

                      if (!player || !team || !position) return null;

                      return (
                        <PlayerCard
                          key={pick.element}
                          pick={pick}
                          player={player}
                          team={team}
                          position={position}
                          nextFixture={nextFixture}
                          isFormationView={true}
                          isBench={false}
                          isSelected={selectedPlayer?.element === pick.element}
                          onDragStart={handleDragStart}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onClick={handlePlayerClick}
                          onCaptainSelect={handleCaptainSelect}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Midfielders */}
              {midfielders.length > 0 && (
                <div className="flex justify-center">
                  <div className="flex gap-3 flex-wrap justify-center">
                    {midfielders.map((pick) => {
                      const player = getPlayer(pick.element);
                      const team = getTeam(player?.team || 0);
                      const position = getPosition(player?.element_type || 0);
                      const nextFixture = player
                        ? getNextFixture(player)
                        : null;

                      if (!player || !team || !position) return null;

                      return (
                        <PlayerCard
                          key={pick.element}
                          pick={pick}
                          player={player}
                          team={team}
                          position={position}
                          nextFixture={nextFixture}
                          isFormationView={true}
                          isBench={false}
                          isSelected={selectedPlayer?.element === pick.element}
                          onDragStart={handleDragStart}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onClick={handlePlayerClick}
                          onCaptainSelect={handleCaptainSelect}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Defenders */}
              {defenders.length > 0 && (
                <div className="flex justify-center">
                  <div className="flex gap-3 flex-wrap justify-center">
                    {defenders.map((pick) => {
                      const player = getPlayer(pick.element);
                      const team = getTeam(player?.team || 0);
                      const position = getPosition(player?.element_type || 0);
                      const nextFixture = player
                        ? getNextFixture(player)
                        : null;

                      if (!player || !team || !position) return null;

                      return (
                        <PlayerCard
                          key={pick.element}
                          pick={pick}
                          player={player}
                          team={team}
                          position={position}
                          nextFixture={nextFixture}
                          isFormationView={true}
                          isBench={false}
                          isSelected={selectedPlayer?.element === pick.element}
                          onDragStart={handleDragStart}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onClick={handlePlayerClick}
                          onCaptainSelect={handleCaptainSelect}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Goalkeeper */}
              {goalkeepers.length > 0 && (
                <div className="flex justify-center">
                  {goalkeepers.map((pick) => {
                    const player = getPlayer(pick.element);
                    const team = getTeam(player?.team || 0);
                    const position = getPosition(player?.element_type || 0);
                    const nextFixture = player ? getNextFixture(player) : null;

                    if (!player || !team || !position) return null;

                    return (
                      <PlayerCard
                        key={pick.element}
                        pick={pick}
                        player={player}
                        team={team}
                        position={position}
                        nextFixture={nextFixture}
                        isFormationView={true}
                        isBench={false}
                        isSelected={selectedPlayer?.element === pick.element}
                        onDragStart={handleDragStart}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onClick={handlePlayerClick}
                        onCaptainSelect={handleCaptainSelect}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Formation Info */}
            <div className="mt-4 text-center text-white">
              Formation: {defenders.length}-{midfielders.length}-
              {forwards.length}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {startingXI.map((pick) => {
              const player = getPlayer(pick.element);
              const team = getTeam(player?.team || 0);
              const position = getPosition(player?.element_type || 0);
              const nextFixture = player ? getNextFixture(player) : null;

              if (!player || !team || !position) return null;

              return (
                <PlayerCard
                  key={pick.element}
                  pick={pick}
                  player={player}
                  team={team}
                  position={position}
                  nextFixture={nextFixture}
                  isFormationView={false}
                  isBench={false}
                  isSelected={selectedPlayer?.element === pick.element}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={handlePlayerClick}
                  onCaptainSelect={handleCaptainSelect}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bench */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Bench ({bench.length}/4)</h3>
        <div className="max-h-64 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {bench.map((pick) => {
              const player = getPlayer(pick.element);
              const team = getTeam(player?.team || 0);
              const position = getPosition(player?.element_type || 0);
              const nextFixture = player ? getNextFixture(player) : null;

              if (!player || !team || !position) return null;

              return (
                <PlayerCard
                  key={pick.element}
                  pick={pick}
                  player={player}
                  team={team}
                  position={position}
                  nextFixture={nextFixture}
                  isFormationView={false}
                  isBench={true}
                  isSelected={selectedPlayer?.element === pick.element}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={handlePlayerClick}
                  onCaptainSelect={handleCaptainSelect}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">How to use:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            • <strong>Drag & Drop:</strong> Drag players between starting XI and
            bench to swap positions
          </li>
          <li>
            • <strong>Click to Select:</strong> Click a player to select them
            (blue highlight), then click another player to swap them with
            formation validation
          </li>
          <li>
            • <strong>Captain Selection:</strong> Click the + button in the
            corner to cycle through captain and no selection
          </li>
          <li>
            • <strong>Formation Rules:</strong> Must have exactly 1 GK, at least
            3 DEF, 3 MID, and 1 FWD in starting XI
          </li>
          <li>
            • <strong>Formation View:</strong> See your team layout on a
            football pitch
          </li>
        </ul>
      </div>
    </div>
  );
}
