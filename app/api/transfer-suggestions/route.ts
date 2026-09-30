import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ragCache } from "@/lib/rag-cache";
import { RAG_CONFIG } from "@/lib/rag-config";
import { getGamesPlayed, getMinValidMinutes } from "@/lib/player-eligibility";
import {
  getAvailability,
  formatAvailability,
} from "@/lib/player-availability";
import { getTransferPlan, getNextWeekFreeTransfers } from "@/lib/transfer-plan";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const POINT_HIT_PER_TRANSFER = 4;

interface TransferRequest {
  teamData: any;
  squadData: any;
  elements: any[];
  teams?: any[];
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
      teams,
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

    // Decide the transfer plan shape from free transfers available: 0 or 1
    // free transfer -> independent alternatives (pick one); 2+ banked free
    // transfers -> one coordinated package using them all together; an
    // active wildcard/free hit -> a fuller coordinated refresh.
    const plan = getTransferPlan(freeTransfers);

    // Log transfer constraints for debugging
    console.log("Transfer Analysis Constraints:", {
      bankBalance,
      freeTransfers,
      plan,
      currentGameweek,
    });

    // Fetch RAG data (computed live from real FPL data) with caching
    let ragData = null;

    const cacheKey = `rag-data-${currentGameweek}`;
    const cachedData = ragCache.get<{ ragData: any }>(cacheKey);

    if (cachedData && RAG_CONFIG.features.enableCaching) {
      ragData = cachedData.ragData;
    } else {
      try {
        const ragResponse = await fetch(
          `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/rag-data`,
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
        //console.log("Could not fetch RAG data, proceeding with basic analysis");
      }
    }

    // Get current squad player IDs to exclude from suggestions
    const currentSquadIds = squadData.map((p: any) => p.id);

    // Exclude fringe players (backups, youth, one-off cameos) from transfer
    // targets - require at least 1/3 of the season's possible minutes so far.
    const gamesPlayed = getGamesPlayed(currentGameweek, gameweekFinished);
    const minValidMinutes = getMinValidMinutes(gamesPlayed);

    // Build comprehensive player database for AI reference
    const teamsById = new Map<number, any>(
      (teams || []).map((t: any) => [t.id, t])
    );

    // Fixture-per-team lookup for a given gameweek - real, already-published
    // fixture data, not a guess. GW${currentGameweek + 1} is the gameweek
    // this week's transfer (using the manager's current free transfer)
    // actually affects. GW${currentGameweek + 2} is the gameweek AFTER
    // that - relevant once the manager's NEXT free transfer is available,
    // which is what the "next week's plan" section below is for.
    const buildFixtureMap = (gw: number) => {
      const map = new Map<
        number,
        { opponent: string; isHome: boolean; difficulty: number }
      >();
      (fixtures || [])
        .filter((f: any) => f.event === gw)
        .forEach((f: any) => {
          map.set(f.team_h, {
            opponent: teamsById.get(f.team_a)?.short_name || "?",
            isHome: true,
            difficulty: f.team_h_difficulty,
          });
          map.set(f.team_a, {
            opponent: teamsById.get(f.team_h)?.short_name || "?",
            isHome: false,
            difficulty: f.team_a_difficulty,
          });
        });
      return map;
    };
    const fixtureLabelFromMap = (
      map: Map<number, { opponent: string; isHome: boolean; difficulty: number }>,
      teamId: number
    ) => {
      const fx = map.get(teamId);
      if (!fx) return "blank";
      return `${fx.isHome ? "vs" : "@"}${fx.opponent}(${fx.difficulty})`;
    };
    const nextGwFixtures = buildFixtureMap(currentGameweek + 1);
    const gwAfterNextFixtures = buildFixtureMap(currentGameweek + 2);
    const nextGwFixtureLabel = (teamId: number) =>
      fixtureLabelFromMap(nextGwFixtures, teamId);
    const gwAfterNextFixtureLabel = (teamId: number) =>
      fixtureLabelFromMap(gwAfterNextFixtures, teamId);

    const availablePlayers = elements
      .filter((player: any) => !currentSquadIds.includes(player.id))
      .filter((player: any) => (player.minutes || 0) >= minValidMinutes)
      .filter((player: any) => {
        // Exclude players who definitely can't help soon (suspended, ruled
        // out, unavailable) - but keep doubtful/injured players with some
        // chance of playing in the pool, tagged, so the AI can weigh the
        // risk itself instead of us guessing on its behalf.
        if (["s", "u", "n"].includes(player.status)) return false;
        if (player.chance_of_playing_next_round === 0) return false;
        return true;
      })
      .map((player: any) => ({
        ...player,
        team_name: teamsById.get(player.team)?.short_name || "",
      }))
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

    // Build context for transfer analysis (all computed from live FPL data)
    let ragContext = "";
    if (ragData) {
      ragContext = `
TRANSFER MARKET INTELLIGENCE (live, computed from current FPL data):

Position Benchmarks:
${Object.entries(ragData.positionAverages)
  .map(
    ([pos, data]: [string, any]) =>
      `${pos}: Avg ${data.averagePoints.toFixed(
        1
      )} pts, Top players: ${data.topPerformers.slice(0, 3).join(", ")}`
  )
  .join("\n")}

Current Market Trends (this gameweek):
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
  .map((p: any) => {
    const availability = getAvailability(
      p.status,
      p.chance_of_playing_next_round,
      p.news
    );
    return `${p.web_name} (${p.team_name}): £${(p.now_cost / 10).toFixed(
      1
    )}m, ${p.total_points}pts, Form: ${p.form}, ${p.minutes}min, ${
      p.transfers_in_event || 0
    } transfers in, Next GW: ${nextGwFixtureLabel(
      p.team
    )}, GW+2: ${gwAfterNextFixtureLabel(p.team)}${
      availability
        ? ` | AVAILABILITY: ${formatAvailability(availability)}`
        : ""
    }`;
  })
  .join("\n")}`;
  })
  .join("\n\n")}

