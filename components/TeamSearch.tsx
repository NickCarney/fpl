"use client";

import { useState, useEffect } from "react";

interface TeamSearchProps {
  onTeamSelect: (teamId: number, teamName: string) => void;
}

interface TeamEntry {
  id: number;
  name: string;
  playerName: string;
  rank?: number;
}

export default function TeamSearch({ onTeamSelect }: TeamSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<TeamEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchTeams(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const searchTeams = async (query: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/search-teams?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setSearchResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to search teams");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Search for your team
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter your FPL team name or manager name..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Type at least 2 characters to search
        </p>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Searching teams...</p>
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      {searchTerm.length >= 2 && !loading && (
        <div className="max-h-80 overflow-y-auto border rounded-md">
          {searchResults.length > 0 ? (
            <ul>
              {searchResults.map((team) => (
                <li key={team.id} className="border-b last:border-b-0">
                  <button
                    className="w-full text-left px-3 py-3 hover:bg-blue-50 focus:bg-blue-50 transition-colors"
                    onClick={() => onTeamSelect(team.id, team.name)}
                  >
                    <div className="font-medium text-gray-900">{team.name}</div>
                    <div className="text-sm text-gray-600">
                      Manager: {team.playerName}
                    </div>
                    <div className="text-xs text-gray-400">
                      Team ID: {team.id}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-6 text-center text-gray-500">
              <div className="text-lg mb-2">🔍</div>
              <div>No teams found matching "{searchTerm}"</div>
              <div className="text-xs mt-2">
                Try searching with different keywords or use Team ID directly
              </div>
            </div>
          )}
        </div>
      )}

      {searchTerm.length > 0 && searchTerm.length < 2 && (
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
          Keep typing to search for teams...
        </div>
      )}

      <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded">
        <p>
          <strong>Tips:</strong>
        </p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Search by your FPL team name or your actual name</li>
          <li>Make sure you're in a public league for search to work</li>
          <li>Can't find your team? Use the Team ID option instead</li>
        </ul>
      </div>
    </div>
  );
}
