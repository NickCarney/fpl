import {
  BootstrapStatic,
  TeamPicks,
  TeamHistory,
  LeagueStandings,
  Fixture,
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
