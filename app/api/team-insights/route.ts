import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ragCache } from "@/lib/rag-cache";
import { RAG_CONFIG } from "@/lib/rag-config";
import {
  getAvailability,
  formatAvailability,
} from "@/lib/player-availability";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};
const CHIP_TYPES = ["wildcard", "freehit", "bboost", "3xc"];
const FIRST_HALF_DEADLINE_GW = 19;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teamData,
      squadData,
      currentGameweek,
      gameweekFinished,
      fixtures,
      elements,
      teams,
      chipsUsed,
      activeChip,
    } = body;

    if (!teamData || !squadData) {
      return NextResponse.json(
        { error: "Missing required team or squad data" },
        { status: 400 }
      );
    }

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

ENHANCED ANALYSIS DATA (live, computed from current FPL data):

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

Transfer Market Trends (this gameweek):
- Most transferred IN: ${ragData.transferTrends.mostTransferredIn.join(", ")}
- Most transferred OUT: ${ragData.transferTrends.mostTransferredOut.join(", ")}
- Rising prices: ${ragData.transferTrends.risingPrices.join(", ")}
- Falling prices: ${ragData.transferTrends.fallingPrices.join(", ")}

Form Leaders: ${ragData.formLeaders
          .map((p: any) => `${p.player} (${p.form})`)
          .join(", ")}

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
You are an expert Fantasy Premier League analyst. Analyze this team and produce a ONE-TIME report. This is not a conversation - do not ask the user for more information, do not invite follow-up, and do not end with a question or offer.

IMPORTANT CONTEXT: ${gameweekStatusText}
${ragContext}
${fixtureOutlookContext}
${chipContext}

Team Overview:
- Total Points: ${teamData.totalPoints}
- Current Gameweek: ${currentGameweek}
- Squad Value: £${squadData
        .reduce((sum: number, p: any) => sum + p.now_cost / 10, 0)
        .toFixed(1)}m

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

Respond ONLY in this exact structured format, with nothing before or after it. Use "-" for every bullet. Do not add any section that isn't listed here, and do not add closing remarks after DIFFERENTIALS:

CAPTAIN_PICK: [player name from squad] | [1-2 sentence reasoning citing real stats: form, xG, or fixture difficulty]
VICE_CAPTAIN_PICK: [player name from squad] | [1-2 sentence reasoning]

STRENGTHS:
- [specific over-performer or strong area, with numbers, vs position benchmark]
- [specific strength, with numbers]

WEAKNESSES:
- [specific under-performer or weak area, with numbers, vs position benchmark]
- [specific weakness, with numbers]

TRANSFER_MARKET:
- [bullet referencing real transfer trends/price changes relevant to this squad]
- [bullet referencing injury/availability concerns relevant to this squad, or state none]

CHIP_STRATEGY:
- [one bullet per chip that is still unused, using the real Chip Status and Gameweek-by-Gameweek Squad Outlook data above to recommend a window - reference specific GW numbers and the fixture data provided. If a chip is already used, skip it]
- [if all chips are used, say so in one bullet instead]

DIFFERENTIALS:
- [low-owned player from squad or a real market trend that fits as a differential]

Rules:
- Every claim must be backed by a number from the data provided above (points, price, form, xG, difficulty rating, ownership, gameweek).
- Never invent fixtures, opponents, or players not present in the data.
- Keep each bullet to 1-2 sentences.
- If a squad player has an AVAILABILITY tag, do not captain or vice-captain them unless their chance of playing is 75% or higher, and say why in the reasoning.
- If a squad player has low form or low minutes AND has an AVAILABILITY tag (injured/doubtful), attribute it to that injury/fitness issue rather than calling it a pure performance decline - a player returning from injury needs time to rebuild form and minutes, that is not the same as an out-of-form player who was fully fit.
- Only flag a player as a genuine WEAKNESS for underperformance if they have no AVAILABILITY tag, or their tag shows they've been fully fit and playing (no recent injury/doubt).
- A player marked [BENCH] does not contribute to the score unless Bench Boost is active - low points/minutes on a cheap bench player is normal squad-building (a budget enabler), not a weakness. Do not name a [BENCH] player as a WEAKNESS just for having low stats; only mention a bench player if their price is unusually high for a bench role, or they pose a real rotation risk to a starting player in the same position.
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

      // Enhanced fallback insights with basic data, matching the structured format
      const fallbackInsights = `
CAPTAIN_PICK: ${squadData.find((p: any) => p.is_captain)?.web_name || "Review your squad"} | AI analysis unavailable - keep your highest-form premium player as captain.
VICE_CAPTAIN_PICK: ${squadData.find((p: any) => p.is_vice_captain)?.web_name || "Review your squad"} | AI analysis unavailable.

STRENGTHS:
- Squad total points this season: ${teamData.totalPoints}

WEAKNESSES:
- Monitor players with consistently low minutes for rotation risk

TRANSFER_MARKET:
- Consider fixture difficulty and form trends when making transfer decisions

CHIP_STRATEGY:
- Review your remaining chips and plan around your squad's upcoming fixture difficulty

DIFFERENTIALS:
- Check ownership percentages on the Player Stats tab for low-owned in-form players`;

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
