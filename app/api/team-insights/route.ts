import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ragCache } from "@/lib/rag-cache";
import { RAG_CONFIG } from "@/lib/rag-config";
import { calculateTeamGrade, getGradeDescription } from "./grading";

export async function POST(request: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  try {
    const body = await request.json();
    const {
      teamData,
      squadData,
      currentGameweek,
      gameweekFinished,
      fixtures,
      elements,
      teamHistory,
      userLeagues,
    } = body;

    if (!teamData || !squadData) {
      return NextResponse.json(
        { error: "Missing required team or squad data" },
        { status: 400 }
      );
    }

    // Calculate team grade
    const { grade, breakdown } = await calculateTeamGrade(
      teamData,
      squadData,
      currentGameweek,
      teamHistory,
      userLeagues
    );
    const gradeDescription = getGradeDescription(grade);

    try {
      // Fetch RAG data (computed live from real FPL data) with caching
      let ragData = null;

      const cacheKey = `rag-data-${currentGameweek}`;
      const cachedData = ragCache.get<{ ragData: any }>(cacheKey);

      if (cachedData && RAG_CONFIG.features.enableCaching) {
        ragData = cachedData.ragData;
      } else {
        try {
          const ragResponse = await fetch(
            `${
              process.env.NEXTAUTH_URL || "http://localhost:3000"
            }/api/rag-data`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                elements,
                fixtures,
                currentGameweek,
                gameweekFinished,
              }),
            }
          );

          if (ragResponse.ok) {
            const ragResult = await ragResponse.json();
            ragData = ragResult.ragData;

            if (RAG_CONFIG.features.enableCaching) {
              ragCache.set(cacheKey, { ragData }, RAG_CONFIG.cache.ragDataTTL);
            }
          }
        } catch (error) {
          //console.log(
          //   "Could not fetch RAG data, proceeding with basic analysis"
          // );
        }
      }

      // Prepare data for analysis
      const squadAnalysis = squadData.map((player: any) => {
        const availability = getAvailability(
          player.status,
          player.chance_of_playing_next_round,
          player.news
        );
        return {
          name: player.web_name,
          position: player.position_name,
          team: player.team_name,
          teamId: player.team,
          points: player.total_points,
          form: player.form,
          price: player.now_cost / 10,
          minutes: player.minutes,
          goals: player.goals_scored,
          assists: player.assists,
          cleanSheets: player.clean_sheets,
          isCaptain: player.is_captain,
          isViceCaptain: player.is_vice_captain,
          isStarting: player.is_starting !== false,
          availability,
        };
      });

      // Analyze current gameweek fixtures for each team
      const currentGameweekFixtures =
        fixtures?.filter((fixture: any) => fixture.event === currentGameweek) ||
        [];

      const teamFixtureStatus = new Map();
      currentGameweekFixtures.forEach((fixture: any) => {
        teamFixtureStatus.set(fixture.team_h, {
          hasPlayed: fixture.finished,
          opponent: fixture.team_a,
          isHome: true,
          started: fixture.started,
        });
        teamFixtureStatus.set(fixture.team_a, {
          hasPlayed: fixture.finished,
          opponent: fixture.team_h,
          isHome: false,
          started: fixture.started,
        });
      });

      // Add fixture context to squad analysis
      const squadWithFixtures = squadAnalysis.map((player: any) => {
        const fixtureInfo = teamFixtureStatus.get(player.teamId);
        return {
          ...player,
          hasPlayedThisGW: fixtureInfo?.hasPlayed || false,
          gameStarted: fixtureInfo?.started || false,
        };
      });

      // --- Real forward-looking fixture analysis (next 5 gameweeks) ---
      const teamsById = new Map<number, any>(
        (teams || []).map((t: any) => [t.id, t])
      );
      const windowEnd = currentGameweek + 5;
      const upcomingFixtures = (fixtures || []).filter(
        (f: any) => f.event > currentGameweek && f.event <= windowEnd
      );

      const fixtureLabel = (fixture: any, teamId: number) => {
        const isHome = fixture.team_h === teamId;
        const oppId = isHome ? fixture.team_a : fixture.team_h;
        const opp = teamsById.get(oppId)?.short_name || "?";
        const difficulty = isHome
          ? fixture.team_h_difficulty
          : fixture.team_a_difficulty;
        return `${isHome ? "vs" : "@"}${opp}(${difficulty})`;
      };

      const squadWithFixtureRun = squadWithFixtures.map((p: any) => {
        const teamFixtures = upcomingFixtures
          .filter((f: any) => f.team_h === p.teamId || f.team_a === p.teamId)
          .sort((a: any, b: any) => a.event - b.event);
        const nextFixture = teamFixtures[0];
        const runLabel = teamFixtures
          .map((f: any) => fixtureLabel(f, p.teamId))
          .join(", ");
        const avgDifficulty =
          teamFixtures.length > 0
            ? (
                teamFixtures.reduce(
                  (sum: number, f: any) =>
                    sum +
                    (f.team_h === p.teamId
                      ? f.team_h_difficulty
                      : f.team_a_difficulty),
                  0
                ) / teamFixtures.length
              ).toFixed(1)
            : null;
        return {
          ...p,
          nextFixture: nextFixture
            ? fixtureLabel(nextFixture, p.teamId)
            : "blank next GW",
          fixtureRun: runLabel || "no fixtures in next 5 GWs",
          avgFixtureDifficulty: avgDifficulty,
        };
      });

      // Squad-wide gameweek-by-gameweek outlook, useful for chip timing (Bench Boost / Triple Captain windows)
      const gwWindowAnalysis = [];
      for (let gw = currentGameweek + 1; gw <= windowEnd; gw++) {
        let appearances = 0;
        let totalDifficulty = 0;
        let playersWithFixture = 0;
        squadWithFixtures.forEach((p: any) => {
          const pf = (fixtures || []).filter(
            (f: any) =>
              f.event === gw && (f.team_h === p.teamId || f.team_a === p.teamId)
          );
          if (pf.length > 0) playersWithFixture++;
          pf.forEach((f: any) => {
            totalDifficulty +=
              f.team_h === p.teamId ? f.team_h_difficulty : f.team_a_difficulty;
            appearances++;
          });
        });
        gwWindowAnalysis.push({
          gameweek: gw,
          playersWithFixture,
          totalAppearances: appearances,
          avgDifficulty:
            appearances > 0 ? (totalDifficulty / appearances).toFixed(2) : null,
        });
      }

      const fixtureOutlookContext = `
Squad Fixture Run (next 5 GWs, difficulty 1=easiest to 5=hardest):
${squadWithFixtureRun
  .map((p: any) => `${p.name} (${p.team}): ${p.fixtureRun}`)
  .join("\n")}

Gameweek-by-Gameweek Squad Outlook (use this for chip timing):
${gwWindowAnalysis
  .map(
    (g: any) =>
      `GW${g.gameweek}: ${g.playersWithFixture}/${squadWithFixtures.length} squad players have a fixture, ${
        g.totalAppearances
      } total player-appearances${
        g.totalAppearances > squadWithFixtures.length
          ? " (some squad players have a double gameweek)"
          : g.totalAppearances < squadWithFixtures.length
          ? " (some squad players are blank this gameweek)"
          : ""
      }, avg difficulty ${g.avgDifficulty ?? "N/A"}`
  )
  .join("\n")}
`;

      // --- Real chip usage context ---
      const chipStatus = CHIP_TYPES.map((type) => {
        const usages = (chipsUsed || []).filter((c: any) => c.name === type);
        const usedFirstHalf = usages.some(
          (c: any) => c.event <= FIRST_HALF_DEADLINE_GW
        );
        const usedSecondHalf = usages.some(
          (c: any) => c.event > FIRST_HALF_DEADLINE_GW
        );
        return {
          label: CHIP_LABELS[type],
          events: usages.map((c: any) => c.event),
          usedFirstHalf,
          usedSecondHalf,
        };
      });

      const chipContext = `
Chip Status (each of Wildcard/Free Hit/Bench Boost/Triple Captain is available twice per season: once for GW1-${FIRST_HALF_DEADLINE_GW}, once for GW${
        FIRST_HALF_DEADLINE_GW + 1
      }-38):
${chipStatus
  .map((c) => {
    const usedText =
      c.events.length > 0 ? `used in GW ${c.events.join(", ")}` : "not yet used";
    const urgency =
      !c.usedFirstHalf && currentGameweek <= FIRST_HALF_DEADLINE_GW
        ? ` - first-half chip still available, must be used by GW${FIRST_HALF_DEADLINE_GW} or it is lost`
        : !c.usedSecondHalf && currentGameweek > FIRST_HALF_DEADLINE_GW
        ? " - second-half chip still available"
        : "";
    return `${c.label}: ${usedText}${urgency}`;
  })
  .join("\n")}
${activeChip ? `Active this gameweek: ${CHIP_LABELS[activeChip] || activeChip}` : "No chip active this gameweek"}
`;

      const gameweekStatusText = gameweekFinished
        ? "Gameweek has finished"
        : "Gameweek is ongoing - some matches may not have been played yet";

      // Build enhanced context with RAG data (all computed from live FPL data)
      let ragContext = "";
      if (ragData) {
        ragContext = `

ENHANCED ANALYSIS DATA (from actual FPL API):

Position Benchmarks:
${Object.entries(ragData.positionAverages)
  .map(
    ([pos, data]: [string, any]) =>
      `${pos}: Avg ${data.averagePoints.toFixed(
        1
      )} pts, Top performers: ${data.topPerformers
        .slice(0, 3)
        .join(", ")}, Price ranges: £${data.priceRanges.budget}m-${
        data.priceRanges.premium
      }m`
  )
  .join("\n")}

Transfer Market Trends (real-time FPL data):
- Most transferred IN: ${ragData.transferTrends.mostTransferredIn.slice(0, 5).join(", ")}
- Most transferred OUT: ${ragData.transferTrends.mostTransferredOut.slice(0, 5).join(", ")}
- Rising prices: ${ragData.transferTrends.risingPrices.slice(0, 5).join(", ")}
- Falling prices: ${ragData.transferTrends.fallingPrices.slice(0, 5).join(", ")}

Next Gameweek Fixtures: ${ragData.nextGameweekFixtures.length} matches scheduled
`;
      }

      // Add external content if available
      let externalContext = "";
      if (externalContent) {
        externalContext = `
LIVE INTELLIGENCE DATA:
${externalContent.summary || ""}

Expected Goals (xG) Data:
${
  externalContent.analytics?.xGData
    ?.map((p: any) => `${p.player}: ${p.xG} xG, ${p.xA} xA`)
    .join(", ") || "No xG data available"
}

Expected Goals (xG) Leaders:
${ragData.xgLeaders
  .map((p: any) => `${p.player}: ${p.xG} xG, ${p.xA} xA`)
  .join(", ")}

Injury/Availability Concerns:
${
  ragData.availabilityConcerns.length > 0
    ? ragData.availabilityConcerns
        .map(
          (p: any) => `${p.player}: ${p.status}${p.news ? ` - ${p.news}` : ""}`
        )
        .join("\n")
    : "No significant availability concerns among widely-owned players"
}
`;
      }

      const prompt = `
You are an expert Fantasy Premier League analyst. This team has been rated ${grade}/100. Provide 4-5 specific team insights that explain and support this rating.

TEAM RATING: ${grade}/100
${gradeDescription}

RATING BREAKDOWN (use these EXACT scores in your section headers):
${JSON.stringify(breakdown, null, 2)}

CONTEXT: ${gameweekStatusText}
${ragContext}
${fixtureOutlookContext}
${chipContext}

Team Overview:
- Total Points: ${teamData.totalPoints}
- Overall Rank: ${teamData.overallRank ? `#${teamData.overallRank.toLocaleString()}` : 'N/A'}
- Team Value: ${teamData.teamValue ? `£${(teamData.teamValue / 10).toFixed(1)}m` : 'N/A'}
- Bank: ${teamData.bank ? `£${(teamData.bank / 10).toFixed(1)}m` : 'N/A'}
- Current Gameweek: ${currentGameweek}