IMPORTANT: Use EXACT player names and prices from this database when making suggestions.`;

    // A manager with exactly 1 free transfer may, rarely, be better served by
    // a 2-transfer package worth a single -4 hit than by 3 forced free
    // alternatives - but only the model can judge that from the data, and it
    // must never force a hit onto the default 3-alternatives path just
    // because a single-player upgrade doesn't fit the budget.
    const allowEscalation = plan.mode === "ALTERNATIVES" && freeTransfers === 1;

    // Budget/free-transfer rules, driven by the plan shape decided above.
    const planContext =
      plan.mode === "ALTERNATIVES"
        ? `
TRANSFER PLAN TYPE: ALTERNATIVES${allowEscalation ? " (default path - see ESCALATION exception below)" : ""}
The manager has ${
            freeTransfers <= 0 ? "0 free transfers" : "1 free transfer"
          } available right now. Generate exactly 3 INDEPENDENT single-player transfer options - these are alternatives to choose between, not a combined package. The manager will only execute ONE of the 3.
Do not make all 3 options about replacing the SAME OUT player - at most 2 of the 3 may share an OUT player (e.g. 2 alternative replacements for your weakest player, plus a 3rd option addressing a different weak player/position). This gives the manager a choice between fixing different problems, not just 3 flavors of the same fix.
${
  freeTransfers <= 0
    ? `There are 0 free transfers, so taking ANY of these options costs -${POINT_HIT_PER_TRANSFER} points. Only include an option if the expected point gain clearly outweighs the -${POINT_HIT_PER_TRANSFER} hit. If nothing in the data clearly justifies a hit, say so plainly in the summary instead of forcing weak suggestions - it is fine to recommend holding transfers.`
    : `This is the manager's 1 free transfer, so all 3 options here MUST be genuinely free (Points_Cost: 0) - each option's IN price must be affordable using ONLY the bank (£${bankBalance}m) plus that option's own OUT player's sale price. If your first-choice weak player has no affordable single-player upgrade, DO NOT force a -${POINT_HIT_PER_TRANSFER} hit onto it - look at other players/positions in the squad instead. With 15 players there is almost always a genuinely affordable upgrade somewhere; find it rather than giving up or padding the list with unaffordable options.
Bench players (marked [BENCH]) do not affect the live score unless Bench Boost is active - low stats on a cheap bench player is normal, deliberate squad-building, not a weakness. Prefer targeting weaknesses among starting XI players; only consider a bench player if their price is unusually high for a bench role or they pose a real rotation risk to a starter in the same position.

ESCALATION (rare exception to the default 3-free-alternatives path above): use this ONLY if you are confident that no single free transfer meaningfully improves the squad, but a SPECIFIC two-player combined move clearly would. In that case, output "TRANSFER_PLAN: COORDINATED" instead of ALTERNATIVES, with exactly 2 TRANSFER_SUGGESTION blocks forming ONE package (first transfer Points_Cost: 0, covered by the free transfer; second transfer Points_Cost: -${POINT_HIT_PER_TRANSFER}), and set POINT_HIT_TOTAL: -${POINT_HIT_PER_TRANSFER}. Explain plainly in the SUMMARY why the extra transfer and the -${POINT_HIT_PER_TRANSFER} hit are clearly worth it, not just convenient. Budget rule for this 2-transfer package: total IN price across both transfers <= bank (£${bankBalance}m) + total OUT sale price across both, combined (not per-swap). Do not mix the two paths - pick the default (3 free alternatives) or this escalation and follow it consistently for the whole response.`
}
${
  freeTransfers <= 0
    ? `Budget rule: for EACH option, the single IN player's price must be affordable using ONLY the bank (£${bankBalance}m) plus the sale price of that option's single OUT player. Evaluate every option independently - money is not shared between options since only one will be played.`
    : ""
}
`
        : `
