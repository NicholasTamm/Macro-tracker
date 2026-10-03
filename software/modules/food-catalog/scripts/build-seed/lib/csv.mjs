import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * Minimal RFC4180-ish CSV parser supporting quoted fields.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function readRow() {
    const fields = [];
    let field = '';
    let inQuotes = false;
    while (i < len) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += c;
        i += 1;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (c === ',') {
        fields.push(field);
        field = '';
        i += 1;
        continue;
      }
      if (c === '\r') {
        i += 1;
        continue;
      }
      if (c === '\n') {
        fields.push(field);
        i += 1;
        return fields;
      }
      field += c;
      i += 1;
    }
    if (field.length > 0 || fields.length > 0) {
      fields.push(field);
      return fields;
    }
    return null;
  }

  const headerFields = readRow();
  if (!headerFields) return [];
  const headers = headerFields.map((h) => h.replace(/^\uFEFF/, '').trim());

  while (true) {
    const fields = readRow();
    if (!fields) break;
    if (fields.length === 1 && fields[0] === '' && i >= len) break;
    const obj = {};
    for (let h = 0; h < headers.length; h += 1) {
      obj[headers[h]] = fields[h] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

/** @param {string} filePath */
export async function readCsvFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  return parseCsv(text);
}

/**
 * Stream large CSV files line-by-line (still loads parsed rows for matching ids).
 * Prefer readCsvFile for fixtures; this is for full USDA extracts when filtered.
 * @param {string} filePath
 * @param {(row: Record<string, string>) => void | boolean} onRow return false to stop
 */
export async function forEachCsvRow(filePath, onRow) {
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let headers = null;
  let buffer = '';
  let inQuotes = false;

  for await (const line of rl) {
    if (!headers) {
      // handle multi-line header unlikely; first line is header
      buffer = buffer ? `${buffer}\n${line}` : line;
      // count quotes
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
      }
      if (inQuotes) continue;
      const headerRow = parseCsv(buffer + '\n')[0];
      // parseCsv on header-only needs newline trick — reparse properly:
      const parsed = parseCsv(buffer + '\n_dummy\n');
      // Actually easier: use parseCsv on accumulated when complete
      headers = parseCsvHeader(buffer);
      buffer = '';
      inQuotes = false;
      continue;
    }
    buffer = buffer ? `${buffer}\n${line}` : line;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
    }
    if (inQuotes) continue;
    const values = parseCsvLine(buffer);
    buffer = '';
    const row = {};
    for (let h = 0; h < headers.length; h += 1) {
      row[headers[h]] = values[h] ?? '';
    }
    const cont = onRow(row);
    if (cont === false) break;
  }
}

function parseCsvHeader(line) {
  return parseCsvLine(line).map((h) => h.replace(/^\uFEFF/, '').trim());
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}
