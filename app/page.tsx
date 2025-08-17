"use client";

import { useState, useEffect } from "react";
import TeamIdInput from "@/components/TeamIdInput";
import CurrentSquad from "@/components/CurrentSquad";
import PlayerStats from "@/components/PlayerStats";
import LeagueStandings from "@/components/LeagueStandings";
import SeasonHistory from "@/components/SeasonHistory";
import {
  getBootstrapStatic,
  getTeamPicks,
  getTeamHistory,
  getLeagueStandings,
} from "@/lib/fpl-api";
import {
  BootstrapStatic,
  TeamPicks,
  TeamHistory,
  LeagueStandings as LeagueStandingsType,
} from "@/types/fpl";

export default function Home() {
  const [teamId, setTeamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "squad" | "stats" | "league" | "history"
  >("squad");

  // Data states
  const [bootstrapData, setBootstrapData] = useState<BootstrapStatic | null>(
    null
  );
  const [teamPicks, setTeamPicks] = useState<TeamPicks | null>(null);
  const [teamHistory, setTeamHistory] = useState<TeamHistory | null>(null);
  const [leagueStandings, setLeagueStandings] =
    useState<LeagueStandingsType | null>(null);

  const [leagueId, setLeagueId] = useState<string>("");

  useEffect(() => {
    // Load bootstrap data on component mount
    loadBootstrapData();
  }, []);

  const loadBootstrapData = async () => {
    try {
      const data = await getBootstrapStatic();
      setBootstrapData(data);
    } catch (err) {
      console.error("Failed to load bootstrap data:", err);
    }
  };

  const handleTeamIdSubmit = async (id: number) => {
    setTeamId(id);
    setLoading(true);
    setError(null);

    try {
      if (!bootstrapData) {
        await loadBootstrapData();
      }

      const currentEvent =
        bootstrapData?.events.find((event) => event.is_current)?.id || 1;

      // Load team data
      const [picks, history] = await Promise.all([
        getTeamPicks(id, currentEvent),
        getTeamHistory(id),
      ]);

      setTeamPicks(picks);
      setTeamHistory(history);
    } catch (err) {
      setError(
        "Failed to load team data. Please check your team ID and try again."
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLeague = async () => {
    if (!leagueId) return;

    setLoading(true);
    try {
      const standings = await getLeagueStandings(parseInt(leagueId));
      setLeagueStandings(standings);
      setActiveTab("league");
    } catch (err) {
      setError("Failed to load league standings. Please check your league ID.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!teamId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold  mb-2">⚽ FPL Dashboard</h1>
            <p className="">Track your Fantasy Premier League performance</p>
          </div>
          <TeamIdInput onTeamIdSubmit={handleTeamIdSubmit} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="">Loading your FPL data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <button
            onClick={() => setTeamId(null)}
            className=" text-white px-4 py-2 rounded-md hover:"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentEvent =
    bootstrapData?.events.find((event) => event.is_current)?.id || 1;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="">
        <div className="flex justify-center">
          <div className="flex justify-between items-center py-4 flex-col">
            <div>
              <h1 className="text-2xl font-bold ">⚽ FPL Dashboard</h1>
              <p className="text-center">Team ID: {teamId}</p>
            </div>
            <button
              onClick={() => setTeamId(null)}
              className="text-blue-600 hover:text-blue-800 !border-none"
            >
              Change Team
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="w-full px-[10%]">
        <div className="flex w-full justify-between gap-[10%] text-nowrap flex-col sm:flex-row pt-2 gap-y-2">
          <button
            onClick={() => setActiveTab("squad")}
            className={`py-1 border-b-2 font-medium text-sm w-full ${
              activeTab === "squad"
                ? "border-blue-500 text-blue-600 bg-green-600"
                : "border-transparent  hover:"
            }`}
          >
            Current Squad
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`py-1 border-b-2 font-medium text-sm  w-full ${
              activeTab === "stats"
                ? "border-blue-500 text-blue-600 bg-green-600"
                : "border-transparent  hover:"
            }`}
          >
            Player Stats
          </button>
          <button
            onClick={() => setActiveTab("league")}
            className={`py-1 border-b-2 font-medium text-sm  w-full ${
              activeTab === "league"
                ? "border-blue-500 text-blue-600 bg-green-600"
                : "border-transparent  hover:"
            }`}
          >
            League
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-1 border-b-2 font-medium text-sm  w-full ${
              activeTab === "history"
                ? "border-blue-500 text-blue-600 bg-green-600"
                : "border-transparent  hover:"
            }`}
          >
            Season History
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === "squad" && teamPicks && bootstrapData && (
          <CurrentSquad
            picks={teamPicks.picks}
            elements={bootstrapData.elements}
            teams={bootstrapData.teams}
            elementTypes={bootstrapData.element_types}
            currentEvent={currentEvent}
            events={bootstrapData.events}
          />
        )}

        {activeTab === "stats" && bootstrapData && (
          <PlayerStats
            elements={bootstrapData.elements}
            teams={bootstrapData.teams}
            elementTypes={bootstrapData.element_types}
          />
        )}

        {activeTab === "league" && (
          <div className="space-y-6">
            {!leagueStandings && (
              <div className="p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">
                  Load League Standings
                </h2>
                <div className="flex gap-4">
                  <input
                    type="number"
                    value={leagueId}
                    onChange={(e) => setLeagueId(e.target.value)}
                    placeholder="Enter League ID"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleLoadLeague}
                    disabled={!leagueId}
                    className=" text-white px-4 py-2 rounded-md"
                  >
                    Load League
                  </button>
                </div>
                <p className="text-xs  mt-2">
                  Find your league ID in the URL when viewing your league
                  standings
                </p>
              </div>
            )}
            {leagueStandings && (
              <LeagueStandings
                standings={leagueStandings.standings.results}
                leagueName={leagueStandings.league.name}
                userTeamId={teamId}
              />
            )}
          </div>
        )}

        {activeTab === "history" && teamHistory && (
          <SeasonHistory
            history={teamHistory.current}
            chips={teamHistory.chips}
          />
        )}
      </main>
    </div>
  );
}