TRANSFER PLAN TYPE: COORDINATED
The manager has ${
            plan.isUnlimitedChip
              ? "an active Wildcard/Free Hit (unlimited free transfers this gameweek)"
              : `${freeTransfers} banked free transfers`
          } and wants to use them together as ONE combined plan of exactly ${
            plan.suggestionCount
          } transfers. Do not suggest a point hit here - stay within the free transfers available, and do not propose fewer or more than ${
            plan.suggestionCount
          } transfers.
Budget rule: the TOTAL price of all ${
            plan.suggestionCount
          } IN players combined must be affordable using the combined pool of the bank (£${bankBalance}m) PLUS the total sale price of ALL ${
            plan.suggestionCount
          } OUT players together. Money freed by one OUT can fund a pricier IN elsewhere in the plan - balance the whole package together, not each swap in isolation. If one swap (e.g. selling an expensive player for a much cheaper one) frees up several million pounds, spend that on the OTHER swap(s) too: for that other swap, pick the MOST EXPENSIVE player from the database at that position whose price still fits the remaining combined budget, unless a cheaper name is clearly better on points/form - do not default to a cheap high-form pick when a premium, similarly-good option is affordable. Get as close to using the full combined budget as you can while still picking genuinely good, justified upgrades.
`;

    // Two independent plans for the gameweek AFTER the one above, for once
    // the manager's next free transfer(s) become available. Free transfers
    // accrue by 1 per gameweek (banked up to 5) if unused, so someone with
    // 1 free transfer now will have 2 next gameweek, not 1.
    const nextWeekTargetGw = currentGameweek + 2;
    const nextWeekFreeTransfers = getNextWeekFreeTransfers(freeTransfers);
    const includeAllTransfersPlan = nextWeekFreeTransfers >= 2;

    const nextWeekSinglePlanContext = `
NEXT WEEK'S PLAN - OPTION A: SINGLE TRANSFER (separate from the plan above - for GW${nextWeekTargetGw}):
This week's plan above already covers GW${
      currentGameweek + 1
    } using the manager's CURRENT free transfer(s). By GW${nextWeekTargetGw} the manager will have ${nextWeekFreeTransfers} free transfer${
      nextWeekFreeTransfers === 1 ? "" : "s"
    } banked (this week's ${freeTransfers} unused, plus the standard 1 that accrues each gameweek, capped at 5). This OPTION A assumes the manager makes JUST ONE transfer next week even though more may be banked - give exactly ONE recommended transfer (not multiple alternatives to choose from), the single best move for GW${nextWeekTargetGw}.
It MUST be genuinely free (Points_Cost: 0) - the IN player's price must be affordable using ONLY the bank (£${bankBalance}m, the SAME hard limit as this week's plan, not a looser future estimate) plus this OUT player's sale price. Ground it in the "GW+2" fixture tags shown on each player's line above and the price trend data provided above. Before writing it, compute IN price minus OUT price yourself and confirm it is <= £${bankBalance}m - if the first-choice weak player has no affordable upgrade, pick a different player/position instead.
Bench players (marked [BENCH]) do not affect the live score unless Bench Boost is active - do not target them just for having low stats.
`;

    const nextWeekAllPlanContext = includeAllTransfersPlan
      ? `
