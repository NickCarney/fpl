import { NextRequest, NextResponse } from "next/server";

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

interface Element {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  total_points: number;
  points_per_game: string;
  form: string;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  starts: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  chance_of_playing_this_round: number | null;
  chance_of_playing_next_round: number | null;
  selected_by_percent: string;
}

interface Team {
  id: number;
  name: string;
  short_name: string;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

interface Fixture {
  id: number;
  event: number;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  kickoff_time: string;
  finished: boolean;
}

interface Pick {
  element: number;
  position: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  multiplier: number;
}

export async function GET(request: NextRequest) {
  try {
    // Get team ID from query params
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json(
        { error: "Team ID is required" },
        { status: 400 }
      );
    }

    console.log(`Fetching predictions for team ${teamId}`);

    // Fetch bootstrap data
    const bootstrapResponse = await fetch(`${FPL_BASE_URL}/bootstrap-static/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      cache: "no-store", // Prevent caching
    });
    if (!bootstrapResponse.ok) {
      throw new Error("Failed to fetch bootstrap data");
    }
    const bootstrapData = await bootstrapResponse.json();

    const elements: Element[] = bootstrapData.elements;
    const teams: Team[] = bootstrapData.teams;
    const events = bootstrapData.events;

    console.log(
      "Available events:",
      events.map((e: any) => ({
        id: e.id,
        name: e.name,
        is_current: e.is_current,
        is_next: e.is_next,
        finished: e.finished,
      }))
    );

    // Find the correct gameweek to predict for
    let targetEvent = events.find((e: any) => e.is_current && !e.finished);

    // If current gameweek is finished, look for next gameweek
    if (!targetEvent || targetEvent.finished) {
      targetEvent = events.find((e: any) => e.is_next);
    }

    // If no next event, try to find the latest unfinished event
    if (!targetEvent) {
      targetEvent = events.find((e: any) => !e.finished);
    }

    console.log("Target event:", targetEvent);

    if (!targetEvent) {
      return NextResponse.json(
        { error: "No upcoming gameweek found" },
        { status: 404 }
      );
    }

    // Try to get the latest team picks - sometimes we need to try current gameweek picks
    let teamData;
    let picksEvent = targetEvent.id;

    // First try the target event
    try {
      console.log(`Trying to fetch picks for event ${picksEvent}`);
      const teamResponse = await fetch(
        `${FPL_BASE_URL}/entry/${teamId}/event/${picksEvent}/picks/`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          cache: "no-store",
        }
      );

      if (!teamResponse.ok) {
        throw new Error(`HTTP ${teamResponse.status}`);
      }

      teamData = await teamResponse.json();
      console.log("Successfully fetched picks for event:", picksEvent);
    } catch (error) {
      console.log(
        `Failed to fetch picks for event ${picksEvent}, trying previous event...`
      );

      // If that fails, try the previous gameweek (current team might not have made picks for next week yet)
      const previousEvent = events.find(
        (e: any) => e.id === targetEvent.id - 1
      );
      if (previousEvent) {
        picksEvent = previousEvent.id;
        console.log(`Trying to fetch picks for previous event ${picksEvent}`);

        const teamResponse = await fetch(
          `${FPL_BASE_URL}/entry/${teamId}/event/${picksEvent}/picks/`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            cache: "no-store",
          }
        );

        if (!teamResponse.ok) {
          throw new Error("Failed to fetch team picks for any recent gameweek");
        }
        teamData = await teamResponse.json();
        console.log(
          "Successfully fetched picks for previous event:",
          picksEvent
        );
      } else {
        throw new Error("Failed to fetch team picks");
      }
    }

    const picks: Pick[] = teamData.picks;
    console.log("Fetched picks:", picks.length, "players");

    // Fetch fixtures for the target gameweek
    const fixturesResponse = await fetch(
      `${FPL_BASE_URL}/fixtures/?event=${targetEvent.id}`,
      {
        cache: "no-store",
      }
    );
    if (!fixturesResponse.ok) {
      throw new Error("Failed to fetch fixtures");
    }
    const fixtures: Fixture[] = await fixturesResponse.json();

    // Get upcoming fixtures only
    const upcomingFixtures = fixtures.filter((fixture) => !fixture.finished);
    console.log("Upcoming fixtures:", upcomingFixtures.length);

    // Predict points for each player in the squad
    const playerPredictions = picks
      .map((pick) => {
        const player = elements.find((el) => el.id === pick.element);
        if (!player) {
          console.log("Player not found for pick:", pick.element);
          return null;
        }

        const team = teams.find((t) => t.id === player.team);
        if (!team) {
          console.log("Team not found for player:", player.web_name);
          return null;
        }

        // Get player's fixture for this gameweek
        const playerFixture = upcomingFixtures.find(
          (fixture) =>
            fixture.team_h === player.team || fixture.team_a === player.team
        );

        const prediction = predictPlayerPoints(
          player,
          team,
          playerFixture,
          targetEvent.id
        );

        return {
          id: player.id,
          name: player.web_name,
          position: getPositionName(player.element_type),
          team: team.short_name,
          predictedPoints: prediction.points,
          confidence: prediction.confidence,
          breakdown: prediction.breakdown,
          isStarter: pick.position <= 11,
          isCaptain: pick.is_captain,
          isViceCaptain: pick.is_vice_captain,
          multiplier: pick.multiplier, // This should be 2 for captain, 1 for others
          fixture: playerFixture
            ? {
                opponent:
                  playerFixture.team_h === player.team
                    ? teams.find((t) => t.id === playerFixture.team_a)
                        ?.short_name || "Unknown"
                    : teams.find((t) => t.id === playerFixture.team_h)
                        ?.short_name || "Unknown",
                isHome: playerFixture.team_h === player.team,
                difficulty:
                  playerFixture.team_h === player.team
                    ? playerFixture.team_h_difficulty
                    : playerFixture.team_a_difficulty,
              }
            : null,
        };
      })
      .filter((p) => p !== null);

    console.log("Player predictions generated:", playerPredictions.length);
    console.log("Captain:", playerPredictions.find((p) => p!.isCaptain)?.name);
    console.log(
      "Vice Captain:",
      playerPredictions.find((p) => p!.isViceCaptain)?.name
    );

    // Calculate total predicted points (with captain multiplier)
    const totalPredictedPoints = playerPredictions.reduce((sum, p) => {
      const points = p!.predictedPoints * p!.multiplier; // multiplier should be 2 for captain
      console.log(
        `${p!.name}: ${p!.predictedPoints} x ${p!.multiplier} = ${points}`
      );
      return sum + points;
    }, 0);

    console.log("Total predicted points:", totalPredictedPoints);

    return NextResponse.json({
      gameweek: targetEvent.id,
      gameweekName: targetEvent.name,
      totalPredictedPoints: Math.round(totalPredictedPoints * 10) / 10,
      players: playerPredictions,
      picksFromGameweek: picksEvent, // Add this for debugging
      summary: {
        startingXI: playerPredictions.filter((p) => p!.isStarter).length,
        bench: playerPredictions.filter((p) => !p!.isStarter).length,
        captain: playerPredictions.find((p) => p!.isCaptain)?.name || "Unknown",
        viceCaptain:
          playerPredictions.find((p) => p!.isViceCaptain)?.name || "Unknown",
      },
    });
  } catch (error) {
    console.error("Error fetching team predictions:", error);
    return NextResponse.json(
      { error: `Failed to fetch team predictions: ${error}` },
      { status: 500 }
    );
  }
}

function generatePredictions(
  elements: Element[],
  teams: Team[],
  picks: Pick[],
  targetEvent: any,
  upcomingFixtures: Fixture[]
) {
  console.log("Generating predictions...");

  // Predict points for each player in the squad
  const playerPredictions = picks
    .map((pick, index) => {
      try {
        const player = elements.find((el) => el.id === pick.element);
        if (!player) {
          console.log(`Player not found for element ${pick.element}`);
          return null;
        }

        const team = teams.find((t) => t.id === player.team);
        if (!team) {
          console.log(
            `Team not found for player ${player.web_name}, team ID: ${player.team}`
          );
          return null;
        }

        // Get player's fixture for this gameweek
        const playerFixture = upcomingFixtures.find(
          (fixture) =>
            fixture.team_h === player.team || fixture.team_a === player.team
        );

        console.log(
          `Processing player ${index + 1}/${picks.length}: ${
            player.web_name
          } (${team.short_name})`
        );

        const prediction = predictPlayerPoints(
          player,
          team,
          playerFixture,
          targetEvent.id
        );

        return {
          id: player.id,
          name: player.web_name,
          position: getPositionName(player.element_type),
          team: team.short_name,
          predictedPoints: prediction.points,
          confidence: prediction.confidence,
          breakdown: prediction.breakdown,
          isStarter: pick.position <= 11,
          isCaptain: pick.is_captain,
          isViceCaptain: pick.is_vice_captain,
          multiplier: pick.multiplier,
          fixture: playerFixture
            ? {
                opponent:
                  playerFixture.team_h === player.team
                    ? teams.find((t) => t.id === playerFixture.team_a)
                        ?.short_name || "Unknown"
                    : teams.find((t) => t.id === playerFixture.team_h)
                        ?.short_name || "Unknown",
                isHome: playerFixture.team_h === player.team,
                difficulty:
                  playerFixture.team_h === player.team
                    ? playerFixture.team_h_difficulty
                    : playerFixture.team_a_difficulty,
              }
            : null,
        };
      } catch (playerError) {
        console.error(`Error processing player ${pick.element}:`, playerError);
        return null;
      }
    })
    .filter((p) => p !== null);

  console.log("Predictions generated for", playerPredictions.length, "players");

  // Calculate total predicted points
  const totalPredictedPoints = playerPredictions
    .filter((p) => p!.isStarter)
    .reduce((sum, p) => sum + p!.predictedPoints * p!.multiplier, 0);

  console.log("Total predicted points:", totalPredictedPoints);

  return NextResponse.json({
    gameweek: targetEvent.id,
    gameweekName: targetEvent.name,
    totalPredictedPoints: Math.round(totalPredictedPoints * 10) / 10,
    players: playerPredictions,
    summary: {
      startingXI: playerPredictions.filter((p) => p!.isStarter).length,
      bench: playerPredictions.filter((p) => !p!.isStarter).length,
      captain: playerPredictions.find((p) => p!.isCaptain)?.name || "Unknown",
      viceCaptain:
        playerPredictions.find((p) => p!.isViceCaptain)?.name || "Unknown",
    },
  });
}

function predictPlayerPoints(
  player: Element,
  team: Team,
  fixture: Fixture | undefined,
  gameweek: number
): { points: number; confidence: number; breakdown: any } {
  // Ensure we have valid numeric values
  const gamesPlayed = Math.max(player.starts || 0, 1);
  const minutesPerGame = (player.minutes || 0) / gamesPlayed;
  const pointsPerGame = parseFloat(player.points_per_game) || 0;
  const form = parseFloat(player.form) || 0;

  // Expected stats with safe parsing
  const expectedGoals = parseFloat(player.expected_goals) || 0;
  const expectedAssists = parseFloat(player.expected_assists) || 0;
  const expectedGoalsPerGame = expectedGoals / gamesPlayed;
  const expectedAssistsPerGame = expectedAssists / gamesPlayed;

  // Initialize prediction breakdown
  const prediction = {
    minutes: 0,
    goals: 0,
    assists: 0,
    cleanSheet: 0,
    bonus: 0,
    saves: 0,
    cards: 0,
    total: 0,
  };

  let confidence = 70; // Base confidence

  // 1. MINUTES PREDICTION
  let minutesProbability = 0.9; // Default 90% chance of playing

  // Injury/availability check
  if (
    player.chance_of_playing_next_round !== null &&
    player.chance_of_playing_next_round !== undefined
  ) {
    minutesProbability = player.chance_of_playing_next_round / 100;
    confidence = Math.min(
      confidence,
      60 + player.chance_of_playing_next_round / 2
    );
  }

  // Starter vs substitute probability
  const starterProbability = Math.min(
    0.95,
    (player.starts || 0) / Math.max(gamesPlayed, 1)
  );

  if (minutesProbability > 0.75 && starterProbability > 0.7) {
    prediction.minutes = 90 * minutesProbability;
  } else if (minutesProbability > 0.5) {
    prediction.minutes = 60 * minutesProbability;
  } else {
    prediction.minutes = 20 * minutesProbability;
  }

  // Minutes points
  if (prediction.minutes >= 60) {
    prediction.total += 2;
  } else if (prediction.minutes >= 1) {
    prediction.total += 1;
  }

  // If player unlikely to play, return early
  if (prediction.minutes < 10) {
    return {
      points: Math.max(0, Math.round(prediction.total * 10) / 10),
      confidence: Math.round(confidence),
      breakdown: {
        minutes: Math.round(prediction.minutes),
        expectedGoals: 0,
        expectedAssists: 0,
        cleanSheetChance: "0%",
        bonusPoints: 0,
        fixtureInfo: fixture
          ? {
              opponent: fixture.team_h === player.team ? "vs Away" : "Away",
              difficulty:
                fixture.team_h === player.team
                  ? fixture.team_h_difficulty
                  : fixture.team_a_difficulty,
            }
          : null,
      },
    };
  }

  // 2. POSITION-SPECIFIC PREDICTIONS
  const elementType = player.element_type || 4; // Default to forward if missing

  if (elementType === 1) {
    // GOALKEEPER
    const cleanSheetRate = (player.clean_sheets || 0) / gamesPlayed;
    let cleanSheetProbability = cleanSheetRate;

    if (fixture) {
      const isHome = fixture.team_h === player.team;
      const difficulty = isHome
        ? fixture.team_h_difficulty
        : fixture.team_a_difficulty;

      if (difficulty <= 2) {
        cleanSheetProbability *= 1.4;
      } else if (difficulty >= 4) {
        cleanSheetProbability *= 0.6;
      }

      if (isHome) {
        cleanSheetProbability *= 1.2;
      }
    }

    prediction.cleanSheet = Math.min(0.8, cleanSheetProbability) * 4;

    const savesPerGame = (player.saves || 0) / gamesPlayed;
    prediction.saves = (savesPerGame / 3) * 1;

    if ((player.penalties_saved || 0) > 0) {
      prediction.saves += 0.1 * 5;
    }
  } else if (elementType === 2) {
    // DEFENDER
    const cleanSheetRate = (player.clean_sheets || 0) / gamesPlayed;
    let cleanSheetProbability = cleanSheetRate;

    if (fixture) {
      const isHome = fixture.team_h === player.team;
      const difficulty = isHome
        ? fixture.team_h_difficulty
        : fixture.team_a_difficulty;

      if (difficulty <= 2) {
        cleanSheetProbability *= 1.3;
      } else if (difficulty >= 4) {
        cleanSheetProbability *= 0.7;
      }

      if (isHome) {
        cleanSheetProbability *= 1.15;
      }
    }

    prediction.cleanSheet = Math.min(0.7, cleanSheetProbability) * 4;
    prediction.goals = expectedGoalsPerGame * 6;
    prediction.assists = expectedAssistsPerGame * 3;
  } else if (elementType === 3) {
    // MIDFIELDER
    prediction.goals = expectedGoalsPerGame * 5;
    prediction.assists = expectedAssistsPerGame * 3;

    if ((player.clean_sheets || 0) > 0) {
      const cleanSheetRate = (player.clean_sheets || 0) / gamesPlayed;
      let cleanSheetProbability = cleanSheetRate * 0.8;

      if (fixture) {
        const isHome = fixture.team_h === player.team;
        const difficulty = isHome
          ? fixture.team_h_difficulty
          : fixture.team_a_difficulty;

        if (difficulty <= 2) {
          cleanSheetProbability *= 1.2;
        } else if (difficulty >= 4) {
          cleanSheetProbability *= 0.8;
        }
      }

      prediction.cleanSheet = cleanSheetProbability * 1;
    }
  } else if (elementType === 4) {
    // FORWARD
    prediction.goals = expectedGoalsPerGame * 4;
    prediction.assists = expectedAssistsPerGame * 3;
  }

  // 3. FIXTURE DIFFICULTY ADJUSTMENT
  if (fixture) {
    const isHome = fixture.team_h === player.team;
    const difficulty = isHome
      ? fixture.team_h_difficulty
      : fixture.team_a_difficulty;

    let fixtureMultiplier = 1.0;

    if (difficulty <= 2) {
      fixtureMultiplier = 1.25; // Easy fixtures boost
      confidence += 10;
    } else if (difficulty === 3) {
      fixtureMultiplier = 1.0; // Neutral
    } else if (difficulty === 4) {
      fixtureMultiplier = 0.85; // Harder fixtures
      confidence -= 5;
    } else {
      fixtureMultiplier = 0.7; // Very hard fixtures
      confidence -= 10;
    }

    // Apply fixture multiplier to attacking returns
    prediction.goals *= fixtureMultiplier;
    prediction.assists *= fixtureMultiplier;

    // Home advantage for all stats
    if (isHome) {
      prediction.goals *= 1.1;
      prediction.assists *= 1.1;
      confidence += 5;
    }
  }

  // 4. FORM ADJUSTMENT
  const formMultiplier = Math.max(0.7, Math.min(1.3, 0.8 + form / 10));
  prediction.goals *= formMultiplier;
  prediction.assists *= formMultiplier;

  if (form > 4) {
    confidence += 10;
  } else if (form < 2) {
    confidence -= 10;
  }

  // 5. BONUS POINTS PREDICTION
  const bonusPerGame = player.bonus / gamesPlayed;
  const bpsPerGame = player.bps / gamesPlayed;

  // Players with high BPS more likely to get bonus
  if (bpsPerGame > 20) {
    prediction.bonus = bonusPerGame * 1.2;
  } else {
    prediction.bonus = bonusPerGame * 0.8;
  }

  // 6. DISCIPLINARY (Yellow/Red cards)
  const yellowCardRate = player.yellow_cards / gamesPlayed;
  const redCardRate = player.red_cards / gamesPlayed;

  prediction.cards = -(yellowCardRate * 1) - redCardRate * 2; // -1 for yellow, -2 for red

  // 7. AGGREGATE TOTAL
  prediction.total +=
    prediction.goals +
    prediction.assists +
    prediction.cleanSheet +
    prediction.bonus +
    prediction.saves +
    prediction.cards;

  // 8. CONFIDENCE ADJUSTMENTS
  confidence = Math.max(30, Math.min(95, confidence));

  // Lower confidence for players with limited minutes
  if (minutesPerGame < 60) {
    confidence *= 0.8;
  }

  // Higher confidence for consistent performers
  if (player.starts > gamesPlayed * 0.8) {
    confidence += 5;
  }

  return {
    points: Math.max(0, Math.round(prediction.total * 10) / 10),
    confidence: Math.round(confidence),
    breakdown: {
      minutes: Math.round(prediction.minutes),
      expectedGoals: Math.round(prediction.goals * 10) / 10,
      expectedAssists: Math.round(prediction.assists * 10) / 10,
      cleanSheetChance:
        Math.round(
          (prediction.cleanSheet /
            (player.element_type === 1 || player.element_type === 2 ? 4 : 1)) *
            100
        ) + "%",
      bonusPoints: Math.round(prediction.bonus * 10) / 10,
      fixtureInfo: fixture
        ? {
            opponent: fixture.team_h === player.team ? "vs Away" : "Away",
            difficulty:
              fixture.team_h === player.team
                ? fixture.team_h_difficulty
                : fixture.team_a_difficulty,
          }
        : null,
    },
  };
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
