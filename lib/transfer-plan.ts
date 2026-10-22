// Shared rule for how many transfers to suggest and whether they're
// independent alternatives or one coordinated package, based on free
// transfers available. Used by both the client (for the pre-request badge)
// and the API route (for the actual prompt instructions), so they can't
// drift out of sync.

export type TransferPlanMode = "ALTERNATIVES" | "COORDINATED";

export interface TransferPlan {
  mode: TransferPlanMode;
  suggestionCount: number;
  isUnlimitedChip: boolean;
}

// The client encodes an active wildcard/free hit (unlimited transfers this
// gameweek) as a large sentinel value for freeTransfers.
export const UNLIMITED_TRANSFERS_SENTINEL = 15;

export function getTransferPlan(freeTransfers: number): TransferPlan {
  if (freeTransfers >= UNLIMITED_TRANSFERS_SENTINEL) {
    // Wildcard/Free Hit active - no point hits possible, suggest a fuller
    // coordinated refresh.
    return { mode: "COORDINATED", suggestionCount: 5, isUnlimitedChip: true };
  }
  if (freeTransfers <= 1) {
    // 0 free transfers (any transfer here would cost a hit) or exactly 1
    // free transfer: give independent single-player alternatives to choose
    // between, rather than forcing multiple moves that risk a point hit.
    return {
      mode: "ALTERNATIVES",
      suggestionCount: 3,
      isUnlimitedChip: false,
    };
  }
  // 2+ banked free transfers: suggest one coordinated package that uses
  // them all together, balanced against the combined budget.
  return {
    mode: "COORDINATED",
    suggestionCount: Math.min(freeTransfers, 5),
    isUnlimitedChip: false,
  };
}

// Free transfers accrue by 1 each gameweek (banking up to a max of 5) if
// not used. A manager with 1 free transfer now who doesn't use it will have
// 2 next gameweek; one with 0 will have the standard fresh 1. An active
// wildcard/free hit doesn't bank - next gameweek reverts to the standard 1.
export function getNextWeekFreeTransfers(thisWeekFreeTransfers: number): number {
  if (thisWeekFreeTransfers >= UNLIMITED_TRANSFERS_SENTINEL) return 1;
  return Math.min(thisWeekFreeTransfers + 1, 5);
}
