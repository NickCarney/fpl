"use client";

import { useState } from "react";
import { Element, Pick, Team, ElementType, Event } from "@/types/fpl";
import { getFixtures, getLiveGameweekData } from "@/lib/fpl-api";
import { getTransferPlan, TransferPlanMode } from "@/lib/transfer-plan";

interface TransferSuggestionsProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
  totalPoints: number;
  teamPicks?: any;
}

interface ParsedTransfer {
  playerOut: string;
  playerIn: string;
  priceOut: string;
  priceIn: string;
  reason: string;
  expectedImprovement: string;
  budgetImpact: string;
  pointsCost: number;
  index: number;
}

interface ParsedPlanSection {
  planMode: TransferPlanMode;
  freeTransfers: number;
  pointHitTotal: number;
  weakness: {
    player: string;
    position: string;
    issues: string;
  };
  transfers: ParsedTransfer[];
  summary: string;
}

interface ParsedPlans {
  thisWeek: ParsedPlanSection | null;
  nextWeekSingle: ParsedPlanSection | null;
  nextWeekAll: ParsedPlanSection | null;
}

interface PlanKeys {
  planKey: string; // e.g. "TRANSFER_PLAN" or "NEXT_GW_PLAN"
  freeTransfersKey: string;
  pointHitKey: string;
  weaknessKey: string;
  suggestionPrefix: string; // e.g. "TRANSFER_SUGGESTION_" or "NEXT_GW_SUGGESTION_"
  summaryKey: string;
  // Any of these appearing bounds this section's summary/transfer list -
  // i.e. the start-of-header keys for every OTHER section in the response.
  otherSectionStartKeys: string[];
}

