"use client";

import { useState, useEffect } from "react";
import { Element, Pick, Team, ElementType, Event } from "@/types/fpl";
import PlayerDetailPopup from "./PlayerDetailPopup";
import TeamInsights from "./TeamInsights";
import TransferSuggestions from "./TransferSuggestions";
import {
  getTeamNews,
  getFixtures,
  generateTransferSuggestions,
} from "@/lib/fpl-api";

interface CurrentSquadProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
  teamPicks?: any; // Full team picks data including entry history
}

export default function CurrentSquad({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
  teamPicks,
}: CurrentSquadProps) {
  const [isFormationView, setIsFormationView] = useState(true);
  const [showSuggestedLineup, setShowSuggestedLineup] = useState(false);
  const [teamNews, setTeamNews] = useState<any>(null);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [suggestedTransfer, setSuggestedTransfer] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    pick: Pick;
    player: Element;
    team: Team;
    position: ElementType;
  } | null>(null);

  // Fetch team news and fixtures on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamNewsData, fixturesData] = await Promise.all([
          getTeamNews().catch(() => null),
          getFixtures().catch(() => []),
        ]);
        setTeamNews(teamNewsData);
        setFixtures(fixturesData);

        // Fetch transfer suggestions for lineup optimization
        if (teamPicks) {
          try {
            const squadData = picks.map((pick) => {
              const player = getPlayer(pick.element);
              const team = getTeam(player?.team || 0);
              const position = getPosition(player?.element_type || 0);

              return {
                ...player,
                web_name: player?.web_name,
                team_name: team?.short_name,
                position_name: position?.singular_name,
                is_captain: pick.is_captain,
                is_vice_captain: pick.is_vice_captain,
                multiplier: pick.multiplier,
                is_in_my_squad: true,
              };
            });

            const teamData = {
              totalPoints: picks.reduce((sum, pick) => {
                const player = getPlayer(pick.element);
                return (
                  sum + (player ? player.total_points * pick.multiplier : 0)
                );
              }, 0),
              squadValue:
                squadData.reduce((sum, p) => sum + (p?.now_cost || 0), 0) / 10,
              currentGameweek: currentEvent,
            };

            const bankBalance = teamPicks?.entry_history?.bank
              ? teamPicks.entry_history.bank / 10
              : 1.0;

            const transferResult = await generateTransferSuggestions(
              teamData,
              squadData,
              elements,
              currentEvent,
              false, // gameweekFinished
              fixturesData,
              bankBalance,
              1 // freeTransfers
            );

            setSuggestedTransfer(transferResult);
          } catch (transferError) {
            console.error(
              "Error fetching transfer suggestions:",
              transferError
            );
          }
        }
      } catch (error) {
        console.error("Error fetching team news or fixtures:", error);
      }
    };

    fetchData();
  }, [currentEvent, teamPicks]);

  const getPlayer = (elementId: number) => {
    return elements.find((el) => el.id === elementId);
  };

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  // Calculate suggested lineup for the NEXT gameweek based on comprehensive analysis
  const calculateSuggestedLineup = () => {
    // Get next gameweek info
    const nextGameweek = events.find((event) => event.is_next);
    const nextGameweekId = nextGameweek?.id || currentEvent + 1;

    // Get fixtures for next gameweek
    const nextGameweekFixtures = fixtures.filter(
      (fixture) => fixture.event === nextGameweekId
    );

    // Create modified squad including suggested transfer
    let modifiedPicks = [...picks];
    if (suggestedTransfer?.transfer_out && suggestedTransfer?.transfer_in) {
      // Remove the transfer out player
      modifiedPicks = modifiedPicks.filter(
        (pick) => pick.element !== suggestedTransfer.transfer_out.id
      );

      // Add the transfer in player
      const transferInPick = {
        element: suggestedTransfer.transfer_in.id,
        position: modifiedPicks.length + 1,
        selling_price: suggestedTransfer.transfer_in.now_cost,
        multiplier: 1,
        purchase_price: suggestedTransfer.transfer_in.now_cost,
        is_captain: false,
        is_vice_captain: false,
      };
      modifiedPicks.push(transferInPick);
    }

    // Score each player based on multiple factors for NEXT gameweek
    const scoredPlayers = modifiedPicks
      .map((pick) => {
        const player = getPlayer(pick.element);
        const team = getTeam(player?.team || 0);

        if (!player) return null;

        // Base performance metrics
        const formScore = parseFloat(player.form) || 0;
        const ppgScore = parseFloat(player.points_per_game) || 0;
        const ictScore = parseFloat(player.ict_index) / 10 || 0;
        const minutesScore = Math.min(player.minutes / 100, 5);
        const expectedScore =
          (parseFloat(player.expected_goals) || 0) +
          (parseFloat(player.expected_assists) || 0);

        // Position-specific bonuses
        const positionBonus =
          player.element_type === 1 || player.element_type === 2
            ? player.clean_sheets * 0.5
            : 0;

        // Fixture difficulty analysis for next gameweek (HEAVILY WEIGHTED)
        const playerFixture = nextGameweekFixtures.find(
          (fixture) =>
            fixture.team_h === player.team || fixture.team_a === player.team
        );

        let fixtureBonus = 1.0;
        let captaincy_score = 0;
        if (playerFixture) {
          const isHome = playerFixture.team_h === player.team;
          const difficulty = isHome
            ? playerFixture.team_h_difficulty
            : playerFixture.team_a_difficulty;

          // HEAVILY weight fixture difficulty - this is now the most important factor
          if (difficulty <= 2) {
            fixtureBonus = 2.0; // Excellent fixtures get massive bonus
            captaincy_score = 3.0; // High captaincy appeal
          } else if (difficulty <= 3) {
            fixtureBonus = 1.2; // Average fixtures get small bonus
            captaincy_score = 1.5; // Moderate captaincy appeal
          } else {
            fixtureBonus = 0.6; // Hard fixtures get significant penalty
            captaincy_score = 0.5; // Low captaincy appeal
          }

          // Home advantage bonus
          if (isHome) {
            fixtureBonus += 0.2;
            captaincy_score += 0.5;
          }
        }

        // Team news impact
        let teamNewsModifier = 1.0;
        if (teamNews?.data?.teams?.[player.team]) {
          const playerTeamNews = teamNews.data.teams[player.team];

          // Check for injuries/suspensions (would need player name matching)
          const hasInjuryConcerns =
            playerTeamNews.injuries?.some((injury: string) =>
              injury.toLowerCase().includes(player.web_name.toLowerCase())
            ) || false;

          const hasSuspension =
            playerTeamNews.suspensions?.some((suspension: string) =>
              suspension.toLowerCase().includes(player.web_name.toLowerCase())
            ) || false;

          const hasRotationRisk =
            playerTeamNews.rotation_risk?.some((risk: string) =>
              risk.toLowerCase().includes(player.web_name.toLowerCase())
            ) || false;

          if (hasInjuryConcerns || hasSuspension) {
            teamNewsModifier = 0.3; // Significant penalty for injury/suspension
          } else if (hasRotationRisk) {
            teamNewsModifier = 0.7; // Moderate penalty for rotation risk
          }
        }

        // Form trend (recent performance vs season average)
        const formTrend = formScore > ppgScore ? 0.5 : -0.2;

        // Minutes reliability (consistent starters get bonus)
        const reliabilityBonus = player.starts > events.length * 0.7 ? 1.0 : 0;

        // Captaincy factors (for captain selection later)
        const attackingBonus = player.element_type >= 3 ? 1.0 : 0.3; // Mids/Forwards better captains
        const premiumBonus = player.now_cost >= 100 ? 0.8 : 0; // Premium players
        const penaltyBonus = player.penalties_saved > 0 ? 0.5 : 0; // Use available penalty stat

        const totalScore =
          (formScore +
            ppgScore +
            ictScore +
            minutesScore +
            expectedScore +
            positionBonus +
            formTrend +
            reliabilityBonus) *
          fixtureBonus * // Heavy fixture weighting
          teamNewsModifier;

        // Separate captaincy score for captain selection
        const captaincyScore =
          (formScore * 1.5 + // Form is crucial for captaincy
            ppgScore * 2.0 + // Points per game very important
            expectedScore * 1.5 +
            attackingBonus +
            premiumBonus +
            penaltyBonus) *
          captaincy_score * // Fixture captaincy appeal
          teamNewsModifier;

        return {
          pick,
          player,
          team,
          position: getPosition(player.element_type),
          score: totalScore,
          captaincyScore,
          isCurrentlySelected: pick.position <= 11,
          nextGameweekPrediction: {
            fixtureRating: fixtureBonus,
            formTrend: formTrend > 0 ? "rising" : "falling",
            reliability: reliabilityBonus > 0 ? "high" : "medium",
            teamNewsImpact: teamNewsModifier < 1.0 ? "negative" : "neutral",
            fixture: playerFixture
              ? {
                  opponent:
                    playerFixture.team_h === player.team
                      ? teams.find((t) => t.id === playerFixture.team_a)
                          ?.short_name
                      : teams.find((t) => t.id === playerFixture.team_h)
                          ?.short_name,
                  isHome: playerFixture.team_h === player.team,
                  difficulty:
                    playerFixture.team_h === player.team
                      ? playerFixture.team_h_difficulty
                      : playerFixture.team_a_difficulty,
                }
              : null,
          },
        };
      })
      .filter(Boolean);

    // Group by position
    const playersByPosition = {
      1: scoredPlayers
        .filter((p) => p!.player.element_type === 1)
        .sort((a, b) => b!.score - a!.score), // GK
      2: scoredPlayers
        .filter((p) => p!.player.element_type === 2)
        .sort((a, b) => b!.score - a!.score), // DEF
      3: scoredPlayers
        .filter((p) => p!.player.element_type === 3)
        .sort((a, b) => b!.score - a!.score), // MID
      4: scoredPlayers
        .filter((p) => p!.player.element_type === 4)
        .sort((a, b) => b!.score - a!.score), // FWD
    };

    // Select optimal formation based on available players
    // Try common formations: 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1
    const formations = [
      { def: 3, mid: 4, fwd: 3, name: "3-4-3" },
      { def: 3, mid: 5, fwd: 2, name: "3-5-2" },
      { def: 4, mid: 3, fwd: 3, name: "4-3-3" },
      { def: 4, mid: 4, fwd: 2, name: "4-4-2" },
      { def: 4, mid: 5, fwd: 1, name: "4-5-1" },
      { def: 5, mid: 3, fwd: 2, name: "5-3-2" },
      { def: 5, mid: 4, fwd: 1, name: "5-4-1" },
    ];

    // Find best formation based on available players and their scores
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

    // Build suggested starting XI
    const suggestedXI = [
      ...playersByPosition[1].slice(0, 1), // 1 GK
      ...playersByPosition[2].slice(0, bestFormation.def), // Defenders
      ...playersByPosition[3].slice(0, bestFormation.mid), // Midfielders
      ...playersByPosition[4].slice(0, bestFormation.fwd), // Forwards
    ];

    // Select Captain and Vice-Captain based on captaincy scores
    const captainCandidates = suggestedXI
      .filter((p) => p!.player.element_type >= 3) // Only midfielders and forwards
      .sort((a, b) => b!.captaincyScore - a!.captaincyScore);

    // If no attacking players, consider all starting XI
    if (captainCandidates.length === 0) {
      captainCandidates.push(
        ...suggestedXI.sort((a, b) => b!.captaincyScore - a!.captaincyScore)
      );
    }

    const captain = captainCandidates[0];
    const viceCaptain =
      captainCandidates[1] || suggestedXI.find((p) => p !== captain);

    // Create modified picks for suggested lineup without affecting original picks
    const suggestedXIWithCaptaincy = suggestedXI.map((p) => ({
      ...p,
      pick: {
        ...p!.pick,
        is_captain: p === captain,
        is_vice_captain: p === viceCaptain,
      },
    }));

    // Remaining players go to bench
    const allSelected = suggestedXI.map((p) => p!.pick.element);
    const bench = scoredPlayers
      .filter((p) => !allSelected.includes(p!.pick.element))
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 4);

    return {
      startingXI: suggestedXIWithCaptaincy,
      bench,
      formation: bestFormation,
      captain: captain?.player,
      viceCaptain: viceCaptain?.player,
      changes: calculateLineupChanges(suggestedXI, bench),
      nextGameweekId,
      confidenceLevel: bestScore > 0 ? "high" : "medium",
    };
  };

  // Calculate what changes need to be made from current lineup
  const calculateLineupChanges = (
    suggestedXI: any[],
    suggestedBench: any[]
  ) => {
    const currentXI = picks
      .filter((pick) => pick.position <= 11)
      .map((pick) => pick.element);
    const suggestedXIIds = suggestedXI.map((p) => p!.pick.element);

    const toRemove = currentXI.filter((id) => !suggestedXIIds.includes(id));
    const toAdd = suggestedXIIds.filter((id) => !currentXI.includes(id));

    return {
      toRemove: toRemove.map((id) => {
        const pick = picks.find((p) => p.element === id);
        const player = getPlayer(id);
        return { pick, player };
      }),
      toAdd: toAdd.map((id) => {
        const pick = picks.find((p) => p.element === id);
        const player = getPlayer(id);
        return { pick, player };
      }),
      swapCount: toAdd.length,
    };
  };

  const suggestedLineup = calculateSuggestedLineup();

  const startingXI = showSuggestedLineup
    ? suggestedLineup.startingXI.map((p) => p!.pick)
    : picks.filter((pick) => pick.position <= 11);
  const bench = showSuggestedLineup
    ? suggestedLineup.bench.map((p) => p!.pick)
    : picks.filter((pick) => pick.position > 11);

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

    // Check if this is a suggested transfer
    const isTransferIn = suggestedTransfer?.transfer_in?.id === player.id;
    const isTransferOut = suggestedTransfer?.transfer_out?.id === player.id;

    // Check if this player is part of suggested changes
    const currentPick = picks.find((p) => p.element === pick.element);
    const isCurrentlySelected = currentPick
      ? currentPick.position <= 11
      : false;
    const isNewSuggestion =
      showSuggestedLineup && !isCurrentlySelected && !isBench;
    const isBenchedSuggestion =
      showSuggestedLineup && isCurrentlySelected && isBench;

    // Get next gameweek fixture info for this player
    const nextGameweekId = suggestedLineup.nextGameweekId;
    const playerFixture = fixtures.find(
      (fixture) =>
        fixture.event === nextGameweekId &&
        (fixture.team_h === player.team || fixture.team_a === player.team)
    );

    const fixtureInfo = playerFixture
      ? {
          opponent:
            playerFixture.team_h === player.team
              ? teams.find((t) => t.id === playerFixture.team_a)?.short_name
              : teams.find((t) => t.id === playerFixture.team_h)?.short_name,
          isHome: playerFixture.team_h === player.team,
          difficulty:
            playerFixture.team_h === player.team
              ? playerFixture.team_h_difficulty
              : playerFixture.team_a_difficulty,
        }
      : null;

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
              : isNewSuggestion
              ? "border-green-500 bg-green-50"
              : isBenchedSuggestion
              ? "border-orange-400 bg-orange-50"
              : " border-green-300"
          }`}
        >
          {/* Suggestion indicators */}
          {isNewSuggestion && (
            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              ↑
            </div>
          )}
          {isBenchedSuggestion && (
            <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              ↓
            </div>
          )}
          {isTransferIn && (
            <div className="absolute -top-1 -left-1 bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              ⚡
            </div>
          )}
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
            {/* Show fixture info when in suggested lineup mode */}
            {showSuggestedLineup && fixtureInfo && (
              <div
                className={`text-xs mt-1 px-1 py-0.5 rounded ${
                  fixtureInfo.difficulty <= 2
                    ? "bg-green-100 text-green-700"
                    : fixtureInfo.difficulty <= 3
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                GW{nextGameweekId}: {fixtureInfo.isHome ? "vs" : "@"}{" "}
                {fixtureInfo.opponent}
              </div>
            )}
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
        className={`relative p-3 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${
          isBench ? " border-gray-300" : " border-gray-200"
        } ${pick.is_captain ? "ring-2 ring-yellow-400" : ""} ${
          pick.is_vice_captain ? "ring-2 ring-yellow-200" : ""
        } ${isNewSuggestion ? "border-green-500 bg-green-50" : ""} ${
          isBenchedSuggestion ? "border-orange-400 bg-orange-50" : ""
        }`}
      >
        {/* Suggestion indicators */}
        {isNewSuggestion && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            ↑
          </div>
        )}
        {isBenchedSuggestion && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            ↓
          </div>
        )}
        {isTransferIn && (
          <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            ⚡
          </div>
        )}
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
            {/* Show fixture info when in suggested lineup mode */}
            {showSuggestedLineup && fixtureInfo && (
              <div
                className={`inline-block ml-2 px-2 py-1 rounded text-xs ${
                  fixtureInfo.difficulty <= 2
                    ? "bg-green-100 text-green-700"
                    : fixtureInfo.difficulty <= 3
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                GW{nextGameweekId}: {fixtureInfo.isHome ? "vs" : "@"}{" "}
                {fixtureInfo.opponent}
              </div>
            )}
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

          {/* Suggested Lineup Toggle */}
          <div className="flex items-center justify-center gap-2 w-full">
            <button
              onClick={() => setShowSuggestedLineup(!showSuggestedLineup)}
              className={`flex-1 min-w-[200px] max-w-[280px] py-2 rounded-md text-sm font-medium transition-colors text-center ${
                showSuggestedLineup
                  ? "text-white bg-blue-100"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
            >
              {showSuggestedLineup
                ? "Show Current Lineup"
                : `Show GW${suggestedLineup.nextGameweekId} suggestions`}
            </button>
          </div>

          {/* Suggested Lineup Info */}
          {showSuggestedLineup && (
            <div className=" border border-blue-200 rounded-lg p-3 w-full">
              <div className="text-center">
                <h4 className="font-semibold text-blue-800 mb-2">
                  Gameweek {suggestedLineup.nextGameweekId} Prediction:{" "}
                  {suggestedLineup.formation.name}
                  {suggestedTransfer && (
                    <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                      ⚡ With Transfer
                    </span>
                  )}
                </h4>

                {/* Captain and Vice-Captain Display */}
                <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="text-sm text-yellow-800">
                    <span className="font-semibold">Captain: </span>
                    <span className="font-medium">
                      {suggestedLineup.captain?.web_name}
                    </span>
                    <span className="mx-2">|</span>
                    <span className="font-semibold">Vice: </span>
                    <span className="font-medium">
                      {suggestedLineup.viceCaptain?.web_name}
                    </span>
                  </div>
                  <div className="text-xs text-yellow-600 mt-1">
                    Based on fixture difficulty, form & attacking potential
                  </div>
                </div>

                <p className="text-xs text-blue-600 mb-2">
                  Based on form, fixtures, team news & injury reports
                  {suggestedTransfer && " + suggested transfer"}
                </p>
                {suggestedLineup.changes.swapCount > 0 ? (
                  <div className="text-sm text-blue-700">
                    <p className="mb-1">
                      Recommended changes: {suggestedLineup.changes.swapCount}{" "}
                      players
                    </p>
                    {suggestedLineup.changes.toAdd.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium">Bring in: </span>
                        {suggestedLineup.changes.toAdd.map((change, idx) => (
                          <span key={change.player?.id}>
                            {change.player?.web_name}
                            {idx < suggestedLineup.changes.toAdd.length - 1
                              ? ", "
                              : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {suggestedLineup.changes.toRemove.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium">Bench: </span>
                        {suggestedLineup.changes.toRemove.map((change, idx) => (
                          <span key={change.player?.id}>
                            {change.player?.web_name}
                            {idx < suggestedLineup.changes.toRemove.length - 1
                              ? ", "
                              : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-green-700">
                    ✅ Your current lineup looks optimal for GW
                    {suggestedLineup.nextGameweekId}!
                  </p>
                )}
                {teamNews?.data && (
                  <p className="text-xs text-gray-600 mt-2">
                    Team news last updated:{" "}
                    {new Date(teamNews.data.lastUpdated).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="text-right">
            <p className="text-sm ">Gameweek {currentEvent}</p>
            <p className="text-xl font-bold">{totalPoints} points</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-center">
          {showSuggestedLineup
            ? `${
                isFormationView
                  ? `GW${suggestedLineup.nextGameweekId} Predicted Formation`
                  : `GW${suggestedLineup.nextGameweekId} Predicted XI`
              }`
            : `${
                isFormationView ? "Starting XI - Formation View" : "Starting XI"
              }`}
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
              Formation:{" "}
              {showSuggestedLineup
                ? suggestedLineup.formation.name
                : `${defenders.length}-${midfielders.length}-${forwards.length}`}
              {showSuggestedLineup && (
                <span className="ml-2 text-blue-600 font-medium">
                  (GW{suggestedLineup.nextGameweekId} Prediction)
                </span>
              )}
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
        <h3 className="text-lg font-semibold mb-3">
          {showSuggestedLineup
            ? `GW${suggestedLineup.nextGameweekId} Predicted Bench`
            : "Bench"}
        </h3>
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
          teamPicks={teamPicks}
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