NEXT WEEK'S PLAN - OPTION B: USE ALL ${nextWeekFreeTransfers} FREE TRANSFERS (for the SAME gameweek, GW${nextWeekTargetGw}):
This is a SEPARATE, alternative plan for GW${nextWeekTargetGw} - instead of the single transfer in OPTION A above, this uses all ${nextWeekFreeTransfers} free transfers the manager will have banked by then, together as ONE coordinated package of exactly ${nextWeekFreeTransfers} transfers. Target ${nextWeekFreeTransfers} DIFFERENT weak spots, preferring DIFFERENT positions (e.g. one defender AND one midfielder) unless the squad genuinely has ${nextWeekFreeTransfers} distinct weaknesses in the same position.
Budget rule: this is a COMBINED budget across all ${nextWeekFreeTransfers} transfers together - the TOTAL price of all IN players must be affordable using the bank (£${bankBalance}m) PLUS the TOTAL sale price of all OUT players combined. Money freed by one OUT can fund a pricier IN elsewhere in the package - for example, with a £${bankBalance}m bank, one swap could cost up to £${(
          bankBalance + 0.5
        ).toFixed(
          1
        )}m more than its OUT player if a second swap frees up an extra £0.5m less than its OUT player, netting exactly £${bankBalance}m used in total. Compute the SUM of (IN - OUT) across all ${nextWeekFreeTransfers} transfers yourself and confirm it is <= £${bankBalance}m before finalizing. Do not suggest a point hit here - this uses exactly ${nextWeekFreeTransfers} transfers, all free.
If one swap (e.g. selling an expensive player for a much cheaper one) frees up several million pounds, spend that on the other swap(s): for that other swap, pick the MOST EXPENSIVE player from the database at that position whose price still fits the remaining combined budget, unless a cheaper name is clearly better on points/form - do not default to a cheap high-form pick when a premium, similarly-good option is affordable. Get as close to using the full combined budget as you can while still picking genuinely good, justified upgrades.
Bench players (marked [BENCH]) do not affect the live score unless Bench Boost is active - do not target them just for having low stats.
`
      : "";

    const nextWeekSingleFormatBlock = `
NEXT_GW_SINGLE_PLAN: ALTERNATIVES
NEXT_GW_SINGLE_FREE_TRANSFERS: ${nextWeekFreeTransfers}
NEXT_GW_SINGLE_POINT_HIT_TOTAL: 0

NEXT_GW_SINGLE_WEAKNESS:
Player: [target player name from MY SQUAD for GW${nextWeekTargetGw}]
Position: [position]
Issues: [2-3 specific issues with this player, ONE line, no sub-bullets]

NEXT_GW_SINGLE_SUGGESTION_1:
OUT: [player name] (£[exact price from database]m)
IN: [replacement name from AVAILABLE PLAYERS DATABASE] (£[exact price from database]m)
Reason: [why this move makes sense for GW${nextWeekTargetGw} specifically, citing the "GW+2" fixture tag or price trend]
Expected_Improvement: [specific improvement expected]
Budget_Impact: [the exact IN price minus OUT price, as a number, e.g. "-0.3" or "+0.6" - must be <= £${bankBalance}m]
Points_Cost: 0

NEXT_GW_SINGLE_SUMMARY:
[Confirm this is the single best move for GW${nextWeekTargetGw} if the manager makes just one transfer, and that it fits the £${bankBalance}m budget.]
`;

    const nextWeekAllFormatBlock = includeAllTransfersPlan
      ? `
NEXT_GW_ALL_PLAN: COORDINATED
NEXT_GW_ALL_FREE_TRANSFERS: ${nextWeekFreeTransfers}
NEXT_GW_ALL_POINT_HIT_TOTAL: 0

