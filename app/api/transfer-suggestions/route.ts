import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ragCache } from "@/lib/rag-cache";
import { RAG_CONFIG } from "@/lib/rag-config";

interface TransferRequest {
  teamData: any;
  squadData: any;
  elements: any[];
  currentGameweek: number;
  gameweekFinished: boolean;
  fixtures: any[];
  bankBalance?: number;
  freeTransfers?: number;
  numberOfTransfers?: number;
}

export async function POST(request: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const body: TransferRequest = await request.json();
    const {
      teamData,
      squadData,
      elements,
      currentGameweek,
      gameweekFinished,
      fixtures,
      bankBalance = 0,
      freeTransfers = 1,
      numberOfTransfers = 1,
    } = body;

    if (!teamData || !squadData || !elements) {
      return NextResponse.json(
        { error: "Missing required data for transfer analysis" },
        { status: 400 }
      );
    }

    // Log transfer constraints for debugging
    console.log("Transfer Analysis Constraints:", {
      bankBalance,
      freeTransfers,
      numberOfTransfers,
      currentGameweek,
    });

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
          `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/rag-data`,
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
        //console.log("Could not fetch RAG data, proceeding with basic analysis");
      }
    }

    // Get current squad player IDs to exclude from suggestions
    const currentSquadIds = squadData.map((p: any) => p.id);

    // Build comprehensive player database for AI reference
    const availablePlayers = elements
      .filter((player: any) => !currentSquadIds.includes(player.id))
      .sort((a: any, b: any) => b.total_points - a.total_points)
      .slice(0, 200);

    // Group players by position for better organization
    const playersByPosition = availablePlayers.reduce(
      (acc: any, player: any) => {
        const position =
          player.element_type === 1
            ? "GK"
            : player.element_type === 2
            ? "DEF"
            : player.element_type === 3
            ? "MID"
            : "FWD";

        if (!acc[position]) acc[position] = [];
        acc[position].push(player);
        return acc;
      },
      {}
    );

    // Build context for transfer analysis
    let ragContext = "";
    if (ragData) {
      ragContext = `
TRANSFER MARKET INTELLIGENCE:

Position Benchmarks:
${Object.entries(ragData.positionAverages)
  .map(
    ([pos, data]: [string, any]) =>
      `${pos}: Avg ${data.averagePoints.toFixed(
        1
      )} pts, Top players: ${data.topPerformers.slice(0, 3).join(", ")}`
  )
  .join("\n")}

Current Market Trends:
- Most transferred IN: ${ragData.transferTrends.mostTransferredIn.join(", ")}
- Most transferred OUT: ${ragData.transferTrends.mostTransferredOut.join(", ")}
- Rising prices: ${ragData.transferTrends.risingPrices.join(", ")}
- Falling prices: ${ragData.transferTrends.fallingPrices.join(", ")}

Expert Recommendations:
${Object.entries(ragData.expertPicks)
  .map(
    ([expert, picks]: [string, any]) =>
      `${expert}: Transfers: ${picks.transfers.join(", ")}`
  )
  .join("\n")}`;
    }

    let externalContext = "";
    if (externalContent) {
      externalContext = `
CURRENT FORM & xG DATA:
${
  externalContent.analytics?.xGData
    ?.map((p: any) => `${p.player}: ${p.xG} xG`)
    .join(", ") || "No xG data"
}

TRENDING PLAYERS:
${
  externalContent.analytics?.formTable
    ?.filter((p: any) => p.trend === "rising")
    .map((p: any) => p.player)
    .join(", ") || "No trending data"
}`;
    }

    // Build player database context - top performers by position
    const playerDatabaseContext = `
 AVAILABLE PLAYERS DATABASE (Top performers by position):

${Object.entries(playersByPosition)
  .map(([position, players]: [string, any]) => {
    const topPlayers = players.slice(0, 15);
    return `${position}:
