"use client";

import { useState } from "react";
import { Element, Pick, Team, ElementType, Event } from "@/types/fpl";
import { generateTransferSuggestions, getFixtures } from "@/lib/fpl-api";

interface TransferSuggestionsProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  events: Event[];
  totalPoints: number;
}

interface ParsedTransferAnalysis {
  weakness: {
    player: string;
    position: string;
    issues: string;
  };
  transfer: {
    playerOut: string;
    playerIn: string;
    priceOut: string;
    priceIn: string;
    reason: string;
    expectedImprovement: string;
    budgetImpact: string;
  };
}

export default function TransferSuggestions({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  events,
  totalPoints,
}: TransferSuggestionsProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [analysis, setAnalysis] = useState<string>("");
  const [parsedAnalysis, setParsedAnalysis] =
    useState<ParsedTransferAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

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
      const transferStart = lines.findIndex((line) =>
        line.includes("TRANSFER_SUGGESTION")
      );

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

      // Parse transfer suggestion
      const transferSection = lines.slice(transferStart + 1);
      const playerOut =
        transferSection
          .find((line) => line.startsWith("OUT:"))
          ?.replace("OUT:", "")
          .trim() || "";
      const playerIn =
        transferSection
          .find((line) => line.startsWith("IN:"))
          ?.replace("IN:", "")
          .trim() || "";
      const reason =
        transferSection
          .find((line) => line.startsWith("Reason:"))
          ?.replace("Reason:", "")
          .trim() || "";
      const expectedImprovement =
        transferSection
          .find((line) => line.startsWith("Expected_Improvement:"))
          ?.replace("Expected_Improvement:", "")
          .trim() || "";
      const budgetImpact =
        transferSection
          .find((line) => line.startsWith("Budget_Impact:"))
          ?.replace("Budget_Impact:", "")
          .trim() || "";

      // Extract prices from player strings
      const priceOutMatch = playerOut.match(/£([\d.]+)m/);
      const priceInMatch = playerIn.match(/£([\d.]+)m/);

      return {
        weakness: { player, position, issues },
        transfer: {
          playerOut: playerOut.split("(")[0].trim(),
          playerIn: playerIn.split("(")[0].trim(),
          priceOut: priceOutMatch ? priceOutMatch[1] : "",
          priceIn: priceInMatch ? priceInMatch[1] : "",
          reason,
          expectedImprovement,
          budgetImpact,
        },
      };
    } catch (error) {
      console.error("Error parsing analysis:", error);
      return null;
    }
  };

  const handleGenerateAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current gameweek info
      const currentGameweek = events.find((event) => event.is_current);
      const gameweekFinished = currentGameweek?.finished || false;

      // Fetch fixtures data
      const fixtures = await getFixtures();

      // Prepare squad data
      const squadData = picks.map((pick) => {
        const player = getPlayer(pick.element);
        const team = getTeam(player?.team || 0);
        const position = getPosition(player?.element_type || 0);

        return {
          ...player,
          web_name: player?.web_name,
          team_name: team?.short_name,
          position_name: position?.singular_name,
          is_captain: pick.is_captain,
          is_vice_captain: pick.is_vice_captain,
          multiplier: pick.multiplier,
        };
      });

      const teamData = {
        totalPoints,
        squadValue:
          squadData.reduce((sum, p) => sum + (p?.now_cost || 0), 0) / 10,
        currentGameweek: currentEvent,
      };

      const result = await generateTransferSuggestions(
        teamData,
        squadData,
        elements,
        currentEvent,
        gameweekFinished,
        fixtures,
        1.0, // Default bank balance - could be passed as prop
        1 // Default free transfers - could be passed as prop
      );

      setAnalysis(result.analysis);
      setIsFallback(result.fallback || false);

      // Parse the structured analysis
      const parsed = parseAnalysis(result.analysis);
      setParsedAnalysis(parsed);
    } catch (err) {
      console.error("Failed to generate transfer suggestions:", err);
      setError("Failed to generate transfer suggestions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-green-200 rounded-lg border border-green-200">
      {/* Header with collapse button */}
      <div
        className="flex justify-between items-center p-4 cursor-pointer rounded-t-lg transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-xl font-bold flex items-center gap-2">
          Transfer Suggestions
          {isFallback && (
            <span className="text-xs text-yellow-800 px-2 py-1 rounded">
              Basic Mode
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateAnalysis();
              }}
              disabled={loading}
              className="px-3 py-1 text-white rounded-md hover:green-700 transition-colors text-sm"
            >
              {loading
                ? "Analyzing..."
                : parsedAnalysis
                ? "New Analysis"
                : "Analyze Squad"}
            </button>
          )}
          <button className=" hover:">{isCollapsed ? "▼" : "▲"}</button>
        </div>
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="px-4 pb-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mr-3"></div>
              <p className="">Analyzing transfer opportunities with AI...</p>
            </div>
          )}

          {error && (
            <div className=" border border-red-200 rounded-md p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {parsedAnalysis && !loading && (
            <div className="space-y-4">
              {/* Weakness Analysis */}
              <div className=" rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  📊 AI Squad Analysis
                  {!isFallback && (
                    <span className="text-xs text-blue-800 px-2 py-1 rounded">
                      RAG Enhanced
                    </span>
                  )}
                </h4>
                <div className=" p-3 rounded-lg border border-red-200">
                  <h5 className="font-medium text-red-800 mb-2">
                    Identified Weakness
                  </h5>
                  <p className="text-sm text-red-700 mb-1">
                    <strong>Player:</strong> {parsedAnalysis.weakness.player}
                  </p>
                  <p className="text-sm text-red-700 mb-1">
                    <strong>Position:</strong>{" "}
                    {parsedAnalysis.weakness.position}
                  </p>
                  <p className="text-xs text-red-600">
                    <strong>Issues:</strong> {parsedAnalysis.weakness.issues}
                  </p>
                </div>
              </div>

              {/* Transfer Suggestion */}
              <div className=" rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold mb-3">💡 Recommended Transfer</h4>

                <div className="space-y-3">
                  {/* Transfer Out */}
                  <div className="flex items-center justify-between p-3  rounded-lg border border-red-200">
                    <div className="flex items-center space-x-3">
                      <span className="text-red-600 font-bold">OUT</span>
                      <div>
                        <p className="font-medium text-red-800">
                          {parsedAnalysis.transfer.playerOut}
                        </p>
                        {parsedAnalysis.transfer.priceOut && (
                          <p className="text-xs text-red-600">
                            £{parsedAnalysis.transfer.priceOut}m
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transfer In */}
                  <div className="flex items-center justify-between p-3  rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <span className="text-green-600 font-bold">IN</span>
                      <div>
                        <p className="font-medium text-green-800">
                          {parsedAnalysis.transfer.playerIn}
                        </p>
                        {parsedAnalysis.transfer.priceIn && (
                          <p className="text-xs text-green-600">
                            £{parsedAnalysis.transfer.priceIn}m
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Analysis Details */}
                  <div className=" p-3 rounded-lg border border-blue-200 space-y-2">
                    {parsedAnalysis.transfer.reason && (
                      <div>
                        <span className="text-sm font-medium text-blue-800">
                          Reasoning:{" "}
                        </span>
                        <span className="text-sm text-blue-700">
                          {parsedAnalysis.transfer.reason}
                        </span>
                      </div>
                    )}
                    {parsedAnalysis.transfer.expectedImprovement && (
                      <div>
                        <span className="text-sm font-medium text-blue-800">
                          Expected Impact:{" "}
                        </span>
                        <span className="text-sm text-blue-700">
                          {parsedAnalysis.transfer.expectedImprovement}
                        </span>
                      </div>
                    )}
                    {parsedAnalysis.transfer.budgetImpact && (
                      <div>
                        <span className="text-sm font-medium text-blue-800">
                          Budget:{" "}
                        </span>
                        <span className="text-sm text-blue-700">
                          {parsedAnalysis.transfer.budgetImpact}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Attribution */}
              {!isFallback && (
                <div className="text-xs  flex items-center gap-1">
                  <span>🤖</span>
                  <span>
                    Powered by AI analysis with live market data, xG stats, and
                    expert insights
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Raw Analysis Display (for debugging/detailed view) */}
          {analysis && !parsedAnalysis && !loading && (
            <div className=" rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold mb-3">Raw Analysis</h4>
              <pre className="text-sm  whitespace-pre-wrap">{analysis}</pre>
            </div>
          )}

          {!analysis && !loading && (
            <div className="text-center py-8">
              <p className=" mb-4">
                Get AI-powered transfer suggestions based on comprehensive data
                analysis
              </p>
              <button
                onClick={handleGenerateAnalysis}
                className="px-4 py-2 text-white rounded-md transition-colors"
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
