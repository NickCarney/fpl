// Turns FPL's raw status/chance_of_playing_next_round fields into a clear,
// non-contradictory label. FPL's own "doubtful" status covers anything from
// 75% (likely to play) down to 25% (unlikely) - showing the word "Doubtful"
// next to "75% chance of playing" reads as contradictory, so lead with the
// percentage instead and only fall back to the status word when there's no
// percentage to show.

export interface AvailabilityInfo {
  label: string;
  chanceOfPlaying: number | null;
  news: string;
  isInjuryOrDoubtContext: boolean;
}

export function getAvailability(
  status: string | undefined,
  chanceOfPlaying: number | null | undefined,
  news: string | undefined
): AvailabilityInfo | null {
  if (!status || status === "a") return null;

  const chance = chanceOfPlaying ?? null;
  const newsText = news || "";
  const isInjuryOrDoubtContext = status === "i" || status === "d";

  let label: string;
  if (status === "s") {
    label = "Suspended";
  } else if (status === "u") {
    label = "Unavailable (not registered/left club)";
  } else if (status === "n") {
    label = "Not available for selection";
  } else if (chance === 0) {
    label = "Ruled out (0% chance of playing)";
  } else if (chance === 25) {
    label = "Unlikely to play (25% chance)";
  } else if (chance === 50) {
    label = "50/50 to play (50% chance)";
  } else if (chance === 75) {
    label = "Likely to play (75% chance)";
  } else if (chance !== null) {
    label = `${chance}% chance of playing`;
  } else {
    label = status === "i" ? "Injured (no return date given)" : "Fitness doubt";
  }

  return { label, chanceOfPlaying: chance, news: newsText, isInjuryOrDoubtContext };
}

export function formatAvailability(info: AvailabilityInfo): string {
  return info.news ? `${info.label} - ${info.news}` : info.label;
}
