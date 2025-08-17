'use client';

import { useState, useEffect } from 'react';
import { Element, Pick, Team, ElementType, Event, Fixture } from '@/types/fpl';
import { generateTeamInsights, getFixtures } from '@/lib/fpl-api';

interface TeamInsightsProps {
  picks: Pick[];
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
  currentEvent: number;
  totalPoints: number;
  events: Event[];
}

export default function TeamInsights({
  picks,
  elements,
  teams,
  elementTypes,
  currentEvent,
  totalPoints,
  events,
}: TeamInsightsProps) {
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const getPlayer = (elementId: number) => {
    return elements.find(el => el.id === elementId);
  };

  const getTeam = (teamId: number) => {
    return teams.find(team => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find(type => type.id === elementTypeId);
  };

  const generateInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current gameweek info
      const currentGameweek = events.find(event => event.is_current);
      const gameweekFinished = currentGameweek?.finished || false;

      // Fetch fixtures data
      const fixtures = await getFixtures();

      // Prepare squad data with enhanced information
      const squadData = picks.map(pick => {
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
        squadValue: squadData.reduce((sum, p) => sum + (p?.now_cost || 0), 0) / 10,
        currentGameweek: currentEvent,
      };

      const result = await generateTeamInsights(
        teamData, 
        squadData, 
        currentEvent, 
        gameweekFinished, 
        fixtures
      );
      setInsights(result.insights);
      setIsFallback(result.fallback || false);
    } catch (err) {
      console.error('Failed to generate insights:', err);
      setError('Failed to generate team insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate insights on component mount
  useEffect(() => {
    if (picks.length > 0 && elements.length > 0) {
      generateInsights();
    }
  }, [picks, elements, currentEvent]);

  const formatInsights = (text: string) => {
    // Split by bullet points and format as list items
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map((line, index) => {
      if (line.startsWith('•') || line.startsWith('-')) {
        return (
          <li key={index} className="mb-2">
            {line.replace(/^[•-]\s*/, '')}
          </li>
        );
      } else if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <h4 key={index} className="font-semibold text-lg mb-2 text-blue-700">
            {line.replace(/\*\*/g, '')}
          </h4>
        );
      } else if (line.includes('**')) {
        // Handle inline bold text
        const parts = line.split('**');
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
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          🧠 Team Insights
          {isFallback && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              Basic Analysis
            </span>
          )}
        </h3>
        <button
          onClick={generateInsights}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm"
        >
          {loading ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <p className="text-gray-600">Analyzing your team...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {insights && !loading && (
        <div className="prose prose-sm max-w-none">
          <div className="text-gray-700 leading-relaxed">
            {formatInsights(insights)}
          </div>
          {!isFallback && (
            <div className="mt-4 text-xs text-gray-500 flex items-center gap-1">
              <span>⚡</span>
              <span>Powered by AI analysis</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