function parsePlanSection(
  lines: string[],
  keys: PlanKeys
): ParsedPlanSection | null {
  const weaknessStart = lines.findIndex((l) =>
    l.startsWith(keys.weaknessKey)
  );
  const transferStart = lines.findIndex((l) =>
    l.startsWith(keys.suggestionPrefix + "1")
  );
  if (weaknessStart === -1 || transferStart === -1) return null;

  const headerSection = lines.slice(0, weaknessStart);
  const planModeLine = headerSection.find((l) =>
    l.startsWith(keys.planKey + ":")
  );
  const freeTransfersLine = headerSection.find((l) =>
    l.startsWith(keys.freeTransfersKey + ":")
  );
  const pointHitLine = headerSection.find((l) =>
    l.startsWith(keys.pointHitKey + ":")
  );

  const planMode: TransferPlanMode =
    planModeLine
      ?.replace(keys.planKey + ":", "")
      .trim()
      .toUpperCase() === "ALTERNATIVES"
      ? "ALTERNATIVES"
      : "COORDINATED";
  const freeTransfers = parseInt(
    freeTransfersLine?.replace(keys.freeTransfersKey + ":", "").trim() || "0",
    10
  );
  const pointHitTotal =
    parseInt(
      (pointHitLine?.replace(keys.pointHitKey + ":", "").trim() || "0").replace(
        /[^-\d]/g,
        ""
      ),
      10
    ) || 0;

  // Parse weakness/target analysis
  const weaknessSection = lines.slice(weaknessStart + 1, transferStart);
  const player =
    weaknessSection
      .find((line) => line.startsWith("Player:"))
      ?.replace("Player:", "")
      .trim() || "";
  const position =
    weaknessSection
      .find((line) => line.startsWith("Position:"))
      ?.replace("Position:", "")
      .trim() || "";
  // Issues is meant to be one line, but tolerate the model wrapping it into
  // sub-bullets by folding every line up to the next section in.
  const issuesIndex = weaknessSection.findIndex((line) =>
    line.startsWith("Issues:")
  );
  const issues =
    issuesIndex !== -1
      ? weaknessSection
          .slice(issuesIndex)
          .map((line, i) => (i === 0 ? line.replace("Issues:", "") : line))
          .map((line) => line.replace(/^[-•]\s*/, ""))
          .join(" ")
          .trim()
      : "";

  // Bound this section's suggestion list and summary at the first line that
  // starts any OTHER known section (this section's own summary key, or any
  // other section's header keys).
  const boundaryKeys = [keys.summaryKey, ...keys.otherSectionStartKeys];
  const findBoundary = (from: number) => {
    for (let i = from; i < lines.length; i++) {
      if (boundaryKeys.some((k) => lines[i].startsWith(k))) return i;
    }
    return lines.length;
  };

  const transferEndIndex = findBoundary(transferStart + 1);
  const transferSection = lines.slice(transferStart + 1, transferEndIndex);

  // Keyed by the suggestion number in the header (e.g. "..._3:" -> 3) so
  // that if the model emits a duplicate/corrected block for the same
  // number (it occasionally self-corrects mid-stream), the later one
  // overwrites the earlier one instead of both showing up as options.
  const transfersByIndex = new Map<number, Partial<ParsedTransfer>>();
  let currentTransfer: Partial<ParsedTransfer> = {};
  let currentIndex = 0;
  let fallbackIndex = 1;

  for (const line of transferSection) {
    if (line.startsWith(keys.suggestionPrefix)) {
      if (currentTransfer.playerOut && currentTransfer.playerIn) {
        transfersByIndex.set(currentIndex, currentTransfer);
      }
      const numMatch = line.match(/_(\d+)\s*:/);
      currentIndex = numMatch ? parseInt(numMatch[1], 10) : fallbackIndex;
      fallbackIndex = currentIndex + 1;
      currentTransfer = { index: currentIndex, pointsCost: 0 };
    }

    if (line.startsWith("OUT:")) {
      const playerOut = line.replace("OUT:", "").trim();
      currentTransfer.playerOut = playerOut.split("(")[0].trim();
      const priceMatch = playerOut.match(/£([\d.]+)m/);
      currentTransfer.priceOut = priceMatch ? priceMatch[1] : "";
    } else if (line.startsWith("IN:")) {
      const playerIn = line.replace("IN:", "").trim();
      currentTransfer.playerIn = playerIn.split("(")[0].trim();
      const priceMatch = playerIn.match(/£([\d.]+)m/);
      currentTransfer.priceIn = priceMatch ? priceMatch[1] : "";
    } else if (line.startsWith("Reason:")) {
      currentTransfer.reason = line.replace("Reason:", "").trim();
    } else if (line.startsWith("Expected_Improvement:")) {
      currentTransfer.expectedImprovement = line
        .replace("Expected_Improvement:", "")
        .trim();
    } else if (line.startsWith("Budget_Impact:")) {
      currentTransfer.budgetImpact = line.replace("Budget_Impact:", "").trim();
    } else if (line.startsWith("Points_Cost:")) {
      const raw = line.replace("Points_Cost:", "").trim();
      currentTransfer.pointsCost =
        parseInt(raw.replace(/[^-\d]/g, ""), 10) || 0;
    }
  }

  if (currentTransfer.playerOut && currentTransfer.playerIn) {
    transfersByIndex.set(currentIndex, currentTransfer);
  }

  const transfers: ParsedTransfer[] = Array.from(transfersByIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, t]) => t as ParsedTransfer);

  // Summary section, bounded by any other section's header key
  const summaryStart = lines.findIndex((l) => l.startsWith(keys.summaryKey));
  const summaryEnd =
    summaryStart !== -1 ? findBoundary(summaryStart + 1) : -1;
  const summary =
    summaryStart !== -1
      ? lines.slice(summaryStart + 1, summaryEnd).join(" ").trim()
      : "";

  return {
    planMode,
    freeTransfers,
    pointHitTotal,
    weakness: { player, position, issues },
    transfers,
    summary:
      summary ||
      "Multiple transfer options identified based on current form and fixtures.",
  };
}

