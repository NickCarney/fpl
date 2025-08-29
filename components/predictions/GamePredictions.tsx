"use client";

import { useState, useEffect } from "react";

interface TeamInfo {
  name: string;
  shortName: string;
  form: number | null;
  position: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  played: number;
  strength: number;
}

interface GamePrediction {
  id: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  predictedScore: {
    home: number;
    away: number;
  };
  confidence: number;
  reasoning: string;
  kickoffTime: string;
  difficulty: {
    home: number;
    away: number;
  };
}

interface PredictionsData {
  gameweek: number;
  gameweekName: string;
  predictions: GamePrediction[];
  totalMatches: number;
}

export default function GamePredictions() {
  const [predictionsData, setPredictionsData] =
    useState<PredictionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/predictions/games")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch game predictions");
        }
        return res.json();
      })
      .then((data) => {
        setPredictionsData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch game predictions:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading game predictions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!predictionsData || predictionsData.predictions.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No upcoming fixtures found</p>
      </div>
    );
  }

  const formatKickoffTime = (kickoffTime: string) => {
    return new Date(kickoffTime).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 bg-green-50";
    if (confidence >= 60) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "bg-green-100 text-green-800";
    if (difficulty <= 3) return "bg-yellow-100 text-yellow-800";
    if (difficulty <= 4) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getPositionColor = (position: number) => {
    if (position <= 4) return "text-green-600 font-bold"; // Top 4
    if (position <= 10) return "text-blue-600"; // Mid-table
    if (position <= 17) return "text-orange-600"; // Lower mid-table
    return "text-red-600 font-bold"; // Relegation zone
  };

  const getResultColor = (
    homeScore: number,
    awayScore: number,
    isHome: boolean
  ) => {
    if (homeScore === awayScore) return "text-gray-600"; // Draw
    if (
      (isHome && homeScore > awayScore) ||
      (!isHome && awayScore > homeScore)
    ) {
      return "text-green-600 font-bold"; // Win
    }
    return "text-red-600"; // Loss
  };

  return (
    <div className="game-predictions bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Score Predictions</h2>
        <p className="text-gray-600">
          {predictionsData.gameweekName} - {predictionsData.totalMatches}{" "}
          fixtures
        </p>
      </div>

      <div className="space-y-4">
        {predictionsData.predictions.map((prediction) => (
          <div
            key={prediction.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* Main prediction display */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-4 flex-1">
                {/* Home team */}
                <div className="text-right flex-1">
                  <div className="font-semibold text-lg">
                    {prediction.homeTeam.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span
                      className={getPositionColor(prediction.homeTeam.position)}
                    >
                      {prediction.homeTeam.position}
                    </span>
                    <span className="mx-1">•</span>
                    <span>{prediction.homeTeam.points} pts</span>
                    {prediction.homeTeam.form !== null && (
                      <>
                        <span className="mx-1">•</span>
                        <span>Form: {prediction.homeTeam.form}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="text-center px-6">
                  <div className="text-3xl font-bold mb-1">
                    <span
                      className={getResultColor(
                        prediction.predictedScore.home,
                        prediction.predictedScore.away,
                        true
                      )}
                    >
                      {prediction.predictedScore.home}
                    </span>
                    <span className="mx-2 text-gray-400">-</span>
                    <span
                      className={getResultColor(
                        prediction.predictedScore.home,
                        prediction.predictedScore.away,
                        false
                      )}
                    >
                      {prediction.predictedScore.away}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatKickoffTime(prediction.kickoffTime)}
                  </div>
                </div>

                {/* Away team */}
                <div className="text-left flex-1">
                  <div className="font-semibold text-lg">
                    {prediction.awayTeam.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span
                      className={getPositionColor(prediction.awayTeam.position)}
                    >
                      {prediction.awayTeam.position}
                    </span>
                    <span className="mx-1">•</span>
                    <span>{prediction.awayTeam.points} pts</span>
                    {prediction.awayTeam.form !== null && (
                      <>
                        <span className="mx-1">•</span>
                        <span>Form: {prediction.awayTeam.form}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Confidence */}
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(
                  prediction.confidence
                )}`}
              >
                {prediction.confidence}% confident
              </div>
            </div>

            {/* Additional stats */}
            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
              <div>
                <div className="text-gray-600">
                  Goals For/Against (per game)
                </div>
                <div className="font-medium">
                  {prediction.homeTeam.name}:{" "}
                  {(
                    prediction.homeTeam.goalsFor /
                    Math.max(1, prediction.homeTeam.played)
                  ).toFixed(1)}{" "}
                  /{" "}
                  {(
                    prediction.homeTeam.goalsAgainst /
                    Math.max(1, prediction.homeTeam.played)
                  ).toFixed(1)}
                </div>
                <div className="font-medium">
                  {prediction.awayTeam.name}:{" "}
                  {(
                    prediction.awayTeam.goalsFor /
                    Math.max(1, prediction.awayTeam.played)
                  ).toFixed(1)}{" "}
                  /{" "}
                  {(
                    prediction.awayTeam.goalsAgainst /
                    Math.max(1, prediction.awayTeam.played)
                  ).toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-gray-600">FPL Difficulty</div>
                <div className="flex space-x-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${getDifficultyColor(
                      prediction.difficulty.home
                    )}`}
                  >
                    {prediction.homeTeam.shortName}:{" "}
                    {prediction.difficulty.home}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${getDifficultyColor(
                      prediction.difficulty.away
                    )}`}
                  >
                    {prediction.awayTeam.shortName}:{" "}
                    {prediction.difficulty.away}
                  </span>
                </div>
              </div>
            </div>

            {/* Reasoning */}
            <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
              <div className="text-gray-600 mb-1">Prediction reasoning:</div>
              <div className="text-gray-800">{prediction.reasoning}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-sm text-gray-500 bg-blue-50 p-4 rounded-lg">
        <p>
          <strong>Prediction Method:</strong> Scores are predicted using:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Team strength ratings (attack/defense, home/away)</li>
          <li>Current form and league position</li>
          <li>Goals scored/conceded averages</li>
          <li>Home advantage factor (30% boost)</li>
          <li>FPL difficulty ratings</li>
        </ul>
        <p className="mt-2">
          <strong>Note:</strong> These are statistical predictions and actual
          results may vary significantly due to team news, tactics, and match
          circumstances.
        </p>
      </div>
    </div>
  );
}
