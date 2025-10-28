import { NextRequest, NextResponse } from "next/server";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

interface Team {
  id: number;
  name: string;
  short_name: string;
  strength: number;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

interface TeamStats {
  id: number;
  form: number | null;
  points: number;
  position: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goals_for: number;
  goals_against: number;
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
  team_h_difficulty: number;
  team_a_difficulty: number;
}

interface HistoricalTeamData {
  goals_for: number;
  goals_against: number;
  played: number;
  points: number;
  position: number;
}

function calculateTeamStats(fixtures: Fixture[], teams: Team[]): TeamStats[] {
  const statsMap = new Map<number, TeamStats>();

  // Initialize stats for all teams
  teams.forEach((team) => {
    statsMap.set(team.id, {
      id: team.id,
      form: null,
      points: 0,
      position: 0,
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      goals_for: 0,
      goals_against: 0,
    });
  });

  // Process finished fixtures
  const finishedFixtures = fixtures.filter((f) => f.finished && f.team_h_score !== null && f.team_a_score !== null);

  finishedFixtures.forEach((fixture) => {
    const homeStats = statsMap.get(fixture.team_h);
    const awayStats = statsMap.get(fixture.team_a);

    if (!homeStats || !awayStats) return;

    const homeScore = fixture.team_h_score!;
    const awayScore = fixture.team_a_score!;

    // Update played
    homeStats.played++;
    awayStats.played++;

    // Update goals
    homeStats.goals_for += homeScore;
    homeStats.goals_against += awayScore;
    awayStats.goals_for += awayScore;
    awayStats.goals_against += homeScore;

    // Update points and results
    if (homeScore > awayScore) {
      homeStats.points += 3;
      homeStats.win++;
      awayStats.loss++;
    } else if (awayScore > homeScore) {
      awayStats.points += 3;
      awayStats.win++;
      homeStats.loss++;
    } else {
      homeStats.points += 1;
      awayStats.points += 1;
      homeStats.draw++;
      awayStats.draw++;
    }
  });

  // Calculate form (average points from last 5 games)
  teams.forEach((team) => {
    const teamFixtures = finishedFixtures
      .filter((f) => f.team_h === team.id || f.team_a === team.id)
      .slice(-5); // Last 5 fixtures

    if (teamFixtures.length > 0) {
      let formPoints = 0;
      teamFixtures.forEach((fixture) => {
        const isHome = fixture.team_h === team.id;
        const teamScore = isHome ? fixture.team_h_score! : fixture.team_a_score!;
        const oppScore = isHome ? fixture.team_a_score! : fixture.team_h_score!;

        if (teamScore > oppScore) formPoints += 3;
        else if (teamScore === oppScore) formPoints += 1;
      });

      const stats = statsMap.get(team.id);
      if (stats) {
        stats.form = formPoints / teamFixtures.length;
      }
    }
  });

  // Calculate league positions (sort by points, then goal difference)
  const statsArray = Array.from(statsMap.values());
  statsArray.sort((a, b) => {
    const pointsDiff = b.points - a.points;
    if (pointsDiff !== 0) return pointsDiff;

    const aGD = a.goals_for - a.goals_against;
    const bGD = b.goals_for - b.goals_against;
    const gdDiff = bGD - aGD;
    if (gdDiff !== 0) return gdDiff;

    return b.goals_for - a.goals_for; // Goals scored as tiebreaker
  });

  statsArray.forEach((stats, index) => {
    stats.position = index + 1;
  });

  return statsArray;
}

export async function GET(request: NextRequest) {
  try {
    // Fetch bootstrap data for teams and current gameweek
    const bootstrapResponse = await fetch(`${FPL_BASE_URL}/bootstrap-static/`);
    if (!bootstrapResponse.ok) {
      throw new Error("Failed to fetch bootstrap data");
    }
    const bootstrapData = await bootstrapResponse.json();

    const teams: Team[] = bootstrapData.teams;
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

    // Fetch ALL fixtures to calculate team statistics
    const allFixturesResponse = await fetch(`${FPL_BASE_URL}/fixtures/`);
    if (!allFixturesResponse.ok) {
      throw new Error("Failed to fetch all fixtures");
    }
    const allFixtures: Fixture[] = await allFixturesResponse.json();

    // Calculate team statistics from finished fixtures
    const teamStats = calculateTeamStats(allFixtures, teams);

    // Fetch fixtures for the target gameweek
    const fixturesResponse = await fetch(
      `${FPL_BASE_URL}/fixtures/?event=${targetEvent.id}`
    );
    if (!fixturesResponse.ok) {
      throw new Error("Failed to fetch fixtures");
    }
    const fixtures: Fixture[] = await fixturesResponse.json();

    // Filter upcoming fixtures (not finished)
    const upcomingFixtures = fixtures.filter((fixture) => !fixture.finished);

    // Fetch historical data (last season)
    const historicalData = await fetchHistoricalData();

    // Calculate league averages for more realistic predictions
    const leagueStats = calculateLeagueAverages(teamStats);

    // Generate predictions for each fixture
    const gamePredictions = upcomingFixtures
      .map((fixture) => {
        const homeTeam = teams.find((t) => t.id === fixture.team_h);
        const awayTeam = teams.find((t) => t.id === fixture.team_a);
        const homeStats = teamStats.find((ts) => ts.id === fixture.team_h);
        const awayStats = teamStats.find((ts) => ts.id === fixture.team_a);

        if (!homeTeam || !awayTeam || !homeStats || !awayStats) return null;

        const prediction = predictScoreWithSimulations(
          homeTeam,
          awayTeam,
          homeStats,
          awayStats,
          fixture,
          leagueStats,
          historicalData
        );

        return {
          id: fixture.id,
          homeTeam: {
            name: homeTeam.name,
            shortName: homeTeam.short_name,
            form: homeStats.form,
            position: homeStats.position,
            points: homeStats.points,
            goalsFor: homeStats.goals_for,
            goalsAgainst: homeStats.goals_against,
            played: homeStats.played,
            strength: homeTeam.strength_overall_home,
          },
          awayTeam: {
            name: awayTeam.name,
            shortName: awayTeam.short_name,
            form: awayStats.form,
            position: awayStats.position,
            points: awayStats.points,
            goalsFor: awayStats.goals_for,
            goalsAgainst: awayStats.goals_against,
            played: awayStats.played,
            strength: awayTeam.strength_overall_away,
          },
          predictedScore: prediction.score,
          confidence: prediction.confidence,
          reasoning: prediction.reasoning,
          kickoffTime: fixture.kickoff_time,
          difficulty: {
            home: fixture.team_h_difficulty,
            away: fixture.team_a_difficulty,
          },
        };
      })
      .filter((prediction) => prediction !== null);

    return NextResponse.json({
      gameweek: targetEvent.id,
      gameweekName: targetEvent.name,
      predictions: gamePredictions,
      totalMatches: gamePredictions.length,
    });
  } catch (error) {
    console.error("Error fetching game predictions:", error);
    return NextResponse.json(
      { error: "Failed to fetch game predictions" },
      { status: 500 }
    );
  }
}

async function fetchHistoricalData(): Promise<Map<string, HistoricalTeamData>> {
  const historicalData = new Map<string, HistoricalTeamData>();

  // Premier League 2023-24 final table data (last complete season)
  const lastSeasonData = [
    {
      name: "Manchester City",
      goals_for: 96,
      goals_against: 34,
      played: 38,
      points: 91,
      position: 1,
    },
    {
      name: "Arsenal",
      goals_for: 91,
      goals_against: 29,
      played: 38,
      points: 89,
      position: 2,
    },
    {
      name: "Liverpool",
      goals_for: 86,
      goals_against: 41,
      played: 38,
      points: 82,
      position: 3,
    },
    {
      name: "Aston Villa",
      goals_for: 76,
      goals_against: 61,
      played: 38,
      points: 68,
      position: 4,
    },
    {
      name: "Tottenham",
      goals_for: 74,
      goals_against: 61,
      played: 38,
      points: 66,
      position: 5,
    },
    {
      name: "Chelsea",
      goals_for: 77,
      goals_against: 63,
      played: 38,
      points: 63,
      position: 6,
    },
    {
      name: "Newcastle",
      goals_for: 85,
      goals_against: 62,
      played: 38,
      points: 60,
      position: 7,
    },
    {
      name: "Man Utd",
      goals_for: 57,
      goals_against: 58,
      played: 38,
      points: 60,
      position: 8,
    },
    {
      name: "West Ham",
      goals_for: 60,
      goals_against: 74,
      played: 38,
      points: 52,
      position: 9,
    },
    {
      name: "Crystal Palace",
      goals_for: 57,
      goals_against: 58,
      played: 38,
      points: 49,
      position: 10,
    },
    {
      name: "Brighton",
      goals_for: 56,
      goals_against: 62,
      played: 38,
      points: 48,
      position: 11,
    },
    {
      name: "Bournemouth",
      goals_for: 54,
      goals_against: 67,
      played: 38,
      points: 48,
      position: 12,
    },
    {
      name: "Fulham",
      goals_for: 55,
      goals_against: 61,
      played: 38,
      points: 47,
      position: 13,
    },
    {
      name: "Wolves",
      goals_for: 50,
      goals_against: 65,
      played: 38,
      points: 46,
      position: 14,
    },
    {
      name: "Everton",
      goals_for: 40,
      goals_against: 57,
      played: 38,
      points: 40,
      position: 15,
    }, // After points deduction
    {
      name: "Brentford",
      goals_for: 56,
      goals_against: 65,
      played: 38,
      points: 39,
      position: 16,
    },
    {
      name: "Nottm Forest",
      goals_for: 49,
      goals_against: 67,
      played: 38,
      points: 32,
      position: 17,
    }, // After points deduction
    {
      name: "Luton",
      goals_for: 52,
      goals_against: 85,
      played: 38,
      points: 26,
      position: 18,
    },
    {
      name: "Burnley",
      goals_for: 41,
      goals_against: 78,
      played: 38,
      points: 24,
      position: 19,
    },
    {
      name: "Sheffield Utd",
      goals_for: 35,
      goals_against: 104,
      played: 38,
      points: 16,
      position: 20,
    },
  ];

  // Add promoted teams with Championship data estimates
  const promotedTeams = [
    {
      name: "Leicester",
      goals_for: 89,
      goals_against: 41,
      played: 46,
      points: 97,
      position: 1,
    }, // Championship winners
    {
      name: "Ipswich",
      goals_for: 92,
      goals_against: 57,
      played: 46,
      points: 96,
      position: 2,
    }, // Championship runners-up
    {
      name: "Southampton",
      goals_for: 87,
      goals_against: 63,
      played: 46,
      points: 87,
      position: 4,
    }, // Championship play-off winners
  ];

  // Combine data
  [...lastSeasonData, ...promotedTeams].forEach((team) => {
    historicalData.set(team.name, {
      goals_for: team.goals_for,
      goals_against: team.goals_against,
      played: team.played,
      points: team.points,
      position: team.position,
    });
  });

  return historicalData;
}

function calculateLeagueAverages(teamStats: TeamStats[]) {
  const playedTeams = teamStats.filter((t) => t.played > 0);

  if (playedTeams.length === 0) {
    return {
      avgGoalsPerGame: 1.35, // Historical PL average per team
      avgGoalsAgainstPerGame: 1.35,
      totalGoalsPerMatch: 2.7,
    };
  }

  const totalGoalsFor = playedTeams.reduce(
    (sum, team) => sum + team.goals_for,
    0
  );
  const totalGoalsAgainst = playedTeams.reduce(
    (sum, team) => sum + team.goals_against,
    0
  );
  const totalGamesPlayed = playedTeams.reduce(
    (sum, team) => sum + team.played,
    0
  );

  return {
    avgGoalsPerGame:
      totalGamesPlayed > 0 ? totalGoalsFor / totalGamesPlayed : 1.35,
    avgGoalsAgainstPerGame:
      totalGamesPlayed > 0 ? totalGoalsAgainst / totalGamesPlayed : 1.35,
    totalGoalsPerMatch:
      totalGamesPlayed > 0
        ? (totalGoalsFor + totalGoalsAgainst) / (totalGamesPlayed / 2)
        : 2.7,
  };
}

function predictScoreWithSimulations(
  homeTeam: Team,
  awayTeam: Team,
  homeStats: TeamStats,
  awayStats: TeamStats,
  fixture: Fixture,
  leagueStats: any,
  historicalData: Map<string, HistoricalTeamData>
) {
  const numSimulations = 7;
  const simulations = [];

  // Run multiple simulations
  for (let i = 0; i < numSimulations; i++) {
    const result = predictSingleScore(
      homeTeam,
      awayTeam,
      homeStats,
      awayStats,
      fixture,
      leagueStats,
      historicalData
    );
    simulations.push(result);
  }

  // Calculate averages
  const avgHomeScore = Math.round(
    simulations.reduce((sum, sim) => sum + sim.score.home, 0) / numSimulations
  );
  const avgAwayScore = Math.round(
    simulations.reduce((sum, sim) => sum + sim.score.away, 0) / numSimulations
  );

  const avgConfidence = Math.round(
    simulations.reduce((sum, sim) => sum + sim.confidence, 0) / numSimulations
  );

  // Use the expected goals from the middle simulation for reasoning
  const middleSimulation = simulations[Math.floor(numSimulations / 2)];

  // Generate reasoning based on averaged results
  const reasoning = generateDetailedReasoning(
    homeTeam,
    awayTeam,
    avgHomeScore,
    avgAwayScore,
    middleSimulation.homeXG,
    middleSimulation.awayXG,
    middleSimulation.homeGPG,
    middleSimulation.awayGPG,
    numSimulations,
    historicalData
  );

  return {
    score: { home: avgHomeScore, away: avgAwayScore },
    confidence: avgConfidence,
    reasoning,
  };
}

function predictSingleScore(
  homeTeam: Team,
  awayTeam: Team,
  homeStats: TeamStats,
  awayStats: TeamStats,
  fixture: Fixture,
  leagueStats: any,
  historicalData: Map<string, HistoricalTeamData>
) {
  // Get historical data for both teams
  const homeHistorical = historicalData.get(homeTeam.name);
  const awayHistorical = historicalData.get(awayTeam.name);

  // Current season data
  const homeGoalsFor = homeStats.goals_for;
  const homeGoalsAgainst = homeStats.goals_against;
  const awayGoalsFor = awayStats.goals_for;
  const awayGoalsAgainst = awayStats.goals_against;
  const homePlayed = Math.max(homeStats.played, 1);
  const awayPlayed = Math.max(awayStats.played, 1);

  // Calculate current season rates
  const homeCurrentAttackRate = homeGoalsFor / homePlayed;
  const homeCurrentDefenseRate = homeGoalsAgainst / homePlayed;
  const awayCurrentAttackRate = awayGoalsFor / awayPlayed;
  const awayCurrentDefenseRate = awayGoalsAgainst / awayPlayed;

  // Calculate historical rates (if available)
  let homeHistoricalAttackRate = 1.35; // Default PL average
  let homeHistoricalDefenseRate = 1.35;
  let awayHistoricalAttackRate = 1.35;
  let awayHistoricalDefenseRate = 1.35;

  if (homeHistorical) {
    homeHistoricalAttackRate = homeHistorical.goals_for / homeHistorical.played;
    homeHistoricalDefenseRate =
      homeHistorical.goals_against / homeHistorical.played;
  }

  if (awayHistorical) {
    awayHistoricalAttackRate = awayHistorical.goals_for / awayHistorical.played;
    awayHistoricalDefenseRate =
      awayHistorical.goals_against / awayHistorical.played;
  }

  // Weighted combination of current and historical data
  // Early season: more weight on historical, later season: more weight on current
  const seasonWeight = Math.min(0.8, Math.max(0.2, homePlayed / 20)); // 20% to 80% current season weight
  const historicalWeight = 1 - seasonWeight;

  const effectiveHomeAttack =
    homeCurrentAttackRate * seasonWeight +
    homeHistoricalAttackRate * historicalWeight;
  const effectiveHomeDefense =
    homeCurrentDefenseRate * seasonWeight +
    homeHistoricalDefenseRate * historicalWeight;
  const effectiveAwayAttack =
    awayCurrentAttackRate * seasonWeight +
    awayHistoricalAttackRate * historicalWeight;
  const effectiveAwayDefense =
    awayCurrentDefenseRate * seasonWeight +
    awayHistoricalDefenseRate * historicalWeight;

  // FPL strength adjustments (normalize to 0.8-1.2)
  const homeAttackStrength = Math.max(
    0.8,
    Math.min(1.2, (homeTeam.strength_attack_home || 1000) / 1000)
  );
  const homeDefenseStrength = Math.max(
    0.8,
    Math.min(1.2, (homeTeam.strength_defence_home || 1000) / 1000)
  );
  const awayAttackStrength = Math.max(
    0.8,
    Math.min(1.2, (awayTeam.strength_attack_away || 1000) / 1000)
  );
  const awayDefenseStrength = Math.max(
    0.8,
    Math.min(1.2, (awayTeam.strength_defence_away || 1000) / 1000)
  );

  // Home advantage
  const homeAdvantage = 1.15;

  // Calculate expected goals
  let homeExpectedGoals =
    effectiveHomeAttack *
    homeAttackStrength *
    homeAdvantage *
    (effectiveAwayDefense / awayDefenseStrength);

  let awayExpectedGoals =
    effectiveAwayAttack *
    awayAttackStrength *
    (effectiveHomeDefense / homeDefenseStrength);

  // Cap expected goals to realistic range
  homeExpectedGoals = Math.max(0.3, Math.min(3.5, homeExpectedGoals));
  awayExpectedGoals = Math.max(0.3, Math.min(3.5, awayExpectedGoals));

  // Apply form factor (increased impact from 0.12 to 0.30)
  if (homeStats.form !== null && awayStats.form !== null) {
    const formImpact = 0.30;
    const formDiff = homeStats.form - awayStats.form;

    // Scale form adjustments - larger differences have bigger impact
    const homeFormAdj = 1 + ((homeStats.form - 1.5) / 6) * formImpact;
    const awayFormAdj = 1 + ((awayStats.form - 1.5) / 6) * formImpact;

    homeExpectedGoals *= Math.max(0.6, Math.min(1.4, homeFormAdj));
    awayExpectedGoals *= Math.max(0.6, Math.min(1.4, awayFormAdj));

    // Additional boost when form difference is extreme (>1.5 difference)
    if (Math.abs(formDiff) > 1.5) {
      if (formDiff > 0) {
        homeExpectedGoals *= 1.15;
        awayExpectedGoals *= 0.85;
      } else {
        awayExpectedGoals *= 1.15;
        homeExpectedGoals *= 0.85;
      }
    }
  }

  // League position adjustment (increased impact from 0.04 to 0.10)
  const positionImpact = 0.10;
  if (homeStats.position && awayStats.position) {
    const currentPositionDiff = awayStats.position - homeStats.position;
    let historicalPositionDiff = 0;

    if (homeHistorical && awayHistorical) {
      historicalPositionDiff =
        awayHistorical.position - homeHistorical.position;
    }

    // Weighted position difference
    const effectivePositionDiff =
      currentPositionDiff * seasonWeight +
      historicalPositionDiff * historicalWeight;

    // Scale position impact based on the magnitude of difference
    const positionScale = Math.min(12, Math.abs(effectivePositionDiff)) / 12;

    if (effectivePositionDiff > 0) {
      // Home team is higher (better position, lower number)
      homeExpectedGoals *= 1 + (positionImpact * positionScale);
      awayExpectedGoals *= 1 - (positionImpact * 0.5 * positionScale);
    } else if (effectivePositionDiff < 0) {
      // Away team is higher
      awayExpectedGoals *= 1 + (positionImpact * positionScale);
      homeExpectedGoals *= 1 - (positionImpact * 0.5 * positionScale);
    }
  }

  // Convert to actual scores with variance
  const homeScore = Math.max(
    0,
    Math.round(homeExpectedGoals + (Math.random() - 0.5) * 1.0)
  );
  const awayScore = Math.max(
    0,
    Math.round(awayExpectedGoals + (Math.random() - 0.5) * 1.0)
  );

  // Calculate confidence
  const strengthDiff = Math.abs(
    (homeTeam.strength_overall_home || 1000) -
      (awayTeam.strength_overall_away || 1000)
  );
  const confidence = Math.min(85, Math.max(55, 65 + strengthDiff * 0.02));

  return {
    score: { home: homeScore, away: awayScore },
    confidence: Math.round(confidence),
    homeXG: homeExpectedGoals,
    awayXG: awayExpectedGoals,
    homeGPG: effectiveHomeAttack,
    awayGPG: effectiveAwayAttack,
  };
}

function generateDetailedReasoning(
  homeTeam: Team,
  awayTeam: Team,
  homeScore: number,
  awayScore: number,
  homeXG: number,
  awayXG: number,
  homeGPG: number,
  awayGPG: number,
  numSimulations: number,
  historicalData: Map<string, HistoricalTeamData>
): string {
  const reasons = [];

  // Result prediction
  if (homeScore > awayScore) {
    reasons.push(`${homeTeam.short_name} predicted to win at home`);
  } else if (awayScore > homeScore) {
    reasons.push(`${awayTeam.short_name} expected to win away`);
  } else {
    reasons.push("Evenly matched - predicting a draw");
  }

  // Simulation info
  reasons.push(`Averaged over ${numSimulations} simulations`);

  // Expected goals
  reasons.push(
    `xG: ${homeTeam.short_name} ${homeXG.toFixed(1)}, ${
      awayTeam.short_name
    } ${awayXG.toFixed(1)}`
  );

  // Combined seasonal data
  reasons.push(
    `Combined avg: ${homeTeam.short_name} ${homeGPG.toFixed(1)}/game, ${
      awayTeam.short_name
    } ${awayGPG.toFixed(1)}/game`
  );

  // Historical context
  const homeHistorical = historicalData.get(homeTeam.name);
  const awayHistorical = historicalData.get(awayTeam.name);

  if (homeHistorical && awayHistorical) {
    const homeLastSeasonGPG = (
      homeHistorical.goals_for / homeHistorical.played
    ).toFixed(1);
    const awayLastSeasonGPG = (
      awayHistorical.goals_for / awayHistorical.played
    ).toFixed(1);
    reasons.push(
      `Last season: ${homeTeam.short_name} ${homeLastSeasonGPG}/game, ${awayTeam.short_name} ${awayLastSeasonGPG}/game`
    );
  }

  // Form analysis
  if (
    homeTeam.form !== null &&
    awayTeam.form !== null &&
    Math.abs(homeTeam.form - awayTeam.form) > 1
  ) {
    const betterTeam =
      homeTeam.form > awayTeam.form ? homeTeam.short_name : awayTeam.short_name;
    reasons.push(`${betterTeam} in better recent form`);
  }

  reasons.push("Home advantage (+15%) and historical data factored in");

  return reasons.join("; ");
}
