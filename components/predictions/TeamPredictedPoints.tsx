"use client";

import { useState, useEffect } from "react";

interface PlayerPrediction {
  id: number;
  name: string;
  position: string;
  team: string;
  predictedPoints: number;
  confidence: number;
  breakdown: {
    minutes: number;
    expectedGoals: number;
    expectedAssists: number;
    cleanSheetChance: string;
    bonusPoints: number;
    fixtureInfo?: {
      opponent: string;
      difficulty: number;
    };
  };
  isStarter: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  multiplier: number;
  fixture?: {
    opponent: string;
    isHome: boolean;
    difficulty: number;
  };
}

interface TeamPrediction {
  gameweek: number;
  gameweekName: string;
  totalPredictedPoints: number;
  players: PlayerPrediction[];
  summary: {
    startingXI: number;
    bench: number;
    captain: string;
    viceCaptain: string;
  };
}

interface OptimalLineup {
  formation: string;
  startingXI: PlayerPrediction[];
  bench: PlayerPrediction[];
  captain: PlayerPrediction;
  viceCaptain: PlayerPrediction;
  totalPoints: number;
}

interface FormationTeamPredictionProps {
  teamId: number;
}

const VALID_FORMATIONS = [
  { name: "3-4-3", gk: 1, def: 3, mid: 4, fwd: 3 },
  { name: "3-5-2", gk: 1, def: 3, mid: 5, fwd: 2 },
  { name: "4-3-3", gk: 1, def: 4, mid: 3, fwd: 3 },
  { name: "4-4-2", gk: 1, def: 4, mid: 4, fwd: 2 },
  { name: "4-5-1", gk: 1, def: 4, mid: 5, fwd: 1 },
  { name: "5-3-2", gk: 1, def: 5, mid: 3, fwd: 2 },
  { name: "5-4-1", gk: 1, def: 5, mid: 4, fwd: 1 },
];

