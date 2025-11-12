"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TeamIdInput from "@/components/TeamIdInput";
import TeamSearch from "@/components/TeamSearch";
import { getLeagueStandingsWithUserStats } from "@/lib/fpl-api";

import Image from "next/image";

import fplgenie from "@/public/fplgenie.png";

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<"team" | "league" | "search">(
    "team"
  );
  const [leagueLoginId, setLeagueLoginId] = useState<string>("");
  const [leagueTeams, setLeagueTeams] = useState<any[]>([]);
  const [leagueLoginLoading, setLeagueLoginLoading] = useState(false);

  const handleTeamIdSubmit = async (id: number) => {
    // Navigate to the team page
    router.push(`/${id}`);
  };

  const handleTeamSearch = (teamId: number) => {
    handleTeamIdSubmit(teamId);
  };

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
              loginMode === "search" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setLoginMode("search")}
          >
            Search Team
          </button>
          <button
            className={`px-3 py-2 rounded text-sm ${
              loginMode === "league" ? "bg-blue-600 text-white" : "bg-gray-200"
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
              <div className="input-gradient-wrapper">
                <input
                  type="text"
                  value={leagueLoginId}
                  onChange={(e) => setLeagueLoginId(e.target.value)}
                  placeholder="Enter League ID or URL: 724869"
                  className="rounded-md px-3 py-2 w-full"
                />
              </div>
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
            {error && (
              <div className="mt-2 text-red-600 text-sm text-center">
                {error}
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
