/** Treats hyphens/underscores as spaces (then collapses whitespace) so a
 * search for "oke ado" matches a polling unit named "OKE-ADO" and vice
 * versa -- the source data hyphenates some place names inconsistently,
 * and requiring the exact separator to match made those units
 * unfindable by anyone who typed the name the "wrong" way. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface SearchablePU {
  pu_name: string;
  ward: string;
  lga: string;
  pu_code: string;
  yardcode?: string;
}

/** Shared by every polling-unit search box (admin map, admin PU list,
 * field PU picker). `query` should already be trimmed and lowercased --
 * codes/yardcodes match it as typed, name/ward/LGA match a further
 * hyphen-insensitive normalization of it. */
export function matchesPollingUnitQuery(pu: SearchablePU, query: string): boolean {
  const normalizedQuery = normalizeSearch(query);
  return (
    normalizeSearch(pu.pu_name).includes(normalizedQuery) ||
    normalizeSearch(pu.ward).includes(normalizedQuery) ||
    normalizeSearch(pu.lga).includes(normalizedQuery) ||
    pu.pu_code.toLowerCase().includes(query) ||
    (pu.yardcode ?? "").toLowerCase().includes(query)
  );
}
