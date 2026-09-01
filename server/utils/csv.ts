/**
 * Phase 2 — Lightweight CSV Parser
 *
 * Handles CSV/TSV with comma, semicolon, or tab delimiters.
 * Supports quoted fields with embedded delimiters and newlines.
 * No external dependency.
 */

export interface CsvRow {
  [key: string]: string;
}

export function parseCsv(content: string): CsvRow[] {
  const lines = splitCsvLines(content);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue; // skip empty lines

    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(row);
  }

  return rows;
}

/** Split content into lines, respecting quoted newlines. */
function splitCsvLines(content: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '""';
      i += 2;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      i++;
      continue;
    }

    if ((char === '\n' || char === '\r\n' || (char === '\r' && !inQuotes)) && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 2;
      } else {
        i++;
      }
      lines.push(current);
      current = '';
      continue;
    }

    current += char;
    i++;
  }

  if (current.trim() !== '') {
    lines.push(current);
  }

  return lines;
}

/** Parse a single CSV line into values. */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let autoQuotes = false;
  let i = 0;

  // Detect delimiter
  const delimiter = detectDelimiter(line);

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      autoQuotes = true;
      i++;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(stripQuotes(current.trim()));
      current = '';
      autoQuotes = false;
      i++;
      continue;
    }

    current += char;
    i++;
  }

  values.push(stripQuotes(current.trim()));

  return values;
}

function detectDelimiter(line: string): string {
  // Check for tab first, then semicolon, then comma
  let tab = 0, semi = 0, comma = 0;
  for (const ch of line) {
    if (ch === '\t') tab++;
    else if (ch === ';') semi++;
    else if (ch === ',') comma++;
  }
  if (tab >= semi && tab >= comma && tab > 0) return '\t';
  if (semi >= comma && semi > 0) return ';';
  return ',';
}

function stripQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/""/g, '"');
  }
  return value;
}

/** Generate a sample CSV matching the existing CatalogUploadModal format. */
export function generateSampleCsv(): string {
  return `Reference,Designation,Categorie,Unite,Prix_HT_TND
PLA-BA13-STD,Plaque de plâtre BA13 Standard 1.2x2.5m,placo,unit,31.500
PLA-BA13-HYD,Plaque de plâtre BA13 Hydrofuge Verte 1.2x2.5m,placo,unit,47.800
ISOL-VERRE50,Laine de verre avec kraft 50mm (Rouleau 15m²),isolation,rouleau,78.000
DAL-VINYL60,Dalle de plafond démontable vinyle 60x60cm,placo,unit,5.800`;
}
