"use client";

import { useState } from "react";

interface TeamIdInputProps {
  onTeamIdSubmit: (teamId: number) => void;
}

export default function TeamIdInput({ onTeamIdSubmit }: TeamIdInputProps) {
  const [teamId, setTeamId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(teamId);
    if (id && id > 0) {
      onTeamIdSubmit(id);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6  rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center">
        Enter Your FPL Team ID
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="teamId" className="block text-sm font-medium  mb-2">
            Team ID
          </label>
          <input
            type="number"
            id="teamId"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="e.g. 3584215"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            required
          />
          <details className="mt-1">
            <summary className="text-xs cursor-pointer select-none">
              Where do I find my team ID?
            </summary>
            <p className="text-xs mt-1">
              Find your team ID in the URL when viewing your team:
              <br />
              <span className="break-all">
                fantasy.premierleague.com/entry/YOUR_ID/
              </span>
            </p>
          </details>
        </div>
        <button
          type="submit"
          className="w-full  text-white py-2 px-4 rounded-md hover: transition-colors"
        >
          Load Dashboard
        </button>
      </form>
    </div>
  );
}
