"use client";

import { useState, useEffect } from "react";
import { Element, Team } from "@/types/fpl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

interface TeamStatsProps {
  teams: Team[];
  elements: Element[];
  setHoveredTeam: any;
}

// Add this interface for fixture data
interface Fixture {
  id: number;
  team_h: number;
  team_a: number;
  team_h_score: number;
  team_a_score: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  event: number;
  finished: boolean;
}

// Strength Tooltip Component
const StrengthTooltip = ({
  team,
  isVisible,
  setHoveredTeam,
}: {
  team: {
    name: string;
    strength: number;
    strength_overall_home: number;
    strength_overall_away: number;
    strength_attack_home: number;
    strength_attack_away: number;
    strength_defence_home: number;
    strength_defence_away: number;
  };
  isVisible: boolean;
  setHoveredTeam: any;
}) => {
  if (!isVisible) return null;

  const getStrengthColor = (value: number) => {
    if (value >= 1300) return "text-green-600 font-semibold";
    if (value >= 1200) return "text-green-500";
    if (value >= 1100) return "text-yellow-600";
    if (value >= 1000) return "text-orange-500";
    if (value == 5) return "text-green-600 font-semibold";
    if (value == 4) return "text-green-200";
    if (value == 3) return "text-green-500";
    if (value == 2) return "text-orange-500";
    return "text-red-500";
  };

  const getStrengthLabel = (value: number) => {
    if (value >= 1300) return "Excellent";
    if (value >= 1200) return "Strong";
    if (value >= 1100) return "Average";
    if (value >= 1000) return "Below Avg";
    if (value == 5) return "Top Tier";
    if (value == 4) return "Above Avg";
    if (value == 3) return "Average";
    if (value == 2) return "Below Avg";
    return "Weak";
  };

  const StrengthBar = ({
    value,
    max = 1500,
  }: {
    value: number;
    max?: number;
  }) => {
    const percentage = (value / max) * 100;
    return (
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            value >= 1300
              ? "bg-green-600"
              : value >= 1200
              ? "bg-green-500"
              : value >= 1100
              ? "bg-yellow-500"
              : value >= 1000
              ? "bg-orange-600"
              : value == 5
              ? "bg-green-600"
              : value == 4
              ? "bg-green-300"
              : value == 3
              ? "bg-yellow-500"
              : value == 2
              ? "bg-orange-500"
              : "bg-red-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      onMouseEnter={() => setHoveredTeam(team)}
      onMouseLeave={() => setHoveredTeam(null)}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 min-w-[280px] pointer-events-auto">
        <div className="mb-3 pb-2 border-b border-gray-200">
          <div className="flex items-center justify-between mb-1 flex-col">
            <h2> {team.name}</h2>
            <span className="text-sm font-semibold text-gray-700">
              Overall Strength
            </span>
            <span
              className={`text-lg font-bold ${getStrengthColor(team.strength)}`}
            >
              {team.strength}
            </span>
          </div>
          <div className="text-xs text-gray-500 mb-2">
            {getStrengthLabel(team.strength)}
          </div>
          <StrengthBar value={team.strength} max={5} />
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-2">
              Home Performance
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Overall</span>
                <span
                  className={`font-semibold ${getStrengthColor(
                    team.strength_overall_home
                  )}`}
                >
                  {team.strength_overall_home}
                </span>
              </div>
              <StrengthBar value={team.strength_overall_home} />

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Attack</span>
                <span
                  className={`font-semibold ${getStrengthColor(
                    team.strength_attack_home
                  )}`}
                >
                  {team.strength_attack_home}
                </span>
              </div>
              <StrengthBar value={team.strength_attack_home} />

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Defence</span>
                <span
                  className={`font-semibold ${getStrengthColor(
                    team.strength_defence_home
                  )}`}
                >
                  {team.strength_defence_home}
                </span>
              </div>
              <StrengthBar value={team.strength_defence_home} />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-600 mb-2">
              Away Performance
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Overall</span>
                <span
                  className={`font-semibold ${getStrengthColor(
                    team.strength_overall_away
                  )}`}
                >
                  {team.strength_overall_away}
                </span>
              </div>
              <StrengthBar value={team.strength_overall_away} />

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Attack</span>
                <span
                  className={`font-semibold ${getStrengthColor(
                    team.strength_attack_away
                  )}`}
                >
                  {team.strength_attack_away}
                </span>
              </div>
              <StrengthBar value={team.strength_attack_away} />

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Defence</span>
                <span
                  className={`font-semibold ${getStrengthColor(
                    team.strength_defence_away
                  )}`}
                >
                  {team.strength_defence_away}
                </span>
              </div>
              <StrengthBar value={team.strength_defence_away} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function TeamStats({ teams, elements }: TeamStatsProps) {
  const [sortBy, setSortBy] = useState<
    | "position"
    | "total_points"
    | "goals_scored"
    | "goals_conceded"
    | "clean_sheets"
  >("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<
    "table" | "performance" | "efficiency" | "strength" | "form"
  >("table");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [hoveredTeam, setHoveredTeam] = useState<any | null>(null);
  // Fetch fixtures when component mounts
  useEffect(() => {
    const fetchFixtures = async () => {
      try {
        const response = await fetch("/api/fixtures");
        const fixtureData = await response.json();
        setFixtures(fixtureData);
      } catch (error) {
        console.error("Failed to fetch fixtures:", error);
      }
    };

    fetchFixtures();
  }, []);

  // Calculate team statistics
  const getTeamStats = () => {
    return teams.map((team) => {
      const teamPlayers = elements.filter(
        (element) => element.team === team.id
      );

      const totalPoints = teamPlayers.reduce(
        (sum, player) => sum + player.total_points,
        0
      );
      const assists = teamPlayers.reduce(
        (sum, player) => sum + player.assists,
        0
      );
      const cleanSheets = teamPlayers.reduce(
        (max, player) =>
          player.clean_sheets > max ? player.clean_sheets : max,
        0
      );
      const yellowCards = teamPlayers.reduce(
        (sum, player) => sum + player.yellow_cards,
        0
      );
      const redCards = teamPlayers.reduce(
        (sum, player) => sum + player.red_cards,
        0
      );

      // Calculate actual goals scored and conceded from fixtures
      const finishedFixtures = fixtures.filter((f) => f.finished);
      let goalsScored = 0;
      let goalsConceded = 0;

      finishedFixtures.forEach((fixture) => {
        if (fixture.team_h === team.id) {
          // Team played at home
          goalsScored += fixture.team_h_score || 0;
          goalsConceded += fixture.team_a_score || 0;
        } else if (fixture.team_a === team.id) {
          // Team played away
          goalsScored += fixture.team_a_score || 0;
          goalsConceded += fixture.team_h_score || 0;
        }
      });

      return {
        id: team.id,
        name: team.name,
        short_name: team.short_name,
        position: team.position,
        total_points: totalPoints,
        goals_scored: goalsScored,
        assists: assists,
        clean_sheets: cleanSheets,
        goals_conceded: goalsConceded,
        yellow_cards: yellowCards,
        red_cards: redCards,
        strength: team.strength,
        strength_overall_home: team.strength_overall_home,
        strength_overall_away: team.strength_overall_away,
        strength_attack_home: team.strength_attack_home,
        strength_attack_away: team.strength_attack_away,
        strength_defence_home: team.strength_defence_home,
        strength_defence_away: team.strength_defence_away,
      };
    });
  };

  // Get fixture difficulty color
  const getDifficultyColor = (difficulty: number) => {
    switch (difficulty) {
      case 1:
        return "bg-green-500"; // Very easy
      case 2:
        return "bg-green-300"; // Easy
      case 3:
        return "bg-yellow-300"; // Moderate
      case 4:
        return "bg-orange-400"; // Hard
      case 5:
        return "bg-red-500"; // Very hard
      default:
        return "bg-gray-300";
    }
  };

  // Get next 5 fixtures for a team
  const getNext5Fixtures = (teamId: number) => {
    const upcomingFixtures = fixtures
      .filter(
        (fixture) =>
          !fixture.finished &&
          (fixture.team_h === teamId || fixture.team_a === teamId)
      )
      .sort((a, b) => a.event - b.event)
      .slice(0, 5);

    return upcomingFixtures.map((fixture) => {
      const isHome = fixture.team_h === teamId;
      const opponentId = isHome ? fixture.team_a : fixture.team_h;
      const opponent = teams.find((team) => team.id === opponentId);
      const difficulty = isHome
        ? fixture.team_h_difficulty
        : fixture.team_a_difficulty;

      return {
        opponent: opponent?.short_name || "TBD",
        isHome,
        difficulty,
        gameweek: fixture.event,
      };
    });
  };

  const teamStats = getTeamStats();

  const sortedTeamStats = [...teamStats].sort((a, b) => {
    let aValue: number, bValue: number;

    switch (sortBy) {
      case "position":
        // Sort by actual league position from API
        aValue = a.position;
        bValue = b.position;
        break;
      case "total_points":
        aValue = a.total_points;
        bValue = b.total_points;
        break;
      case "goals_scored":
        aValue = a.goals_scored;
        bValue = b.goals_scored;
        break;
      case "goals_conceded":
        aValue = a.goals_conceded;
        bValue = b.goals_conceded;
        break;
      case "clean_sheets":
        aValue = a.clean_sheets;
        bValue = b.clean_sheets;
        break;
      default:
        aValue = 0;
        bValue = 0;
    }

    return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
  });

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("desc");
    }
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: typeof sortBy;
    children: React.ReactNode;
  }) => (
    <th
      className="text-center py-2 cursor-pointer px-1 hover:bg-gray-100"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        {sortBy === field && (
          <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>
        )}
      </div>
    </th>
  );

  // Prepare various chart data
  const performanceData = sortedTeamStats.map((team) => ({
    name: team.short_name,
    "Total Points": team.total_points,
    "Goals Scored": team.goals_scored,
    Assists: team.assists,
    "Clean Sheets": team.clean_sheets,
  }));

  const efficiencyData = sortedTeamStats.map((team) => ({
    name: team.short_name,
    "Goals Scored": team.goals_scored,
    "Goals Conceded": team.goals_conceded,
    "Goal Difference": team.goals_scored - team.goals_conceded,
    "Clean Sheets": team.clean_sheets,
  }));

  const strengthRadarData = sortedTeamStats.slice(0, 20).map((team) => ({
    team: team.short_name,
    "Attack Home": team.strength_attack_home,
    "Attack Away": team.strength_attack_away,
    "Defence Home": team.strength_defence_home,
    "Defence Away": team.strength_defence_away,
    Overall: team.strength,
  }));

  const formData = sortedTeamStats.map((team) => ({
    name: team.short_name,
    position: team.position,
    points: team.total_points / 25,
    goals: team.goals_scored,
  }));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 flex justify-center">
        Team Stats & Analysis
      </h2>

      {/* View Mode Toggle */}
      <div className="mb-6">
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-2 rounded-md font-medium text-sm ${
              viewMode === "table"
                ? "text-white bg-green-600"
                : "text-gray-700 bg-gray-100"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode("performance")}
            className={`px-3 py-2 rounded-md font-medium text-sm ${
              viewMode === "performance"
                ? "text-white bg-green-600"
                : "text-gray-700 bg-gray-100"
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setViewMode("efficiency")}
            className={`px-3 py-2 rounded-md font-medium text-sm ${
              viewMode === "efficiency"
                ? "text-white bg-green-600"
                : "text-gray-700 bg-gray-100"
            }`}
          >
            Efficiency
          </button>
          <button
            onClick={() => setViewMode("strength")}
            className={`px-3 py-2 rounded-md font-medium text-sm ${
              viewMode === "strength"
                ? "text-white bg-green-600"
                : "text-gray-700 bg-gray-100"
            }`}
          >
            Strength
          </button>
          <button
            onClick={() => setViewMode("form")}
            className={`px-3 py-2 rounded-md font-medium text-sm ${
              viewMode === "form"
                ? "text-white bg-green-600"
                : "text-gray-700 bg-gray-100"
            }`}
          >
            Form Analysis
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "performance" ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-center">
              Team Performance Overview
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Total Points" fill="#3b82f6" />
                  <Bar dataKey="Goals Scored" fill="#ef4444" />
                  <Bar dataKey="Assists" fill="#22c55e" />
                  <Bar dataKey="Clean Sheets" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : viewMode === "efficiency" ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-center">
              Offensive vs Defensive Efficiency
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={efficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Goals Scored"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e"
                  />
                  <Area
                    type="monotone"
                    dataKey="Goals Conceded"
                    stackId="2"
                    stroke="#ef4444"
                    fill="#ef4444"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-center">
              Goal Difference Distribution
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={efficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Goal Difference" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : viewMode === "strength" ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-center">
              Team Strength Comparison
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {strengthRadarData.map((teamData) => (
                <div key={teamData.team} className="h-80">
                  <h4 className="text-center font-medium mb-2">
                    {teamData.team}
                  </h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={[
                        { stat: "Attack Home", value: teamData["Attack Home"] },
                        { stat: "Attack Away", value: teamData["Attack Away"] },
                        {
                          stat: "Defence Home",
                          value: teamData["Defence Home"],
                        },
                        {
                          stat: "Defence Away",
                          value: teamData["Defence Away"],
                        },
                        { stat: "Overall", value: teamData["Overall"] * 275 },
                      ]}
                    >
                      <PolarGrid />
                      <PolarAngleAxis dataKey="stat" />
                      <PolarRadiusAxis angle={90} domain={[0, 1400]} />
                      <Radar
                        name={teamData.team}
                        dataKey="value"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.6}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : viewMode === "form" ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-center">
              League Position vs Points per player
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="position"
                    name="Position"
                    reversed
                    domain={[1, 20]}
                  />
                  <YAxis type="number" dataKey="points" name="Points" />
                  <ZAxis type="number" dataKey="goals" range={[50, 400]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Legend />
                  <Scatter name="Teams" data={formData} fill="#3b82f6" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-center">
              Points Progression
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="points"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="goals"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* Stats Table */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <SortableHeader field="position">Position</SortableHeader>
                <th className="text-center py-2 px-3">Team</th>
                <SortableHeader field="total_points">
                  Total Points
                </SortableHeader>
                <SortableHeader field="goals_scored">Goals</SortableHeader>
                <th className="text-center py-2 px-3">Assists</th>
                <SortableHeader field="clean_sheets">
                  Clean Sheets
                </SortableHeader>
                <SortableHeader field="goals_conceded">
                  Goals Conceded
                </SortableHeader>
                <th className="text-center py-2 px-3">Strength</th>
                <th className="text-center py-2 px-1">Next 5 Fixtures</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeamStats.map((team) => {
                const nextFixtures = getNext5Fixtures(team.id);

                return (
                  <tr
                    key={team.id}
                    className="border-b hover:bg-gray-50 transition-colors"
                    onMouseEnter={() => setHoveredTeam(team)}
                    onMouseLeave={() => {
                      setHoveredTeam(null);
                    }}
                  >
                    <td className="py-3 text-center font-semibold">
                      {team.position}
                    </td>
                    <td className="py-3 text-center font-medium">
                      {team.short_name}
                    </td>
                    <td className="py-3 text-center font-semibold">
                      {team.total_points}
                    </td>
                    <td className="py-3 text-center">{team.goals_scored}</td>
                    <td className="py-3 text-center">{team.assists}</td>
                    <td className="py-3 text-center">{team.clean_sheets}</td>
                    <td className="py-3 text-center">{team.goals_conceded}</td>
                    <td className="py-3 text-center cursor-pointer hover:bg-blue-50 transition-colors">
                      <div className="text-xs">
                        <div className="font-semibold text-blue-600">
                          {team.strength}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex gap-3 justify-center flex-row">
                        {nextFixtures.map((fixture, index) => (
                          <div
                            key={index}
                            className={`flex flex-1 px-2 py-1 rounded text-xs font-medium text-white justify-center ${getDifficultyColor(
                              fixture.difficulty
                            )}`}
                            title={`GW${fixture.gameweek}: ${
                              fixture.isHome ? "vs" : "@"
                            } ${fixture.opponent} (Difficulty: ${
                              fixture.difficulty
                            })`}
                          >
                            {fixture.isHome ? "vs" : "@"} {fixture.opponent}
                          </div>
                        ))}
                        {/* Fill empty slots if less than 5 fixtures */}
                        {Array.from({ length: 5 - nextFixtures.length }).map(
                          (_, index) => (
                            <div
                              key={`empty-${index}`}
                              className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-500"
                            >
                              TBD
                            </div>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Strength Tooltip */}
      {hoveredTeam && (
        <StrengthTooltip
          team={hoveredTeam}
          isVisible={true}
          setHoveredTeam={setHoveredTeam}
        />
      )}
    </div>
  );
}
