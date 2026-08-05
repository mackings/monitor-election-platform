/** Ranks every party present in a vote_counts map by total votes,
 * descending -- used both as the collation page's party leaderboard and
 * as the option order for a party filter dropdown, so a party's rank
 * position is consistent everywhere it's shown. */
export function partyTotals(voteCounts: Record<string, number> | undefined): { party: string; votes: number }[] {
  return Object.entries(voteCounts ?? {})
    .map(([party, votes]) => ({ party, votes }))
    .sort((a, b) => b.votes - a.votes);
}

/** The vote figure to show for one row given the current party filter --
 * that party's count alone, or the total across every party when "all"
 * parties are selected. Centralized so the three collation views (state
 * summary, per-PU list, per-submission list) can't drift on what "all"
 * means. */
export function projectedVotes(voteCounts: Record<string, number> | undefined, party: string): number {
  if (!voteCounts) return 0;
  if (party === "all") return Object.values(voteCounts).reduce((sum, n) => sum + n, 0);
  return voteCounts[party] ?? 0;
}
