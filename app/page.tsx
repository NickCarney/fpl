"use client";

import { useState, useEffect } from "react";
import TeamIdInput from "@/components/TeamIdInput";
import TeamSearch from "@/components/TeamSearch";
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

export default function Home() {
  const [teamId, setTeamId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  const [loginMode, setLoginMode] = useState<"team" | "league" | "search">(
    "team"
  );
  const [leagueLoginId, setLeagueLoginId] = useState<string>("");
  const [leagueTeams, setLeagueTeams] = useState<any[]>([]);
  const [leagueLoginLoading, setLeagueLoginLoading] = useState(false);

  useEffect(() => {
    // Load bootstrap data on component mount
    loadBootstrapData();
  }, []);

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
            console.log("Auto-load league result:", result);
            setLeagueStandings(result.standings);
            setUserPosition(result.userStats || null);
            setLeagueId(firstLeague.id.toString());
          } catch (err) {
            console.log("Failed to auto-load league:", err);
            // Don't show error for auto-load, user can manually load
          }
        }
      }
    };

    autoLoadFirstLeague();
  }, [teamInfo, leagueStandings]);

  const loadBootstrapData = async () => {
    try {
      const data = await getBootstrapStatic();
      setBootstrapData(data);
    } catch (err: any) {
      console.error("Failed to load bootstrap data:", err);
      const errorMessage = err?.message || "Unknown error";
      if (
        errorMessage.includes("403") ||
        errorMessage.includes("Access denied")
      ) {
        setError(
          "FPL API access denied. This may be a temporary issue - please try again in a few minutes."
        );
      } else {
        setError("Failed to load FPL data. Please try again.");
      }
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

      // Load team data with better error handling
      const [teamInfoData, picks, history] = await Promise.allSettled([
        getTeamInfo(id),
        getTeamPicks(id, currentEvent),
        getTeamHistory(id),
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
            `Team ID ${id} not found. Please check your team ID.`
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

    console.log("Loading league with:", { leagueId: idToLoad, teamId });
    setLoading(true);
    try {
      const result = await getLeagueStandingsWithUserStats(
        parseInt(idToLoad),
        teamId || undefined
      );
      console.log("Manual load league result:", result);
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

  const handleTeamSearch = (teamId: number, teamName: string) => {
    handleTeamIdSubmit(teamId);
  };

  if (!teamId) {
    return (
      <div className="relative min-h-screen flex items-center justify-left p-[15%] flex-col sm:flex-row overflow-hidden">
        <div className="w-full max-w-md bg-[#f4fde0] rounded relative z-10">
          <div className="text-center">
            <h1 className="text-4xl font-bold  mb-2">FPL Genie</h1>
            <p className="">Track your Fantasy Premier League performance</p>
          </div>
          <div className="flex justify-center gap-2 mb-2 flex-wrap mt-4">
            <button
              className={`px-3 py-2 rounded text-sm ${
                loginMode === "team" ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
              onClick={() => setLoginMode("team")}
            >
              Team ID
            </button>
            <button
              className={`px-3 py-2 rounded text-sm ${
                loginMode === "search"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => setLoginMode("search")}
            >
              Search Team
            </button>
            <button
              className={`px-3 py-2 rounded text-sm ${
                loginMode === "league"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => setLoginMode("league")}
            >
              Via League
            </button>
          </div>
          {loginMode === "team" && (
            <TeamIdInput onTeamIdSubmit={handleTeamIdSubmit} />
          )}
          {loginMode === "search" && (
            <TeamSearch onTeamSelect={handleTeamSearch} />
          )}
          {loginMode === "league" && (
            <div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setLeagueLoginLoading(true);
                  setError(null);
                  try {
                    // Extract league ID from URL or use as is
                    let id = leagueLoginId.trim();
                    if (id.includes("/")) {
                      // Try to extract league ID from URL
                      const match =
                        id.match(/leagues\/(\d+)/) ||
                        id.match(/league-entry\/(\d+)/) ||
                        id.match(/(\d+)/);
                      id = match ? match[1] : id;
                    }
                    const result = await getLeagueStandingsWithUserStats(
                      parseInt(id)
                    );
                    setLeagueTeams(result.standings.standings.results);
                    setLeagueLoginId(id);
                  } catch (err) {
                    setError(
                      "Failed to load league. Please check the ID or URL."
                    );
                    setLeagueTeams([]);
                  } finally {
                    setLeagueLoginLoading(false);
                  }
                }}
                className="flex flex-col gap-2"
              >
                <input
                  type="text"
                  value={leagueLoginId}
                  onChange={(e) => setLeagueLoginId(e.target.value)}
                  placeholder="Enter League ID or URL: 724869"
                  className="border border-gray-300 rounded-md px-3 py-2"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white rounded-md px-4 py-2"
                  disabled={leagueLoginLoading || !leagueLoginId}
                >
                  {leagueLoginLoading ? "Loading..." : "Show League Teams"}
                </button>
              </form>
              {leagueTeams.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium mb-2">Select your team:</p>
                  <ul className="max-h-64 overflow-y-auto border rounded">
                    {leagueTeams.map((team) => (
                      <li key={team.entry} className="border-b last:border-b-0">
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-blue-100"
                          onClick={() => handleTeamIdSubmit(team.entry)}
                        >
                          {team.entry_name}{" "}
                          <span className="text-xs text-gray-500">
                            ({team.player_name})
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <Image
          src={fplgenie}
          alt="FplGenie Image"
          width={0}
          height={0}
          sizes="100vw"
          className="fixed right-0 w-auto h-screen object-contain -z-50 translate-y-12 pt-[35%] sm:pt-0"
          style={{ zIndex: -1000 }}
        />
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
              onClick={() => setTeamId(null)}
              className="text-blue-600 hover:text-blue-800 !border-none !bg-transparent"
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
                        <input
                          type="number"
                          value={leagueId}
                          onChange={(e) => setLeagueId(e.target.value)}
                          placeholder="Enter League ID"
                          className="border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
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
                    <input
                      type="number"
                      value={leagueId}
                      onChange={(e) => setLeagueId(e.target.value)}
                      placeholder="Enter League ID"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
        {activeTab === "predictions" && teamHistory && <Predictions />}
      </main>
    </div>
  );
}
