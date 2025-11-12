"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CurrentSquad from "@/components/CurrentSquad";
import PlayerStats from "@/components/PlayerStats";
import LeagueStandings from "@/components/LeagueStandings";
import SeasonHistory from "@/components/SeasonHistory";
import TeamPicker from "@/components/TeamPicker";
import {
  getBootstrapStatic,
  getTeamPicks,
  getTeamHistory,
  getTeamInfo,
  getLeagueStandingsWithUserStats,
} from "@/lib/fpl-api";
import {
  BootstrapStatic,
  TeamPicks,
  TeamHistory,
  TeamInfo,
  LeagueStandings as LeagueStandingsType,
  LeagueStanding,
} from "@/types/fpl";

import Predictions from "@/components/predictions/Predictions";

import Image from "next/image";

import fplgenie from "@/public/fplgenie.png";

export default function TeamPageClient({ teamId }: { teamId: number }) {
  const router = useRouter();

  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "squad" | "picker" | "stats" | "league" | "history" | "predictions"
  >("squad");

  // Data states
  const [bootstrapData, setBootstrapData] = useState<BootstrapStatic | null>(
    null
  );
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [teamPicks, setTeamPicks] = useState<TeamPicks | null>(null);
  const [teamHistory, setTeamHistory] = useState<TeamHistory | null>(null);
  const [leagueStandings, setLeagueStandings] =
    useState<LeagueStandingsType | null>(null);
  const [userPosition, setUserPosition] = useState<LeagueStanding | null>(null);

  const [leagueId, setLeagueId] = useState<string>("");

  useEffect(() => {
    loadTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Auto-load the first league when team info is loaded
  useEffect(() => {
    const autoLoadFirstLeague = async () => {
      if (
        teamInfo &&
        teamInfo.leagues?.classic &&
        teamInfo.leagues.classic.length > 0 &&
        !leagueStandings
      ) {
        const firstLeague = teamInfo.leagues.classic[0];
        if (firstLeague.id) {
          const leagueIdStr = firstLeague.id.toString();
          setLeagueId(leagueIdStr);

          // Auto-load the first league
          try {
            const result = await getLeagueStandingsWithUserStats(
              firstLeague.id,
              teamId || undefined
            );
            setLeagueStandings(result.standings);
            setUserPosition(result.userStats || null);
            setLeagueId(firstLeague.id.toString());
          } catch (err) {
            // Don't show error for auto-load, user can manually load
          }
        }
      }
    };

    autoLoadFirstLeague();
  }, [teamInfo, leagueStandings, teamId]);

  const loadBootstrapData = async () => {
    try {
      const data = await getBootstrapStatic();
      setBootstrapData(data);
      return data;
    } catch (err: any) {
      console.error("Failed to load bootstrap data:", err);
      const errorMessage = err?.message || "Unknown error";
      if (
        errorMessage.includes("403") ||
        errorMessage.includes("Access denied")
      ) {
        throw new Error(
          "FPL API access denied. This may be a temporary issue - please try again in a few minutes."
        );
      } else {
        throw new Error("Failed to load FPL data. Please try again.");
      }
    }
  };

  const loadTeamData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate team ID
      if (isNaN(teamId) || teamId <= 0) {
        throw new Error("Invalid team ID");
      }

      // Load bootstrap data first
      const bootstrap = await loadBootstrapData();

      const currentEvent =
        bootstrap?.events.find((event) => event.is_current)?.id || 1;

      // Load team data with better error handling
      const [teamInfoData, picks, history] = await Promise.allSettled([
        getTeamInfo(teamId),
        getTeamPicks(teamId, currentEvent),
        getTeamHistory(teamId),
      ]);

      // Check if team info loaded successfully (most critical)
      if (teamInfoData.status === "rejected") {
        console.error("Team info error:", teamInfoData.reason);
        const errorMessage = teamInfoData.reason?.message || "Unknown error";
        if (
          errorMessage.includes("404") ||
          errorMessage.includes("Team not found")
        ) {
          throw new Error(
            `Team ID ${teamId} not found. Please check your team ID.`
          );
        } else if (
          errorMessage.includes("403") ||
          errorMessage.includes("Access denied")
        ) {
          throw new Error(
            "FPL API access denied. This may be a temporary issue - please try again in a few minutes."
          );
        } else {
          throw new Error(`Failed to load team information: ${errorMessage}`);
        }
      }

      // Check picks
      if (picks.status === "rejected") {
        console.error("Team picks error:", picks.reason);
        // Don't fail completely for picks, but log the error
      }

      // Check history
      if (history.status === "rejected") {
        console.error("Team history error:", history.reason);
        // Don't fail completely for history, but log the error
      }

      setTeamInfo(teamInfoData.value);
      setTeamPicks(picks.status === "fulfilled" ? picks.value : null);
      setTeamHistory(history.status === "fulfilled" ? history.value : null);
      setTeamName(teamInfoData.value.name);
    } catch (err: any) {
      const errorMessage =
        err?.message ||
        "Failed to load team data. Please check your team ID and try again.";
      setError(errorMessage);
      console.error("Team data loading error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLeague = async (selectedLeagueId?: string) => {
    const idToLoad = selectedLeagueId || leagueId;
    if (!idToLoad) return;

    setLoading(true);
    try {
      const result = await getLeagueStandingsWithUserStats(
        parseInt(idToLoad),
        teamId || undefined
      );
      setLeagueStandings(result.standings);
      setUserPosition(result.userStats || null);
      setLeagueId(idToLoad);
      setActiveTab("league");
    } catch (err) {
      setError("Failed to load league standings. Please check your league ID.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueSelection = (selectedLeagueId: string) => {
    if (selectedLeagueId) {
      handleLoadLeague(selectedLeagueId);
    } else {
      setLeagueId("");
      setLeagueStandings(null);
      setUserPosition(null);
    }
  };

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
            onClick={() => router.push("/")}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Go Back
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
            <div className="flex justify-center flex-col items-center">
              <Image
                src={fplgenie}
                alt="FplGenie Image"
                width={96}
                height={144}
                style={{ zIndex: -1000 }}
              />
              <h1 className="text-2xl font-bold ">FPL Genie</h1>
              {teamName && (
                <p className="text-center text-lg font-semibold">{teamName}</p>
              )}
              <p className="text-center">Team ID: {teamId}</p>
              {teamInfo && (
                <p className="text-center text-sm text-gray-600">
                  {teamInfo.player_first_name} {teamInfo.player_last_name}
                </p>
              )}
            </div>
            <button
              onClick={() => router.push("/")}
              className="text-blue-600 hover:text-blue-800 no-gradient-border"
            >
              Change Team
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="w-full px-12">
        <div className="flex w-full justify-between gap-[5%] text-nowrap flex-col sm:flex-row pt-2 gap-y-2">
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
            onClick={() => setActiveTab("picker")}
            className={`py-1 border-b-2 font-medium text-sm w-full ${
              activeTab === "picker"
                ? "border-blue-500 text-blue-600 bg-green-600"
                : "border-transparent  hover:"
            }`}
          >
            Pick Team
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
          <button
            onClick={() => setActiveTab("predictions")}
            className={`py-1 border-b-2 font-medium text-sm  w-full ${
              activeTab === "predictions"
                ? "border-blue-500 text-blue-600 bg-green-600"
                : "border-transparent  hover:"
            }`}
          >
            Predictions
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
            teamPicks={teamPicks}
          />
        )}

        {activeTab === "picker" && bootstrapData && teamPicks && (
          <TeamPicker
            picks={teamPicks.picks}
            elements={bootstrapData.elements}
            teams={bootstrapData.teams}
            elementTypes={bootstrapData.element_types}
            currentEvent={currentEvent}
            events={bootstrapData.events}
            teamPicks={teamPicks}
            teamId={teamInfo?.id}
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
            {/* League Selection - Always show when teamInfo is available */}
            {teamInfo &&
              teamInfo.leagues?.classic &&
              teamInfo.leagues.classic.length > 0 && (
                <div className="p-6 rounded-lg flex justify-center">
                  <div className="mb-4 flex justify-center flex-col">
                    <label className="block text-sm font-medium mb-2 text-center">
                      Your Leagues
                    </label>
                    <select
                      value={
                        leagueStandings
                          ? leagueStandings.league.id.toString()
                          : leagueId
                      }
                      onChange={(e) => handleLeagueSelection(e.target.value)}
                      className="px-3 py-2 border rounded-md focus:outline-none"
                    >
                      <option value="">Select a league</option>
                      {teamInfo.leagues.classic.map((league: any) => (
                        <option key={league.id} value={league.id}>
                          {league.name}
                        </option>
                      ))}
                    </select>
                    {/* Manual league ID input - collapsible */}
                    <details className="mb-4 pt-2 text-center">
                      <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                        Enter different league ID manually
                      </summary>
                      <div className="mt-3 flex flex-col gap-y-4 justify-center items-center">
                        <div className="input-gradient-wrapper">
                          <input
                            type="number"
                            value={leagueId}
                            onChange={(e) => setLeagueId(e.target.value)}
                            placeholder="Enter League ID"
                          />
                        </div>
                        <button
                          onClick={() => handleLoadLeague()}
                          disabled={!leagueId}
                          className="bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          Load League
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Find league ID in the URL when viewing league standings
                      </p>
                    </details>
                  </div>
                </div>
              )}

            {/* Fallback for manual entry when no team leagues available */}
            {!leagueStandings &&
              (!teamInfo ||
                !teamInfo.leagues?.classic ||
                teamInfo.leagues.classic.length === 0) && (
                <div className="p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-bold mb-4">
                    Load League Standings
                  </h2>
                  <div className="flex gap-4">
                    <div className="input-gradient-wrapper flex-1">
                      <input
                        type="number"
                        value={leagueId}
                        onChange={(e) => setLeagueId(e.target.value)}
                        placeholder="Enter League ID"
                      />
                    </div>
                    <button
                      onClick={() => handleLoadLeague()}
                      disabled={!leagueId}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Load League
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Find your league ID in the URL when viewing your league
                    standings
                  </p>
                </div>
              )}
            {leagueStandings && bootstrapData && (
              <LeagueStandings
                standings={leagueStandings.standings.results}
                leagueName={leagueStandings.league.name}
                userTeamId={teamId}
                userPosition={userPosition || undefined}
                elements={bootstrapData.elements}
                teams={bootstrapData.teams}
                elementTypes={bootstrapData.element_types}
                currentEvent={
                  bootstrapData.events.find((e) => e.is_current)?.id || 1
                }
                events={bootstrapData.events}
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
        {activeTab === "predictions" && teamId && (
          <Predictions teamId={teamId} />
        )}
      </main>
    </div>
  );
}