Squad Details:
${squadWithFixtureRun
  .map(
    (p: any) =>
      `${p.name} (${p.team}) - ${p.position}: ${p.points}pts, Form: ${
        p.form
      }, £${p.price}m, ${p.minutes} mins${p.isCaptain ? " [CAPTAIN]" : ""}${
        p.isViceCaptain ? " [VC]" : ""
      }${p.isStarting ? "" : " [BENCH]"}${
        !p.hasPlayedThisGW ? " [NOT PLAYED YET THIS GW]" : ""
      } | Next: ${p.nextFixture}${
        p.availability
          ? ` | AVAILABILITY: ${formatAvailability(p.availability)}`
          : ""
      }`
  )
  .join("\n")}

Provide insights that explain the ${grade}/100 rating:

IMPORTANT: The overall grade of ${grade}/100 comes from these components:
- Weekly Performance: ${breakdown.weeklyPerformance?.score || 'N/A'}/${breakdown.weeklyPerformance?.max || 35} points
- Private League Standings: ${breakdown.privateLeagues?.score || 'N/A'}/${breakdown.privateLeagues?.max || 30} points
- Overall Rank: ${breakdown.overallRank?.score || 'N/A'}/${breakdown.overallRank?.max || 15} points
- Team Value: ${breakdown.teamValue?.score || 'N/A'}/${breakdown.teamValue?.max || 10} points
- Recent Form: ${breakdown.recentForm?.score || 'N/A'}/${breakdown.recentForm?.max || 10} points

