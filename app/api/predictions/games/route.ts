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
          leagueStats
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
  leagueStats: any
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
      leagueStats
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
    numSimulations
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
  leagueStats: any
) {
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

  // Early in the season a team's own rate is noisy (few real games to go
  // on), so blend it toward the league's actual CURRENT-season average
  // (computed live from this season's finished fixtures) rather than a
  // fixed prior - this converges to the team's own rate as real games
  // accumulate, without relying on stale season-to-season data.
  const homeSeasonWeight = Math.min(0.9, Math.max(0.3, homeStats.played / 10));
  const awaySeasonWeight = Math.min(0.9, Math.max(0.3, awayStats.played / 10));
  const leagueAvgAttack = leagueStats.avgGoalsPerGame;
  const leagueAvgDefense = leagueStats.avgGoalsAgainstPerGame;

  const effectiveHomeAttack =
    homeCurrentAttackRate * homeSeasonWeight +
    leagueAvgAttack * (1 - homeSeasonWeight);
  const effectiveHomeDefense =
    homeCurrentDefenseRate * homeSeasonWeight +
    leagueAvgDefense * (1 - homeSeasonWeight);
  const effectiveAwayAttack =
    awayCurrentAttackRate * awaySeasonWeight +
    leagueAvgAttack * (1 - awaySeasonWeight);
  const effectiveAwayDefense =
    awayCurrentDefenseRate * awaySeasonWeight +
    leagueAvgDefense * (1 - awaySeasonWeight);

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

  // League position adjustment - only once both teams have played enough
  // real games that position reflects results rather than tiebreaker order
  // (everyone is tied at 0 points before kickoff, so position is meaningless
  // that early - no historical stand-in needed, just wait for real data).
  const positionImpact = 0.1;
  const minGamesForPosition = 3;
  if (
    homeStats.position &&
    awayStats.position &&
    homeStats.played >= minGamesForPosition &&
    awayStats.played >= minGamesForPosition
  ) {
    const positionDiff = awayStats.position - homeStats.position;
    const positionScale = Math.min(12, Math.abs(positionDiff)) / 12;

    if (positionDiff > 0) {
      // Home team is higher (better position, lower number)
      homeExpectedGoals *= 1 + positionImpact * positionScale;
      awayExpectedGoals *= 1 - positionImpact * 0.5 * positionScale;
    } else if (positionDiff < 0) {
      // Away team is higher
      awayExpectedGoals *= 1 + positionImpact * positionScale;
      homeExpectedGoals *= 1 - positionImpact * 0.5 * positionScale;
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
  numSimulations: number
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

  // Form analysis - form property not available on Team type
  // if (
  //   homeTeam.form !== null &&
  //   awayTeam.form !== null &&
  //   Math.abs(homeTeam.form - awayTeam.form) > 1
  // ) {
  //   const betterTeam =
  //     homeTeam.form > awayTeam.form ? homeTeam.short_name : awayTeam.short_name;
  //   reasons.push(`${betterTeam} in better recent form`);
  // }

  reasons.push("Home advantage (+15%) factored in");

  return reasons.join("; ");
}
