import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { RAG_CONFIG } from "@/lib/rag-config";

interface PlayerTransferRequest {
  playerId: number;
  playerName: string;
  playerPosition: string;
  playerPrice: number;
  playerPoints: number;
  playerForm: string;
  currentSquadIds?: number[];
}

export async function POST(request: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const body: PlayerTransferRequest = await request.json();
    const {
      playerId,
      playerName,
      playerPosition,
      playerPrice,
      playerPoints,
      playerForm,
      currentSquadIds = [],
    } = body;

    if (!playerId || !playerName || !playerPosition) {
      return NextResponse.json(
        { error: "Missing required player data for transfer analysis" },
        { status: 400 }
      );
    }

    console.log("Player Transfer Analysis:", {
      playerId,
      playerName,
      playerPosition,
      playerPrice,
      currentSquadSize: currentSquadIds.length,
    });

    // Fetch all available players from FPL API
    let allPlayers: any[] = [];
    let teams: any[] = [];
    try {
      const bootstrapResponse = await fetch(
        "https://fantasy.premierleague.com/api/bootstrap-static/"
      );
      if (bootstrapResponse.ok) {
        const bootstrapData = await bootstrapResponse.json();
        allPlayers = bootstrapData.elements || [];
        teams = bootstrapData.teams || [];
      }
    } catch (error) {
      console.error("Failed to fetch player data:", error);
      return NextResponse.json(
        { error: "Failed to fetch player data" },
        { status: 500 }
      );
    }

    // Filter players by same position, exclude the current player AND all players in current squad
    const samePositionPlayers = allPlayers
      .filter(
        (p: any) =>
          p.element_type ===
            allPlayers.find((pl: any) => pl.id === playerId)?.element_type &&
          p.id !== playerId &&
          !currentSquadIds.includes(p.id) // Exclude all players already in squad
      )
      .sort((a: any, b: any) => b.total_points - a.total_points)
      .slice(0, 50); // Top 50 alternatives

    // Get team names for better context
    const getTeamName = (teamId: number) => {
      const team = teams.find((t: any) => t.id === teamId);
      return team?.name || "Unknown";
    };

    // Build player alternatives context
    const alternativesContext = `
AVAILABLE ALTERNATIVES FOR ${playerName} (${playerPosition}):

Top ${
      samePositionPlayers.length
    } ${playerPosition} alternatives (EXCLUDING all players already in the user's squad):
${samePositionPlayers
  .map(
    (p: any) =>
      `${p.web_name} (${getTeamName(p.team)}): £${(p.now_cost / 10).toFixed(
        1
      )}m, ${p.total_points}pts, Form: ${p.form}, PPG: ${
        p.points_per_game
      }, Selected: ${p.selected_by_percent}%, Minutes: ${p.minutes}`
  )
  .join("\n")}

IMPORTANT:
- Use EXACT player names and prices from this list when making suggestions
- All players in this list are NOT currently in the user's squad
- Do NOT suggest any player already owned by the user`;

    const prompt = `You are an expert FPL transfer analyst. A user wants to transfer OUT ${playerName} and needs specific replacement suggestions.

CURRENT PLAYER TO REPLACE:
Name: ${playerName}
Position: ${playerPosition}
Price: £${playerPrice.toFixed(1)}m
Total Points: ${playerPoints}
Form: ${playerForm}

${alternativesContext}

TASK: Identify 3-5 BEST replacements for ${playerName} from the available alternatives list above.

Consider:
1. Similar or better price point (within ±£2m ideally)
2. Better form and points
3. Expected goals and assists
4. Upcoming fixtures
5. Minutes played and starts
6. Value for money (points per million)
7. Transfer market activity (selected by %)

Provide your response in this EXACT format for each suggestion:

REPLACEMENT_1:
Player: [exact name from list]
Team: [team name]
Price: £[price]m (Price difference: [+/- amount])
Stats: [total points]pts, Form: [form], PPG: [ppg]
Reason: [2-3 sentences explaining why this is a good replacement]
Value_Analysis: [How they compare to ${playerName} in terms of value]

REPLACEMENT_2:
Player: [exact name from list]
Team: [team name]
Price: £[price]m (Price difference: [+/- amount])
Stats: [total points]pts, Form: [form], PPG: [ppg]
Reason: [2-3 sentences explaining why this is a good replacement]
Value_Analysis: [How they compare to ${playerName} in terms of value]

REPLACEMENT_3:
Player: [exact name from list]
Team: [team name]
Price: £[price]m (Price difference: [+/- amount])
Stats: [total points]pts, Form: [form], PPG: [ppg]
Reason: [2-3 sentences explaining why this is a good replacement]
Value_Analysis: [How they compare to ${playerName} in terms of value]

SUMMARY:
[Brief summary of the best transfer strategy for replacing ${playerName}]

Keep it concise and data-driven. Reference specific stats and trends.`;

    try {
      // Create streaming response
      const stream = await openai.chat.completions.create({
        model: RAG_CONFIG.openAI.model,
        messages: [
          {
            role: "system",
            content:
              "You are an elite FPL transfer specialist with deep knowledge of player performance, form, and value. Always use exact player names and prices from the provided database.",
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
          Connection: "keep-alive",
        },
      });
    } catch (aiError) {
      console.error("Error with OpenAI transfer analysis:", aiError);

      // Fallback analysis
      const fallbackAnalysis = `
REPLACEMENT_1:
Player: Analysis requires OpenAI API access
Team: N/A
Price: Check available alternatives in the same position
Stats: Review form and points data
Reason: Enable OpenAI API for detailed player-specific transfer suggestions
Value_Analysis: Compare stats manually using the player list

SUMMARY:
Enable OpenAI API for AI-powered transfer suggestions tailored to replacing ${playerName}.`;

      return NextResponse.json({
        analysis: fallbackAnalysis.trim(),
        fallback: true,
      });
    }
  } catch (error) {
    console.error("Error generating player transfer suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate transfer suggestions" },
      { status: 500 }
    );
  }
}