const NEXT_WEEK_SINGLE_SECTION_KEYS = [
  "NEXT_GW_SINGLE_PLAN",
  "NEXT_GW_SINGLE_FREE_TRANSFERS",
  "NEXT_GW_SINGLE_POINT_HIT_TOTAL",
  "NEXT_GW_SINGLE_WEAKNESS",
  "NEXT_GW_SINGLE_SUGGESTION_",
];
const NEXT_WEEK_ALL_SECTION_KEYS = [
  "NEXT_GW_ALL_PLAN",
  "NEXT_GW_ALL_FREE_TRANSFERS",
  "NEXT_GW_ALL_POINT_HIT_TOTAL",
  "NEXT_GW_ALL_WEAKNESS",
  "NEXT_GW_ALL_SUGGESTION_",
];

const THIS_WEEK_KEYS: PlanKeys = {
  planKey: "TRANSFER_PLAN",
  freeTransfersKey: "FREE_TRANSFERS",
  pointHitKey: "POINT_HIT_TOTAL",
  weaknessKey: "WEAKNESS_ANALYSIS",
  suggestionPrefix: "TRANSFER_SUGGESTION_",
  summaryKey: "SUMMARY",
  otherSectionStartKeys: [
    ...NEXT_WEEK_SINGLE_SECTION_KEYS,
    ...NEXT_WEEK_ALL_SECTION_KEYS,
  ],
};

const NEXT_WEEK_SINGLE_KEYS: PlanKeys = {
  planKey: "NEXT_GW_SINGLE_PLAN",
  freeTransfersKey: "NEXT_GW_SINGLE_FREE_TRANSFERS",
  pointHitKey: "NEXT_GW_SINGLE_POINT_HIT_TOTAL",
  weaknessKey: "NEXT_GW_SINGLE_WEAKNESS",
  suggestionPrefix: "NEXT_GW_SINGLE_SUGGESTION_",
  summaryKey: "NEXT_GW_SINGLE_SUMMARY",
  otherSectionStartKeys: NEXT_WEEK_ALL_SECTION_KEYS,
};

const NEXT_WEEK_ALL_KEYS: PlanKeys = {
  planKey: "NEXT_GW_ALL_PLAN",
  freeTransfersKey: "NEXT_GW_ALL_FREE_TRANSFERS",
  pointHitKey: "NEXT_GW_ALL_POINT_HIT_TOTAL",
  weaknessKey: "NEXT_GW_ALL_WEAKNESS",
  suggestionPrefix: "NEXT_GW_ALL_SUGGESTION_",
  summaryKey: "NEXT_GW_ALL_SUMMARY",
  otherSectionStartKeys: [],
};

function parseAnalysis(analysisText: string): ParsedPlans {
  try {
    const lines = analysisText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    return {
      thisWeek: parsePlanSection(lines, THIS_WEEK_KEYS),
      nextWeekSingle: parsePlanSection(lines, NEXT_WEEK_SINGLE_KEYS),
      nextWeekAll: parsePlanSection(lines, NEXT_WEEK_ALL_KEYS),
    };
  } catch (error) {
    console.error("Error parsing analysis:", error);
    return { thisWeek: null, nextWeekSingle: null, nextWeekAll: null };
  }
}

// The model's own budget arithmetic isn't fully reliable, so verify it here
// with the numbers we already parsed rather than trusting its claim.
const BUDGET_EPSILON = 0.05;
function getTransferDelta(transfer: ParsedTransfer): number | null {
  const priceIn = parseFloat(transfer.priceIn);
  const priceOut = parseFloat(transfer.priceOut);
  if (isNaN(priceIn) || isNaN(priceOut)) return null;
  return priceIn - priceOut;
}

