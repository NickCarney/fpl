import {
  BootstrapStatic,
  TeamPicks,
  TeamHistory,
  LeagueStandings,
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

  return response.json();
}

export async function generateTransferSuggestions(
  teamData: any,
  squadData: any,
  elements: any[],
  currentGameweek: number,
  gameweekFinished: boolean = false,
  fixtures: any[] = [],
  bankBalance: number = 0,
  freeTransfers: number = 1
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
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate transfer suggestions");
  }

  return response.json();
}
