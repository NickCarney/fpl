"use client";

import { useState } from "react";
import { Element, Pick, Team, ElementType, Event, ChipPlay } from "@/types/fpl";
import { getFixtures } from "@/lib/fpl-api";

interface TeamInsightsProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  totalPoints: number;
  events: Event[];
  chipsUsed?: ChipPlay[];
  activeChip?: string | null;
}

interface ParsedInsights {
  captain: { player: string; reasoning: string } | null;
  viceCaptain: { player: string; reasoning: string } | null;
  strengths: string[];
  weaknesses: string[];
  transferMarket: string[];
  chipStrategy: string[];
  differentials: string[];
}

const SECTION_KEYS = [
  "CAPTAIN_PICK",
  "VICE_CAPTAIN_PICK",
  "STRENGTHS",
  "WEAKNESSES",
  "TRANSFER_MARKET",
  "CHIP_STRATEGY",
  "DIFFERENTIALS",
] as const;

function parseInsights(text: string): ParsedInsights | null {
  const lines = text.split("\n").map((l) => l.trim());

  const findSectionLine = (key: string) =>
    lines.findIndex((l) => l.startsWith(key + ":"));

  const captainLine = findSectionLine("CAPTAIN_PICK");
  if (captainLine === -1) return null;

  const getPipeValue = (lineIdx: number, key: string) => {
    const raw = lines[lineIdx].replace(key + ":", "").trim();
    const [player, ...rest] = raw.split("|");
    return {
      player: (player || "").trim(),
      reasoning: rest.join("|").trim(),
    };
  };

  const captain = getPipeValue(captainLine, "CAPTAIN_PICK");

  const vcLine = findSectionLine("VICE_CAPTAIN_PICK");
  const viceCaptain = vcLine !== -1 ? getPipeValue(vcLine, "VICE_CAPTAIN_PICK") : null;

  const sectionBounds: { key: string; start: number }[] = SECTION_KEYS.map(
    (key) => ({ key, start: findSectionLine(key) })
  ).filter((s) => s.start !== -1);
  sectionBounds.sort((a, b) => a.start - b.start);

  const getBullets = (key: string): string[] => {
    const idx = sectionBounds.findIndex((s) => s.key === key);
    if (idx === -1) return [];
    const start = sectionBounds[idx].start + 1;
    const end =
      idx + 1 < sectionBounds.length ? sectionBounds[idx + 1].start : lines.length;
    return lines
      .slice(start, end)
      .filter((l) => l.startsWith("-") || l.startsWith("•"))
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
  };

  return {
    captain: captain.player ? captain : null,
    viceCaptain: viceCaptain?.player ? viceCaptain : null,
    strengths: getBullets("STRENGTHS"),
    weaknesses: getBullets("WEAKNESSES"),
    transferMarket: getBullets("TRANSFER_MARKET"),
    chipStrategy: getBullets("CHIP_STRATEGY"),
    differentials: getBullets("DIFFERENTIALS"),
  };
}

// Renders **bold** segments within a line of text
function renderInline(text: string) {
  const parts = text.split("**");
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

export default function TeamInsights({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  totalPoints,
  events,
  chipsUsed = [],
  activeChip = null,
}: TeamInsightsProps) {
  const [rawText, setRawText] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);

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
    setRawText("");
    setParsed(null);
    setIsStreaming(true);

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
          is_starting: pick.position <= 11,
        };
      });

      const teamData = {
        totalPoints,
        squadValue:
          squadData.reduce((sum, p) => sum + (p?.now_cost || 0), 0) / 10,
        currentGameweek: currentEvent,
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
          teams,
          chipsUsed,
          activeChip,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate insights");
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
            setRawText(accumulatedContent);

            const partial = parseInsights(accumulatedContent);
            if (partial) setParsed(partial);
          }
        }

        setRawText(accumulatedContent);
        setParsed(parseInsights(accumulatedContent));
        setIsFallback(false);
      } else {
        // Handle regular JSON response (fallback)
        const result = await response.json();
        setRawText(result.insights);
        setParsed(parseInsights(result.insights));
        setIsFallback(result.fallback || false);
      }
    } catch (err) {
      console.error("Failed to generate insights:", err);
      setError("Failed to generate team insights. Please try again.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  return (
    <div className="bg-green-200 rounded-lg border border-green-200">
      <div
        className="flex justify-between items-center p-4 cursor-pointer rounded-t-lg transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-xl font-bold flex items-center gap-2">
          Team Insights
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
                generateInsights();
              }}
              disabled={loading}
              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
            >
              {loading
                ? "Analyzing..."
                : parsed
                ? "New Analysis"
                : "Analyze Squad"}
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

          {parsed && (
            <div className="space-y-4">
              {/* Captaincy */}
              {(parsed.captain || parsed.viceCaptain) && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold mb-3">Captaincy</h4>
                  <div className="space-y-2">
                    {parsed.captain && (
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-900">
                          <span className="font-bold">Captain: </span>
                          {parsed.captain.player}
                        </p>
                        <p className="text-xs text-yellow-800 mt-1">
                          {renderInline(parsed.captain.reasoning)}
                        </p>
                      </div>
                    )}
                    {parsed.viceCaptain && (
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-900">
                          <span className="font-bold">Vice-Captain: </span>
                          {parsed.viceCaptain.player}
                        </p>
                        <p className="text-xs text-orange-800 mt-1">
                          {renderInline(parsed.viceCaptain.reasoning)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Strengths / Weaknesses */}
              {(parsed.strengths.length > 0 || parsed.weaknesses.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parsed.strengths.length > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold mb-2 text-green-800">
                        Strengths
                      </h4>
                      <ul className="space-y-2">
                        {parsed.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-gray-800">
                            {renderInline(s)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parsed.weaknesses.length > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold mb-2 text-red-800">
                        Weaknesses
                      </h4>
                      <ul className="space-y-2">
                        {parsed.weaknesses.map((s, i) => (
                          <li key={i} className="text-sm text-gray-800">
                            {renderInline(s)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Transfer Market */}
              {parsed.transferMarket.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold mb-2 text-blue-800">
                    Transfer Market
                  </h4>
                  <ul className="space-y-2">
                    {parsed.transferMarket.map((s, i) => (
                      <li key={i} className="text-sm text-gray-800">
                        {renderInline(s)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Chip Strategy */}
              {parsed.chipStrategy.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold mb-2 text-purple-800">
                    Chip Strategy
                  </h4>
                  <ul className="space-y-2">
                    {parsed.chipStrategy.map((s, i) => (
                      <li key={i} className="text-sm text-gray-800">
                        {renderInline(s)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Differentials */}
              {parsed.differentials.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold mb-2 text-indigo-800">
                    Differentials
                  </h4>
                  <ul className="space-y-2">
                    {parsed.differentials.map((s, i) => (
                      <li key={i} className="text-sm text-gray-800">
                        {renderInline(s)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!isFallback && !isStreaming && (
                <div className="text-xs flex items-center gap-1">
                  <span>Powered by AI</span>
                </div>
              )}
            </div>
          )}

          {/* Raw fallback display if structured parse failed */}
          {rawText && !parsed && !loading && (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <pre className="text-sm whitespace-pre-wrap">{rawText}</pre>
            </div>
          )}

          {!parsed && !rawText && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Get AI-powered insights about your team&apos;s strengths, weaknesses, and performance
              </p>
              <button
                onClick={generateInsights}
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
