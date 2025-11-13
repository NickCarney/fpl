"use client";

import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Current, ChipPlay, Fixture, Team, Element } from "@/types/fpl";

function formatRank(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

interface SeasonHistoryProps {
  history: Current[];
  chips: ChipPlay[];
}

type ViewMode = "yourTeam" | "premierLeague";

export default function SeasonHistory({ history, chips }: SeasonHistoryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("yourTeam");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (viewMode === "premierLeague") {
      fetchPremierLeagueData();
    }
  }, [viewMode]);

  const fetchPremierLeagueData = async () => {
    setLoading(true);
    try {
      const [fixturesRes, bootstrapRes] = await Promise.all([
        fetch("/api/fixtures"),
        fetch("/api/bootstrap-static"),
      ]);

      const fixturesData = await fixturesRes.json();
      const bootstrapData = await bootstrapRes.json();

      setFixtures(fixturesData);
      setTeams(bootstrapData.teams);
      setElements(bootstrapData.elements);
    } catch (error) {
      console.error("Error fetching Premier League data:", error);
    } finally {
      setLoading(false);
    }
  };
  // Prepare data for the chart
  const chartData = history.map((gw) => {
    const chip = chips.find((c) => c.event === gw.event);
    return {
      gameweek: gw.event,
      points: gw.points,
      totalPoints: gw.total_points,
      rank: gw.overall_rank,
      chip: chip?.name || null,
    };
  });

  // Calculate stats
  const totalPoints = history[history.length - 1]?.total_points || 0;
  const currentRank = history[history.length - 1]?.overall_rank || 0;
  const averagePoints =
    history.length > 0 ? Math.round(totalPoints / history.length) : 0;
  const highestGW = Math.max(...history.map((gw) => gw.points));
  const lowestGW = Math.min(...history.map((gw) => gw.points));

  const chipsUsed = chips.filter((chip) =>
    history.some((gw) => gw.event === chip.event)
  );

  return (
    <div className=" p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Season History</h2>

      {/* Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border-2p-[2px] no-gradient-border ">
          <div className="inline-flex rounded-lg dark:bg-gray-900 p-1 no-gradient-border ">
            <button
              onClick={() => setViewMode("yourTeam")}
              className={`px-6 py-2 rounded-md transition-all no-gradient-border  ${
                viewMode === "yourTeam"
                  ? "text-white !border-b-2 !rounded-none !border-purple-600"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 bg-transparent"
              }`}
            >
              Your Team
            </button>
            <button
              onClick={() => setViewMode("premierLeague")}
              className={`px-6 py-2 rounded-md transition-all no-gradient-border  ${
                viewMode === "premierLeague"
                  ? "text-white !border-b-2 !rounded-none !border-cyan-600"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 bg-transparent"
              }`}
            >
              Premier League
            </button>
          </div>
        </div>
      </div>

      {viewMode === "yourTeam" ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className=" p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{totalPoints}</div>
              <div className="text-sm ">Total Points</div>
            </div>
            <div className=" p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">
                {currentRank.toLocaleString()}
              </div>
              <div className="text-sm ">Overall Rank</div>
            </div>
            <div className=" p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{averagePoints}</div>
              <div className="text-sm ">Avg Points/GW</div>
            </div>
            <div className=" p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{highestGW}</div>
              <div className="text-sm ">Highest GW</div>
            </div>
            <div className=" p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{lowestGW}</div>
              <div className="text-sm ">Lowest GW</div>
            </div>
          </div>

          {/* Points Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Points per Gameweek</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="gameweek"
                    label={{
                      value: "Gameweek",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />
                  <YAxis
                    label={{
                      value: "Points",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      value,
                      name === "points" ? "GW Points" : "Total Points",
                    ]}
                    labelFormatter={(label) => `Gameweek ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="points"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rank Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">
              Overall Rank Progress
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="gameweek"
                    label={{
                      value: "Gameweek",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />
                  <YAxis
                    reversed
                    label={{
                      value: "Rank",
                      angle: -90,
                      position: "insideLeft",
                    }}
                    tickFormatter={formatRank}
                  />
                  <Tooltip
                    formatter={(value: any) => [
                      formatRank(value),
                      "Overall Rank",
                    ]}
                    labelFormatter={(label) => `Gameweek ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="rank"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ fill: "#dc2626", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chips Used */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Chips Used</h3>
            {chipsUsed.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {chipsUsed.map((chip) => (
                  <div key={chip.event} className=" p-3 rounded-lg">
                    <div className="font-semibold">{chip.name}</div>
                    <div className="text-sm ">Gameweek {chip.event}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="">No chips used yet this season</p>
            )}
          </div>
        </>
      ) : (
        <PremierLeagueView
          fixtures={fixtures}
          teams={teams}
          elements={elements}
          loading={loading}
        />
      )}
    </div>
  );
}

