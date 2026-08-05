/** Minimal RFC 4180-ish CSV parser -- handles quoted fields (including
 * embedded commas/newlines and escaped `""` quotes), which a naive
 * `line.split(",")` would mangle on any real-world export from Excel or
 * Google Sheets. No library: this is the entire surface area needed. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-blank lines (trailing newline at EOF, blank rows mid-file).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export interface OfficerCsvRow {
  name: string;
  phone: string;
  email: string;
  assigned_pu_code: string;
}

export interface ParsedOfficerCsv {
  rows: OfficerCsvRow[];
  error?: string;
}

/** Parses an uploaded CSV into officer-import rows. Requires a header row
 * with at least a `name` column (case-insensitive); `phone`/`email`/
 * `assigned_pu_code` are optional both here and server-side, so a missing
 * column just means every row gets "" for it rather than a parse error. */
export function parseOfficerCsv(text: string): ParsedOfficerCsv {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], error: "The file is empty." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) {
    return { rows: [], error: 'Missing a "name" column — check the file has a header row.' };
  }
  const phoneIdx = header.indexOf("phone");
  const emailIdx = header.indexOf("email");
  const puIdx = header.indexOf("assigned_pu_code");

  const rows: OfficerCsvRow[] = table
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => ({
      name: (r[nameIdx] ?? "").trim(),
      phone: phoneIdx !== -1 ? (r[phoneIdx] ?? "").trim() : "",
      email: emailIdx !== -1 ? (r[emailIdx] ?? "").trim() : "",
      assigned_pu_code: puIdx !== -1 ? (r[puIdx] ?? "").trim() : "",
    }));

  if (rows.length === 0) return { rows: [], error: "No data rows found below the header." };
  return { rows };
}
