// Shared rule for excluding fringe/unused players from AI analysis and suggestions.
// A player must have played at least 1/3 of the season's possible minutes
// (games played so far * 90) to be considered "valid" data.

export function getGamesPlayed(
  currentGameweek: number,
  gameweekFinished: boolean
): number {
  const played = gameweekFinished ? currentGameweek : currentGameweek - 1;
  return Math.max(played, 1);
}

export function getMinValidMinutes(gamesPlayed: number): number {
  return (gamesPlayed * 90) / 3;
}

export function isValidPlayer(minutes: number, gamesPlayed: number): boolean {
  return minutes >= getMinValidMinutes(gamesPlayed);
}
