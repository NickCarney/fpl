"use client";

import { useState, useEffect } from "react";
import { Element, Team, ElementType } from "@/types/fpl";
import PlayerDetailPopup from "./PlayerDetailPopup";
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

// Filter interface
interface PlayerFilter {
  id: string;
  stat: keyof Element | "now_cost";
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  value: number | "";
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
  const [selectedPlayer, setSelectedPlayer] = useState<{
    player: Element;
    team: Team;
    position: ElementType;
  } | null>(null);
  const [filters, setFilters] = useState<PlayerFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);

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

  const handlePlayerClick = (element: Element) => {
    const team = getTeam(element.team);
    const position = getPosition(element.element_type);

    if (team && position) {
      setSelectedPlayer({ player: element, team, position });
    }
  };

  const closePopup = () => {
    setSelectedPlayer(null);
  };

  // Filter management functions
  const addFilter = () => {
    const newFilter: PlayerFilter = {
      id: Date.now().toString(),
      stat: "total_points",
      operator: "gte",
      value: "",
    };
    setFilters([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, field: keyof PlayerFilter, value: any) => {
    setFilters(
      filters.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
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

      // Apply custom filters
      const matchesCustomFilters = filters.every((filter) => {
        // Skip filter if value is empty
        if (filter.value === "") {
          return true;
        }

        let elementValue = element[filter.stat as keyof Element];

        // Handle price - divide by 10 to get actual price
        if (filter.stat === "now_cost") {
          elementValue = (elementValue as number) / 10;
        }

        const value =
          typeof elementValue === "string"
            ? parseFloat(elementValue)
            : (elementValue as number);

        switch (filter.operator) {
          case "gt":
            return value > filter.value;
          case "lt":
            return value < filter.value;
          case "eq":
            return value === filter.value;
          case "gte":
            return value >= filter.value;
          case "lte":
            return value <= filter.value;
          default:
            return true;
        }
      });

      return (
        matchesPosition && matchesTeam && matchesSearch && matchesCustomFilters
      );
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
      //console.log(
      //   `Scatter chart sorted by ${yAxisStat} then ${xAxisStat}:`,
      //   sorted
      //     .slice(0, 5)
      //     .map(
      //       (p) =>
      //         `${p.name}: ${p[yAxisStat as keyof typeof p]} pts, ${
      //           p[xAxisStat as keyof typeof p]
      //         } ${xAxisStat === "now_cost" ? "£m" : ""}`
      //     )
      // );
      return sorted;
    } else if (chartType === "bar") {
      // For bar charts, sort by the selected statistic (descending - highest first)
      const sorted = chartData.sort((a, b) => {
        const aValue = a[xAxisStat as keyof typeof a] as number;
        const bValue = b[xAxisStat as keyof typeof b] as number;
        return bValue - aValue; // Descending order (highest first)
      });
      //console.log(
      //   `Bar chart sorted by ${xAxisStat}:`,
      //   sorted
      //     .slice(0, 5)
      //     .map((p) => `${p.name}: ${p[xAxisStat as keyof typeof p]}`)
      // );
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
        <div className="p-3 border border-gray-300 rounded-lg shadow-lg bg-[#fdf6e0]">
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
                <Tooltip
                  content={<CustomTooltip />}
                  active={true}
                  wrapperStyle={{ pointerEvents: "auto" }}
                />
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
                <Tooltip
                  content={<CustomTooltip />}
                  active={true}
                  wrapperStyle={{ pointerEvents: "auto" }}
                />
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
    <div>
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
        <div className="mb-6 p-4 rounded-lg no-gradient-border">
          <div className="flex justify-center flex-col sm:flex-row gap-x-24 gap-y-2">
            <div className="text-center input-gradient-wrapper">
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

            <div className="text-center input-gradient-wrapper">
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
                <div className="text-center input-gradient-wrapper">
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
                  <div className="text-center input-gradient-wrapper">
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

      {/* Advanced Find Player Section */}
      <div className="mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>Find Players</span>
          <span className="text-sm">{showFilters ? "▲" : "▼"}</span>
        </button>

        {showFilters && (
          <div className="mt-4 p-4 border border-gray-300 rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Find Players By Stats</h3>
              <button
                onClick={addFilter}
                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                + Add Filter
              </button>
            </div>

            {filters.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">
                No filters applied. Click &quot;Add Filter&quot; to start
                filtering players.
              </p>
            ) : (
              <div className="space-y-3">
                {filters.map((filter) => (
                  <div
                    key={filter.id}
                    className="bg-white p-4 rounded-md border border-gray-200 shadow-sm"
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Stat Selection - Takes more space */}
                      <div className="col-span-5">
                        <select
                          value={filter.stat}
                          onChange={(e) =>
                            updateFilter(filter.id, "stat", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all hover:border-blue-400 appearance-none cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                            backgroundPosition: "right 0.5rem center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "1.5em 1.5em",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <option value="total_points">Total Points</option>
                          <option value="goals_scored">Goals</option>
                          <option value="assists">Assists</option>
                          <option value="now_cost">Price</option>
                          <option value="minutes">Minutes</option>
                          <option value="clean_sheets">Clean Sheets</option>
                          <option value="bonus">Bonus Points</option>
                          <option value="bps">BPS</option>
                          <option value="saves">Saves</option>
                          <option value="yellow_cards">Yellow Cards</option>
                          <option value="red_cards">Red Cards</option>
                          <option value="form">Form</option>
                          <option value="ict_index">ICT Index</option>
                          <option value="selected_by_percent">
                            Selected %
                          </option>
                        </select>
                      </div>

                      {/* Operator Selection */}
                      <div className="col-span-3">
                        <select
                          value={filter.operator}
                          onChange={(e) =>
                            updateFilter(filter.id, "operator", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all hover:border-blue-400 appearance-none cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                            backgroundPosition: "right 0.5rem center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "1.5em 1.5em",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <option value="gte">≥ Greater or equal</option>
                          <option value="lte">≤ Less or equal</option>
                          <option value="gt">&gt; Greater than</option>
                          <option value="lt">&lt; Less than</option>
                          <option value="eq">= Equal to</option>
                        </select>
                      </div>

                      {/* Value Input */}
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={filter.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateFilter(
                              filter.id,
                              "value",
                              val === "" ? "" : parseFloat(val)
                            );
                          }}
                          step={
                            filter.stat === "now_cost"
                              ? 0.1
                              : filter.stat === "form" ||
                                filter.stat === "ict_index" ||
                                filter.stat === "selected_by_percent"
                              ? 0.1
                              : 1
                          }
                          placeholder="Enter value"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all hover:border-blue-400"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => removeFilter(filter.id)}
                          className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                          title="Remove filter"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-x-12 gap-y-2 items-center flex-col sm:flex-row justify-center">
        <div className="input-gradient-wrapper">
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

        <div className="w-fit input-gradient-wrapper">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by player name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="input-gradient-wrapper">
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
                  <tr
                    key={element.id}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handlePlayerClick(element)}
                  >
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

      {/* Help text */}
      {viewMode === "table" && filteredAndSortedElements.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Click on any player to view detailed statistics
        </div>
      )}

      {/* Player Detail Popup */}
      {selectedPlayer && (
        <PlayerDetailPopup
          player={selectedPlayer.player}
          team={selectedPlayer.team}
          position={selectedPlayer.position}
          teams={teams}
          isOpen={!!selectedPlayer}
          onClose={closePopup}
        />
      )}
    </div>
  );
}
