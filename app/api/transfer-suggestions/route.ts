import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ragCache } from "@/lib/rag-cache";
import { RAG_CONFIG } from "@/lib/rag-config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TransferRequest {
  teamData: any;
  squadData: any;
  elements: any[];
  currentGameweek: number;
  gameweekFinished: boolean;
  fixtures: any[];
  bankBalance?: number;
  freeTransfers?: number;
}

export async function POST(request: NextRequest) {
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
    } = body;

    if (!teamData || !squadData || !elements) {
      return NextResponse.json(
        { error: "Missing required data for transfer analysis" },
        { status: 400 }
      );
    }

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
        console.log("Could not fetch RAG data, proceeding with basic analysis");
      }
    }

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

    const prompt = `You are an expert FPL transfer analyst. Analyze this squad and provide ONE specific, actionable transfer recommendation.

CONSTRAINTS:
- Bank: £${bankBalance}m
- Free Transfers: ${freeTransfers}
- Current Gameweek: ${currentGameweek} ${
      gameweekFinished ? "(finished)" : "(ongoing)"
    }

${ragContext}
${externalContext}

MY CURRENT SQUAD (15 players I own):
${squadData
  .map(
    (p: any) =>
      `${p.web_name} (${p.team_name}) - ${p.position_name}: ${
        p.total_points
      }pts, Form: ${p.form}, £${(p.now_cost / 10).toFixed(1)}m, ${
        p.minutes
      } mins${p.is_captain ? " [C]" : ""}${p.is_vice_captain ? " [VC]" : ""}${
        gameweekFinished ? `` : 
        p.has_played_current_gw ? ` | GW${currentGameweek}: ${p.current_gameweek_points}pts` :
        ` | GW${currentGameweek}: Not played yet${p.will_play_current_gw ? ' (will play)' : ' (may not play)'}`
      }`
  )
  .join("\n")}

IMPORTANT: 
- These 15 players are my CURRENT SQUAD - do NOT suggest transferring IN any of these players as I already own them
- If gameweek is ongoing, consider that players who haven't played yet may still get points
- Don't criticize players who haven't played yet for having 0 points in current gameweek

TASK: Identify the WEAKEST player in MY SQUAD and suggest the BEST replacement within budget.

Consider:
1. Player performance vs position averages
2. Recent form and trend
3. Transfer market activity
4. Expected goals data (if available)
5. Upcoming fixtures
6. Price trends
7. Current gameweek performance (if gameweek finished) or playing status (if ongoing)

Provide your response in this EXACT format:

WEAKNESS_ANALYSIS:
Player: [weakest player name from MY SQUAD]
Position: [position]
Issues: [2-3 specific issues with this player]

TRANSFER_SUGGESTION:
OUT: [player name] (£[price]m)
IN: [replacement name - MUST be different from any player in my squad] (£[price]m) 
Reason: [why this is a good transfer]
Expected_Improvement: [specific improvement expected]
Budget_Impact: [cost difference]

Keep it concise and data-driven. Reference specific stats and trends when available.`;

    try {
      const completion = await openai.chat.completions.create({
        model: RAG_CONFIG.openAI.model,
        messages: [
          {
            role: "system",
            content:
              "You are an elite FPL transfer specialist with access to comprehensive market data, expected goals statistics, form trends, and expert insights. Provide specific, actionable transfer advice.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.2, // Lower temperature for more consistent transfer advice
      });

      const analysis =
        completion.choices[0]?.message?.content ||
        "Unable to generate transfer analysis.";

      return NextResponse.json({
        analysis,
        ragDataAvailable: !!ragData,
        externalDataAvailable: !!externalContent,
      });
    } catch (aiError) {
      console.error("Error with OpenAI transfer analysis:", aiError);

      // Enhanced fallback with basic analysis
      const fallbackAnalysis = `
WEAKNESS_ANALYSIS:
Player: Analysis requires OpenAI API access
Position: Multiple positions need review
Issues: Check players with low form, limited minutes, or poor value

TRANSFER_SUGGESTION:
OUT: Review lowest scoring players
IN: Consider players from trending list: ${
        ragData?.transferTrends.mostTransferredIn.slice(0, 3).join(", ") ||
        "Market leaders"
      }
Reason: Based on current transfer trends and form
Expected_Improvement: Monitor upcoming fixtures and form
Budget_Impact: Calculate based on current prices

Note: Enable OpenAI API for detailed analysis`;

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