NEXT_GW_ALL_WEAKNESS:
Player: [primary target player name from MY SQUAD for GW${nextWeekTargetGw}]
Position: [position]
Issues: [2-3 specific issues with this player, ONE line, no sub-bullets]

NEXT_GW_ALL_SUGGESTION_1:
OUT: [player name] (£[exact price from database]m)
IN: [replacement name from AVAILABLE PLAYERS DATABASE] (£[exact price from database]m)
Reason: [why this move makes sense for GW${nextWeekTargetGw} specifically, citing the "GW+2" fixture tag or price trend]
Expected_Improvement: [specific improvement expected]
Budget_Impact: [the exact IN price minus OUT price for THIS swap alone, as a number]
Points_Cost: 0

(repeat NEXT_GW_ALL_SUGGESTION_2 through NEXT_GW_ALL_SUGGESTION_${nextWeekFreeTransfers} - exactly ${nextWeekFreeTransfers} total, each targeting a different position where possible, same fields each time)

NEXT_GW_ALL_SUMMARY:
[Confirm this uses all ${nextWeekFreeTransfers} transfers together as one combined plan for GW${nextWeekTargetGw}, targeting different positions. State the combined math explicitly: total IN price minus total OUT price, and confirm it is <= £${bankBalance}m.]
`
      : "";

    const prompt = `You are an expert FPL transfer analyst. Analyze this squad and build a transfer plan.

CONSTRAINTS:
- Bank: £${bankBalance}m
- Free Transfers: ${freeTransfers}
- Current Gameweek: ${currentGameweek} ${
      gameweekFinished ? "(finished)" : "(ongoing)"
    }
${planContext}
${nextWeekSinglePlanContext}
${nextWeekAllPlanContext}
${ragContext}
${playerDatabaseContext}

MY CURRENT SQUAD (15 players I own):
${squadData
  .map((p: any) => {
    const availability = getAvailability(
      p.status,
      p.chance_of_playing_next_round,
      p.news
    );
    return `${p.web_name} (${p.team_name}) - ${p.position_name}: ${
      p.total_points
    }pts, Form: ${p.form}, £${(p.now_cost / 10).toFixed(1)}m, ${
      p.minutes
    } mins${p.is_captain ? " [C]" : ""}${p.is_vice_captain ? " [VC]" : ""}${
      p.is_starting === false ? " [BENCH]" : ""
    }${
      gameweekFinished
        ? ``
        : p.has_played_current_gw
        ? ` | GW${currentGameweek}: ${p.current_gameweek_points}pts`
        : ` | GW${currentGameweek}: Not played yet${
            p.will_play_current_gw ? " (will play)" : " (may not play)"
          }`
    }${
      availability
        ? ` | AVAILABILITY: ${formatAvailability(availability)}`
        : ""
    } | Next GW: ${nextGwFixtureLabel(
      p.team
    )}, GW+2: ${gwAfterNextFixtureLabel(p.team)}`;
  })
  .join("\n")}