export default function FormationTeamPrediction({
  teamId,
}: FormationTeamPredictionProps) {
  const [prediction, setPrediction] = useState<TeamPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimalLineup, setOptimalLineup] = useState<OptimalLineup | null>(
    null
  );

  useEffect(() => {
    if (!teamId) {
      setError("Team ID is required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/predictions/team-points?teamId=${teamId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}: Failed to fetch team predictions`
          );
        }
        return res.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.players)) {
          throw new Error("Invalid response structure: missing players array");
        }

        setPrediction(data);

        // Calculate optimal lineup
        const optimal = calculateOptimalLineup(data.players);
        setOptimalLineup(optimal);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch team predictions:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [teamId]);

  const calculateOptimalLineup = (
    players: PlayerPrediction[]
  ): OptimalLineup => {
    const gkPlayers = players.filter((p) => p.position === "GK");
    const defPlayers = players.filter((p) => p.position === "DEF");
    const midPlayers = players.filter((p) => p.position === "MID");
    const fwdPlayers = players.filter((p) => p.position === "FWD");

    // Sort each position by predicted points
    gkPlayers.sort((a, b) => b.predictedPoints - a.predictedPoints);
    defPlayers.sort((a, b) => b.predictedPoints - a.predictedPoints);
    midPlayers.sort((a, b) => b.predictedPoints - a.predictedPoints);
    fwdPlayers.sort((a, b) => b.predictedPoints - a.predictedPoints);

    let bestFormation: any = null;
    let bestLineup: PlayerPrediction[] = [];
    let bestTotalPoints = 0;

    // Try each valid formation
    for (const formation of VALID_FORMATIONS) {
      if (
        gkPlayers.length >= formation.gk &&
        defPlayers.length >= formation.def &&
        midPlayers.length >= formation.mid &&
        fwdPlayers.length >= formation.fwd
      ) {
        const lineup = [
          ...gkPlayers.slice(0, formation.gk),
          ...defPlayers.slice(0, formation.def),
          ...midPlayers.slice(0, formation.mid),
          ...fwdPlayers.slice(0, formation.fwd),
        ];

        // Find optimal captain for this formation
        const sortedByPoints = [...lineup].sort(
          (a, b) => b.predictedPoints - a.predictedPoints
        );
        const captain = sortedByPoints[0];

        // Calculate total with captain getting double points
        const totalPoints = lineup.reduce((sum, player) => {
          if (player.id === captain.id) {
            return sum + player.predictedPoints * 2; // Captain gets 2x points
          }
          return sum + player.predictedPoints;
        }, 0);

        if (totalPoints > bestTotalPoints) {
          bestTotalPoints = totalPoints;
          bestLineup = lineup;
          bestFormation = formation;
        }
      }
    }

    // Find captain and vice-captain (highest and second highest predicted points)
    const sortedByPoints = [...bestLineup].sort(
      (a, b) => b.predictedPoints - a.predictedPoints
    );
    const captain = sortedByPoints[0];
    const viceCaptain = sortedByPoints[1];

    // Create bench from remaining players
    const usedPlayerIds = new Set(bestLineup.map((p) => p.id));
    const bench = players.filter((p) => !usedPlayerIds.has(p.id));

    return {
      formation: bestFormation?.name || "4-4-2",
      startingXI: bestLineup,
      bench,
      captain,
      viceCaptain,
      totalPoints: bestTotalPoints, // This already includes captain multiplier
    };
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case "GK":
        return "text-yellow-800 border-yellow-300";
      case "DEF":
        return "text-blue-800 border-blue-300";
      case "MID":
        return "text-green-800 border-green-300";
      case "FWD":
        return "text-red-800 border-red-300";
      default:
        return "text-gray-800 border-gray-300";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600";
    if (confidence >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "bg-green-100 text-green-800";
    if (difficulty <= 3) return "bg-yellow-100 text-yellow-800";
    if (difficulty <= 4) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  // Responsive PlayerCard
  const PlayerCard = ({
    player,
    isCaptain,
    isViceCaptain,
  }: {
    player: PlayerPrediction;
    isCaptain: boolean;
    isViceCaptain: boolean;
  }) => (
    <div
      className={`relative flex flex-col items-center p-3 rounded-lg border-2 w-full max-w-[140px] min-w-[110px] mx-auto transition-all hover:shadow-lg 
        ${
          isCaptain
            ? "ring-2 ring-yellow-400"
            : isViceCaptain
            ? "ring-2 ring-yellow-200"
            : getPositionColor(player.position)
        }`}
    >
      {/* Captain/Vice Captain Badge */}
      {isCaptain && (
        <div className="absolute -top-1 -right-1 bg-yellow-400 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          C
        </div>
      )}
      {isViceCaptain && (
        <div className="absolute -top-1 -right-1 bg-yellow-200 text-yellow-800 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          V
        </div>
      )}

      {/* Player Info */}
      <div className="text-center w-full">
        <div className="font-semibold text-sm mb-1 truncate">{player.name}</div>
        <div className="text-xs text-gray-600 mb-1 truncate">{player.team}</div>
        <div className="text-lg font-bold text-blue-600">
          {isCaptain
            ? (player.predictedPoints * 2).toFixed(1)
            : player.predictedPoints.toFixed(1)}
          <span className="text-xs text-gray-500 ml-1">pts</span>
        </div>
        <div className={`text-xs ${getConfidenceColor(player.confidence)}`}>
          {player.confidence}%
        </div>
        {player.fixture && (
          <div className="mt-2">
            <div className="text-xs font-medium truncate">
              {player.fixture.isHome ? "vs" : "@"} {player.fixture.opponent}
            </div>
            <span
              className={`inline-block px-1 py-0.5 rounded text-xs ${getDifficultyColor(
                player.fixture.difficulty
              )}`}
            >
              {player.fixture.difficulty}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const renderFormationView = (lineup: OptimalLineup | null) => {
    if (!lineup) return null;

    const { startingXI, formation } = lineup;
    const gks = startingXI.filter((p) => p.position === "GK");
    const defs = startingXI.filter((p) => p.position === "DEF");
    const mids = startingXI.filter((p) => p.position === "MID");
    const fwds = startingXI.filter((p) => p.position === "FWD");

    // Use flex for each row, centered
    const rowClass = "flex justify-center gap-3 flex-wrap";

    return (
      <div className="formation-view bg-gradient-to-b from-green-100 to-green-50 p-6 rounded-lg border">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold">{formation} Formation</h3>
          <p className="text-sm text-gray-600">
            Optimal Lineup – {lineup.totalPoints.toFixed(1)} predicted points
          </p>
        </div>
        <div className="space-y-6 content-center">
          <div className={rowClass}>
            {fwds.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isCaptain={player.id === lineup.captain.id}
                isViceCaptain={player.id === lineup.viceCaptain.id}
              />
            ))}
          </div>
          <div className={rowClass}>
            {mids.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isCaptain={player.id === lineup.captain.id}
                isViceCaptain={player.id === lineup.viceCaptain.id}
              />
            ))}
          </div>
          <div className={rowClass}>
            {defs.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isCaptain={player.id === lineup.captain.id}
                isViceCaptain={player.id === lineup.viceCaptain.id}
              />
            ))}
          </div>
          <div className={rowClass}>
            {gks.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isCaptain={player.id === lineup.captain.id}
                isViceCaptain={player.id === lineup.viceCaptain.id}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading optimal team prediction...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <p className="text-sm text-gray-600 mt-2">
          Failed to load predictions for team ID {teamId}.
        </p>
      </div>
    );
  }

  if (!prediction || !optimalLineup) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No predictions available</p>
      </div>
    );
  }

  // Create original lineup for comparison
  const originalStarters = prediction.players.filter((p) => p.isStarter);
  const originalCaptain = prediction.players.find((p) => p.isCaptain);
  const originalViceCaptain = prediction.players.find((p) => p.isViceCaptain);

  // Fix the original total calculation
  const originalTotalPoints = originalStarters.reduce((sum, player) => {
    // Use the multiplier from the API (should be 2 for captain, 1 for others)
    return sum + player.predictedPoints * player.multiplier;
  }, 0);

  //console.log("Original lineup calculation:");
  originalStarters.forEach((p) => {
    //console.log(
    // `${p.name}: ${p.predictedPoints} x ${p.multiplier} = ${
    //   p.predictedPoints * p.multiplier
    // }`
    // );
  });
  //console.log("Original total:", originalTotalPoints);

  const originalLineup: OptimalLineup = {
    formation: "4-4-2", // Default, we'd need to calculate actual formation
    startingXI: originalStarters,
    bench: prediction.players.filter((p) => !p.isStarter),
    captain: originalCaptain!,
    viceCaptain: originalViceCaptain!,
    totalPoints: originalTotalPoints,
  };

  return (
    <div className="formation-team-prediction">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Optimal Team Formation
        </h2>
        <p className="text-gray-600">{prediction.gameweekName}</p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <h3 className="text-lg font-bold text-blue-800">Optimal Lineup</h3>
          <div className="text-2xl font-bold text-blue-600">
            {optimalLineup.totalPoints.toFixed(1)} pts
          </div>
          <p className="text-sm text-blue-600">
            {optimalLineup.formation} • Captain: {optimalLineup.captain.name}
          </p>
        </div>
      </div>

      {/* Formation Display */}
      {renderFormationView(optimalLineup)}

      {/* Bench */}
      <div className="mt-6">
        <h4 className="text-lg font-semibold mb-3">
          Bench ({optimalLineup.bench.length} players)
        </h4>
        <div className="flex justify-center gap-3 flex-wrap">
          {optimalLineup.bench.map((player) => (
            <div
              key={player.id}
              className={`p-3 rounded border ${getPositionColor(
                player.position
              )} opacity-75 flex flex-col items-center max-w-[140px] min-w-[110px] mx-auto`}
            >
              <div className="text-center w-full">
                <div className="font-medium text-sm truncate">
                  {player.name}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  {player.team}
                </div>
                <div className="text-sm font-bold">
                  {player.predictedPoints.toFixed(1)} pts
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