function TransferPlanSectionView({
  title,
  subtitle,
  plan,
  bankBalance,
  isFallback,
}: {
  title: string;
  subtitle?: string;
  plan: ParsedPlanSection;
  bankBalance: number;
  isFallback: boolean;
}) {
  const combinedDelta = plan.transfers.reduce((sum, t) => {
    const delta = getTransferDelta(t);
    return delta === null ? sum : sum + delta;
  }, 0);
  const planOverBudget =
    plan.planMode === "COORDINATED" && combinedDelta > bankBalance + BUDGET_EPSILON;

  // The model's per-option budget math isn't fully reliable even with
  // explicit instructions, so for ALTERNATIVES (where each option stands
  // alone) we don't just flag a bad option - we drop it, since a suggestion
  // that isn't actually affordable isn't a real suggestion. A COORDINATED
  // plan can't be filtered piece by piece (it's one package), so that case
  // keeps the whole-plan warning banner above instead.
  const displayedTransfers =
    plan.planMode === "ALTERNATIVES"
      ? plan.transfers.filter((t) => {
          const delta = getTransferDelta(t);
          return delta === null || delta <= bankBalance + BUDGET_EPSILON;
        })
      : plan.transfers;
  const droppedCount = plan.transfers.length - displayedTransfers.length;

  const perOptionHits = displayedTransfers.map((t) => t.pointsCost);
  const worstSingleHit = perOptionHits.length > 0 ? Math.min(...perOptionHits) : 0;
  const displayedHit =
    plan.planMode === "ALTERNATIVES" && plan.pointHitTotal < worstSingleHit
      ? worstSingleHit
      : plan.pointHitTotal;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-base">{title}</h4>
        {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
      </div>

      {/* Plan mode banner */}
      <div
        className={`rounded-lg p-3 border text-sm font-medium ${
          displayedHit < 0
            ? "bg-red-50 border-red-200 text-red-800"
            : "bg-blue-50 border-blue-200 text-blue-800"
        }`}
      >
        {plan.planMode === "ALTERNATIVES"
          ? `Pick at most ONE of the options below (${displayedTransfers.length} independent alternatives).`
          : `Make all ${plan.transfers.length} transfers below together as one combined plan.`}
        {displayedHit < 0 && (
          <span className="ml-1">
            Taking a suggestion here costs {displayedHit} points beyond your
            free transfers.
          </span>
        )}
        {displayedHit === 0 && (
          <span className="ml-1">
            No point hit - fully covered by free transfers.
          </span>
        )}
      </div>

      {/* Weakness Analysis */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h5 className="font-semibold mb-3 flex items-center gap-2">
          AI Squad Analysis
          {!isFallback && (
            <span className="text-xs text-blue-800 bg-blue-100 px-2 py-1 rounded">
              RAG Enhanced
            </span>
          )}
        </h5>
        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
          <h6 className="font-medium text-red-800 mb-2">
            Key Areas for Improvement
          </h6>
          <p className="text-sm text-red-700 mb-1">
            <strong>Focus Player:</strong> {plan.weakness.player}
          </p>
          <p className="text-sm text-red-700 mb-1">
            <strong>Position:</strong> {plan.weakness.position}
          </p>
          <p className="text-xs text-red-600">
            <strong>Analysis:</strong> {plan.weakness.issues}
          </p>
        </div>
      </div>

      {/* Transfer Suggestions */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h5 className="font-semibold mb-3">
          {plan.planMode === "ALTERNATIVES"
            ? `Transfer Options (${displayedTransfers.length})`
            : `Transfer Plan (${plan.transfers.length} moves)`}
        </h5>

        {plan.planMode === "ALTERNATIVES" && droppedCount > 0 && (
          <div className="mb-3 text-xs font-medium text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
            {droppedCount} option{droppedCount > 1 ? "s" : ""} the AI
            suggested {droppedCount > 1 ? "were" : "was"} actually over
            budget and {droppedCount > 1 ? "have" : "has"} been left out -
            only genuinely affordable options are shown below.
          </div>
        )}

        {plan.planMode === "ALTERNATIVES" && displayedTransfers.length === 0 && (
          <p className="text-sm text-gray-700">
            The AI couldn&apos;t find an affordable option within your £
            {bankBalance.toFixed(1)}m bank this time - try regenerating, or
            your budget may be too tight for a clean upgrade right now.
          </p>
        )}

        {planOverBudget && (
          <div className="mb-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            This combined plan doesn&apos;t actually fit your budget: needs £
            {combinedDelta.toFixed(1)}m total but you only have £
            {bankBalance.toFixed(1)}m free - verify before making these
            moves.
          </div>
        )}

        <div className="space-y-4">
          {displayedTransfers.map((transfer, idx) => {
            return (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h6 className="font-medium">
                    {plan.planMode === "ALTERNATIVES"
                      ? `Option ${idx + 1}`
                      : `Transfer ${idx + 1} of ${displayedTransfers.length}`}
                  </h6>
                  <span
                    className={`text-xs px-2 py-1 rounded font-semibold ${
                      transfer.pointsCost < 0
                        ? "text-red-700 bg-red-100"
                        : "text-green-700 bg-green-100"
                    }`}
                  >
                    {transfer.pointsCost < 0
                      ? `${transfer.pointsCost} pts hit`
                      : "Free transfer"}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Transfer Out */}
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-3">
                      <span className="text-red-600 font-bold">OUT</span>
                      <div>
                        <p className="font-medium text-red-800">
                          {transfer.playerOut}
                        </p>
                        {transfer.priceOut && (
                          <p className="text-xs text-red-600">
                            £{transfer.priceOut}m
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transfer In */}
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <span className="text-green-600 font-bold">IN</span>
                      <div>
                        <p className="font-medium text-green-800">
                          {transfer.playerIn}
                        </p>
                        {transfer.priceIn && (
                          <p className="text-xs text-green-600">
                            £{transfer.priceIn}m
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transfer Details */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2">
                    {transfer.reason && (
                      <div>
                        <span className="text-sm font-medium text-blue-800">
                          Reasoning:
                        </span>
                        <span className="text-sm text-blue-700 ml-1">
                          {transfer.reason}
                        </span>
                      </div>
                    )}
                    {transfer.expectedImprovement && (
                      <div>
                        <span className="text-sm font-medium text-blue-800">
                          Expected Impact:
                        </span>
                        <span className="text-sm text-blue-700 ml-1">
                          {transfer.expectedImprovement}
                        </span>
                      </div>
                    )}
                    {transfer.budgetImpact && (
                      <div>
                        <span className="text-sm font-medium text-blue-800">
                          Budget:
                        </span>
                        <span className="text-sm text-blue-700 ml-1">
                          {transfer.budgetImpact.slice(0, 1) === "-" ? (
                            <>+</>
                          ) : (
                            <>-</>
                          )}
                          {parseFloat(transfer.budgetImpact.slice(2))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {plan.summary && (
          <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <h6 className="font-medium text-gray-800 mb-2">Summary</h6>
            <p className="text-sm text-gray-700">{plan.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransferSuggestions({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
  totalPoints,
  teamPicks,
}: TransferSuggestionsProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [analysis, setAnalysis] = useState<string>("");
  const [parsedPlans, setParsedPlans] = useState<ParsedPlans | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [streamedContent, setStreamedContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [transferInfo, setTransferInfo] = useState<{
    bankBalance: number;
    freeTransfers: number;
    suggestionCount: number;
    planMode: TransferPlanMode;
  } | null>(null);

  const handleGenerateAnalysis = async () => {
    setLoading(true);
    setError(null);
    setStreamedContent("");
    setIsStreaming(true);
    setAnalysis("");
    setParsedPlans(null);

    try {
      // Get current gameweek info
      const currentGameweek = events.find((event) => event.is_current);
      const gameweekFinished = currentGameweek?.finished || false;

      // Use Promise.allSettled for better error handling and faster execution
      const [fixturesResult, liveDataResult] = await Promise.allSettled([
        getFixtures(),
        getLiveGameweekData(currentEvent),
      ]);

      const fixtures =
        fixturesResult.status === "fulfilled" ? fixturesResult.value : [];
      const liveData =
        liveDataResult.status === "fulfilled" ? liveDataResult.value : null;

      // Prepare enhanced squad data (optimized)
      const squadData = picks.map((pick) => {
        const player = elements.find((el) => el.id === pick.element);
        const team = player
          ? teams.find((t) => t.id === player.team)
          : undefined;
        const position = player
          ? elementTypes.find((t) => t.id === player.element_type)
          : undefined;

        const livePlayerData = liveData?.elements?.find(
          (el: any) => el.id === pick.element
        );
        const currentGameweekPoints = livePlayerData?.stats?.total_points || 0;
        const hasPlayed = livePlayerData?.stats?.minutes > 0;

        return {
          ...player,
          web_name: player?.web_name,
          team_name: team?.short_name,
          position_name: position?.singular_name,
          is_captain: pick.is_captain,
          is_vice_captain: pick.is_vice_captain,
          multiplier: pick.multiplier,
          current_gameweek_points: currentGameweekPoints,
          has_played_current_gw: hasPlayed,
          will_play_current_gw: !hasPlayed && !gameweekFinished,
          is_in_my_squad: true,
          is_starting: pick.position <= 11,
        };
      });

      const teamData = {
        totalPoints,
        squadValue:
          squadData.reduce((sum, p) => sum + (p?.now_cost || 0), 0) / 10,
        currentGameweek: currentEvent,
      };

      const bankBalance = teamPicks?.entry_history?.bank
        ? teamPicks.entry_history.bank / 10
        : 1.0;

      // Calculate free transfers available
      // If transfers.limit is null, it means unlimited (chip active like wildcard/free hit)
      // Otherwise, free transfers = limit - made
      const freeTransfers = teamPicks?.transfers
        ? teamPicks.transfers.limit === null
          ? 15 // Unlimited transfers (wildcard/free hit) - suggest full squad refresh
          : Math.max(0, teamPicks.transfers.limit - teamPicks.transfers.made)
        : 1; // Default to 1 if no transfer data

      const plan = getTransferPlan(freeTransfers);

      // Store transfer info for display
      setTransferInfo({
        bankBalance,
        freeTransfers,
        suggestionCount: plan.suggestionCount,
        planMode: plan.mode,
      });

      // Make streaming request
      const response = await fetch("/api/transfer-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamData,
          squadData,
          elements,
          teams,
          currentGameweek: currentEvent,
          gameweekFinished,
          fixtures,
          bankBalance,
          freeTransfers,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate transfer suggestions");
      }

      // Check if it's a streaming response
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/plain")) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            setStreamedContent(accumulatedContent);

            // Try to parse analysis in real-time for better UX
            const parsed = parseAnalysis(accumulatedContent);
            if (parsed.thisWeek && parsed.thisWeek.transfers.length > 0) {
              setParsedPlans(parsed);
            }
          }
        }

        setAnalysis(accumulatedContent);
        setIsFallback(false);

        // Final parse
        setParsedPlans(parseAnalysis(accumulatedContent));
      } else {
        // Handle regular JSON response (fallback)
        const result = await response.json();
        setAnalysis(result.analysis);
        setIsFallback(result.fallback || false);
        setStreamedContent(result.analysis);

        setParsedPlans(parseAnalysis(result.analysis));
      }
    } catch (err) {
      console.error("Failed to generate transfer suggestions:", err);
      setError("Failed to generate transfer suggestions. Please try again.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const hasAnyPlan = !!(
    parsedPlans?.thisWeek ||
    parsedPlans?.nextWeekSingle ||
    parsedPlans?.nextWeekAll
  );

  return (
    <div className="bg-green-200 rounded-lg border border-green-200">
      {/* Header with collapse button */}
      <div
        className="flex flex-wrap justify-between items-center gap-2 p-4 cursor-pointer rounded-t-lg transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
            Transfer Suggestions
            {isFallback && (
              <span className="text-xs text-yellow-800 px-2 py-1 rounded">
                Basic Mode
              </span>
            )}
          </h3>
          {transferInfo && (
            <div className="flex items-center gap-2 text-xs md:text-sm flex-wrap">
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 rounded whitespace-nowrap">
                <span className="font-semibold">Bank:</span>
                <span>£{transferInfo.bankBalance.toFixed(1)}m</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded whitespace-nowrap">
                <span className="font-semibold">Free Transfers:</span>
                <span>
                  {transferInfo.freeTransfers === 15
                    ? "Unlimited"
                    : transferInfo.freeTransfers}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 rounded whitespace-nowrap">
                <span className="font-semibold">
                  {transferInfo.planMode === "ALTERNATIVES"
                    ? "Options:"
                    : "Plan:"}
                </span>
                <span>
                  {transferInfo.planMode === "ALTERNATIVES"
                    ? `${transferInfo.suggestionCount} to choose from`
                    : `${transferInfo.suggestionCount} together`}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateAnalysis();
              }}
              disabled={loading}
              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
            >
              {loading
                ? "Analyzing..."
                : hasAnyPlan
                ? "New Analysis"
                : "Analyze Squad"}
            </button>
          )}
          <button className="hover:bg-green-300 p-1 rounded">
            {isCollapsed ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="px-4 pb-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {hasAnyPlan && transferInfo && (
            <div className="space-y-6">
              {parsedPlans?.thisWeek && (
                <TransferPlanSectionView
                  title={`This Week (GW${currentEvent + 1})`}
                  subtitle="Using your current free transfer(s)"
                  plan={parsedPlans.thisWeek}
                  bankBalance={transferInfo.bankBalance}
                  isFallback={isFallback}
                />
              )}

              {parsedPlans?.nextWeekSingle && (
                <TransferPlanSectionView
                  title={`Next Week (GW${currentEvent + 2}) - Single Transfer`}
                  subtitle={`If you make just one of your ${
                    parsedPlans.nextWeekSingle.freeTransfers
                  } banked free transfer${
                    parsedPlans.nextWeekSingle.freeTransfers === 1 ? "" : "s"
                  } - not using this week's budget or transfer`}
                  plan={parsedPlans.nextWeekSingle}
                  bankBalance={transferInfo.bankBalance}
                  isFallback={isFallback}
                />
              )}

              {parsedPlans?.nextWeekAll && (
                <TransferPlanSectionView
                  title={`Next Week (GW${currentEvent + 2}) - Use All ${
                    parsedPlans.nextWeekAll.freeTransfers
                  } Transfers`}
                  subtitle={`If you use all ${parsedPlans.nextWeekAll.freeTransfers} banked free transfers together as one combined plan - not using this week's budget or transfer`}
                  plan={parsedPlans.nextWeekAll}
                  bankBalance={transferInfo.bankBalance}
                  isFallback={isFallback}
                />
              )}

              {/* AI Attribution */}
              {!isFallback && (
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <span>Powered by AI</span>
                </div>
              )}
            </div>
          )}

          {/* Raw Analysis Display (for debugging/detailed view) */}
          {(analysis || streamedContent) && !hasAnyPlan && (
            <div className="rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold mb-3">Raw Analysis</h4>
              <pre className="text-sm  whitespace-pre-wrap">{analysis}</pre>
            </div>
          )}

          {!analysis && !streamedContent && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Get AI-powered transfer suggestions that respect your bank
                balance and free transfers
              </p>
              <button
                onClick={handleGenerateAnalysis}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Analyze My Squad
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