IMPORTANT:
- These 15 players are my CURRENT SQUAD - do NOT suggest transferring IN any of these players as I already own them
- Use EXACT player names and prices from the AVAILABLE PLAYERS DATABASE above
- If gameweek is ongoing, consider that players who haven't played yet may still get points
- Don't criticize players who haven't played yet for having 0 points in current gameweek
- Don't transfer out players who have played well AND are cheap - these players are not weak.
- Take player's price into consideration. A 14mil player averaging 10 is no better (maybe worse) than a 7mil player averaging 5
- If a squad player has an AVAILABILITY tag, treat low recent form/minutes as a symptom of that injury/fitness issue, not a pure performance decline - do not name them as the "weakest player" for underperformance alone; if you do suggest transferring them out, say explicitly that it's because of the injury/availability risk, not poor ability
- If a replacement ("IN") player has an AVAILABILITY tag, only suggest them if their chance of playing is 75% or higher, and mention the availability status in the Reason field. Never suggest a player who is suspended, ruled out, or has no chance-of-playing data alongside injury news.
- Follow the TRANSFER PLAN TYPE and budget rule above exactly - never propose a transfer (or package) that costs more than the bank plus sale value it's paired with.
- Budget and Points_Cost are TWO SEPARATE, UNRELATED constraints. Budget (bank + sale value) is a HARD LIMIT with no workaround - if an IN player is unaffordable, do not include that option at all, full stop; there is no amount of points you can "pay" to unlock more budget. Points_Cost is ONLY about exceeding your free transfer count (each transfer beyond your free transfers costs -${POINT_HIT_PER_TRANSFER}, regardless of price). Never set Points_Cost to signal an unaffordable transfer - check affordability first, and only include options you have already confirmed fit the budget rule.
- Before writing each option, compute IN price minus OUT sale price yourself and confirm it is <= the budget available for that option (per the TRANSFER PLAN TYPE rule above) - discard and replace any option that fails this check. This same rule applies to BOTH next-week plans below too - their budget limit is the SAME bank amount, not a looser future guess.
- Fitting the budget is a floor, not the goal - spend it well. Do this as a mechanical last step for every transfer you write, BEFORE finalizing it: (1) compute the full amount available for that swap (bank + that OUT player's sale price, or its share of the combined package budget); (2) look back at the AVAILABLE PLAYERS DATABASE for that position and find the MOST EXPENSIVE player whose price is still <= that available amount; (3) if that pricier player's points/form/output are not clearly worse than your current pick, switch to the pricier player instead. Do not stop at the first affordable name that has good form - a cheap in-form player is often a worse pick than a premium player who costs nearly the full budget, because price roughly tracks ceiling. Concretely: if you are selling an £11m+ player, your replacement should usually also be a genuine premium (ideally within £2-3m of the OUT price, not a £5-6m budget player) unless that premium option is actually injured, benched, or clearly out of form itself. Leaving more than ~£2m of the available amount unspent on any single swap is a signal you under-shopped - go back and pick someone pricier. This applies to every plan below, including the coordinated multi-transfer ones, where "available amount" means that swap's fair share of the combined leftover budget.
- This is a ONE-TIME report, not a conversation. Never ask the manager a question, never invite follow-up, and never say something like "tell me which players you'd prefer and I'll generate a valid plan." If your first choice of transfers doesn't fit the budget, silently pick different, cheaper players yourself until you have a fully valid, budget-compliant plan to present - always finish with a complete, concrete, compliant plan in every section below, never a request for more input.

TASK: Identify the weakest player(s) in MY SQUAD and suggest the BEST replacement(s), following the TRANSFER PLAN TYPE above.

Consider:
1. Player performance vs position averages
2. Recent form and trend
3. Transfer market activity
4. Expected goals data (if available)
5. Upcoming fixtures
6. Price trends
7. Current gameweek performance (if gameweek finished) or playing status (if ongoing)

Provide your response in this EXACT format:

TRANSFER_PLAN: ${
      allowEscalation
        ? "[ALTERNATIVES for the default 3-free-options path, or COORDINATED only if you used the rare ESCALATION path described above]"
        : plan.mode
    }
FREE_TRANSFERS: ${freeTransfers}
POINT_HIT_TOTAL: [0 if every option/transfer below is free. Otherwise, this is the cost of what the manager will ACTUALLY execute - for an ALTERNATIVES plan that is just ONE option (only one will ever be played), so this is the single option's hit, e.g. -${POINT_HIT_PER_TRANSFER}, NEVER the sum across multiple alternatives (do not write -${
      POINT_HIT_PER_TRANSFER * 2
    } or -${
      POINT_HIT_PER_TRANSFER * 3
    } just because several options each individually cost -${POINT_HIT_PER_TRANSFER}). For a COORDINATED plan, it's the sum across the transfers actually being made together.]

WEAKNESS_ANALYSIS:
Player: [weakest player name from MY SQUAD]
Position: [position]
Issues: [2-3 specific issues with this player, all on this ONE line - do not use sub-bullets or line breaks]

REMINDER before writing each TRANSFER_SUGGESTION below: the hard bank limit is £${bankBalance}m. For each option, take the IN player's exact database price, subtract the OUT player's exact database price, and confirm the result is <= the budget available for that option per the TRANSFER PLAN TYPE rule above. If it is not, pick a cheaper IN player instead - do not write the option anyway with a vague or conditional budget justification.

