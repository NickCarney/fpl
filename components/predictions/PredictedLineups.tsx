"use client";

import { useState, useEffect } from "react";

interface Player {
  id: number;
  name: string;
  position: string;
  team: string;
  form: string;
  minutes: number;
  chanceOfPlaying: number | null;
}

interface TeamLineup {
  team: string;
  formation: string;
  players: Player[];
}

interface Fixture {
  id: number;
  kickoff_time: string;
  homeTeam: string;
  awayTeam: string;
}

interface FixtureLineup {
  fixture: Fixture;
  homeLineup: TeamLineup;
  awayLineup: TeamLineup;
}

interface LineupsData {
  gameweek: number;
  gameweekName: string;
  fixtures: FixtureLineup[];
}

export default function PredictedLineups() {
  const [lineupsData, setLineupsData] = useState<LineupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/predictions/lineups")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch lineups");
        }
        return res.json();
      })
      .then((data) => {
        setLineupsData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch lineups:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading predicted lineups...</span>
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

  if (!lineupsData || lineupsData.fixtures.length === 0) {
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

  const getPositionColor = (position: string) => {
    switch (position) {
      case "GK":
        return "bg-yellow-100 text-yellow-800";
      case "DEF":
        return "bg-blue-100 text-blue-800";
      case "MID":
        return "bg-green-100 text-green-800";
      case "FWD":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const renderFormation = (lineup: TeamLineup) => {
    const { players } = lineup;
    const gk = players.filter((p) => p.position === "GK");
    const def = players.filter((p) => p.position === "DEF");
    const mid = players.filter((p) => p.position === "MID");
    const fwd = players.filter((p) => p.position === "FWD");

    return (
      <div className="formation-display bg-green-50 rounded-lg p-4 min-h-[300px] relative">
        <div className="text-center font-semibold mb-2">{lineup.team}</div>
        <div className="text-xs text-gray-600 text-center mb-4">
          {lineup.formation}
        </div>

        {/* Formation Layout */}
        <div className="formation-grid h-64 relative">
          {/* Forwards */}
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {fwd.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>

          {/* Midfielders */}
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {mid.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>

          {/* Defenders */}
          <div className="absolute top-38 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {def.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>

          {/* Goalkeeper */}
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
            {gk.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const PlayerCard = ({ player }: { player: Player }) => (
    <div className="text-center">
      <div
        className={`w-16 h-12 rounded text-xs p-1 ${getPositionColor(
          player.position
        )} flex flex-col justify-center items-center shadow-sm`}
      >
        <div className="font-semibold truncate w-full">{player.name}</div>
        <div className="text-xs opacity-75">{player.position}</div>
      </div>
      <div className="text-xs mt-1 space-y-0.5">
        <div>Form: {player.form}</div>
        {player.chanceOfPlaying !== null && player.chanceOfPlaying < 100 && (
          <div className="text-orange-600 absolute top-0 transform translate-x-2/3">
            {player.chanceOfPlaying}%
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="predicted-lineups bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Predicted Lineups</h2>
        <p className="text-gray-600">
          {lineupsData.gameweekName} - Upcoming Fixtures
        </p>
      </div>

      <div className="space-y-8">
        {lineupsData.fixtures.map((fixtureLineup, index) => (
          <div
            key={fixtureLineup.fixture.id}
            className="fixture-container border border-gray-200 rounded-lg p-4"
          >
            <div className="fixture-header text-center mb-6">
              <h3 className="text-xl font-semibold">
                {fixtureLineup.fixture.homeTeam} vs{" "}
                {fixtureLineup.fixture.awayTeam}
              </h3>
              <p className="text-gray-500 text-sm">
                {formatKickoffTime(fixtureLineup.fixture.kickoff_time)}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderFormation(fixtureLineup.homeLineup)}
              {renderFormation(fixtureLineup.awayLineup)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>
          <strong>Note:</strong> Lineups are predicted based on recent form,
          minutes played, and selection data. Actual lineups may vary due to
          injuries, rotation, or tactical decisions.
        </p>
      </div>
    </div>
  );
}
