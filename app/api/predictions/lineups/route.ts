import { NextRequest, NextResponse } from "next/server";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

interface Element {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  selected_by_percent: string;
  form: string;
  minutes: number;
  chance_of_playing_next_round: number | null;
  chance_of_playing_this_round: number | null;
  total_points: number;
  points_per_game: string;
}

interface Team {
  id: number;
  name: string;
  short_name: string;
}

interface Fixture {
  id: number;
  event: number;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  finished: boolean;
  kickoff_time: string;
}

export async function GET(request: NextRequest) {
  try {
    // Fetch bootstrap data for teams, players, and current gameweek
    const bootstrapResponse = await fetch(`${FPL_BASE_URL}/bootstrap-static/`);
    if (!bootstrapResponse.ok) {
      throw new Error("Failed to fetch bootstrap data");
    }
    const bootstrapData = await bootstrapResponse.json();

    const teams: Team[] = bootstrapData.teams;
    const elements: Element[] = bootstrapData.elements;
    const currentEvent = bootstrapData.events.find((e: any) => e.is_current);
    const nextEvent = bootstrapData.events.find((e: any) => e.is_next);

    // Use next event if current is finished, otherwise current
    const targetEvent =
      currentEvent?.finished && nextEvent ? nextEvent : currentEvent;

    if (!targetEvent) {
      return NextResponse.json(
        { error: "No upcoming gameweek found" },
        { status: 404 }
      );
    }

    // Fetch fixtures for the target gameweek
    const fixturesResponse = await fetch(
      `${FPL_BASE_URL}/fixtures/?event=${targetEvent.id}`
    );
    if (!fixturesResponse.ok) {
      throw new Error("Failed to fetch fixtures");
    }
    const fixtures: Fixture[] = await fixturesResponse.json();

    // Filter upcoming fixtures (not finished) - show ALL fixtures
    const upcomingFixtures = fixtures.filter((fixture) => !fixture.finished);

    // Fetch recent player performance data for better predictions
    const playerHistoryPromises = elements.slice(0, 100).map(async (player) => {
      try {
        const historyResponse = await fetch(
          `${FPL_BASE_URL}/element-summary/${player.id}/`
        );
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          return {
            playerId: player.id,
            recentGames: historyData.history?.slice(-5) || [], // Last 5 games
          };
        }
      } catch (error) {
        //console.log(`Failed to fetch history for player ${player.id}`);
      }
      return null;
    });

    const playerHistories = await Promise.allSettled(playerHistoryPromises);
    const validHistories = playerHistories
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result: any) => result.value);

    // Generate predicted lineups for each fixture
    const predictedLineups = await Promise.all(
      upcomingFixtures.map(async (fixture) => {
        const homeTeam = teams.find((t) => t.id === fixture.team_h);
        const awayTeam = teams.find((t) => t.id === fixture.team_a);

        if (!homeTeam || !awayTeam) return null;

        // Get players for each team
        const homeTeamPlayers = elements.filter((p) => p.team === homeTeam.id);
        const awayTeamPlayers = elements.filter((p) => p.team === awayTeam.id);

        // Predict lineups based on enhanced scoring system
        const homePredictedLineup = predictLineup(
          homeTeamPlayers,
          homeTeam,
          validHistories
        );
        const awayPredictedLineup = predictLineup(
          awayTeamPlayers,
          awayTeam,
          validHistories
        );

        return {
          fixture: {
            id: fixture.id,
            kickoff_time: fixture.kickoff_time,
            homeTeam: homeTeam.name,
            awayTeam: awayTeam.name,
          },
          homeLineup: homePredictedLineup,
          awayLineup: awayPredictedLineup,
        };
      })
    );

    // Filter out any null results
    const validLineups = predictedLineups.filter((lineup) => lineup !== null);

    return NextResponse.json({
      gameweek: targetEvent.id,
      gameweekName: targetEvent.name,
      fixtures: validLineups,
    });
  } catch (error) {
    console.error("Error fetching predicted lineups:", error);
    return NextResponse.json(
      { error: "Failed to fetch predicted lineups" },
      { status: 500 }
    );
  }
}

