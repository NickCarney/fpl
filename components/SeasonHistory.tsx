"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Current, ChipPlay } from "@/types/fpl";

function formatRank(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

interface SeasonHistoryProps {
  history: Current[];
  chips: ChipPlay[];
}

export default function SeasonHistory({ history, chips }: SeasonHistoryProps) {
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
                label={{ value: "Points", angle: -90, position: "insideLeft" }}
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
        <h3 className="text-lg font-semibold mb-3">Overall Rank Progress</h3>
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
                label={{ value: "Rank", angle: -90, position: "insideLeft" }}
                tickFormatter={formatRank}
              />
              <Tooltip
                formatter={(value: any) => [formatRank(value), "Overall Rank"]}
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
    </div>
  );
}
