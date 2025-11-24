import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ragCache } from "@/lib/rag-cache";
import { RAG_CONFIG } from "@/lib/rag-config";

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
    } = body;

    if (!teamData || !squadData) {
      return NextResponse.json(
        { error: "Missing required team or squad data" },
        { status: 400 }
      );
    }

    try {
      // Fetch RAG data for enhanced analysis with caching
      let ragData = null;
      let externalContent = null;

      const cacheKey = `rag-data-${currentGameweek}`;
      const cachedData = ragCache.get<{ ragData: any; externalContent: any }>(
        cacheKey
      );

      if (cachedData && RAG_CONFIG.features.enableCaching) {
        ragData = cachedData.ragData;
        externalContent = cachedData.externalContent;
      } else {
        try {
          const ragResponse = await fetch(
            `${
              process.env.NEXTAUTH_URL || "http://localhost:3000"
            }/api/rag-data`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ elements, fixtures, currentGameweek }),
            }
          );

          if (ragResponse.ok) {
            const ragResult = await ragResponse.json();
            ragData = ragResult.ragData;
            externalContent = ragResult.externalContent;

            if (RAG_CONFIG.features.enableCaching) {
              ragCache.set(
                cacheKey,
                { ragData, externalContent },
                RAG_CONFIG.cache.ragDataTTL
              );
            }
          }
        } catch (error) {
          //console.log(
          //   "Could not fetch RAG data, proceeding with basic analysis"
          // );
        }
      }

      // Prepare data for analysis
      const squadAnalysis = squadData.map((player: any) => ({
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
      }));

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

      const gameweekStatusText = gameweekFinished
        ? "Gameweek has finished"
        : "Gameweek is ongoing - some matches may not have been played yet";

      // Build enhanced context with RAG data
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

Form Trends:
${
  externalContent.analytics?.formTable
    ?.map((p: any) => `${p.player}: ${p.form} (${p.trend})`)
    .join(", ") || "No form data available"
}

Community Insights:
${
  externalContent.predictions
    ?.map((pred: any) =>
      pred.predictions
        .slice(0, 2)
        .map((p: any) => `${p.player}: ${p.prediction}`)
        .join("; ")
    )
    .join("\n") || "No community insights available"
}
`;
      }

      const prompt = `
You are an expert Fantasy Premier League analyst with access to comprehensive data. Analyze this team and provide 4-5 specific, actionable insights.

IMPORTANT CONTEXT: ${gameweekStatusText}
${ragContext}
${externalContext}

Team Overview:
- Total Points: ${teamData.totalPoints}
- Current Gameweek: ${currentGameweek}
- Squad Value: £${squadData
        .reduce((sum: number, p: any) => sum + p.now_cost / 10, 0)
        .toFixed(1)}m

Squad Details:
${squadWithFixtures
  .map(
    (p: any) =>
      `${p.name} (${p.team}) - ${p.position}: ${p.points}pts, Form: ${
        p.form
      }, £${p.price}m, ${p.minutes} mins${p.isCaptain ? " [CAPTAIN]" : ""}${
        p.isViceCaptain ? " [VC]" : ""
      }${!p.hasPlayedThisGW ? " [NOT PLAYED YET THIS GW]" : ""}`
  )
  .join("\n")}

Provide data-driven insights about:
1. **Performance vs Position Benchmarks**: Compare players to position averages and identify over/underperformers
2. **Transfer Market Analysis**: Highlight alignment with market trends and potential value moves
3. **Captaincy & Lineup Strategy**: Evaluate choices against expert consensus and upcoming fixtures
4. **Value & Budget Optimization**: Suggest improvements based on price trends and position efficiency
5. **Differential Opportunities**: Identify low-owned gems based on the data

Requirements:
- Reference specific benchmark data when available
- Mention transfer trends and expert picks where relevant
- If a player shows "[NOT PLAYED YET THIS GW]", focus on season form and upcoming fixtures
- Be specific with numbers (points, prices, percentages)
- Prioritize actionable insights over general observations

Keep each insight to 2-3 sentences maximum. Use expert FPL terminology.
`;

      // Create streaming response
      const stream = await openai.chat.completions.create({
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
        stream: true,
        max_completion_tokens: RAG_CONFIG.openAI.maxTokens,
        // Note: GPT-5 nano only supports default temperature (1)
        ...(RAG_CONFIG.openAI.reasoning_effort && {
          reasoning_effort: RAG_CONFIG.openAI.reasoning_effort,
        }),
      });

      // Create a ReadableStream to handle the OpenAI stream
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                controller.enqueue(new TextEncoder().encode(content));
              }
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (aiError) {
      console.error("Error with OpenAI analysis:", aiError);

      // Enhanced fallback insights with basic data
      const fallbackInsights = `
**Team Analysis** (Basic Mode)
• Your squad is performing at the current level for gameweek ${currentGameweek}
• Monitor players with consistently low minutes for potential rotation risks
• Consider fixture difficulty and form trends when making transfer decisions
• Review your captaincy choice based on upcoming opponents and recent performance
• Note: Some players may not have played this gameweek - check fixtures before transfers`;

      return NextResponse.json({
        insights: fallbackInsights.trim(),
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
