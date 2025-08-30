"use client";

import { useState } from "react";
import GamePredictions from "./GamePredictions";
import TeamPredictedPoints from "./TeamPredictedPoints";
import PredictedLineups from "./PredictedLineups";

interface PredictionsProps {
  teamId: number;
}

export default function Predictions({ teamId }: PredictionsProps) {
  const [activeTab, setActiveTab] = useState<"games" | "team" | "formation">(
    "games"
  );

  return (
    <div className="predictions-container">
      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8 justify-center">
          <button
            onClick={() => setActiveTab("games")}
            className={`py-1 px-1 border-b-2 font-medium text-sm ${
              activeTab === "games"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Game Predictions
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={`py-1 px-1 border-b-2 font-medium text-sm ${
              activeTab === "team"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Team Points Prediction
          </button>
          <button
            onClick={() => setActiveTab("formation")}
            className={`py-1 px-1 border-b-2 font-medium text-sm ${
              activeTab === "formation"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Team Lineup Prediction
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "games" && <GamePredictions />}
        {activeTab === "team" && <TeamPredictedPoints teamId={teamId} />}
        {activeTab === "formation" && <PredictedLineups />}
      </div>
    </div>
  );
}
