"use client";

import { useState, useEffect } from "react";
import { Element, Pick, Team, ElementType, Event } from "@/types/fpl";
import PlayerDetailPopup from "./PlayerDetailPopup";
import TeamInsights from "./TeamInsights";
import TransferSuggestions from "./TransferSuggestions";
import PointsBreakdownModal from "./PointsBreakdownModal";
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
  teamHistory?: any; // Team history with weekly scores
  userLeagues?: any[]; // User's leagues with rankings
}

export default function CurrentSquad({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
  teamPicks,
  teamHistory,
  userLeagues,
}: CurrentSquadProps) {
  const [isFormationView, setIsFormationView] = useState(true);
  const [manualStarterPoints, setManualStarterPoints] = useState(0);
  const [showSuggestedLineup, setShowSuggestedLineup] = useState(false);
  const [showGameweekStats, setShowGameweekStats] = useState(true); // Add stats toggle state
  const [teamNews, setTeamNews] = useState<any>(null);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [suggestedTransfer, setSuggestedTransfer] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    pick: Pick;
    player: Element;
    team: Team;
    position: ElementType;
  } | null>(null);
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
  const [liveStandingsEnabled, setLiveStandingsEnabled] = useState(false);
  const [substitutions, setSubstitutions] = useState<
    Array<{
      outPlayer: number;
      inPlayer: number;
    }>
  >([]);
  const [animatingSubstitution, setAnimatingSubstitution] = useState<{
    outPlayer: number;
    inPlayer: number;
    phase: "flying" | "swapping";
  } | null>(null);
  const [livePoints, setLivePoints] = useState<number | null>(null);
  const [liveBenchPoints, setLiveBenchPoints] = useState<number | null>(null);
  const [liveTotalPoints, setLiveTotalPoints] = useState<number | null>(null);
  const [displayPicks, setDisplayPicks] = useState<Pick[]>([]);
  const [liveGameweekData, setLiveGameweekData] = useState<any>(null);
  const [predictedBonus, setPredictedBonus] = useState<{ [playerId: number]: number }>({});
  const [hasAnimated, setHasAnimated] = useState(false);

  // Add function to fetch gameweek data for a player
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

  // Fetch team news and fixtures on component mount (no automatic OpenAI calls)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamNewsData, fixturesData] = await Promise.all([
          getTeamNews().catch(() => null),
          getFixtures().catch(() => []),
        ]);
        setTeamNews(teamNewsData);
        setFixtures(fixturesData);

        // Removed automatic transfer suggestions - these should only be triggered by user action
      } catch (error) {
        console.error("Error fetching team news or fixtures:", error);
      }
    };

    fetchData();
  }, [currentEvent]);

  // Add effect to fetch gameweek data for all players
  useEffect(() => {
    const fetchAllGameweekData = async () => {
      const promises = picks.map((pick) =>
        fetchPlayerGameweekData(pick.element)
      );
      await Promise.all(promises);
    };

    if (picks.length > 0) {
      fetchAllGameweekData();
    }
  }, [picks, currentEvent]);

  // Sync displayPicks with picks only when live standings is disabled
  useEffect(() => {
    if (!liveStandingsEnabled) {
      setDisplayPicks([...picks]);
    }
  }, [picks, liveStandingsEnabled]);

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

  // Trigger substitution calculation when live data is ready
  useEffect(() => {
    if (
      liveStandingsEnabled &&
      Object.keys(gameweekData).length > 0 &&
      picks.length > 0 &&
      liveGameweekData &&
      !hasAnimated // Only calculate once when data is ready
    ) {
      calculateSubstitutions();
    } else if (!liveStandingsEnabled) {
      setSubstitutions([]);
      setLivePoints(null);
      setLiveBenchPoints(null);
      setLiveTotalPoints(null);
      setDisplayPicks([...picks]);
      setPredictedBonus({});
      setHasAnimated(false);
    }
  }, [liveStandingsEnabled, gameweekData, picks, liveGameweekData, hasAnimated]);

  const getPlayer = (elementId: number) => {
    return elements.find((el) => el.id === elementId);
  };

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  // Add function to get player stats based on toggle
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
            // Show actual points regardless of multiplier (for bench display)
            // But indicate captain/vice-captain with multiplier if applicable
            const currentBonus = playerGameweekData.bonus || 0;
            const predictedBonusPoints = (currentBonus === 0) ? (predictedBonus[player.id] || 0) : 0;
            const pointsWithBonus = gameweekPoints + predictedBonusPoints;
            const displayPoints =
              pick.multiplier > 0
                ? pointsWithBonus * pick.multiplier
                : pointsWithBonus;

            // Show predicted bonus separately if applicable
            if (liveStandingsEnabled && predictedBonusPoints > 0) {
              pointsDisplay = `${displayPoints}pts (+${predictedBonusPoints}*)`;
            } else {
              pointsDisplay = `${displayPoints}pts`;
            }

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

  // Calculate predicted bonus points for players who played but haven't received bonus yet
  const calculatePredictedBonus = () => {
    if (!liveGameweekData || !liveGameweekData.elements) {
      return {};
    }

    const bonusPredictions: { [playerId: number]: number } = {};

    // Group ALL players in the game by fixture (not just our picks)
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

  // Calculate substitutions based on DNP players
  const calculateSubstitutions = () => {
    const isBenchBoost = teamPicks?.active_chip === "bboost";

    // If bench boost active, no substitutions
    if (isBenchBoost) {
      setSubstitutions([]);
      return;
    }

    const startingXI = picks.filter((pick) => pick.position <= 11);
    const bench = picks.filter((pick) => pick.position > 11);

    const subs: Array<{ outPlayer: number; inPlayer: number }> = [];

    // Helper function to check if a player is DNP (not YTP)
    const isPlayerDNP = (elementId: number): boolean => {
      const playerData = gameweekData[elementId];
      if (!playerData) return false;

      // A player "did not play" (DNP) only if:
      // 1. Their game has kicked off (kickoff_time has passed)
      // 2. AND they got 0 minutes
      // If game hasn't kicked off yet, the player is yet to play (YTP), not DNP
      if (!playerData.kickoff_time) return false; // No kickoff time = YTP

      const kickoffTime = new Date(playerData.kickoff_time);
      const currentTime = new Date();
      const gameHasStarted = currentTime >= kickoffTime;

      // Only DNP if game has started AND player got 0 minutes
      return gameHasStarted && playerData.minutes === 0;
    };

    // Helper function to check if a player has played (for bench players)
    const hasPlayerPlayed = (elementId: number): boolean => {
      const playerData = gameweekData[elementId];
      if (!playerData) return false;

      // Player has played if their game has kicked off and they got minutes
      if (!playerData.kickoff_time) return false; // No kickoff time = hasn't played yet

      const kickoffTime = new Date(playerData.kickoff_time);
      const currentTime = new Date();
      const gameHasStarted = currentTime >= kickoffTime;

      // Only counts as "played" if game has started AND player got minutes
      return gameHasStarted && playerData.minutes > 0;
    };

    // Check for DNP players and valid substitutions
    // GK substitution
    const gk = startingXI.find((pick) => pick.position === 1);
    if (gk && isPlayerDNP(gk.element)) {
      const backupGK = bench.find((pick) => {
        const player = getPlayer(pick.element);
        return player?.element_type === 1;
      });
      if (backupGK && hasPlayerPlayed(backupGK.element)) {
        subs.push({ outPlayer: gk.element, inPlayer: backupGK.element });
      }
    }

    // Outfield substitutions
    const dnpOutfield = startingXI.filter((pick) => {
      if (pick.position === 1) return false; // Skip GK
      return isPlayerDNP(pick.element);
    });

    const availableBench = bench
      .filter((pick) => {
        const player = getPlayer(pick.element);
        if (player?.element_type === 1) return false; // Skip GK
        return hasPlayerPlayed(pick.element);
      })
      .sort((a, b) => a.position - b.position);

    for (const benchPick of availableBench) {
      if (dnpOutfield.length === 0) break;

      const benchPlayer = getPlayer(benchPick.element);
      if (!benchPlayer) continue;

      for (let i = 0; i < dnpOutfield.length; i++) {
        const dnpPick = dnpOutfield[i];
        const dnpPlayer = getPlayer(dnpPick.element);
        if (!dnpPlayer) continue;

        // Test substitution
        const testLineup = startingXI.map((pick) => {
          if (pick.element === dnpPick.element) {
            return { ...benchPick, position: pick.position };
          }
          // Check if this player was already subbed out
          const alreadySubbed = subs.find((s) => s.outPlayer === pick.element);
          if (alreadySubbed) {
            const subInPlayer = subs.find((s) => s.outPlayer === pick.element);
            if (subInPlayer) {
              return (
                picks.find((p) => p.element === subInPlayer.inPlayer) || pick
              );
            }
          }
          return pick;
        });

        // Count formation
        const outfield = testLineup.filter((pick) => pick.position > 1);
        const defCount = outfield.filter((pick) => {
          const player = getPlayer(pick.element);
          return player?.element_type === 2;
        }).length;
        const midCount = outfield.filter((pick) => {
          const player = getPlayer(pick.element);
          return player?.element_type === 3;
        }).length;
        const fwdCount = outfield.filter((pick) => {
          const player = getPlayer(pick.element);
          return player?.element_type === 4;
        }).length;

        // Check formation rules
        if (defCount >= 3 && midCount >= 3 && fwdCount >= 1) {
          subs.push({
            outPlayer: dnpPick.element,
            inPlayer: benchPick.element,
          });
          dnpOutfield.splice(i, 1);
          break;
        }
      }
    }

    setSubstitutions(subs);

    // Calculate predicted bonus points
    const bonusPredictions = calculatePredictedBonus();
    setPredictedBonus(bonusPredictions);

    // Calculate live points with substitutions
    calculateLivePoints(subs, isBenchBoost, bonusPredictions);

    // Trigger animation sequence only once
    if (subs.length > 0 && !hasAnimated) {
      setHasAnimated(true);
      animateSubstitutions(subs);
    }
  };

  const calculateLivePoints = (
    subs: Array<{ outPlayer: number; inPlayer: number }>,
    isBenchBoost: boolean,
    bonusPredictions: { [playerId: number]: number }
  ) => {
    let starterPoints = 0;
    let benchPoints = 0;

    if (isBenchBoost) {
      // Count all players (all 15 count as starters for bench boost)
      picks.forEach((pick) => {
        const playerData = gameweekData[pick.element];
        if (playerData) {
          const multiplier = pick.multiplier > 0 ? pick.multiplier : 1;
          const currentBonus = playerData.bonus || 0;
          const predictedBonus = (currentBonus === 0) ? (bonusPredictions[pick.element] || 0) : 0;
          starterPoints += (playerData.total_points + predictedBonus) * multiplier;
        }
      });
      benchPoints = 0; // No separate bench for bench boost
    } else {
      // Get final lineup after substitutions
      const finalStarterIds = new Set<number>();
      const finalBenchIds = new Set<number>();

      // Build final lineup
      picks
        .filter((pick) => pick.position <= 11)
        .forEach((pick) => {
          const sub = subs.find((s) => s.outPlayer === pick.element);
          if (sub) {
            finalStarterIds.add(sub.inPlayer);
            finalBenchIds.add(pick.element);
          } else {
            finalStarterIds.add(pick.element);
          }
        });

      // Add remaining bench players who weren't subbed in
      picks
        .filter((pick) => pick.position > 11)
        .forEach((pick) => {
          if (!finalStarterIds.has(pick.element)) {
            finalBenchIds.add(pick.element);
          }
        });

      // Calculate starter points
      picks.forEach((pick) => {
        if (finalStarterIds.has(pick.element)) {
          const playerData = gameweekData[pick.element];
          if (playerData) {
            const multiplier = pick.multiplier > 0 ? pick.multiplier : 1;
            const currentBonus = playerData.bonus || 0;
            const predictedBonus = (currentBonus === 0) ? (bonusPredictions[pick.element] || 0) : 0;
            starterPoints += (playerData.total_points + predictedBonus) * multiplier;
          }
        }
      });

      // Calculate bench points
      picks.forEach((pick) => {
        if (finalBenchIds.has(pick.element)) {
          const playerData = gameweekData[pick.element];
          if (playerData) {
            const currentBonus = playerData.bonus || 0;
            const predictedBonus = (currentBonus === 0) ? (bonusPredictions[pick.element] || 0) : 0;
            benchPoints += playerData.total_points + predictedBonus; // No multiplier for bench
          }
        }
      });
    }

    setLivePoints(starterPoints);
    setLiveBenchPoints(benchPoints);
    setLiveTotalPoints(starterPoints + benchPoints);
  };

  const animateSubstitutions = (
    subs: Array<{ outPlayer: number; inPlayer: number }>
  ) => {
    let currentIndex = 0;

    const animateNext = () => {
      if (currentIndex < subs.length) {
        const currentSub = subs[currentIndex];

        // Phase 1: Flying animation (800ms)
        setAnimatingSubstitution({ ...currentSub, phase: "flying" });

        setTimeout(() => {
          // Phase 2: Swap positions in displayPicks
          setDisplayPicks((prevPicks) => {
            const newPicks = [...prevPicks];
            const outIndex = newPicks.findIndex(
              (p) => p.element === currentSub.outPlayer
            );
            const inIndex = newPicks.findIndex(
              (p) => p.element === currentSub.inPlayer
            );

            if (outIndex !== -1 && inIndex !== -1) {
              // Swap the picks but keep their original position numbers temporarily
              const outPick = { ...newPicks[outIndex] };
              const inPick = { ...newPicks[inIndex] };

              // Swap positions
              newPicks[outIndex] = { ...inPick, position: outPick.position };
              newPicks[inIndex] = { ...outPick, position: inPick.position };
            }

            return newPicks;
          });

          setAnimatingSubstitution({ ...currentSub, phase: "swapping" });

          setTimeout(() => {
            setAnimatingSubstitution(null);
            currentIndex++;
            if (currentIndex < subs.length) {
              setTimeout(animateNext, 300); // Small delay between subs
            }
          }, 500);
        }, 800);
      }
    };

    // Start animation after a short delay
    setTimeout(animateNext, 500);
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
    : displayPicks.filter((pick) => pick.position <= 11);
  const bench = showSuggestedLineup
    ? suggestedLineup.bench.map((p) => p!.pick)
    : displayPicks.filter((pick) => pick.position > 11);

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

  const handlePointsClick = (
    e: React.MouseEvent,
    player: Element,
    stats: any,
    pick: Pick
  ) => {
    e.stopPropagation(); // Prevent triggering the player card click
    if (showGameweekStats) {
      // Extract numeric points or pass the string if it's YTP/DNP
      let pointsValue: number | string = stats.points;

      // If stats.points is a string like "7pts" or "7pts (+3*)", extract the number
      if (typeof stats.points === "string") {
        if (stats.points === "YTP" || stats.points === "DNP") {
          pointsValue = stats.points;
        } else if (stats.points.includes("pts")) {
          // Extract just the first number before "pts"
          const match = stats.points.match(/^(\d+)pts/);
          if (match) {
            pointsValue = parseInt(match[1]);
          }
        }
      }

      setPointsBreakdownPlayer({
        playerId: player.id,
        playerName: player.web_name,
        points: pointsValue,
        position: player.element_type,
        multiplier: pick.multiplier,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
      });
    }
  };

  const closePointsBreakdown = () => {
    setPointsBreakdownPlayer(null);
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
    const stats = getPlayerStats(player, pick);

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

    // Check if this player is involved in a substitution
    const isSubbedOut = substitutions.some((s) => s.outPlayer === pick.element);
    const isSubbedIn = substitutions.some((s) => s.inPlayer === pick.element);
    const isAnimatingOut =
      animatingSubstitution && animatingSubstitution.outPlayer === pick.element;
    const isAnimatingIn =
      animatingSubstitution && animatingSubstitution.inPlayer === pick.element;
    const isFlying =
      (isAnimatingOut || isAnimatingIn) &&
      animatingSubstitution?.phase === "flying";
    const isSwapping =
      (isAnimatingOut || isAnimatingIn) &&
      animatingSubstitution?.phase === "swapping";

    if (isFormation) {
      // Enhanced formation view with stats toggle
      return (
        <div
          key={pick.element}
          className="gradient-border rounded-lg w-16 md:w-24 h-20 md:h-32"
        >
          <div
            onClick={() => handlePlayerClick(pick)}
            className={`relative flex flex-col p-1 md:p-3 rounded-lg cursor-pointer w-full h-full overflow-y-auto overflow-x-hidden ${
              isFlying
                ? isAnimatingOut
                  ? "bg-red-300 ring-2 ring-red-500 animate-[fly-to-bench_0.8s_ease-in-out] z-50 scale-110 shadow-2xl"
                  : "bg-green-500 ring-2 ring-green-600 animate-[fly-to-field_0.8s_ease-in-out] z-50 scale-110 shadow-2xl"
                : isSwapping
                ? "animate-pulse bg-orange-300 ring-2 ring-orange-500 transition-all duration-500"
                : isSubbedOut
                ? "bg-red-200 opacity-60 ring-2 ring-red-400"
                : isSubbedIn
                ? "bg-green-400 ring-2 ring-green-600"
                : pick.is_captain
                ? "bg-green-300 ring-1 ring-yellow-400"
                : pick.is_vice_captain
                ? "bg-green-300 ring-1 ring-yellow-300"
                : isNewSuggestion
                ? "bg-green-300 ring-1 ring-green-500"
                : isBenchedSuggestion
                ? "bg-green-300 ring-1 ring-orange-400"
                : "bg-green-300"
            } ${isFlying ? "transition-none" : "transition-all"}`}
            style={{
              ...(isFlying && {
                position: "relative",
                zIndex: 9999,
              }),
            }}
          >
            {/* Substitution indicators */}
            {(isSubbedOut || isSubbedIn) && (
              <div
                className={`absolute -top-1 -right-1 text-white text-[8px] md:text-xs rounded-full w-5 md:w-6 h-5 md:h-6 flex items-center justify-center font-bold z-10 ${
                  isSubbedOut ? "bg-red-500" : "bg-green-600"
                }`}
              >
                {isSubbedOut ? "OUT" : "IN"}
              </div>
            )}
            {/* Suggestion indicators */}
            {!isSubbedOut && !isSubbedIn && isNewSuggestion && (
              <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] md:text-xs rounded-full w-3 md:w-4 h-3 md:h-4 flex items-center justify-center">
                ↑
              </div>
            )}
            {!isSubbedOut && !isSubbedIn && isBenchedSuggestion && (
              <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] md:text-xs rounded-full w-3 md:w-4 h-3 md:h-4 flex items-center justify-center">
                ↓
              </div>
            )}
            {!isSubbedOut && !isSubbedIn && isTransferIn && (
              <div className="absolute -top-1 -left-1 bg-purple-500 text-white text-[8px] md:text-xs rounded-full w-3 md:w-4 h-3 md:h-4 flex items-center justify-center">
                ⚡
              </div>
            )}
            {/* Player Name and Team */}
            <div className="text-center mb-0.5 md:mb-2">
              <h3 className="font-semibold text-[10px] md:text-sm leading-tight">
                {player.web_name}
              </h3>
              <p className="text-[8px] md:text-xs ">
                {team?.short_name} - {position?.singular_name_short}
              </p>
            </div>

            {/* Stats - Updated to use getPlayerStats - Points are now clickable */}
            <div className="text-center mb-0.5 md:mb-2">
              <div
                onClick={(e) => handlePointsClick(e, player, stats, pick)}
                className={`text-[10px] md:text-sm font-bold cursor-pointer hover:underline ${
                  stats.statusColor
                } ${showGameweekStats ? "hover:text-blue-600" : ""}`}
                title={showGameweekStats ? "Click to see points breakdown" : ""}
              >
                {isNaN(parseInt(stats.points)) ? "YTP" : stats.points}
              </div>
              <p className="text-[8px] md:text-xs ">£{stats.price}m</p>
            </div>

            {/* Form and Minutes - Updated - Hidden on mobile, shown on desktop */}
            <div className="hidden md:block text-center text-xs mb-2">
              <div>Form: {stats.form}</div>
              <div className={stats.statusColor}>{stats.minutes}</div>
              {stats.isGameweek && (
                <div className="mt-1">
                  {stats.goals > 0 && (
                    <div className="text-green-600">G {stats.goals}</div>
                  )}
                  {stats.assists > 0 && (
                    <div className="text-blue-600">A {stats.assists}</div>
                  )}
                  {stats.cleanSheets > 0 && (
                    <div className="text-purple-600">
                      CS {stats.cleanSheets}
                    </div>
                  )}
                  {stats.bonus > 0 && (
                    <div className="text-orange-600">BP {stats.bonus}</div>
                  )}
                </div>
              )}
              {!stats.isGameweek && (
                <div className="mt-1">
                  <div>PPG: {stats.ppg}</div>
                  <div className="flex justify-center gap-1 text-xs">
                    <span className="text-green-600">G{stats.goals}</span>
                    <span className="text-blue-600">A{stats.assists}</span>
                    {stats.cleanSheets > 0 && (
                      <span className="text-purple-600">
                        CS{stats.cleanSheets}
                      </span>
                    )}
                  </div>
                </div>
              )}
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
        </div>
      );
    }

    // Regular list view - Updated to use getPlayerStats
    return (
      <div
        key={pick.element}
        onClick={() => handlePlayerClick(pick)}
        className={`relative p-3 rounded-lg border cursor-pointer transition-all  ${
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
            <div
              onClick={(e) => handlePointsClick(e, player, stats, pick)}
              className={`text-sm font-bold cursor-pointer hover:underline ${
                stats.statusColor
              } ${showGameweekStats ? "hover:text-blue-600" : ""}`}
              title={showGameweekStats ? "Click to see points breakdown" : ""}
            >
              {stats.points}
              <span className="text-xs text-gray-500 block">
                {stats.isGameweek ? `GW${currentEvent}` : "Season"}
              </span>
            </div>
            <p className="text-xs ">£{stats.price}m</p>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="text-xs ">
            Form: {stats.form} |{" "}
            <span className={stats.statusColor}>{stats.minutes}</span>
            {stats.isGameweek && (
              <>
                {stats.goals > 0 && (
                  <span className="ml-1 text-green-600">G{stats.goals}</span>
                )}
                {stats.assists > 0 && (
                  <span className="ml-1 text-blue-600">A{stats.assists}</span>
                )}
                {stats.cleanSheets > 0 && (
                  <span className="ml-1 text-purple-600">
                    CS{stats.cleanSheets}
                  </span>
                )}
                {stats.bonus > 0 && (
                  <span className="ml-1 text-orange-600">B{stats.bonus}</span>
                )}
              </>
            )}
            {!stats.isGameweek && (
              <>
                | PPG: {stats.ppg}
                {stats.goals > 0 && (
                  <span className="ml-1 text-green-600">G{stats.goals}</span>
                )}
                {stats.assists > 0 && (
                  <span className="ml-1 text-blue-600">A{stats.assists}</span>
                )}
                {stats.cleanSheets > 0 && (
                  <span className="ml-1 text-purple-600">
                    CS{stats.cleanSheets}
                  </span>
                )}
              </>
            )}
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

  // Updated points calculations - use FPL official totals when available
  const calculatePoints = () => {
    if (showGameweekStats) {
      // For gameweek stats, try to use official FPL totals from teamPicks
      if (teamPicks?.entry_history) {
        // Use the gameweek-specific points from entry_history
        const officialGameweekPoints = teamPicks.entry_history.points || 0;
        const officialPointsOnBench =
          teamPicks.entry_history.points_on_bench || 0;

        return {
          total: officialGameweekPoints + officialPointsOnBench,
          starting: officialGameweekPoints,
          bench: officialPointsOnBench,
        };
      }

      // Fallback to manual calculation if official data not available
      const startingPoints = picks
        .filter((pick) => pick.position <= 11)
        .reduce((sum, pick) => {
          const playerGameweekData = gameweekData[pick.element];
          if (!playerGameweekData || !playerGameweekData.kickoff_time) {
            return sum; // Game hasn't started, don't count points yet
          }

          const kickoffTime = new Date(playerGameweekData.kickoff_time);
          const currentTime = new Date();
          const gameHasStarted = currentTime >= kickoffTime;

          if (gameHasStarted) {
            const gameweekPoints = playerGameweekData.total_points || 0;
            return sum + gameweekPoints * pick.multiplier;
          }

          return sum; // Game hasn't started yet
        }, 0);

      const benchPoints = picks
        .filter((pick) => pick.position > 11)
        .reduce((sum, pick) => {
          const playerGameweekData = gameweekData[pick.element];
          if (!playerGameweekData || !playerGameweekData.kickoff_time) {
            return sum; // Game hasn't started, don't count points yet
          }

          const kickoffTime = new Date(playerGameweekData.kickoff_time);
          const currentTime = new Date();
          const gameHasStarted = currentTime >= kickoffTime;

          if (gameHasStarted) {
            const gameweekPoints = playerGameweekData.total_points || 0;
            return sum + gameweekPoints; // No multiplier for bench players
          }

          return sum; // Game hasn't started yet
        }, 0);

      return {
        total: startingPoints + benchPoints,
        starting: startingPoints,
        bench: benchPoints,
      };
    } else {
      // For season stats, use the official total from teamPicks.entry_history.total_points
      if (teamPicks?.entry_history?.total_points !== undefined) {
        // This is the official season total that matches league standings (113 in your case)
        const officialSeasonTotal = teamPicks.entry_history.total_points;

        return {
          total: officialSeasonTotal,
          starting: officialSeasonTotal, // Show as "started" since it's the official team total
          bench: 0, // Can't accurately split historical season data
          isSeasonTotal: true,
        };
      }

      // Fallback to manual calculation (this will be inaccurate for transferred players)
      const startingPoints = picks
        .filter((pick) => pick.position <= 11)
        .reduce((sum, pick) => {
          const player = getPlayer(pick.element);
          return sum + (player?.total_points || 0);
        }, 0);

      const benchPoints = picks
        .filter((pick) => pick.position > 11)
        .reduce((sum, pick) => {
          const player = getPlayer(pick.element);
          return sum + (player?.total_points || 0);
        }, 0);

      // Calculate fallback manual sum of all starters' season points
      const manualPoints = picks
        .filter((pick) => pick.position <= 11)
        .reduce((sum, pick) => {
          const player = getPlayer(pick.element);
          return sum + (player?.total_points || 0);
        }, 0);
      setManualStarterPoints(manualPoints);

      return {
        total: startingPoints + benchPoints,
        starting: startingPoints,
        bench: benchPoints,
        isSeasonTotal: false,
      };
    }
  };

  const pointsBreakdown = calculatePoints();

  // Calculate manual sum of all starters' points (gameweek or season)
  const manualStarterPointsSum = picks
    .filter((pick) => pick.position <= 11)
    .reduce((sum, pick) => {
      if (showGameweekStats) {
        const gw = gameweekData[pick.element];
        if (gw && gw.kickoff_time) {
          const kickoffTime = new Date(gw.kickoff_time);
          const currentTime = new Date();
          if (
            currentTime >= kickoffTime &&
            typeof gw.total_points === "number"
          ) {
            return sum + gw.total_points * pick.multiplier;
          }
        }
        return sum;
      } else {
        const player = getPlayer(pick.element);
        return sum + (player?.total_points || 0);
      }
    }, 0);

  // Calculate manual sum of all bench points
  const manualBenchPointsSum = picks
    .filter((pick) => pick.position > 11)
    .reduce((sum, pick) => {
      if (showGameweekStats) {
        const gw = gameweekData[pick.element];
        if (gw && gw.kickoff_time) {
          const kickoffTime = new Date(gw.kickoff_time);
          const currentTime = new Date();
          if (
            currentTime >= kickoffTime &&
            typeof gw.total_points === "number"
          ) {
            return sum + gw.total_points; // No multiplier for bench
          }
        }
        return sum;
      } else {
        const player = getPlayer(pick.element);
        return sum + (player?.total_points || 0);
      }
    }, 0);

  // Check if all starters are Yet To Play (YTP)
  const allStartersYTP = picks
    .filter((pick) => pick.position <= 11)
    .every((pick) => {
      if (showGameweekStats) {
        const gw = gameweekData[pick.element];
        if (!gw || !gw.kickoff_time) return true;
        const kickoffTime = new Date(gw.kickoff_time);
        const currentTime = new Date();
        return currentTime < kickoffTime;
      }
      return false;
    });

  // Use the same logic as before for starter points
  const displayedStarterPoints = allStartersYTP
    ? "YTP"
    : pointsBreakdown.starting > 0
    ? pointsBreakdown.starting
    : manualStarterPointsSum > 0
    ? manualStarterPointsSum
    : "0";

  // Calculate displayed bench points (show YTP if all starters are YTP)
  const displayedBenchPoints =
    displayedStarterPoints === "YTP" ? "YTP" : manualBenchPointsSum;

  // Calculate displayed total (if YTP, show "YTP", else sum starter + bench)
  const displayedTotalPoints =
    displayedStarterPoints === "YTP"
      ? "YTP"
      : Number(displayedStarterPoints) + manualBenchPointsSum;

  return (
    <div className="no-gradient-border p-6 rounded-lg">
      <div className="flex items-center mb-6 justify-center flex-col">
        <h2 className="text-2xl font-bold">Current Squad</h2>
        <div className="flex items-center gap-4 flex-col pt-2">
          {/* View Toggle */}
          <div className="flex items-center justify-center gap-2 w-full">
            {/* <span className="text-sm ">View:</span> */}
            <button
              onClick={() => setIsFormationView(true)}
              className={`flex-1 min-w-[120px] max-w-[160px] py-1 rounded-md text-sm font-medium transition-colors text-center ${
                isFormationView
                  ? "text-white bg-green-600 "
                  : " !bg-transparent"
              }`}
              style={{ marginRight: 4 }}
            >
              Formation
            </button>
            <button
              onClick={() => setIsFormationView(false)}
              className={`flex-1 min-w-[120px] max-w-[160px] py-1 rounded-md text-sm font-medium transition-colors text-center ${
                !isFormationView
                  ? " text-white bg-green-600"
                  : " !bg-transparent"
              }`}
              style={{ marginLeft: 4 }}
            >
              List
            </button>
          </div>

          {/* Stats Toggle */}
          <div className="flex justify-center mb-2">
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
            <div className="rounded-lg p-3 w-full ">
              <div className="text-center">
                <h4 className="font-semibold text-blue-800 mb-2">
                  Gameweek {suggestedLineup.nextGameweekId} Prediction:{" "}
                  {suggestedLineup.formation.name}
                  {suggestedTransfer && (
                    <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                      With Transfer
                    </span>
                  )}
                </h4>

                {/* Captain and Vice-Captain Display */}
                <div className="mb-3 p-2 rounded no-gradient-border ">
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
                    Your current lineup looks optimal for GW
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

          {/* Updated Points Display */}
          <div className="text-center">
            <p className="text-sm">
              {showGameweekStats ? `Gameweek ${currentEvent}` : "Season Total"}
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-3">
                <p className="text-xl font-bold">
                  {liveStandingsEnabled && livePoints !== null
                    ? `${livePoints} points`
                    : `${displayedStarterPoints} points`}
                </p>
                {showGameweekStats && (
                  <label
                    className="flex items-center cursor-pointer group"
                    title="Apply auto-substitutions"
                  >
                    <input
                      type="checkbox"
                      checked={liveStandingsEnabled}
                      onChange={() =>
                        setLiveStandingsEnabled(!liveStandingsEnabled)
                      }
                      className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-800">
                      Live
                    </span>
                  </label>
                )}
              </div>
              <div className="flex justify-center gap-4 text-sm">
                <span className="text-green-700 font-medium">
                  {liveStandingsEnabled && liveBenchPoints !== null
                    ? liveBenchPoints
                    : manualBenchPointsSum}{" "}
                  benched
                </span>
                <span className="text-orange-600 font-medium">
                  {liveStandingsEnabled && liveTotalPoints !== null
                    ? liveTotalPoints
                    : displayedTotalPoints}{" "}
                  total
                </span>
              </div>
              {manualBenchPointsSum > 0 && !liveStandingsEnabled && (
                <p className="text-xs text-gray-600 mt-1">
                  You left {manualBenchPointsSum} point
                  {manualBenchPointsSum === 1 ? "" : "s"} on the bench
                </p>
              )}
              {liveStandingsEnabled && substitutions.length > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  {substitutions.length} auto-sub
                  {substitutions.length === 1 ? "" : "s"} applied
                </p>
              )}
            </div>
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
            <div className="no-gradient-border bg-gradient-to-b from-green-400 to-green-500 p-6 rounded-lg relative overflow-hidden">
              {/* Vertical Stripes - Center 60% only */}
              <div className="absolute inset-0">
                <div className="flex h-full">
                  {/* Left 20% - no stripes */}
                  <div className="w-1/5 bg-[#4ade80]"></div>

                  {/* Center 60% - with stripes */}
                  <div className="w-[150%] flex">
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
                    <div className="flex gap-1 md:gap-4 justify-center flex-wrap">
                      {forwards.map((pick) => renderPlayer(pick, false, true))}
                    </div>
                  </div>
                )}

                {/* Midfielders */}
                {midfielders.length > 0 && (
                  <div className="flex justify-center">
                    <div className="flex gap-1 md:gap-4 justify-center flex-wrap">
                      {midfielders.map((pick) =>
                        renderPlayer(pick, false, true)
                      )}
                    </div>
                  </div>
                )}

                {/* Defenders */}
                {defenders.length > 0 && (
                  <div className="flex justify-center">
                    <div className="flex gap-1 md:gap-4 justify-center flex-wrap">
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
          totalPoints={pointsBreakdown.total}
          events={events}
          teamPicks={teamPicks}
          teamHistory={teamHistory}
          userLeagues={userLeagues}
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
          totalPoints={pointsBreakdown.total}
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
          currentSquad={elements.filter((el) =>
            picks.some((p) => p.element === el.id)
          )}
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
    </div>
  );
}
