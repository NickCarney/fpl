"use client";

import { useState } from "react";
import { Element, Pick, Team, ElementType, Event } from "@/types/fpl";
import { getFixtures, getLiveGameweekData } from "@/lib/fpl-api";

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
  priority: number;
}

interface ParsedTransferAnalysis {
  weakness: {
    player: string;
    position: string;
    issues: string;
  };
  transfers: ParsedTransfer[];
  summary: string;
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
  const [parsedAnalysis, setParsedAnalysis] =
    useState<ParsedTransferAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [streamedContent, setStreamedContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [transferInfo, setTransferInfo] = useState<{
    bankBalance: number;
    freeTransfers: number;
    numberOfTransfers: number;
  } | null>(null);

  const getPlayer = (elementId: number) => {
    return elements.find((el) => el.id === elementId);
  };

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  const parseAnalysis = (
    analysisText: string
  ): ParsedTransferAnalysis | null => {
    try {
      const lines = analysisText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      const weaknessStart = lines.findIndex((line) =>
        line.includes("WEAKNESS_ANALYSIS")
      );
      const transferStart = lines.findIndex(
        (line) =>
          line.includes("TRANSFER_SUGGESTIONS") ||
          line.includes("TRANSFER_SUGGESTION_1")
      );
      const summaryStart = lines.findIndex((line) => line.includes("SUMMARY"));

      if (weaknessStart === -1 || transferStart === -1) return null;

      // Parse weakness analysis
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
      const issues =
        weaknessSection
          .find((line) => line.startsWith("Issues:"))
          ?.replace("Issues:", "")
          .trim() || "";

      // Parse multiple transfers
      const transferEndIndex =
        summaryStart !== -1 ? summaryStart : lines.length;
      const transferSection = lines.slice(transferStart + 1, transferEndIndex);

      const transfers: ParsedTransfer[] = [];
      let currentTransfer: Partial<ParsedTransfer> = {};
      let priority = 1;

      for (const line of transferSection) {
        if (line.startsWith("TRANSFER_") && line.includes(":")) {
          // Save previous transfer if complete
          if (currentTransfer.playerOut && currentTransfer.playerIn) {
            transfers.push(currentTransfer as ParsedTransfer);
            priority++;
          }
          currentTransfer = { priority };
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
          currentTransfer.budgetImpact = line
            .replace("Budget_Impact:", "")
            .trim();
        }
      }

      // Add the last transfer
      if (currentTransfer.playerOut && currentTransfer.playerIn) {
        transfers.push(currentTransfer as ParsedTransfer);
      }

      // Parse summary
      const summarySection =
        summaryStart !== -1 ? lines.slice(summaryStart + 1) : [];
      const summary = summarySection.join(" ").trim();

      return {
        weakness: { player, position, issues },
        transfers,
        summary:
          summary ||
          "Multiple transfer options identified based on current form and fixtures.",
      };
    } catch (error) {
      console.error("Error parsing analysis:", error);
      return null;
    }
  };

  const handleGenerateAnalysis = async () => {
    setLoading(true);
    setError(null);
    setStreamedContent("");
    setIsStreaming(true);
    setAnalysis("");
    setParsedAnalysis(null);

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

      // Number of transfers to suggest should be at most free transfers
      // But cap at 3 for normal gameweeks to keep suggestions focused
      const numberOfTransfers =
        teamPicks?.transfers?.limit === null
          ? 5 // More suggestions for wildcard/free hit
          : Math.min(freeTransfers, 3);

      // Store transfer info for display
      setTransferInfo({
        bankBalance,
        freeTransfers,
        numberOfTransfers,
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
          currentGameweek: currentEvent,
          gameweekFinished,
          fixtures,
          bankBalance,
          freeTransfers,
          numberOfTransfers,
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
            if (parsed && parsed.transfers.length > 0) {
              setParsedAnalysis(parsed);
            }
          }
        }

        setAnalysis(accumulatedContent);
        setIsFallback(false);

        // Final parse
        const finalParsed = parseAnalysis(accumulatedContent);
        setParsedAnalysis(finalParsed);
      } else {
        // Handle regular JSON response (fallback)
        const result = await response.json();
        setAnalysis(result.analysis);
        setIsFallback(result.fallback || false);
        setStreamedContent(result.analysis);

        const parsed = parseAnalysis(result.analysis);
        setParsedAnalysis(parsed);
      }
    } catch (err) {
      console.error("Failed to generate transfer suggestions:", err);
      setError("Failed to generate transfer suggestions. Please try again.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  // Helper function to get priority label
  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1:
        return { label: "Priority", color: "text-red-600 bg-red-100" };
      case 2:
        return { label: "Consider", color: "text-orange-600 bg-orange-100" };
      case 3:
        return { label: "Alternative", color: "text-blue-600 bg-blue-100" };
      default:
        return { label: "Option", color: "text-gray-600 bg-gray-100" };
    }
  };

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
            {/* {isStreaming && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded animate-pulse">
                Streaming...
              </span>
            )} */}
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
                <span className="font-semibold">Suggestions:</span>
                <span>{transferInfo.numberOfTransfers}</span>
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
                : parsedAnalysis
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
          {/* {loading && (
            <div className="flex items-center justify-center py-8">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mr-3"></div>
              <p className="text-gray-700">
                {isStreaming
                  ? "Streaming AI analysis with live market data..."
                  : "Analyzing multiple transfer opportunities with AI..."} 
              </p>
            </div>
          )} */}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {parsedAnalysis && (
            <div className="space-y-4">
              {/* Weakness Analysis */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  📊 AI Squad Analysis
                  {!isFallback && (
                    <span className="text-xs text-blue-800 bg-blue-100 px-2 py-1 rounded">
                      RAG Enhanced
                    </span>
                  )}
                  {/* {isStreaming && (
                    <div className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1"></div>
                  )} */}
                </h4>
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <h5 className="font-medium text-red-800 mb-2">
                    Key Areas for Improvement
                  </h5>
                  <p className="text-sm text-red-700 mb-1">
                    <strong>Focus Player:</strong>{" "}
                    {parsedAnalysis.weakness.player}
                  </p>
                  <p className="text-sm text-red-700 mb-1">
                    <strong>Position:</strong>{" "}
                    {parsedAnalysis.weakness.position}
                  </p>
                  <p className="text-xs text-red-600">
                    <strong>Analysis:</strong> {parsedAnalysis.weakness.issues}
                  </p>
                </div>
              </div>

              {/* Multiple Transfer Suggestions */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold mb-3">
                  Transfer Options ({parsedAnalysis.transfers.length})
                  {/* {isStreaming && parsedAnalysis.transfers.length < 3 && (
                    <span className="text-sm text-blue-600 ml-2">
                      (Loading more options...)
                    </span>
                  )} */}
                </h4>

                <div className="space-y-4">
                  {parsedAnalysis.transfers.map((transfer, index) => {
                    const priorityInfo = getPriorityLabel(transfer.priority);

                    return (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium">
                            Transfer Option {index + 1}
                          </h5>
                          <span
                            className={`text-xs px-2 py-1 rounded ${priorityInfo.color}`}
                          >
                            {priorityInfo.label}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {/* Transfer Out */}
                          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex items-center space-x-3">
                              <span className="text-red-600 font-bold">
                                OUT
                              </span>
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
                              <span className="text-green-600 font-bold">
                                IN
                              </span>
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
                {parsedAnalysis.summary && (
                  <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <h5 className="font-medium text-gray-800 mb-2">Summary</h5>
                    <p className="text-sm text-gray-700">
                      {parsedAnalysis.summary}
                      {/* {isStreaming && (
                        <span className="inline-block w-2 h-4 bg-gray-600 animate-pulse ml-1"></span>
                      )} */}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Attribution */}
              {!isFallback && (
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <span>Powered by AI</span>
                </div>
              )}
            </div>
          )}

          {/* Raw Analysis Display (for debugging/detailed view) */}
          {(analysis || streamedContent) && !parsedAnalysis && (
            <div className="rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold mb-3">Raw Analysis</h4>
              <pre className="text-sm  whitespace-pre-wrap">{analysis}</pre>
            </div>
          )}

          {!analysis && !streamedContent && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Get AI-powered transfer suggestions with multiple options ranked
                by priority
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
