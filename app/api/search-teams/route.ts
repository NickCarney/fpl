import { NextRequest, NextResponse } from "next/server";

// We'll use a sample of popular league IDs to search through
// In production, you'd want to maintain a database of teams or use FPL's search if available
const POPULAR_LEAGUE_IDS = [
  314, // Official FPL league
  633, // Another popular league
  724869, // Example league
  // Add more popular league IDs here
];

async function fetchTeamsFromLeague(leagueId: number) {
  try {
    const response = await fetch(
      `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.standings?.results || [];
  } catch (error) {
    console.error(`Failed to fetch league ${leagueId}:`, error);
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
    // Fetch teams from multiple leagues
    const allTeamsPromises = POPULAR_LEAGUE_IDS.map(fetchTeamsFromLeague);
    const leagueResults = await Promise.allSettled(allTeamsPromises);

    // Combine all teams and remove duplicates
    const allTeams = new Map();

    leagueResults.forEach((result) => {
      if (result.status === "fulfilled") {
        result.value.forEach((team: any) => {
          if (team.entry && team.entry_name && team.player_name) {
            allTeams.set(team.entry, {
              id: team.entry,
              name: team.entry_name,
              playerName: team.player_name,
              rank: team.rank || 0,
            });
          }
        });
      }
    });

    // Convert to array and filter by search query
    const teamsArray = Array.from(allTeams.values());

    const results = teamsArray
      .filter(
        (team: any) =>
          team.name.toLowerCase().includes(query) ||
          team.playerName.toLowerCase().includes(query)
      )
      .sort((a: any, b: any) => {
        // Prioritize exact matches at the beginning
        const aNameMatch = a.name.toLowerCase().startsWith(query);
        const bNameMatch = b.name.toLowerCase().startsWith(query);

        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        // Then sort by rank (lower is better)
        return a.rank - b.rank;
      })
      .slice(0, 50); // Return more results

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