function predictLineup(players: Element[], team: Team, playerHistories: any[]) {
  // Calculate enhanced player scores
  const playersWithScores = players.map((player) => {
    const playerHistory = playerHistories.find((h) => h.playerId === player.id);
    const score = calculateEnhancedPlayerScore(player, playerHistory);
    return { ...player, predictionScore: score };
  });

  // Sort by prediction score
  const sortedPlayers = playersWithScores.sort(
    (a, b) => b.predictionScore - a.predictionScore
  );

  // Group by position
  const goalkeepers = sortedPlayers.filter((p) => p.element_type === 1);
  const defenders = sortedPlayers.filter((p) => p.element_type === 2);
  const midfielders = sortedPlayers.filter((p) => p.element_type === 3);
  const forwards = sortedPlayers.filter((p) => p.element_type === 4);

  // Smart formation selection based on available players
  const formation = determineOptimalFormation(defenders, midfielders, forwards);

  // Select starting XI based on formation
  const lineup = [
    ...goalkeepers.slice(0, 1), // Exactly 1 GK
    ...defenders.slice(0, formation.defenders),
    ...midfielders.slice(0, formation.midfielders),
    ...forwards.slice(0, formation.forwards),
  ];

  // Ensure we have exactly 11 players
  if (lineup.length < 11) {
    // Fill remaining spots with best available players
    const remaining = sortedPlayers.filter(
      (p) => !lineup.includes(p) && p.element_type !== 1
    );
    lineup.push(...remaining.slice(0, 11 - lineup.length));
  }

  const formationString = `${formation.defenders}-${formation.midfielders}-${formation.forwards}`;

  return {
    team: team.name,
    formation: formationString,
    players: lineup.slice(0, 11).map((player) => ({
      id: player.id,
      name: player.web_name,
      position: getPositionName(player.element_type),
      team: team.name,
      form: player.form,
      minutes: player.minutes,
      chanceOfPlaying:
        player.chance_of_playing_next_round ||
        player.chance_of_playing_this_round,
    })),
  };
}

function calculateEnhancedPlayerScore(
  player: Element,
  playerHistory: any
): number {
  let score = 0;

  // Season minutes (higher is better) - weighted heavily
  score += player.minutes * 0.15;

  // Form (recent performance)
  score += parseFloat(player.form || "0") * 12;

  // Total points this season
  score += player.total_points * 0.8;

  // Points per game
  score += parseFloat(player.points_per_game || "0") * 8;

  // Selection percentage (indicates regular starter)
  score += parseFloat(player.selected_by_percent) * 0.6;

  // Recent games performance
  if (playerHistory?.recentGames?.length > 0) {
    const recentMinutes = playerHistory.recentGames.reduce(
      (total: number, game: any) => total + (game.minutes || 0),
      0
    );
    const recentPoints = playerHistory.recentGames.reduce(
      (total: number, game: any) => total + (game.total_points || 0),
      0
    );

    // Recent minutes average (heavily weighted)
    score += (recentMinutes / playerHistory.recentGames.length) * 0.3;

    // Recent points average
    score += (recentPoints / playerHistory.recentGames.length) * 3;
  }

  // Chance of playing bonus/penalty
  const chanceOfPlaying =
    player.chance_of_playing_next_round || player.chance_of_playing_this_round;
  if (chanceOfPlaying !== null) {
    if (chanceOfPlaying >= 75) {
      score += 20; // Bonus for likely to play
    } else if (chanceOfPlaying < 50) {
      score *= 0.3; // Heavy penalty for unlikely to play
    } else {
      score *= 0.7; // Moderate penalty for uncertain
    }
  }

  return score;
}

function determineOptimalFormation(
  defenders: Element[],
  midfielders: Element[],
  forwards: Element[]
): { defenders: number; midfielders: number; forwards: number } {
  // Common formations with constraints
  const formations = [
    { defenders: 4, midfielders: 4, forwards: 2 }, // 4-4-2
    { defenders: 4, midfielders: 3, forwards: 3 }, // 4-3-3
    { defenders: 3, midfielders: 5, forwards: 2 }, // 3-5-2
    { defenders: 5, midfielders: 3, forwards: 2 }, // 5-3-2
    { defenders: 4, midfielders: 5, forwards: 1 }, // 4-5-1
    { defenders: 3, midfielders: 4, forwards: 3 }, // 3-4-3
  ];

  // Score each formation based on available player quality
  let bestFormation = formations[0];
  let bestScore = 0;

  formations.forEach((formation) => {
    // Check if we have enough players for this formation
    if (
      defenders.length >= formation.defenders &&
      midfielders.length >= formation.midfielders &&
      forwards.length >= formation.forwards
    ) {
      // Calculate formation score based on top players in each position
      const defScore = defenders
        .slice(0, formation.defenders)
        .reduce((sum, p: any) => sum + (p.predictionScore || 0), 0);
      const midScore = midfielders
        .slice(0, formation.midfielders)
        .reduce((sum, p: any) => sum + (p.predictionScore || 0), 0);
      const fwdScore = forwards
        .slice(0, formation.forwards)
        .reduce((sum, p: any) => sum + (p.predictionScore || 0), 0);

      const totalScore = defScore + midScore + fwdScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestFormation = formation;
      }
    }
  });

  return bestFormation;
}

function getPositionName(elementType: number): string {
  switch (elementType) {
    case 1:
      return "GK";
    case 2:
      return "DEF";
    case 3:
      return "MID";
    case 4:
      return "FWD";
    default:
      return "UNK";
  }
}
