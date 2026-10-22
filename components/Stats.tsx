"use client";

import { useState } from "react";
import { Element, Team, ElementType } from "@/types/fpl";
import PlayerStats from "./PlayerStats";
import TeamStats from "./TeamStats";

interface StatsProps {
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
}

export default function Stats({ elements, teams, elementTypes }: StatsProps) {
  const [activeStatsTab, setActiveStatsTab] = useState<"player" | "team">(
    "player"
  );

  return (
    <div className="p-6 rounded-lg shadow-md">
      {/* Stats Tab Navigation */}
      <div className="mb-6">
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setActiveStatsTab("player")}
            className={`px-4 py-2 rounded-md font-medium ${
              activeStatsTab === "player"
                ? "text-white bg-green-600"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Player Stats
          </button>
          <button
            onClick={() => setActiveStatsTab("team")}
            className={`px-4 py-2 rounded-md font-medium ${
              activeStatsTab === "team"
                ? "text-white bg-green-600"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Team Stats
          </button>
        </div>
      </div>

      {/* Render appropriate content */}
      {activeStatsTab === "player" ? (
        <PlayerStats
          elements={elements}
          teams={teams}
          elementTypes={elementTypes}
        />
      ) : (
        <TeamStats teams={teams} elements={elements} />
      )}
    </div>
  );
}
