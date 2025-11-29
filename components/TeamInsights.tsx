"use client";

import { useState, useEffect } from "react";
import { Element, Pick, Team, ElementType, Event, Fixture } from "@/types/fpl";
import { getFixtures } from "@/lib/fpl-api";

interface TeamInsightsProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  totalPoints: number;
  events: Event[];
  teamPicks?: any;
  teamHistory?: any;
  userLeagues?: any[];
}

export default function TeamInsights({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  totalPoints,
  events,
  teamPicks,
  teamHistory,
  userLeagues,
}: TeamInsightsProps) {
  const [insights, setInsights] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [streamedContent, setStreamedContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [grade, setGrade] = useState<number | null>(null);
  const [gradeDescription, setGradeDescription] = useState<string>("");

  const getPlayer = (elementId: number) => {
    return elements.find((el) => el.id === elementId);
  };

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    setStreamedContent("");
    setIsStreaming(true);
    setInsights("");

    try {
      // Get current gameweek info
      const currentGameweek = events.find((event) => event.is_current);
      const gameweekFinished = currentGameweek?.finished || false;

      // Fetch fixtures data
      const fixtures = await getFixtures();

      // Prepare squad data with enhanced information
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
        overallRank: teamPicks?.entry_history?.overall_rank,
        gameweekRank: teamPicks?.entry_history?.rank,
        teamValue: teamPicks?.entry_history?.value,
        bank: teamPicks?.entry_history?.bank,
      };

      // Make streaming request
      const response = await fetch("/api/team-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamData,
          squadData,
          currentGameweek: currentEvent,
          gameweekFinished,
          fixtures,
          elements,
          teamHistory,
          userLeagues,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate insights");
      }

      // Check if it's a streaming response or JSON with grade
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        // Handle JSON response with grade
        const result = await response.json();
        setGrade(result.grade || null);
        setGradeDescription(result.gradeDescription || "");
        setInsights(result.insights || "");
        setIsFallback(result.fallback || false);
        setStreamedContent(result.insights || "");
      } else if (contentType?.includes("text/plain")) {
        // Handle streaming response (legacy, no grade)
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
          }
        }

        setInsights(accumulatedContent);
        setIsFallback(false);
      }
    } catch (err) {
      console.error("Failed to generate insights:", err);
      setError("Failed to generate team insights. Please try again.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const formatInsights = (text: string) => {
    // Split by bullet points and format as list items
    const lines = text.split("\n").filter((line) => line.trim());
    return lines.map((line, index) => {
      if (line.startsWith("•") || line.startsWith("-")) {
        return (
          <li key={index} className="mb-2">
            {line.replace(/^[•-]\s*/, "")}
          </li>
        );
      } else if (line.startsWith("**") && line.endsWith("**")) {
        return (
          <h4 key={index} className="font-semibold text-lg mb-2 text-blue-700">
            {line.replace(/\*\*/g, "")}
          </h4>
        );
      } else if (line.includes("**")) {
        // Handle inline bold text
        const parts = line.split("**");
        return (
          <p key={index} className="mb-2">
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
          </p>
        );
      } else {
        return (
          <p key={index} className="mb-2">
            {line}
          </p>
        );
      }
    });
  };

  return (
    <div className="bg-green-200 rounded-lg border border-green-200">
      <div
        className="flex justify-between items-center p-4 cursor-pointer rounded-t-lg transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold flex items-center gap-2">
            Rate my team
            {isFallback && (
              <span className="text-xs text-yellow-800 px-2 py-1 rounded">
                Basic Mode
              </span>
            )}
          </h3>
          {grade !== null && (
            <div className="text-3xl font-bold text-blue-700">
              {grade}
              <span className="text-sm text-gray-600">/100</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                generateInsights();
              }}
              disabled={loading}
              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
            >
              {loading
                ? "Analyzing..."
                : insights
                ? "Re-rate Team"
                : "Rate My Team"}
            </button>
          )}
          <button className="hover:bg-green-300 p-1 rounded">
            {isCollapsed ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="px-4 pb-4">
          {error && (
            <div className="border border-red-200 rounded-md p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Grade Description */}
          {gradeDescription && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-800">{gradeDescription}</p>
            </div>
          )}

          {(streamedContent || insights) && (
            <div className="prose prose-sm max-w-none">
              <div className="leading-relaxed">
                {formatInsights(streamedContent || insights)}
              </div>
              {/* {isStreaming && (
                <div className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1"></div>
              )} */}
              {!isFallback && !isStreaming && (
                <div className="mt-4 text-xs flex items-center gap-1">
                  <span>Powered by AI</span>
                </div>
              )}
            </div>
          )}

          {!insights && !streamedContent && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Get your team rated based on weekly performance vs average, personal league rankings, and overall rank
              </p>
              <button
                onClick={generateInsights}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Rate My Team
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