TRANSFER_SUGGESTION_1:
OUT: [player name] (£[exact price from database]m)
IN: [replacement name from AVAILABLE PLAYERS DATABASE] (£[exact price from database]m)
Reason: [why this is a good transfer]
Expected_Improvement: [specific improvement expected]
Budget_Impact: [the exact IN price minus OUT price, as a number, e.g. "-0.3" or "+0.6" - must be within budget]
Points_Cost: [0 if free, or -${POINT_HIT_PER_TRANSFER} if this specific transfer requires a hit]

(repeat TRANSFER_SUGGESTION_2, TRANSFER_SUGGESTION_3, etc. for ${
      allowEscalation
        ? "exactly 3 total suggestions on the default path, or exactly 2 total suggestions if you used the ESCALATION path"
        : `exactly ${plan.suggestionCount} total suggestions`
    }, same fields each time)

SUMMARY:
[${
      plan.mode === "ALTERNATIVES"
        ? "State clearly that these are alternative options and the manager should pick at most one. Confirm each option's individual budget usage."
        : "State clearly that all transfers together form one combined plan to play together this gameweek. Confirm the combined budget usage across all of them."
    } Mention the total point hit (if any) and why it is or isn't worth it.]

${nextWeekSingleFormatBlock}
${nextWeekAllFormatBlock}
Keep it concise and data-driven. Reference specific stats and trends when available.`;

    try {
      // Create streaming response
      const stream = await openai.chat.completions.create({
        model: RAG_CONFIG.openAI.model,
        messages: [
          {
            role: "system",
            content:
              "You are an elite FPL transfer specialist with access to live market data, expected goals statistics, form trends, and injury/availability status. Always use exact player names and prices from the provided database, and strictly respect the bank balance and free transfer count given - never recommend overspending or an unjustified point hit.",
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
TRANSFER_PLAN: ${plan.mode}
FREE_TRANSFERS: ${freeTransfers}
POINT_HIT_TOTAL: 0

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
Points_Cost: 0

SUMMARY:
Enable OpenAI API for detailed analysis with exact player names and current prices.

NEXT_GW_SINGLE_PLAN: ALTERNATIVES
NEXT_GW_SINGLE_FREE_TRANSFERS: ${nextWeekFreeTransfers}
NEXT_GW_SINGLE_POINT_HIT_TOTAL: 0

NEXT_GW_SINGLE_WEAKNESS:
Player: Analysis requires OpenAI API access
Position: Multiple positions need review
Issues: Check players with low form, limited minutes, or poor value

NEXT_GW_SINGLE_SUGGESTION_1:
OUT: Review lowest scoring players
IN: Consider players from trending list: ${
        ragData?.transferTrends.mostTransferredIn.slice(0, 3).join(", ") ||
        "Market leaders"
      }
Reason: Based on current transfer trends and form
Expected_Improvement: Monitor upcoming fixtures and form
Budget_Impact: Calculate based on current prices
Points_Cost: 0

NEXT_GW_SINGLE_SUMMARY:
Enable OpenAI API for detailed analysis with exact player names and current prices.${
        includeAllTransfersPlan
          ? `

NEXT_GW_ALL_PLAN: COORDINATED
NEXT_GW_ALL_FREE_TRANSFERS: ${nextWeekFreeTransfers}
NEXT_GW_ALL_POINT_HIT_TOTAL: 0

NEXT_GW_ALL_WEAKNESS:
Player: Analysis requires OpenAI API access
Position: Multiple positions need review
Issues: Check players with low form, limited minutes, or poor value

NEXT_GW_ALL_SUGGESTION_1:
OUT: Review lowest scoring players
IN: Consider players from trending list: ${
              ragData?.transferTrends.mostTransferredIn
                .slice(0, 3)
                .join(", ") || "Market leaders"
            }
Reason: Based on current transfer trends and form
Expected_Improvement: Monitor upcoming fixtures and form
Budget_Impact: Calculate based on current prices
Points_Cost: 0

NEXT_GW_ALL_SUMMARY:
Enable OpenAI API for detailed analysis with exact player names and current prices.`
          : ""
      }`;

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
