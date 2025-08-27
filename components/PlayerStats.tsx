"use client";

import { useState, useEffect } from "react";
import { Element, Team, ElementType } from "@/types/fpl";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface PlayerStatsProps {
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
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

export default function PlayerStats({
  elements,
  teams,
  elementTypes,
}: PlayerStatsProps) {
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<
    "total_points" | "form" | "now_cost" | "ict_index"
  >("total_points");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [chartType, setChartType] = useState<"scatter" | "bar" | "comparison">(
    "scatter"
  );
  const [topX, setTopX] = useState(20);
  const [xAxisStat, setXAxisStat] = useState<keyof Element>("now_cost");
  const [yAxisStat, setYAxisStat] = useState<keyof Element>("total_points");
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

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  const filteredAndSortedElements = elements
    .filter((element) => {
      const matchesPosition =
        selectedPosition === null || element.element_type === selectedPosition;
      const matchesTeam =
        selectedTeam === null || element.team === selectedTeam;
      const matchesSearch =
        searchTerm === "" ||
        element.web_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        element.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        element.second_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPosition && matchesTeam && matchesSearch;
    })
    .sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortBy) {
        case "total_points":
          aValue = a.total_points;
          bValue = b.total_points;
          break;
        case "form":
          aValue = parseFloat(a.form) || 0;
          bValue = parseFloat(b.form) || 0;
          break;
        case "now_cost":
          aValue = a.now_cost;
          bValue = b.now_cost;
          break;
        case "ict_index":
          aValue = parseFloat(a.ict_index) || 0;
          bValue = parseFloat(b.ict_index) || 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
    })
    .slice(0, topX === 9999 ? elements.length : Math.max(topX, 50)); // Dynamic limit based on topX

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
      className="text-center py-2 cursor-pointer px-1 hover:"
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

  // Available stats for visualization
  const availableStats = [
    { key: "total_points", label: "Total Points" },
    { key: "goals_scored", label: "Goals" },
    { key: "assists", label: "Assists" },
    { key: "now_cost", label: "Price (£m)" },
    { key: "minutes", label: "Minutes" },
    { key: "clean_sheets", label: "Clean Sheets" },
    { key: "bonus", label: "Bonus Points" },
    { key: "bps", label: "BPS" },
    { key: "saves", label: "Saves" },
    { key: "yellow_cards", label: "Yellow Cards" },
    { key: "red_cards", label: "Red Cards" },
  ] as const;

  // Prepare chart data with proper sorting
  const getChartData = () => {
    const limit = topX === 9999 ? filteredAndSortedElements.length : topX;
    const selectedPlayers = filteredAndSortedElements.slice(0, limit);

    const chartData = selectedPlayers.map((element) => {
      const team = getTeam(element.team);
      const position = getPosition(element.element_type);

      return {
        name: element.web_name,
        fullName: `${element.first_name} ${element.second_name}`,
        team: team?.short_name,
        position: position?.singular_name_short,
        total_points: element.total_points,
        goals_scored: element.goals_scored,
        assists: element.assists,
        now_cost: element.now_cost / 10, // Convert to millions
        minutes: element.minutes,
        clean_sheets: element.clean_sheets,
        bonus: element.bonus,
        bps: element.bps,
        saves: element.saves,
        yellow_cards: element.yellow_cards,
        red_cards: element.red_cards,
        form: parseFloat(element.form) || 0,
        ict_index: parseFloat(element.ict_index) || 0,
        selected_by_percent: parseFloat(element.selected_by_percent) || 0,
      };
    });

    // Sort chart data based on the chart type and selected axes
    if (chartType === "scatter") {
      // For scatter plots, sort by Y-axis first (descending), then by X-axis (ascending)
      const sorted = chartData.sort((a, b) => {
        const aYValue = a[yAxisStat as keyof typeof a] as number;
        const bYValue = b[yAxisStat as keyof typeof b] as number;

        // Primary sort: Y-axis (descending - highest performers first)
        if (bYValue !== aYValue) {
          return bYValue - aYValue;
        }

        // Secondary sort: X-axis (ascending - for ties in Y-axis)
        const aXValue = a[xAxisStat as keyof typeof a] as number;
        const bXValue = b[xAxisStat as keyof typeof b] as number;
        return aXValue - bXValue;
      });
      console.log(
        `Scatter chart sorted by ${yAxisStat} then ${xAxisStat}:`,
        sorted
          .slice(0, 5)
          .map(
            (p) =>
              `${p.name}: ${p[yAxisStat as keyof typeof p]} pts, ${
                p[xAxisStat as keyof typeof p]
              } ${xAxisStat === "now_cost" ? "£m" : ""}`
          )
      );
      return sorted;
    } else if (chartType === "bar") {
      // For bar charts, sort by the selected statistic (descending - highest first)
      const sorted = chartData.sort((a, b) => {
        const aValue = a[xAxisStat as keyof typeof a] as number;
        const bValue = b[xAxisStat as keyof typeof b] as number;
        return bValue - aValue; // Descending order (highest first)
      });
      console.log(
        `Bar chart sorted by ${xAxisStat}:`,
        sorted
          .slice(0, 5)
          .map((p) => `${p.name}: ${p[xAxisStat as keyof typeof p]}`)
      );
      return sorted;
    } else {
      // For other charts (comparison), sort by total points descending
      return chartData.sort((a, b) => b.total_points - a.total_points);
    }
  };

  const chartData = getChartData();

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold">{data.fullName}</p>
          <p className="text-sm text-gray-600">
            {data.team} - {data.position}
          </p>
          <p className="text-sm">{`${
            availableStats.find((s) => s.key === xAxisStat)?.label
          }: ${data[xAxisStat]}`}</p>
          <p className="text-sm">{`${
            availableStats.find((s) => s.key === yAxisStat)?.label
          }: ${data[yAxisStat]}`}</p>
          <p className="text-sm">{`Total Points: ${data.total_points}`}</p>
        </div>
      );
    }
    return null;
  };

  const renderVisualization = () => {
    switch (chartType) {
      case "scatter":
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={xAxisStat}
                  name={availableStats.find((s) => s.key === xAxisStat)?.label}
                />
                <YAxis
                  dataKey={yAxisStat}
                  name={availableStats.find((s) => s.key === yAxisStat)?.label}
                />
                <Tooltip content={<CustomTooltip />} />
                <Scatter
                  dataKey={yAxisStat}
                  fill="#3b82f6"
                  stroke="#1d4ed8"
                  strokeWidth={1}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );

      case "bar":
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={xAxisStat} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case "comparison":
        return (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="goals_scored" fill="#ef4444" name="Goals" />
                <Bar dataKey="assists" fill="#22c55e" name="Assists" />
                <Bar
                  dataKey="clean_sheets"
                  fill="#3b82f6"
                  name="Clean Sheets"
                />
                <Bar dataKey="bonus" fill="#f59e0b" name="Bonus" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className=" p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 flex justify-center">
        Player Stats & Visualizations
      </h2>

      {/* View Mode Toggle */}
      <div className="mb-6">
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 rounded-md font-medium ${
              viewMode === "table"
                ? " text-white bg-green-600"
                : " text-gray-700"
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`px-3 rounded-md font-medium ${
              viewMode === "chart"
                ? "text-white bg-green-600"
                : " text-gray-700"
            }`}
          >
            Chart View
          </button>
        </div>
      </div>

      {/* Chart Controls */}
      {viewMode === "chart" && (
        <div className="mb-6 p-4 bg-green-500 rounded-lg ">
          <div className="flex justify-center flex-col sm:flex-row gap-x-24 gap-y-2">
            <div className="text-center">
              <label className="block text-sm font-medium mb-2">
                Chart Type
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="scatter">Season Scatter Plot</option>
                <option value="bar">Season Bar Chart</option>
                <option value="comparison">Multi-Stat Comparison</option>
              </select>
            </div>

            <div className="text-center">
              <label className="block text-sm font-medium mb-2">
                Player Limit
              </label>
              <select
                value={topX}
                onChange={(e) => setTopX(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={100}>Top 100</option>
                <option value={9999}>All Players</option>
              </select>
            </div>

            {(chartType === "scatter" || chartType === "bar") && (
              <>
                <div className="text-center">
                  <label className="block text-sm font-medium mb-2">
                    {chartType === "scatter" ? "X-Axis" : "Statistic"}
                  </label>
                  <select
                    value={xAxisStat}
                    onChange={(e) =>
                      setXAxisStat(e.target.value as keyof Element)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableStats.map((stat) => (
                      <option key={stat.key} value={stat.key}>
                        {stat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {chartType === "scatter" && (
                  <div className="text-center">
                    <label className="block text-sm font-medium mb-2">
                      Y-Axis
                    </label>
                    <select
                      value={yAxisStat}
                      onChange={(e) =>
                        setYAxisStat(e.target.value as keyof Element)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {availableStats.map((stat) => (
                        <option key={stat.key} value={stat.key}>
                          {stat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-x-12 gap-y-2 items-center flex-col sm:flex-row justify-center">
        <div className="">
          <select
            value={selectedPosition || ""}
            onChange={(e) =>
              setSelectedPosition(
                e.target.value ? parseInt(e.target.value) : null
              )
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
          >
            <option value="">All Positions</option>
            {elementTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.plural_name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-fit">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by player name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="">
          <select
            value={selectedTeam || ""}
            onChange={(e) =>
              setSelectedTeam(e.target.value ? parseInt(e.target.value) : null)
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
          >
            <option value="">All Teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.short_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {viewMode === "chart" ? (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {chartType === "scatter" &&
              `Season: ${
                availableStats.find((s) => s.key === xAxisStat)?.label
              } vs ${availableStats.find((s) => s.key === yAxisStat)?.label}`}
            {chartType === "bar" &&
              `Season: ${topX === 9999 ? "All" : `Top ${topX}`} Players - ${
                availableStats.find((s) => s.key === xAxisStat)?.label
              }`}
            {chartType === "comparison" &&
              `Season: Multi-Stat Comparison - ${
                topX === 9999 ? "All" : `Top ${topX}`
              } Players`}
          </h3>
          {renderVisualization()}
        </div>
      ) : (
        /* Stats Table */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-center py-2 px-3">Player</th>
                <th className="text-center py-2 px-3">Team</th>
                <th className="text-center py-2 px-3">Pos</th>
                <SortableHeader field="total_points">Points</SortableHeader>
                <SortableHeader field="form">Form</SortableHeader>
                <SortableHeader field="now_cost">Price</SortableHeader>
                <SortableHeader field="ict_index">ICT</SortableHeader>
                <th className="text-center py-2 text-nowrap px-3">
                  Selected %
                </th>
                <th className="text-center py-2 px-1">Next 5 Fixtures</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedElements.map((element) => {
                const team = getTeam(element.team);
                const position = getPosition(element.element_type);
                const nextFixtures = getNext5Fixtures(element.team);

                return (
                  <tr key={element.id} className="border-b">
                    <td className="py-3 text-center">
                      <div>
                        <div className="font-medium">{element.web_name}</div>
                        <div className="text-xs ">{element.first_name}</div>
                      </div>
                    </td>
                    <td className="py-3 text-center">{team?.short_name}</td>
                    <td className="py-3 text-center">
                      {position?.singular_name_short}
                    </td>
                    <td className="py-3 font-semibold text-center">
                      {element.total_points}
                    </td>
                    <td className="py-3 text-center">{element.form}</td>
                    <td className="py-3 text-center">
                      £{(element.now_cost / 10).toFixed(1)}m
                    </td>
                    <td className="py-3 text-center">{element.ict_index}</td>
                    <td className="py-3 text-center">
                      {element.selected_by_percent}%
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

      {filteredAndSortedElements.length === 0 && (
        <div className="text-center py-8 ">
          No players found matching your criteria
        </div>
      )}
    </div>
  );
}