interface PremierLeagueViewProps {
  fixtures: Fixture[];
  teams: Team[];
  elements: Element[];
  loading: boolean;
}

function PremierLeagueView({
  fixtures,
  teams,
  elements,
  loading,
}: PremierLeagueViewProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-lg">Loading Premier League data...</div>
      </div>
    );
  }

  if (fixtures.length === 0 || teams.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-lg">No data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <UpcomingFixtures fixtures={fixtures} teams={teams} />
      <FixturesTable fixtures={fixtures} teams={teams} elements={elements} />
    </div>
  );
}

interface UpcomingFixturesProps {
  fixtures: Fixture[];
  teams: Team[];
}

function UpcomingFixtures({ fixtures, teams }: UpcomingFixturesProps) {
  // Find the current or next gameweek
  const nextGameweek = Math.min(
    ...fixtures
      .filter((f) => !f.finished && f.kickoff_time && f.event)
      .map((f) => f.event!)
  );

  // Get upcoming fixtures for only the current/next gameweek
  const upcomingFixtures = fixtures
    .filter((f) => !f.finished && f.kickoff_time && f.event === nextGameweek)
    .sort(
      (a, b) =>
        new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
    );

  const getTeam = (teamId: number) => {
    return teams.find((t) => t.id === teamId);
  };

  const getTeamColor = (shortName: string) => {
    const colorMap: Record<string, string> = {
      ARS: "#EF0107",
      AVL: "#95BFE5",
      BOU: "#DA291C",
      BRE: "#E30613",
      BHA: "#0057B8",
      CHE: "#034694",
      CRY: "#1B458F",
      EVE: "#003399",
      FUL: "#000000",
      IPS: "#0033A0",
      LEI: "#003090",
      LIV: "#C8102E",
      MCI: "#6CABDD",
      MUN: "#DA291C",
      NEW: "#241F20",
      NFO: "#DD0000",
      SOU: "#D71920",
      TOT: "#132257",
      WHU: "#7A263A",
      WOL: "#FDB913",
    };
    return colorMap[shortName] || "#666666";
  };

  // Group fixtures by date
  const fixturesByDate = upcomingFixtures.reduce((acc, fixture) => {
    const date = new Date(fixture.kickoff_time).toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(fixture);
    return acc;
  }, {} as Record<string, Fixture[]>);

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4 text-center">
        Gameweek {nextGameweek} Fixtures
      </h3>
      <div className="space-y-6 text-center">
        {Object.entries(fixturesByDate).map(([date, dateFixtures]) => (
          <div key={date}>
            <h4 className="text-lg font-semibold mb-3">{date}</h4>
            <div className="space-y-2">
              {dateFixtures.map((fixture) => {
                const homeTeam = getTeam(fixture.team_h);
                const awayTeam = getTeam(fixture.team_a);

                if (!homeTeam || !awayTeam) return null;

                return (
                  <div
                    key={fixture.id}
                    className="flex items-center justify-between py-3 px-4 border-b border-gray-200 dark:border-gray-700"
                  >
                    {/* Home Team */}
                    <div className="flex items-center justify-end flex-1 space-x-3">
                      <span className="font-medium text-right hidden sm:visible">
                        {homeTeam.name}
                      </span>
                      <div
                        className="w-12 h-12 rounded-md flex items-center justify-center text-white font-bold text-xs"
                        style={{
                          backgroundColor: getTeamColor(homeTeam.short_name),
                        }}
                      >
                        {homeTeam.short_name}
                      </div>
                    </div>

                    {/* Time */}
                    <div className="px-6 text-center min-w-[80px]">
                      <span className="font-semibold">
                        {new Date(fixture.kickoff_time).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }
                        )}
                      </span>
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center justify-start flex-1 space-x-3">
                      <div
                        className="w-12 h-12 rounded-md flex items-center justify-center text-white font-bold text-xs "
                        style={{
                          backgroundColor: getTeamColor(awayTeam.short_name),
                        }}
                      >
                        {awayTeam.short_name}
                      </div>
                      <span className="font-medium text-left hidden sm:visible">
                        {awayTeam.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FixturesTableProps {
  fixtures: Fixture[];
  teams: Team[];
  elements: Element[];
}

function FixturesTable({ fixtures, teams, elements }: FixturesTableProps) {
  const statsRef = useRef<HTMLTableCellElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll to show stats columns in the middle
    if (statsRef.current && tableRef.current) {
      const statsLeft = statsRef.current.offsetLeft;
      const tableWidth = tableRef.current.offsetWidth;
      const scrollPosition =
        statsLeft - tableWidth / 2 + statsRef.current.offsetWidth / 2;
      tableRef.current.scrollLeft = scrollPosition;
    }
  }, [fixtures, teams]);

  const getTeamColor = (shortName: string) => {
    const colorMap: Record<string, string> = {
      ARS: "#EF0107",
      AVL: "#95BFE5",
      BOU: "#DA291C",
      BRE: "#E30613",
      BHA: "#0057B8",
      CHE: "#034694",
      CRY: "#1B458F",
      EVE: "#003399",
      FUL: "#000000",
      IPS: "#0033A0",
      LEI: "#003090",
      LIV: "#C8102E",
      MCI: "#6CABDD",
      MUN: "#DA291C",
      NEW: "#241F20",
      NFO: "#DD0000",
      SOU: "#D71920",
      TOT: "#132257",
      WHU: "#7A263A",
      WOL: "#FDB913",
    };
    return colorMap[shortName] || "#666666";
  };

  // Find the last finished gameweek
  const lastFinishedGW = Math.max(
    0,
    ...fixtures.filter((f) => f.finished).map((f) => f.event || 0)
  );

  // Calculate team statistics
  const teamStats = teams.map((team) => {
    const teamFixtures = fixtures.filter(
      (f) => f.team_h === team.id || f.team_a === team.id
    );

    const finishedFixtures = teamFixtures.filter((f) => f.finished);

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let xgFor = 0;
    let xgAgainst = 0;
    let points = 0;

    finishedFixtures.forEach((fixture) => {
      const isHome = fixture.team_h === team.id;
      const teamScore = isHome ? fixture.team_h_score : fixture.team_a_score;
      const opponentScore = isHome
        ? fixture.team_a_score
        : fixture.team_h_score;

      if (teamScore > opponentScore) {
        wins++;
        points += 3;
      } else if (teamScore === opponentScore) {
        draws++;
        points += 1;
      } else {
        losses++;
      }

      // Calculate xG from fixture stats if available
      if (fixture.stats && Array.isArray(fixture.stats)) {
        const xgStat = fixture.stats.find(
          (s: any) => s.identifier === "expected_goals"
        );
        if (xgStat) {
          const teamXg = isHome
            ? xgStat.h?.[0]?.value || 0
            : xgStat.a?.[0]?.value || 0;
          const opponentXg = isHome
            ? xgStat.a?.[0]?.value || 0
            : xgStat.h?.[0]?.value || 0;
          xgFor += teamXg;
          xgAgainst += opponentXg;
        }
      }
    });

    // Get top scorer for team
    const teamPlayers = elements.filter((e) => e.team === team.id);
    const topScorer = teamPlayers.reduce(
      (max, player) => (player.goals_scored > max.goals_scored ? player : max),
      teamPlayers[0] || { web_name: "N/A", goals_scored: 0 }
    );

    // Calculate form (last 5 games)
    const last5 = finishedFixtures.slice(-5).map((fixture) => {
      const isHome = fixture.team_h === team.id;
      const teamScore = isHome ? fixture.team_h_score : fixture.team_a_score;
      const opponentScore = isHome
        ? fixture.team_a_score
        : fixture.team_h_score;

      if (teamScore > opponentScore) return "W";
      if (teamScore === opponentScore) return "D";
      return "L";
    });

    return {
      team,
      fixtures: teamFixtures,
      wins,
      draws,
      losses,
      xgFor: xgFor.toFixed(1),
      xgAgainst: xgAgainst.toFixed(1),
      points,
      topScorer: `${topScorer.web_name} (${topScorer.goals_scored})`,
      form: last5.join(""),
    };
  });

  // Sort teams by points
  teamStats.sort((a, b) => b.points - a.points);

  const getFixtureCell = (teamId: number, gameweek: number) => {
    const fixture = fixtures.find(
      (f) =>
        f.event === gameweek && (f.team_h === teamId || f.team_a === teamId)
    );

    if (!fixture)
      return {
        content: "-",
        bgColor: "bg-gray-100 dark:bg-gray-700",
        opponent: null,
        isHome: false,
      };

    const isHome = fixture.team_h === teamId;
    const opponent = teams.find(
      (t) => t.id === (isHome ? fixture.team_a : fixture.team_h)
    );

    if (fixture.finished) {
      const teamScore = isHome ? fixture.team_h_score : fixture.team_a_score;
      const opponentScore = isHome
        ? fixture.team_a_score
        : fixture.team_h_score;

      let bgColor = "";
      if (teamScore > opponentScore) {
        bgColor = "bg-green-200 dark:bg-green-600";
      } else if (teamScore === opponentScore) {
        bgColor = "bg-yellow-200 dark:bg-yellow-600";
      } else {
        bgColor = "bg-red-300 dark:bg-red-600";
      }

      return {
        content: `${opponent?.short_name || ""}${isHome ? " (H)" : " (A)"}`,
        score: `${teamScore}-${opponentScore}`,
        bgColor,
        opponent,
        isHome,
      };
    } else {
      // Show fixture difficulty with new colors
      const difficulty = isHome
        ? fixture.team_h_difficulty
        : fixture.team_a_difficulty;
      let bgColor = "";

      // Difficulty 1-2: Green (Easy)
      if (difficulty <= 2) {
        bgColor = "bg-[#7FD97F] dark:bg-[#7FD97F]";
      }
      // Difficulty 3: Gray (Medium)
      else if (difficulty === 3) {
        bgColor = "bg-[#E0E0E0] dark:bg-[#5A5A5A]";
      }
      // Difficulty 4-5: Red/Pink (Hard)
      else {
        bgColor = "bg-[#FF6B7A] dark:bg-[#FF6B7A]";
      }

      return {
        content: `${opponent?.short_name || ""}${isHome ? " (H)" : " (A)"}`,
        bgColor,
        opponent,
        isHome,
      };
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Fixtures & Stats</h3>
      <div ref={tableRef} className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-700">
              <th className="sticky left-0 z-10 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">
                Team
              </th>
              {/* Stats columns */}
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gradient-to-r from-cyan-100 via-green-100 to-purple-100 dark:from-cyan-900 dark:via-green-900 dark:to-purple-900">
                Top Scorer
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 bg-gradient-to-r from-cyan-100 via-green-100 to-purple-100 dark:from-cyan-900 dark:via-green-900 dark:to-purple-900">
                W
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 bg-gradient-to-r from-cyan-100 via-green-100 to-purple-100 dark:from-cyan-900 dark:via-green-900 dark:to-purple-900">
                D
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 bg-gradient-to-r from-cyan-100 via-green-100 to-purple-100 dark:from-cyan-900 dark:via-green-900 dark:to-purple-900">
                L
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 bg-gradient-to-r from-cyan-100 via-green-100 to-purple-100 dark:from-cyan-900 dark:via-green-900 dark:to-purple-900">
                Pts
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gradient-to-r from-cyan-100 via-green-100 to-purple-100 dark:from-cyan-900 dark:via-green-900 dark:to-purple-900">
                Form
              </th>
              {/* Played fixtures */}
              {Array.from({ length: lastFinishedGW }, (_, i) => i + 1).map(
                (gw) => (
                  <th
                    key={`played-${gw}`}
                    className="border border-gray-300 dark:border-gray-600 px-2 py-2 min-w-[80px]"
                  >
                    GW{gw}
                  </th>
                )
              )}
              {/* Upcoming fixtures */}
              {Array.from(
                { length: 38 - lastFinishedGW },
                (_, i) => lastFinishedGW + i + 1
              ).map((gw) => (
                <th
                  key={`upcoming-${gw}`}
                  className="border border-gray-300 dark:border-gray-600 px-2 py-2 min-w-[80px]"
                >
                  GW{gw}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamStats.map((stat, index) => (
              <tr
                key={stat.team.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-3 py-2 font-semibold">
                  {stat.team.short_name}
                </td>
                {/* Stats columns */}
                <td
                  ref={index === 0 ? statsRef : null}
                  className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs bg-gradient-to-r from-cyan-50 via-green-50 to-purple-50 dark:from-cyan-950 dark:via-green-950 dark:to-purple-950"
                >
                  {stat.topScorer}
                </td>
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center bg-gradient-to-r from-cyan-50 via-green-50 to-purple-50 dark:from-cyan-950 dark:via-green-950 dark:to-purple-950">
                  {stat.wins}
                </td>
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center bg-gradient-to-r from-cyan-50 via-green-50 to-purple-50 dark:from-cyan-950 dark:via-green-950 dark:to-purple-950">
                  {stat.draws}
                </td>
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center bg-gradient-to-r from-cyan-50 via-green-50 to-purple-50 dark:from-cyan-950 dark:via-green-950 dark:to-purple-950">
                  {stat.losses}
                </td>
                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-bold bg-gradient-to-r from-cyan-50 via-green-50 to-purple-50 dark:from-cyan-950 dark:via-green-950 dark:to-purple-950">
                  {stat.points}
                </td>
                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs bg-gradient-to-r from-cyan-50 via-green-50 to-purple-50 dark:from-cyan-950 dark:via-green-950 dark:to-purple-950">
                  {stat.form || "-"}
                </td>
                {/* Played fixtures */}
                {Array.from({ length: lastFinishedGW }, (_, i) => i + 1).map(
                  (gw) => {
                    const cell = getFixtureCell(stat.team.id, gw);
                    return (
                      <td
                        key={`played-${gw}`}
                        className={`border border-gray-300 dark:border-gray-600 px-2 py-2 ${cell.bgColor} text-center`}
                      >
                        {/* Desktop view - show full text */}
                        <div className="hidden md:block">
                          <div className="text-xs whitespace-nowrap">
                            {cell.content}
                          </div>
                          {cell.score && (
                            <div className="text-xs font-bold mt-1">
                              {cell.score}
                            </div>
                          )}
                        </div>
                        {/* Mobile view - show team badge icon */}
                        <div className="md:hidden flex flex-col items-center justify-center">
                          {cell.opponent ? (
                            <>
                              <div
                                className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[8px]"
                                style={{
                                  backgroundColor: getTeamColor(
                                    cell.opponent.short_name
                                  ),
                                }}
                              >
                                {cell.opponent.short_name}
                              </div>
                              {cell.score && (
                                <div className="text-[9px] font-bold mt-0.5">
                                  {cell.score}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs">-</span>
                          )}
                        </div>
                      </td>
                    );
                  }
                )}
                {/* Upcoming fixtures */}
                {Array.from(
                  { length: 38 - lastFinishedGW },
                  (_, i) => lastFinishedGW + i + 1
                ).map((gw) => {
                  const cell = getFixtureCell(stat.team.id, gw);
                  return (
                    <td
                      key={`upcoming-${gw}`}
                      className={`border border-gray-300 dark:border-gray-600 px-2 py-2 ${cell.bgColor} text-center`}
                    >
                      {/* Desktop view - show full text */}
                      <div className="hidden md:block">
                        <div className="text-xs whitespace-nowrap">
                          {cell.content}
                        </div>
                        {cell.score && (
                          <div className="text-xs font-bold mt-1">
                            {cell.score}
                          </div>
                        )}
                      </div>
                      {/* Mobile view - show team badge icon */}
                      <div className="md:hidden flex flex-col items-center justify-center">
                        {cell.opponent ? (
                          <>
                            <div
                              className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[8px]"
                              style={{
                                backgroundColor: getTeamColor(
                                  cell.opponent.short_name
                                ),
                              }}
                            >
                              {cell.opponent.short_name}
                            </div>
                            {cell.score && (
                              <div className="text-[9px] font-bold mt-0.5">
                                {cell.score}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs">-</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
