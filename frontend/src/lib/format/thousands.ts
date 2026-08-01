/** Strips everything but digits -- what actually gets stored/submitted. */
export function parseThousands(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

/** "1000" -> "1,000". Used to display a plain digit-string input with
 * separators as the person types, so a six-figure vote count reads at a
 * glance instead of as an undifferentiated string of digits. */
export function formatThousands(raw: string): string {
  const digits = parseThousands(raw);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}
