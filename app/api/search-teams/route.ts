import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

interface TeamEntry {
  id: number;
  name: string;
  playerName: string;
  nameLower: string;
  playerNameLower: string;
}

// Cache for the teams data - loaded once and reused
let teamsCache: TeamEntry[] | null = null;

// Simple CSV parser that handles quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Push the last field
  result.push(current);

  return result;
}

function loadTeamsData(): TeamEntry[] {
  if (teamsCache) {
    return teamsCache;
  }

  try {
    const filePath = join(process.cwd(), "data", "fpl_teams.csv");
    const fileContent = readFileSync(filePath, "utf-8");
    const lines = fileContent.split("\n");

    // Skip header and parse CSV
    const teams: TeamEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line with proper handling of quoted fields
      const parts = parseCSVLine(line);
      if (parts.length >= 4) {
        const id = parseInt(parts[0], 10);
        const teamName = parts[1];
        const firstName = parts[2];
        const lastName = parts[3];
        const playerName = `${firstName} ${lastName}`;

        // Skip invalid entries (no ID or empty team name)
        if (id && teamName) {
          teams.push({
            id,
            name: teamName,
            playerName,
            nameLower: teamName.toLowerCase(),
            playerNameLower: playerName.toLowerCase(),
          });
        }
      }
    }

    teamsCache = teams;
    console.log(`Loaded ${teams.length} teams into cache`);
    return teams;
  } catch (error) {
    console.error("Failed to load teams data:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return NextResponse.json({
      results: [],
      message: "Please enter at least 2 characters to search",
    });
  }

  try {
    const teams = loadTeamsData();

    // Fast in-memory search
    const results = teams
      .filter(
        (team) =>
          team.nameLower.includes(query) || team.playerNameLower.includes(query)
      )
      .sort((a, b) => {
        // Prioritize exact matches at the beginning
        const aNameMatch = a.nameLower.startsWith(query);
        const bNameMatch = b.nameLower.startsWith(query);

        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        // Then prioritize player name matches
        const aPlayerMatch = a.playerNameLower.startsWith(query);
        const bPlayerMatch = b.playerNameLower.startsWith(query);

        if (aPlayerMatch && !bPlayerMatch) return -1;
        if (!aPlayerMatch && bPlayerMatch) return 1;

        // Finally sort by ID (lower IDs are typically older/more established teams)
        return a.id - b.id;
      })
      .slice(0, 50)
      .map((team) => ({
        id: team.id,
        name: team.name,
        playerName: team.playerName,
      }));

    return NextResponse.json({
      results,
      total: results.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        results: [],
        error: "Failed to search teams",
      },
      { status: 500 }
    );
  }
}
