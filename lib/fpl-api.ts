import {
  BootstrapStatic,
  TeamPicks,
  TeamHistory,
  TeamInfo,
  LeagueStandings,
  LeagueStanding,
  Fixture,
  PlayerGameweekData,
} from "@/types/fpl";

export async function getBootstrapStatic(): Promise<BootstrapStatic> {
  const response = await fetch("/api/bootstrap-static");
  if (!response.ok) {
    throw new Error("Failed to fetch bootstrap static data");
  }
  return response.json();
}

export async function getTeamPicks(
  teamId: number,
  event: number
): Promise<TeamPicks> {
  const response = await fetch(`/api/team/${teamId}/event/${event}/picks`);
  if (!response.ok) {
    throw new Error("Failed to fetch team picks");
  }
  return response.json();
}

export async function getTeamHistory(teamId: number): Promise<TeamHistory> {
  const response = await fetch(`/api/team/${teamId}/history`);
  if (!response.ok) {
    throw new Error("Failed to fetch team history");
  }
  return response.json();
}

export async function getTeamInfo(teamId: number): Promise<TeamInfo> {
  const response = await fetch(`/api/team/${teamId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch team info");
  }
  return response.json();
}

export async function getLeagueStandings(
  leagueId: number,
  page: number = 1
): Promise<LeagueStandings> {
  const response = await fetch(
    `/api/league/${leagueId}/standings?page=${page}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch league standings");
  }
  return response.json();
}

export async function getLeagueStandingsWithUserStats(
  leagueId: number,
  userTeamId?: number
): Promise<{ standings: LeagueStandings; userStats?: any }> {
  //console.log("getLeagueStandingsWithUserStats called with:", {
  //   leagueId,
  //   userTeamId,
  // });

  // Get the first page of league standings
  const standings = await getLeagueStandings(leagueId, 1);

  // If no user team ID provided, just return the standings
  if (!userTeamId) {
    //console.log("No userTeamId provided, returning standings only");
    return { standings };
  }

  // Check if user is in the first page
  const userInFirstPage = standings.standings.results.find(
    (standing) => standing.entry === userTeamId
  );

  if (userInFirstPage) {
    //console.log("User found in first page, no need for separate user stats");
    return { standings };
  }

  // User not in first page, get their current team stats
  try {
    //console.log("User not in first page, fetching user team stats...");
    const teamResponse = await fetch(`/api/team/${userTeamId}`);
    if (teamResponse.ok) {
      const teamData = await teamResponse.json();

      // Get current gameweek from bootstrap data
      const bootstrapResponse = await fetch("/api/bootstrap-static");
      let currentGW = 1;
      let eventTotal = 0;

      if (bootstrapResponse.ok) {
        const bootstrapData = await bootstrapResponse.json();
        const currentEvent = bootstrapData.events.find(
          (e: any) => e.is_current
        );
        currentGW = currentEvent ? currentEvent.id : 1;

        // Get the current gameweek picks to get event total
        const picksResponse = await fetch(
          `/api/team/${userTeamId}/event/${currentGW}/picks`
        );
        if (picksResponse.ok) {
          const picksData = await picksResponse.json();
          eventTotal = picksData.entry_history?.points || 0;
        }
      }

      const userStats = {
        entry: userTeamId,
        entry_name: teamData.name,
        player_name: `${teamData.player_first_name} ${teamData.player_last_name}`,
        rank: null, // Don't show rank as it's expensive to calculate
        last_rank: null,
        event_total: eventTotal,
        total: teamData.summary_overall_points,
      };

      //console.log("User stats created:", userStats);
      return { standings, userStats };
    }
  } catch (error) {
    console.warn("Failed to fetch user team stats:", error);
  }

  return { standings };
}

export async function getLiveGameweekData(event: number) {
  const response = await fetch(`/api/event/${event}/live`);
  if (!response.ok) {
    throw new Error("Failed to fetch live gameweek data");
  }
  return response.json();
}

export async function getFixtures(): Promise<Fixture[]> {
  const response = await fetch("/api/fixtures");
  if (!response.ok) {
    throw new Error("Failed to fetch fixtures");
  }
  return response.json();
}

export async function getTeamNews(): Promise<any> {
  const response = await fetch("/api/team-news");
  if (!response.ok) {
    throw new Error("Failed to fetch team news");
  }
  return response.json();
}

export async function getPlayerGameweeks(
  playerId: number
): Promise<PlayerGameweekData> {
  const response = await fetch(`/api/player/${playerId}/gameweeks`);
  if (!response.ok) {
    throw new Error("Failed to fetch player gameweek data");
  }
  return response.json();
}

export async function generateTeamInsights(
  teamData: any,
  squadData: any,
  currentGameweek: number,
  gameweekFinished: boolean = false,
  fixtures: any[] = [],
  elements: any[] = []
): Promise<{ insights: string; fallback?: boolean }> {
  const response = await fetch("/api/team-insights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamData,
      squadData,
      currentGameweek,
      gameweekFinished,
      fixtures,
      elements,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate team insights");
  }

  // Check if it's a streaming response
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("text/plain")) {
    // Handle streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;
      }
    }

    return { insights: accumulatedContent };
  } else {
    // Handle regular JSON response (fallback)
    return response.json();
  }
}

export async function generateTransferSuggestions(
  teamData: any,
  squadData: any,
  elements: any[],
  currentGameweek: number,
  gameweekFinished: boolean = false,
  fixtures: any[] = [],
  bankBalance: number,
  freeTransfers: number,
  numberOfTransfers: number
): Promise<{
  analysis: string;
  fallback?: boolean;
  ragDataAvailable?: boolean;
}> {
  const response = await fetch("/api/transfer-suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamData,
      squadData,
      elements,
      currentGameweek,
      gameweekFinished,
      fixtures,
      bankBalance,
      freeTransfers,
      numberOfTransfers,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate transfer suggestions");
  }

  // Check if it's a streaming response
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("text/plain")) {
    // Handle streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;
      }
    }

    return { analysis: accumulatedContent };
  } else {
    // Handle regular JSON response (fallback)
    return response.json();
  }
}
