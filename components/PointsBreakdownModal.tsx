"use client";

import { useState, useEffect } from "react";

interface PointsBreakdownModalProps {
  playerId: number;
  playerName: string;
  gameweek: number;
  totalPoints: number | string;
  isOpen: boolean;
  onClose: () => void;
  playerPosition?: number; // 1=GK, 2=DEF, 3=MID, 4=FWD
}

interface PointsDetail {
  label: string;
  points: number;
  description: string;
}

export default function PointsBreakdownModal({
  playerId,
  playerName,
  gameweek,
  totalPoints,
  isOpen,
  onClose,
  playerPosition,
}: PointsBreakdownModalProps) {
  const [breakdown, setBreakdown] = useState<PointsDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rawGameweekData, setRawGameweekData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPointsBreakdown();
    }
  }, [isOpen, playerId, gameweek]);

  const fetchPointsBreakdown = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/player/${playerId}/gameweeks`);
      const data = await response.json();

      console.log("API response:", data);
      console.log("Looking for gameweek:", gameweek);
      console.log("History array:", data.history);

      // Find the specific gameweek data
      const gameweekData = data.history?.find(
        (gw: any) => gw.round === gameweek
      );

      console.log("Found gameweekData:", gameweekData);

      if (gameweekData) {
        // Store raw data for advanced view
        setRawGameweekData(gameweekData);

        const details: PointsDetail[] = [];

        // Check if player didn't play (0 minutes)
        const didNotPlay = gameweekData.minutes === 0;

        // Minutes played points
        if (gameweekData.minutes >= 60) {
          details.push({
            label: "Minutes (60+)",
            points: 2,
            description: `Played ${gameweekData.minutes} minutes`,
          });
        } else if (gameweekData.minutes > 0) {
          details.push({
            label: "Minutes (1-59)",
            points: 1,
            description: `Played ${gameweekData.minutes} minutes`,
          });
        } else if (didNotPlay) {
          // Player was in squad but didn't play
          details.push({
            label: "Did Not Play",
            points: 0,
            description: "Did not play this gameweek" + gameweek + gameweekData,
          });
        }

        // Goals scored
        if (gameweekData.goals_scored > 0) {
          // Points depend on position: GK/DEF = 6, MID = 5, FWD = 4
          const goalsScored = gameweekData.goals_scored;
          let pointsPerGoal = 4; // Default to forward

          if (playerPosition === 1 || playerPosition === 2) {
            pointsPerGoal = 6; // GK or DEF
          } else if (playerPosition === 3) {
            pointsPerGoal = 5; // MID
          }

          const totalGoalPoints = goalsScored * pointsPerGoal;

          details.push({
            label: `Goal${goalsScored > 1 ? "s" : ""}`,
            points: totalGoalPoints,
            description: `Scored ${goalsScored} goal${
              goalsScored > 1 ? "s" : ""
            }`,
          });
        }

        // Assists
        if (gameweekData.assists > 0) {
          const assists = gameweekData.assists;
          details.push({
            label: `Assist${assists > 1 ? "s" : ""}`,
            points: assists * 3,
            description: `${assists} assist${assists > 1 ? "s" : ""}`,
          });
        }

        // Clean sheets
        if (gameweekData.clean_sheets > 0) {
          const cleanSheets = gameweekData.clean_sheets;
          // Points vary by position: GK/DEF = 4, MID = 1, FWD = 0
          let pointsPerCS = 0; // Default to forward (0 points)

          if (playerPosition === 1 || playerPosition === 2) {
            pointsPerCS = 4; // GK or DEF
          } else if (playerPosition === 3) {
            pointsPerCS = 1; // MID
          }

          // Only add to breakdown if they actually get points for it
          if (pointsPerCS > 0) {
            details.push({
              label: "Clean Sheet",
              points: cleanSheets * pointsPerCS,
              description: `Kept ${cleanSheets} clean sheet${
                cleanSheets > 1 ? "s" : ""
              }`,
            });
          }
        }

        // Goals conceded (negative for GK/DEF only)
        if (
          gameweekData.goals_conceded > 0 &&
          gameweekData.clean_sheets === 0 &&
          (playerPosition === 1 || playerPosition === 2) // Only GK or DEF
        ) {
          const goalsConceded = gameweekData.goals_conceded;
          const penaltyPoints = Math.floor(goalsConceded / 2) * -1;
          if (penaltyPoints < 0) {
            details.push({
              label: "Goals Conceded",
              points: penaltyPoints,
              description: `Conceded ${goalsConceded} goal${
                goalsConceded > 1 ? "s" : ""
              }`,
            });
          }
        }

        // Saves (GK only)
        if (gameweekData.saves > 0) {
          const saves = gameweekData.saves;
          const savePoints = Math.floor(saves / 3);
          if (savePoints > 0) {
            details.push({
              label: "Saves",
              points: savePoints,
              description: `${saves} save${saves > 1 ? "s" : ""} (1pt per 3)`,
            });
          }
        }

        // Penalty saves
        if (gameweekData.penalties_saved > 0) {
          const penSaves = gameweekData.penalties_saved;
          details.push({
            label: "Penalty Save",
            points: penSaves * 5,
            description: `Saved ${penSaves} penalty`,
          });
        }

        // Penalty misses
        if (gameweekData.penalties_missed > 0) {
          const penMisses = gameweekData.penalties_missed;
          details.push({
            label: "Penalty Miss",
            points: penMisses * -2,
            description: `Missed ${penMisses} penalty`,
          });
        }

        // Yellow cards
        if (gameweekData.yellow_cards > 0) {
          const yellows = gameweekData.yellow_cards;
          details.push({
            label: "Yellow Card",
            points: yellows * -1,
            description: `${yellows} yellow card${yellows > 1 ? "s" : ""}`,
          });
        }

        // Red cards
        if (gameweekData.red_cards > 0) {
          const reds = gameweekData.red_cards;
          details.push({
            label: "Red Card",
            points: reds * -3,
            description: `${reds} red card${reds > 1 ? "s" : ""}`,
          });
        }

        // Own goals
        if (gameweekData.own_goals > 0) {
          const ownGoals = gameweekData.own_goals;
          details.push({
            label: "Own Goal",
            points: ownGoals * -2,
            description: `${ownGoals} own goal${ownGoals > 1 ? "s" : ""}`,
          });
        }

        // Bonus points
        if (gameweekData.bonus > 0) {
          details.push({
            label: "Bonus Points",
            points: gameweekData.bonus,
            description: `Earned ${gameweekData.bonus} bonus point${
              gameweekData.bonus > 1 ? "s" : ""
            }`,
          });
        }

        // Defensive contributions (custom scoring: 2 points per 10 contributions)
        if (gameweekData.defensive_contribution > 0) {
          const contributions = gameweekData.defensive_contribution;
          const contributionPoints = Math.floor(contributions / 10) * 2;
          if (contributionPoints > 0) {
            details.push({
              label: "Defensive Contributions",
              points: contributionPoints,
              description: `${contributions} defensive action${
                contributions > 1 ? "s" : ""
              } (2pts per 10)`,
            });
          }
        }

        setBreakdown(details);
      }
    } catch (error) {
      console.error("Error fetching points breakdown:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Handle YTP and DNP cases
  if (typeof totalPoints === "string") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{playerName}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="text-center py-8">
            <p className="text-lg font-medium text-gray-600">
              {totalPoints === "YTP"
                ? "Yet to play this gameweek"
                : "Did not play this gameweek" + gameweek}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {playerName} - GW{gameweek}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading breakdown...</p>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Total Points</p>
                <p className="text-3xl font-bold text-blue-600">
                  {totalPoints}
                </p>
              </div>
            </div>

            {/* Advanced View Toggle */}
            <div className="mb-4 text-center">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-600 hover:text-blue-800 underline no-gradient-border"
              >
                {showAdvanced ? "Hide Advanced View" : "Show Advanced View"}
              </button>
            </div>

            {showAdvanced && rawGameweekData ? (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Raw Gameweek Data:
                </h3>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(rawGameweekData, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}

            {breakdown.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-700 mb-3">Breakdown:</h3>
                {breakdown.map((detail, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        {detail.label}
                      </p>
                      <p className="text-sm text-gray-600">
                        {detail.description}
                      </p>
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        detail.points > 0
                          ? "text-green-600"
                          : detail.points < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {detail.points > 0 ? "+" : ""}
                      {detail.points}
                    </div>
                  </div>
                ))}

                <div className="border-t pt-3 mt-4">
                  <div className="flex justify-between items-center font-bold">
                    <span>Total</span>
                    <span className="text-blue-600">{totalPoints} pts</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <p>No breakdown available for this gameweek</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