${topPlayers
  .map(
    (p: any) =>
      `${p.web_name} (${p.team_name}): £${(p.now_cost / 10).toFixed(1)}m, ${
        p.total_points
      }pts, Form: ${p.form}, ${p.minutes}min, ${
        p.transfers_in_event || 0
      } transfers in`
  )
  .join("\n")}`;
  })
  .join("\n\n")}

IMPORTANT: Use EXACT player names and prices from this database when making suggestions.`;

    const prompt = `You are an expert FPL transfer analyst. Analyze this squad and provide ${numberOfTransfers} specific, actionable transfer recommendations.

CONSTRAINTS:
- Bank: £${bankBalance}m
- Free Transfers: ${freeTransfers}
- Current Gameweek: ${currentGameweek} ${
      gameweekFinished ? "(finished)" : "(ongoing)"
    }

Do not break any contraints (Use more than the bank allows (its okay to have multiple transfers even out), suggestmore than Free Transfers (Without saying you are))

${ragContext}
${externalContext}
${playerDatabaseContext}

MY CURRENT SQUAD (15 players I own):
${squadData
  .map(
    (p: any) =>
      `${p.web_name} (${p.team_name}) - ${p.position_name}: ${
        p.total_points
      }pts, Form: ${p.form}, £${(p.now_cost / 10).toFixed(1)}m, ${
        p.minutes
      } mins${p.is_captain ? " [C]" : ""}${p.is_vice_captain ? " [VC]" : ""}${
        gameweekFinished
          ? ``
          : p.has_played_current_gw
          ? ` | GW${currentGameweek}: ${p.current_gameweek_points}pts`
          : ` | GW${currentGameweek}: Not played yet${
              p.will_play_current_gw ? " (will play)" : " (may not play)"
            }`
      }`
  )
  .join("\n")}

IMPORTANT: 
- These 15 players are my CURRENT SQUAD - do NOT suggest transferring IN any of these players as I already own them
- Use EXACT player names and prices from the AVAILABLE PLAYERS DATABASE above
- If gameweek is ongoing, consider that players who haven't played yet may still get points
- Don't criticize players who haven't played yet for having 0 points in current gameweek
- Don't transfer out players who have played well AND are cheap - these players are not weak. 
- Take player's price into consideration. A 14mil player averaging 10 is no better (maybe wose) than a 7mil player averaging 5

TASK: Identify the ${numberOfTransfers} weakest players in MY SQUAD and suggest the BEST replacements within budget.

Consider:
1. Player performance vs position averages
2. Recent form and trend
3. Transfer market activity
4. Expected goals data (if available)
5. Upcoming fixtures
6. Price trends
7. Current gameweek performance (if gameweek finished) or playing status (if ongoing)

Provide your response in this EXACT format for each transfer:

WEAKNESS_ANALYSIS:
Player: [weakest player name from MY SQUAD]
Position: [position]
Issues: [2-3 specific issues with this player]

TRANSFER_SUGGESTION_1:
OUT: [player name] (£[exact price from database]m)
IN: [replacement name from AVAILABLE PLAYERS DATABASE] (£[exact price from database]m) 
Reason: [why this is a good transfer]
Expected_Improvement: [specific improvement expected]
Budget_Impact: [cost difference]

TRANSFER_SUGGESTION_2:
OUT: [player name] (£[exact price from database]m)
IN: [replacement name from AVAILABLE PLAYERS DATABASE] (£[exact price from database]m)
Reason: [why this is a good transfer]
Expected_Improvement: [specific improvement expected]
Budget_Impact: [cost difference]

TRANSFER_SUGGESTION_3:
OUT: [player name] (£[exact price from database]m)
IN: [replacement name from AVAILABLE PLAYERS DATABASE] (£[exact price from database]m)
Reason: [why this is a good transfer]
Expected_Improvement: [specific improvement expected]
Budget_Impact: [cost difference]

SUMMARY:
[Brief summary of the transfer strategy]

Keep it concise and data-driven. Reference specific stats and trends when available.`;

    try {
      // Create streaming response
      const stream = await openai.chat.completions.create({
        model: RAG_CONFIG.openAI.model,
        messages: [
          {
            role: "system",
            content:
              "You are an elite FPL transfer specialist with access to comprehensive market data, expected goals statistics, form trends, and expert insights. Always use exact player names and prices from the provided database.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: true,
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
          Connection: "keep-alive",
        },
      });
    } catch (aiError) {
      console.error("Error with OpenAI transfer analysis:", aiError);

      // Enhanced fallback with basic analysis
      const fallbackAnalysis = `
WEAKNESS_ANALYSIS:
Player: Analysis requires OpenAI API access
Position: Multiple positions need review
Issues: Check players with low form, limited minutes, or poor value

TRANSFER_SUGGESTION_1:
OUT: Review lowest scoring players
IN: Consider players from trending list: ${
        ragData?.transferTrends.mostTransferredIn.slice(0, 3).join(", ") ||
        "Market leaders"
      }
Reason: Based on current transfer trends and form
Expected_Improvement: Monitor upcoming fixtures and form
Budget_Impact: Calculate based on current prices

TRANSFER_SUGGESTION_2:
OUT: Check underperforming midfielders
IN: Target high-scoring alternatives
Reason: Improve points per gameweek average
Expected_Improvement: Better fixture runs and form
Budget_Impact: Assess price differences

TRANSFER_SUGGESTION_3:
OUT: Review premium players with poor returns
IN: Consider budget alternatives with better value
Reason: Free up funds for other positions
Expected_Improvement: Better points per million value
Budget_Impact: Release budget for team improvements

SUMMARY:
Enable OpenAI API for detailed analysis with exact player names and current prices.`;

      return NextResponse.json({
        analysis: fallbackAnalysis.trim(),
        fallback: true,
        ragDataAvailable: !!ragData,
      });
    }
  } catch (error) {
    console.error("Error generating transfer suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate transfer suggestions" },
      { status: 500 }
    );
  }
}
