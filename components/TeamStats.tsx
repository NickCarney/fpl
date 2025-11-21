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
} from "recharts";

interface TeamStatsProps {
  teams: Team[];
  elements: Element[];
}

// Add this interface for fixture data
interface Fixture {
  id: number;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  event: number;
  finished: boolean;
}

export default function TeamStats({ teams, elements }: TeamStatsProps) {
  const [sortBy, setSortBy] = useState<
    | "position"
    | "total_points"
    | "goals_scored"
    | "goals_conceded"
    | "clean_sheets"
  >("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

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
      const teamPlayers = elements.filter((element) => element.team === team.id);

      const totalPoints = teamPlayers.reduce(
        (sum, player) => sum + player.total_points,
        0
      );
      const goalsScored = teamPlayers.reduce(
        (sum, player) => sum + player.goals_scored,
        0
      );
      const assists = teamPlayers.reduce(
        (sum, player) => sum + player.assists,
        0
      );
      const cleanSheets = teamPlayers.reduce(
        (sum, player) => sum + player.clean_sheets,
        0
      );
      const goalsConceded = teamPlayers.reduce(
        (sum, player) => sum + player.goals_conceded,
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

  const chartData = sortedTeamStats.map((team) => ({
    name: team.short_name,
    "Total Points": team.total_points,
    "Goals Scored": team.goals_scored,
    Assists: team.assists,
    "Clean Sheets": team.clean_sheets,
  }));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 flex justify-center">
        Team Stats & Analysis
      </h2>

      {/* View Mode Toggle */}
      <div className="mb-6">
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 rounded-md font-medium ${
              viewMode === "table"
                ? "text-white bg-green-600"
                : "text-gray-700"
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`px-3 rounded-md font-medium ${
              viewMode === "chart"
                ? "text-white bg-green-600"
                : "text-gray-700"
            }`}
          >
            Chart View
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "chart" ? (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 text-center">
            Team Performance Comparison
          </h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
      ) : (
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
              {sortedTeamStats.map((team, index) => {
                const nextFixtures = getNext5Fixtures(team.id);

                return (
                  <tr
                    key={team.id}
                    className="border-b hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 text-center font-semibold">{team.position}</td>
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
                    <td className="py-3 text-center">
                      <div className="text-xs">
                        <div>Overall: {team.strength}</div>
                        <div className="text-gray-600">
                          H: {team.strength_overall_home} / A:{" "}
                          {team.strength_overall_away}
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
      )}
    </div>
  );
}