Create 4-5 insights using these EXACT section headers with INDIVIDUAL scores:
1. **Weekly Performance (${breakdown.weeklyPerformance?.score || 'N/A'}/${breakdown.weeklyPerformance?.max || 35})**: Explain weekly performance vs averages
2. **Private League Standings (${breakdown.privateLeagues?.score || 'N/A'}/${breakdown.privateLeagues?.max || 30})**: Explain private league performance
3. **Key Strengths**: What's driving the strong rating components
4. **Areas for Improvement**: What's limiting the grade
5. **Strategic Recommendations**: Specific actions to improve

CRITICAL FORMATTING REQUIREMENTS:
- Copy the EXACT section headers above with their individual component scores
- For example: "Weekly Performance (30.2/35)" NOT "Weekly Performance (${grade}/100)"
- For example: "Private League Standings (30.0/30)" NOT "Private League Standings (${grade}/100)"
- Sections 3-5 should have NO score in the header (just the title)

Requirements:
- Directly reference the grade and rating factors
- Be specific with player names and numbers
- Each insight should be 2-3 sentences
- Focus on actionable advice
- Use expert FPL terminology

Format as bullet points with section headers.
`;

      // Create completion (non-streaming)
      const completion = await openai.chat.completions.create({
        model: RAG_CONFIG.openAI.model,
        messages: [
          {
            role: "system",
            content: RAG_CONFIG.openAI.systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: RAG_CONFIG.openAI.maxTokens,
        ...(RAG_CONFIG.openAI.reasoning_effort && {
          reasoning_effort: RAG_CONFIG.openAI.reasoning_effort,
        }),
      });

      const insights = completion.choices[0]?.message?.content || "";

      return NextResponse.json({
        grade,
        gradeDescription,
        insights,
        breakdown,
        fallback: false,
      });
    } catch (aiError) {
      console.error("Error with OpenAI analysis:", aiError);

      // Enhanced fallback insights with basic data, matching the structured format
      const fallbackInsights = `
**Team Analysis** (Basic Mode)
• Your team has been rated ${grade}/100 based on performance metrics
• Monitor players with consistently low minutes for potential rotation risks
• Consider fixture difficulty and form trends when making transfer decisions
• Review your captaincy choice based on upcoming opponents and recent performance
• Focus on beating weekly averages to improve your rating`;

      return NextResponse.json({
        grade,
        gradeDescription,
        insights: fallbackInsights.trim(),
        breakdown,
        fallback: true,
      });
    }
  } catch (error) {
    console.error("Error generating team insights:", error);
    return NextResponse.json(
      { error: "Failed to generate team insights" },
      { status: 500 }
    );
  }
}
