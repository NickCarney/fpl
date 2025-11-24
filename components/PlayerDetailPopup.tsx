"use client";

import { useState, useEffect } from "react";
import Popup from "reactjs-popup";
import {
  Element,
  Team,
  ElementType,
  PlayerGameweekData,
  PlayerGameweek,
} from "@/types/fpl";
import { getPlayerGameweeks } from "@/lib/fpl-api";

interface PlayerDetailPopupProps {
  player: Element;
  team: Team;
  position: ElementType;
  teams: Team[];
  isOpen: boolean;
  onClose: () => void;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  currentSquad?: Element[]; // Add current squad to props
}

export default function PlayerDetailPopup({
  player,
  team,
  position,
  teams,
  isOpen,
  onClose,
  isCaptain = false,
  isViceCaptain = false,
  currentSquad = [],
}: PlayerDetailPopupProps) {
  const [gameweekData, setGameweekData] = useState<PlayerGameweekData | null>(
    null
  );
  const [loadingGameweeks, setLoadingGameweeks] = useState(false);
  const [showGameweeks, setShowGameweeks] = useState(true);
  const [loadingTransferSuggestions, setLoadingTransferSuggestions] =
    useState(false);
  const [transferSuggestions, setTransferSuggestions] = useState<string>("");
  const [showTransferSuggestions, setShowTransferSuggestions] = useState(false);

  // Load gameweek data when popup opens
  useEffect(() => {
    if (isOpen && !gameweekData && !loadingGameweeks) {
      loadGameweekData();
    }
  }, [isOpen, player.id]);

  const loadGameweekData = async () => {
    setLoadingGameweeks(true);
    try {
      const data = await getPlayerGameweeks(player.id);
      setGameweekData(data);
    } catch (error) {
      console.error("Failed to load gameweek data:", error);
    } finally {
      setLoadingGameweeks(false);
    }
  };

  const handleSuggestTransfers = async () => {
    setLoadingTransferSuggestions(true);
    setShowTransferSuggestions(true);
    setTransferSuggestions("");

    try {
      // Get current squad player IDs to exclude from suggestions
      const currentSquadIds = currentSquad.map((p) => p.id);

      const response = await fetch("/api/transfer-suggestions-player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: player.id,
          playerName: player.web_name,
          playerPosition: position.singular_name,
          playerPrice: player.now_cost / 10,
          playerPoints: player.total_points,
          playerForm: player.form,
          currentSquadIds, // Pass current squad IDs
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate transfer suggestions");
      }

      // Handle streaming response
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/plain")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            setTransferSuggestions(accumulatedContent);
          }
        }
      } else {
        const result = await response.json();
        setTransferSuggestions(result.analysis || "No suggestions available");
      }
    } catch (error) {
      console.error("Failed to generate transfer suggestions:", error);
      setTransferSuggestions(
        "Failed to generate transfer suggestions. Please try again."
      );
    } finally {
      setLoadingTransferSuggestions(false);
    }
  };

  const getOpponentTeamName = (gameweek: PlayerGameweek, teams: Team[]) => {
    const opponentTeam = teams.find((t) => t.id === gameweek.opponent_team);
    return opponentTeam?.short_name || "Unknown";
  };
  const statsRows = [
    { label: "Total Points", value: player.total_points, highlight: true },
    { label: "Form", value: player.form },
    { label: "Price", value: `£${(player.now_cost / 10).toFixed(1)}m` },
    { label: "Points per Game", value: player.points_per_game },
    { label: "Selected by", value: `${player.selected_by_percent}%` },
    { label: "Minutes Played", value: player.minutes },
    { label: "Starts", value: player.starts },
    { label: "ICT Index", value: player.ict_index },
    { label: "Influence", value: player.influence },
    { label: "Creativity", value: player.creativity },
    { label: "Threat", value: player.threat },
    { label: "BPS (Bonus Points System)", value: player.bps },
    { label: "Bonus Points", value: player.bonus },
  ];

  const performanceStats = [
    { label: "Goals Scored", value: player.goals_scored },
    { label: "Assists", value: player.assists },
    { label: "Clean Sheets", value: player.clean_sheets },
    { label: "Goals Conceded", value: player.goals_conceded },
    { label: "Own Goals", value: player.own_goals },
    { label: "Penalties Saved", value: player.penalties_saved },
    { label: "Penalties Missed", value: player.penalties_missed },
    { label: "Yellow Cards", value: player.yellow_cards },
    { label: "Red Cards", value: player.red_cards },
    { label: "Saves", value: player.saves },
  ];

  const expectedStats = [
    { label: "Expected Goals (xG)", value: player.expected_goals },
    { label: "Expected Assists (xA)", value: player.expected_assists },
    {
      label: "Expected Goal Involvements (xGI)",
      value: player.expected_goal_involvements,
    },
    {
      label: "Expected Goals Conceded (xGC)",
      value: player.expected_goals_conceded,
    },
  ];

  return (
    <Popup
      open={isOpen}
      onClose={onClose}
      modal
      nested
      className="player-popup"
      overlayStyle={{ background: "rgba(0, 0, 0, 0.5)" }}
    >
      <div className=" rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto scrolly">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">
                {player.first_name} {player.second_name}
              </h2>
              {isCaptain && (
                <span className="px-2 py-1 bg-yellow-400 text-sm rounded font-bold">
                  Captain
                </span>
              )}
              {isViceCaptain && (
                <span className="px-2 py-1 bg-yellow-200 text-sm rounded font-bold">
                  Vice Captain
                </span>
              )}
            </div>
            <p className="text-lg ">
              {team.name} • {position.singular_name}
            </p>
            <p className="text-sm ">Web Name: {player.web_name}</p>
          </div>
          <button onClick={onClose} className=" hover: text-2xl font-bold">
            ×
          </button>
        </div>

        {/* Key Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className=" p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{player.total_points}</div>
            <div className="text-sm ">Total Points</div>
          </div>
          <div className=" p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">
              £{(player.now_cost / 10).toFixed(1)}m
            </div>
            <div className="text-sm ">Price</div>
          </div>
          <div className=" p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{player.form}</div>
            <div className="text-sm ">Form</div>
          </div>
          <div className=" p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">
              {player.selected_by_percent}%
            </div>
            <div className="text-sm ">Selected By</div>
          </div>
        </div>

        {/* Transfer Suggestions Button */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={handleSuggestTransfers}
            disabled={loadingTransferSuggestions}
            className="!border-black w-fit px-4 py-3 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingTransferSuggestions
              ? "Analyzing alternatives..."
              : "Suggest transfers for this player"}
          </button>
        </div>

        {/* Transfer Suggestions Display */}
        {showTransferSuggestions && (
          <div className="mb-6 bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h3 className="text-lg font-semibold mb-3 text-purple-900">
              Transfer Suggestions for {player.web_name}
            </h3>
            {loadingTransferSuggestions ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-purple-700">
                  Analyzing player alternatives...
                </p>
              </div>
            ) : (
              <div className="text-sm text-purple-900 whitespace-pre-wrap">
                {transferSuggestions}
              </div>
            )}
          </div>
        )}

        {/* Stats Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-3">General Stats</h3>
            <div className=" rounded-lg p-4">
              <table className="w-full text-sm">
                <tbody>
                  {statsRows.map((stat, index) => (
                    <tr key={index} className={stat.highlight ? "" : ""}>
                      <td className="py-2 font-medium ">{stat.label}</td>
                      <td className="py-2 text-right font-semibold">
                        {stat.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Performance Stats</h3>
            <div className=" rounded-lg p-4">
              <table className="w-full text-sm">
                <tbody>
                  {performanceStats.map((stat, index) => (
                    <tr key={index}>
                      <td className="py-2 font-medium ">{stat.label}</td>
                      <td className="py-2 text-right font-semibold">
                        {stat.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Expected Stats */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">
            Expected Stats (Advanced Analytics)
          </h3>
          <div className=" rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {expectedStats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="text-xs ">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gameweek Performance */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Gameweek Performance</h3>
            <button
              onClick={() => setShowGameweeks(!showGameweeks)}
              className="px-3 py-1  text-white rounded-md hover: transition-colors text-sm"
            >
              {showGameweeks ? "Hide" : "Show"} Game-by-Game Stats
            </button>
          </div>

          {showGameweeks && (
            <div className=" rounded-lg p-4">
              {loadingGameweeks ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="">Loading gameweek data...</p>
                </div>
              ) : gameweekData ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b w-fit">
                        <th className="text-left py-2 px-4">GW</th>
                        <th className="text-left py-2 px-4">Opponent</th>
                        <th className="text-left py-2 px-4">Venue</th>
                        <th className="text-right py-2 px-4">Pts</th>
                        <th className="text-right py-2 px-4">Min</th>
                        <th className="text-right py-2 px-4">Goals</th>
                        <th className="text-right py-2 px-4">Assists</th>
                        <th className="text-right py-2 px-4">CS</th>
                        <th className="text-right py-2 px-4">Bonus</th>
                        <th className="text-right py-2 px-4">BPS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gameweekData.history.map((gw, index) => (
                        <tr key={index} className="border-b hover:">
                          <td className="py-2 font-medium">{gw.round}</td>
                          <td className="py-2">
                            {getOpponentTeamName(gw, teams)}
                          </td>
                          <td className="py-2">{gw.was_home ? "H" : "A"}</td>
                          <td className="py-2 text-right font-semibold">
                            {gw.total_points}
                          </td>
                          <td className="py-2 text-right">{gw.minutes}</td>
                          <td className="py-2 text-right">{gw.goals_scored}</td>
                          <td className="py-2 text-right">{gw.assists}</td>
                          <td className="py-2 text-right">{gw.clean_sheets}</td>
                          <td className="py-2 text-right">{gw.bonus}</td>
                          <td className="py-2 text-right">{gw.bps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 text-xs ">
                    <p>
                      <strong>CS:</strong> Clean Sheets | <strong>BPS:</strong>{" "}
                      Bonus Points System
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 ">
                  Failed to load gameweek data
                </div>
              )}
            </div>
          )}
        </div>

        {/* Team Info */}
        <div className="mt-6  rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Team Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Team:</span> {team.name}
            </div>
            <div>
              <span className="font-medium">Strength:</span> {team.strength}
            </div>
            <div>
              <span className="font-medium">Attack (Home):</span>{" "}
              {team.strength_attack_home}
            </div>
            <div>
              <span className="font-medium">Attack (Away):</span>{" "}
              {team.strength_attack_away}
            </div>
            <div>
              <span className="font-medium">Defence (Home):</span>{" "}
              {team.strength_defence_home}
            </div>
            <div>
              <span className="font-medium">Defence (Away):</span>{" "}
              {team.strength_defence_away}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className=" text-white px-6 py-2 rounded-md hover: transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Popup>
  );
}
