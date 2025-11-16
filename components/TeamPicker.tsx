"use client";

import { useState, useEffect } from "react";
import { Element, Pick, Team, ElementType, Event } from "@/types/fpl";
import { getFixtures, getTeamInfo } from "@/lib/fpl-api";

interface TeamPickerProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
  teamPicks?: any;
  teamId?: number;
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
  canBeReplaced?: boolean;
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
  canBeReplaced = false,
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
    // Formation view for starting XI - MATCH CurrentSquad
    return (
      <div className="gradient-border rounded-lg p-0 w-16 md:w-24 h-20 md:h-32">
        <div
          draggable
          onDragStart={() => onDragStart(player, pick, false)}
          onDrop={() => onDrop(pick)}
          onDragOver={onDragOver}
          onClick={() => onClick(pick)}
          className={`relative flex flex-col p-1 md:p-3 rounded-lg transition-all cursor-pointer w-full h-full bg-green-300 overflow-y-auto overflow-x-hidden ${
            isSelected
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
              : canBeReplaced
              ? "border-orange-400 bg-orange-50 ring-2 ring-orange-300"
              : pick.is_captain
              ? "border-yellow-400"
              : pick.is_vice_captain
              ? "border-yellow-300"
              : "border-green-300"
          } ${className}`}
        >
          {/* Player Name and Team */}
          <div className="text-center mb-0.5 md:mb-2">
            <h3 className="font-semibold text-[10px] md:text-sm leading-tight">
              {player.web_name}
            </h3>
            <p className="text-[8px] md:text-xs ">
              {team.short_name} - {position.singular_name_short}
            </p>
          </div>

          {/* Stats */}
          <div className="text-center mb-0.5 md:mb-2">
            <p className="text-[10px] md:text-sm font-bold text-green-700">
              {player.total_points}pts
            </p>
            <p className="text-[8px] md:text-xs ">
              £{(player.now_cost / 10).toFixed(1)}m
            </p>
          </div>

          {/* Form and Minutes - Hidden on mobile */}
          <div className="hidden md:block text-center text-xs mb-2">
            <div>Form: {player.form}</div>
            <div className="text-gray-700">{player.minutes} mins</div>
            <div className="mt-1">
              <div>PPG: {player.points_per_game}</div>
              <div className="flex justify-center gap-1 text-xs">
                <span className="text-green-600">G{player.goals_scored}</span>
                <span className="text-blue-600">A{player.assists}</span>
                {player.clean_sheets > 0 && (
                  <span className="text-purple-600">
                    CS{player.clean_sheets}
                  </span>
                )}
              </div>
            </div>
            {/* Fixture info */}
            {nextFixture && (
              <div
                className={`text-xs mt-1 px-1 py-0.5 rounded ${
                  fixtureDifficulty <= 2
                    ? "bg-green-100 text-green-700"
                    : fixtureDifficulty <= 3
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {fixtureText} ({fixtureDifficulty})
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
            {/* Captain select button (optional, keep if you want quick selection) */}
            {!pick.is_captain && !pick.is_vice_captain && !isBench && (
              <span
                className="hidden md:inline px-2 py-1 bg-gray-200 text-xs rounded font-bold cursor-pointer hover:bg-yellow-200"
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
  }

  // List view for bench or detailed view
  return (
    <div
      draggable
      onDragStart={() => onDragStart(player, pick, isBench)}
      onDrop={() => onDrop(pick)}
      onDragOver={onDragOver}
      onClick={() => onClick(pick)}
      className={`relative p-3 rounded-lg cursor-pointer ${
        isSelected
          ? "ring-1 ring-blue-300 bg-green-300"
          : canBeReplaced
          ? "ring-1 ring-orange-300"
          : isBench
          ? "border-gray-300"
          : "border-green-300"
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
          {canBeReplaced && (
            <span className="px-1 py-0.5 bg-orange-400 text-xs rounded font-bold text-white">
              Replace
            </span>
          )}
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
  teamId,
}: TeamPickerProps) {
  const [currentPicks, setCurrentPicks] = useState<Pick[]>(picks);
  const [originalPicks] = useState<Pick[]>(picks); // Store original picks to track changes
  const [isFormationView, setIsFormationView] = useState(true);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [draggedPlayer, setDraggedPlayer] = useState<DraggedPlayer | null>(
    null
  );
  const [selectedPlayer, setSelectedPlayer] = useState<Pick | null>(null);

  // New state for player browser
  const [showPlayerBrowser, setShowPlayerBrowser] = useState(false);
  const [browserPosition, setBrowserPosition] = useState<number | null>(null);
  const [browserTeam, setBrowserTeam] = useState<number | null>(null);
  const [browserSearchTerm, setBrowserSearchTerm] = useState("");
  const [browserSortBy, setBrowserSortBy] = useState<
    "total_points" | "form" | "now_cost" | "ict_index"
  >("total_points");
  const [browserSortOrder, setBrowserSortOrder] = useState<"asc" | "desc">(
    "desc"
  );
  const [selectedPlayerToBuy, setSelectedPlayerToBuy] =
    useState<Element | null>(null);

  // State for collapsible instructions
  const [showInstructions, setShowInstructions] = useState(false);

  const nextGameweek = events.find((event) => event.is_next);
  const nextGameweekId = nextGameweek?.id || currentEvent + 1;

  const [teamInfo, setTeamInfo] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        //console.log("Fetching fixtures data...");
        const fixturesData = await getFixtures();
        //console.log(
        //   "Fixtures data received:",
        //   fixturesData?.length || 0,
        //   "fixtures"
        // );
        setFixtures(fixturesData);
      } catch (error) {
        console.error("Error fetching fixtures data:", error);
        // Set empty array as fallback
        setFixtures([]);
      }
    };

    fetchData();
  }, [currentEvent]);

  const getPlayer = (elementId: number) =>
    elements.find((el) => el.id === elementId);
  const getTeam = (teamId: number) => teams.find((team) => team.id === teamId);
  const getPosition = (elementTypeId: number) =>
    elementTypes.find((type) => type.id === elementTypeId);

  // Calculate dynamic transfer stats
  const calculateTransferStats = () => {
    const originalPlayerIds = new Set(originalPicks.map((p) => p.element));
    const currentPlayerIds = new Set(currentPicks.map((p) => p.element));

    // Find players that were transferred out (in original but not in current)
    const actualTransfersOut = originalPicks.filter(
      (p) => !currentPlayerIds.has(p.element)
    );

    // Find players that were transferred in (in current but not in original)
    const actualTransfersIn = currentPicks.filter(
      (p) => !originalPlayerIds.has(p.element)
    );

    const numTransfers = actualTransfersOut.length; // Should equal actualTransfersIn.length

    // Calculate budget change (money spent on new players - money gained from sold players)
    let budgetChange = 0;
    actualTransfersOut.forEach((pick) => {
      const player = getPlayer(pick.element);
      // When selling, we get the selling_price (which is the price we can sell at)
      budgetChange += pick.selling_price || player?.now_cost || 0;
    });
    actualTransfersIn.forEach((pick) => {
      const player = getPlayer(pick.element);
      // When buying, we pay the current price
      budgetChange -= player?.now_cost || 0;
    });

    // Calculate current team value (sum of all player prices)
    const currentTeamValue = currentPicks.reduce((sum, pick) => {
      const player = getPlayer(pick.element);
      return sum + (player?.now_cost || 0);
    }, 0);

    // Calculate original budget and team value from teamInfo
    const originalBudget = teamInfo?.last_deadline_bank || 0;
    const originalTeamValue = teamInfo?.last_deadline_value || 0;

    // New budget = original budget + budget change
    const newBudget = originalBudget + budgetChange;

    // Free transfers calculation - use same logic as TransferSuggestions
    const originalFreeTransfers = teamPicks?.transfers
      ? teamPicks.transfers.limit === null
        ? 999 // Unlimited (wildcard/free hit)
        : teamPicks.transfers.limit - teamPicks.transfers.made // Don't use Math.max here, made might include transfers from this session
      : 1; // Default to 1 free transfer

    const freeTransfersRemaining = Math.max(
      0,
      originalFreeTransfers - numTransfers
    );
    const extraTransfers = Math.max(0, numTransfers - originalFreeTransfers);
    const transferCost = extraTransfers * 4;

    return {
      numTransfers,
      budgetChange,
      newBudget,
      currentTeamValue,
      freeTransfersRemaining,
      originalFreeTransfers,
      transferCost,
      extraTransfers,
    };
  };

  const transferStats = calculateTransferStats();

  useEffect(() => {
    async function fetchTeamInfo() {
      if (!teamId) return;
      try {
        //console.log("TEAM\n\n ID\n\n\n ID\n\n\n ID DID", teamId);
        const info = await getTeamInfo(teamId);
        setTeamInfo(info);
      } catch (e) {
        setTeamInfo(null);
      }
    }
    fetchTeamInfo();
  }, []);

  // Get players not in current squad
  const getAvailablePlayers = () => {
    const currentPlayerIds = currentPicks.map((pick) => pick.element);
    return elements.filter((element) => !currentPlayerIds.includes(element.id));
  };

  // Filter and sort available players for browser
  const getFilteredAvailablePlayers = () => {
    const availablePlayers = getAvailablePlayers();

    return availablePlayers
      .filter((element) => {
        const matchesPosition =
          browserPosition === null || element.element_type === browserPosition;
        const matchesTeam =
          browserTeam === null || element.team === browserTeam;
        const matchesSearch =
          browserSearchTerm === "" ||
          element.web_name
            .toLowerCase()
            .includes(browserSearchTerm.toLowerCase()) ||
          element.first_name
            .toLowerCase()
            .includes(browserSearchTerm.toLowerCase()) ||
          element.second_name
            .toLowerCase()
            .includes(browserSearchTerm.toLowerCase());
        return matchesPosition && matchesTeam && matchesSearch;
      })
      .sort((a, b) => {
        let aValue: number, bValue: number;

        switch (browserSortBy) {
          case "total_points":
            aValue = a.total_points;
            bValue = b.total_points;
            break;
          case "form":
            aValue = parseFloat(a.form) || 0;
            bValue = parseFloat(b.form) || 0;
            break;
          case "now_cost":
            aValue = a.now_cost;
            bValue = b.now_cost;
            break;
          case "ict_index":
            aValue = parseFloat(a.ict_index) || 0;
            bValue = parseFloat(b.ict_index) || 0;
            break;
          default:
            aValue = 0;
            bValue = 0;
        }

        return browserSortOrder === "desc" ? bValue - aValue : aValue - bValue;
      })
      .slice(0, 50); // Limit to top 50 for performance
  };

  const handleBrowserSort = (newSortBy: typeof browserSortBy) => {
    if (browserSortBy === newSortBy) {
      setBrowserSortOrder(browserSortOrder === "desc" ? "asc" : "desc");
    } else {
      setBrowserSortBy(newSortBy);
      setBrowserSortOrder("desc");
    }
  };
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
    //console.log(
    //   "Getting fixture for player:",
    //   player.web_name,
    //   "team:",
    //   player.team,
    //   "nextGameweekId:",
    //   nextGameweekId,
    //   "fixtures count:",
    //   fixtures.length
    // );

    const fixture = fixtures.find(
      (f) =>
        f.event === nextGameweekId &&
        (f.team_h === player.team || f.team_a === player.team)
    );

    //console.log("Found fixture:", fixture ? "YES" : "NO", fixture);

    if (!fixture) return null;

    const isHome = fixture.team_h === player.team;
    const opponentId = isHome ? fixture.team_a : fixture.team_h;
    const opponent = teams.find((t) => t.id === opponentId);

    const result = {
      opponent: opponent?.short_name || "TBD",
      isHome,
      difficulty: isHome
        ? fixture.team_h_difficulty
        : fixture.team_a_difficulty,
    };

    //console.log("Returning fixture result:", result);
    return result;
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

    // Swap positions - create new objects to avoid mutating state
    const draggedPosition = newPicks[draggedIndex].position;
    const targetPosition = newPicks[targetIndex].position;

    newPicks[draggedIndex] = {
      ...newPicks[draggedIndex],
      position: targetPosition,
    };
    newPicks[targetIndex] = {
      ...newPicks[targetIndex],
      position: draggedPosition,
    };

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
    // If a player is selected for buying, replace the clicked player
    if (selectedPlayerToBuy) {
      handlePlayerReplacement(pick.element, selectedPlayerToBuy);
      return;
    }

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
      // Swap positions - create new objects to avoid mutating state
      const tempPosition = newPicks[selectedIndex].position;
      newPicks[selectedIndex] = {
        ...newPicks[selectedIndex],
        position: newPicks[clickedIndex].position,
      };
      newPicks[clickedIndex] = {
        ...newPicks[clickedIndex],
        position: tempPosition,
      };

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

  // Handle replacing a current player with a new player
  const handlePlayerReplacement = (
    currentPickElement: number,
    newPlayer: Element
  ) => {
    const newPicks = [...currentPicks];
    const pickIndex = newPicks.findIndex(
      (p) => p.element === currentPickElement
    );

    if (pickIndex === -1) return;

    // Create new pick with same position but new player
    const oldPick = newPicks[pickIndex];
    const newPick: Pick = {
      element: newPlayer.id,
      position: oldPick.position,
      multiplier: oldPick.is_captain ? 2 : 1,
      is_captain: oldPick.is_captain,
      is_vice_captain: oldPick.is_vice_captain,
      selling_price: oldPick.selling_price,
      purchase_price: newPlayer.now_cost,
    };

    // Validate the formation with the new player
    const tempPicks = [...newPicks];
    tempPicks[pickIndex] = newPick;
    const validation = validateFormation(tempPicks);

    if (validation.isValid) {
      setCurrentPicks(tempPicks);
      setSelectedPlayerToBuy(null);
      setShowPlayerBrowser(false);
    } else {
      alert(
        `Invalid formation with this replacement! Must have: 1 GK (${validation.goalkeepers}), 3+ DEF (${validation.defenders}), 3+ MID (${validation.midfielders}), 1+ FWD (${validation.forwards})`
      );
    }
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

  // Sortable header component for browser
  const BrowserSortableHeader = ({
    field,
    children,
  }: {
    field: typeof browserSortBy;
    children: React.ReactNode;
  }) => (
    <th
      className="text-center py-2 cursor-pointer px-3 hover:bg-gray-100"
      onClick={() => handleBrowserSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        {browserSortBy === field && (
          <span className="text-xs">
            {browserSortOrder === "desc" ? "↓" : "↑"}
          </span>
        )}
      </div>
    </th>
  );

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
        {(teamInfo || teamPicks) && (
          <div className="mt-2 flex justify-center gap-3 md:gap-6 text-xs md:text-sm text-gray-800 flex-wrap">
            {teamInfo && (
              <>
                <span
                  className={
                    transferStats.budgetChange !== 0 ? "font-semibold" : ""
                  }
                >
                  <strong>Budget:</strong> £
                  {(transferStats.newBudget / 10).toFixed(1)}m
                  {transferStats.budgetChange !== 0 && (
                    <span
                      className={
                        transferStats.budgetChange > 0
                          ? "text-green-600 ml-1"
                          : "text-red-600 ml-1"
                      }
                    >
                      ({transferStats.budgetChange > 0 ? "+" : ""}
                      {(transferStats.budgetChange / 10).toFixed(1)}m)
                    </span>
                  )}
                </span>
                <span
                  className={
                    transferStats.numTransfers > 0 ? "font-semibold" : ""
                  }
                >
                  <strong>Team Value:</strong> £
                  {(transferStats.currentTeamValue / 10).toFixed(1)}m
                </span>
              </>
            )}
            <span
              className={transferStats.numTransfers > 0 ? "font-semibold" : ""}
            >
              <strong>Free Transfers:</strong>{" "}
              {transferStats.originalFreeTransfers === 999
                ? "Unlimited"
                : `${transferStats.freeTransfersRemaining}/${transferStats.originalFreeTransfers}`}
              {transferStats.numTransfers > 0 && (
                <span className="text-blue-600 ml-1">
                  ({transferStats.numTransfers} made)
                </span>
              )}
            </span>
            {transferStats.transferCost > 0 && (
              <span className="font-semibold text-red-600">
                <strong>Points Cost:</strong> -{transferStats.transferCost}pts (
                {transferStats.extraTransfers} × 4pts)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 w-full flex-wrap">
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
        {transferStats.numTransfers > 0 && (
          <button
            onClick={() => {
              setCurrentPicks(originalPicks);
              setSelectedPlayerToBuy(null);
            }}
            className="px-4 py-1 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Reset Transfers ({transferStats.numTransfers})
          </button>
        )}
      </div>

      {/* Starting XI */}
      <div className="border rounded-lg p-4 flex justify-center flex-col no-gradient-border">
        <h3 className="text-lg font-semibold mb-4 text-center">
          Starting XI ({startingXI.length}/11)
        </h3>

        {isFormationView ? (
          // --- Formation View (MATCH CurrentSquad) ---
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
              <div className="relative z-10 space-y-4 sm:space-y-12 md:space-y-20">
                {/* Forwards */}
                {forwards.length > 0 && (
                  <div className="flex justify-center">
                    <div className="flex gap-1 md:gap-4 justify-center">
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
                            isSelected={
                              selectedPlayer?.element === pick.element
                            }
                            canBeReplaced={!!selectedPlayerToBuy}
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
                    <div className="flex gap-1 md:gap-4 justify-center flex-wrap">
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
                            isSelected={
                              selectedPlayer?.element === pick.element
                            }
                            canBeReplaced={!!selectedPlayerToBuy}
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
                    <div className="flex gap-1 md:gap-4 justify-center flex-wrap">
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
                            isSelected={
                              selectedPlayer?.element === pick.element
                            }
                            canBeReplaced={!!selectedPlayerToBuy}
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
                    <div className="flex justify-center">
                      {goalkeepers.map((pick) => {
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
                            isSelected={
                              selectedPlayer?.element === pick.element
                            }
                            canBeReplaced={!!selectedPlayerToBuy}
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
                  canBeReplaced={!!selectedPlayerToBuy}
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
      <div className="border rounded-lg p-4 no-gradient-border">
        <h3 className="text-lg font-semibold mb-4">Bench ({bench.length}/4)</h3>
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
                canBeReplaced={!!selectedPlayerToBuy}
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

      {/* Instructions */}
      <div className="border border-blue-200 rounded-lg">
        <div
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-blue-50 transition-colors rounded-t-lg"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          <h4 className="font-semibold text-blue-800">How to use</h4>
          <button className="text-blue-800">
            {showInstructions ? "▲" : "▼"}
          </button>
        </div>
        {showInstructions && (
          <div className="px-4 pb-4 border-t border-blue-200">
            <ul className="text-sm text-blue-700 space-y-1 mt-2">
              <li>
                • <strong>Drag & Drop:</strong> Drag players between starting XI
                and bench to swap positions
              </li>
              <li>
                • <strong>Click to Select:</strong> Click a player to select
                them (blue highlight), then click another player to swap them
                with formation validation
              </li>
              <li>
                • <strong>Captain Selection:</strong> Click the + button in the
                corner to cycle through captain and no selection
              </li>
              <li>
                • <strong>Formation Rules:</strong> Must have exactly 1 GK, at
                least 3 DEF, 3 MID, and 1 FWD in starting XI
              </li>
              <li>
                • <strong>Formation View:</strong> See your team layout on a
                football pitch
              </li>
              <li>
                • <strong>Player Browser:</strong> Browse available players
                below to replace current squad members
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Player Browser Toggle */}
      <div className="text-center">
        <button
          onClick={() => setShowPlayerBrowser(!showPlayerBrowser)}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            showPlayerBrowser
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {showPlayerBrowser
            ? "Hide Player Browser"
            : "Browse Available Players"}
        </button>
        {selectedPlayerToBuy && (
          <p className="text-sm text-green-600 mt-2">
            Player selected: {selectedPlayerToBuy.web_name} - Click a current
            player to replace them
          </p>
        )}
      </div>

      {/* Player Browser */}
      {showPlayerBrowser && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">
            Available Players ({getAvailablePlayers().length} total)
          </h3>

          {/* Browser Filters */}
          <div className="mb-4 flex flex-wrap gap-4 items-center justify-center">
            <div>
              <select
                value={browserPosition || ""}
                onChange={(e) =>
                  setBrowserPosition(
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
              >
                <option value="">All Positions</option>
                {elementTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.plural_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <input
                type="text"
                value={browserSearchTerm}
                onChange={(e) => setBrowserSearchTerm(e.target.value)}
                placeholder="Search players..."
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
              />
            </div>

            <div>
              <select
                value={browserTeam || ""}
                onChange={(e) =>
                  setBrowserTeam(
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
              >
                <option value="">All Teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.short_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Browser Table */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100">
                <tr className="border-b">
                  <th className="text-center py-2 px-3">Player</th>
                  <th className="text-center py-2 px-3">Team</th>
                  <th className="text-center py-2 px-3">Pos</th>
                  <BrowserSortableHeader field="total_points">
                    Points
                  </BrowserSortableHeader>
                  <BrowserSortableHeader field="form">
                    Form
                  </BrowserSortableHeader>
                  <BrowserSortableHeader field="now_cost">
                    Price
                  </BrowserSortableHeader>
                  <BrowserSortableHeader field="ict_index">
                    ICT
                  </BrowserSortableHeader>
                  <th className="text-center py-2 px-3">Selected %</th>
                  <th className="text-center py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredAvailablePlayers().map((element) => {
                  const team = getTeam(element.team);
                  const position = getPosition(element.element_type);
                  const nextFixture = getNextFixture(element);
                  const isSelected = selectedPlayerToBuy?.id === element.id;

                  return (
                    <tr
                      key={element.id}
                      className={`border-b hover:bg-gray-100 cursor-pointer ${
                        isSelected ? "bg-green-100 border-green-300" : ""
                      }`}
                      onClick={() =>
                        setSelectedPlayerToBuy(isSelected ? null : element)
                      }
                    >
                      <td className="py-3 text-center">
                        <div>
                          <div className="font-medium">{element.web_name}</div>
                          <div className="text-xs text-gray-600">
                            {element.first_name}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center">{team?.short_name}</td>
                      <td className="py-3 text-center">
                        {position?.singular_name_short}
                      </td>
                      <td className="py-3 font-semibold text-center">
                        {element.total_points}
                      </td>
                      <td className="py-3 text-center">{element.form}</td>
                      <td className="py-3 text-center">
                        £{(element.now_cost / 10).toFixed(1)}m
                      </td>
                      <td className="py-3 text-center">{element.ict_index}</td>
                      <td className="py-3 text-center">
                        {element.selected_by_percent}%
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlayerToBuy(isSelected ? null : element);
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            isSelected
                              ? "bg-red-500 text-white hover:bg-red-600"
                              : "bg-green-500 text-white hover:bg-green-600"
                          }`}
                        >
                          {isSelected ? "Deselect" : "Select"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {getFilteredAvailablePlayers().length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No available players found matching your criteria
            </div>
          )}

          {/* Instructions for replacement */}
          {selectedPlayerToBuy && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>{selectedPlayerToBuy.web_name}</strong> selected. Now
                click on any current player in your squad above to replace them.
                The replacement must maintain valid formation rules.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
