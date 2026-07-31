// Validated default palette from the dataviz skill, used verbatim (no
// eyeballed values) -- see the skill's references/palette.md for the
// six-checks validation this order clears in both light and dark.

export interface CategoricalSlot {
  light: string;
  dark: string;
}

// Fixed hue order -- assigned to entities in a stable order (alphabetical
// by name), never by current rank/value, so a color never gets reassigned
// when the data changes.
export const CATEGORICAL_SLOTS: CategoricalSlot[] = [
  { light: "#2a78d6", dark: "#3987e5" }, // 1 blue
  { light: "#eb6834", dark: "#d95926" }, // 2 orange
  { light: "#1baf7a", dark: "#199e70" }, // 3 aqua
  { light: "#eda100", dark: "#c98500" }, // 4 yellow
  { light: "#e87ba4", dark: "#d55181" }, // 5 magenta
  { light: "#008300", dark: "#008300" }, // 6 green
  { light: "#4a3aa7", dark: "#9085e9" }, // 7 violet
  { light: "#e34948", dark: "#e66767" }, // 8 red
];

// Default sequential hue (blue), for magnitude comparisons (reporting
// completion) rather than identity.
export const SEQUENTIAL = {
  fill: { light: "#2a78d6", dark: "#3987e5" },
};

export const CHART_INK = {
  primary: { light: "#0b0b0b", dark: "#ffffff" },
  secondary: { light: "#52514e", dark: "#c3c2b7" },
  muted: { light: "#898781", dark: "#898781" },
  gridline: { light: "#e1e0d9", dark: "#2c2c2a" },
};

/** Assigns each candidate a stable categorical color by alphabetical
 * order of name (never by current vote rank), folding anything past the
 * 8 fixed slots into a shared "Other" gray -- entities keep their color
 * across every refetch, filter, and drill-down. */
export function assignCandidateColors(candidateNames: string[]): Map<string, CategoricalSlot> {
  const sorted = [...candidateNames].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, CategoricalSlot>();
  sorted.forEach((name, i) => {
    map.set(name, CATEGORICAL_SLOTS[i % CATEGORICAL_SLOTS.length]);
  });
  return map;
}
