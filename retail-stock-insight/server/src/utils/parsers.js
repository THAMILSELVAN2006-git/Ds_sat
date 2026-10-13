import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import path from 'path';
import { config } from '../config/index.js';

/**
 * Parse a CSV file and return array of objects.
 * Logs row counts and any skipped rows.
 */
export async function parseCSV(filename, options = {}) {
  const filePath = path.join(config.dataDir, filename);
  return new Promise((resolve, reject) => {
    const records = [];
    const parser = createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: options.cast || false,
        ...options.parseOptions,
      })
    );
    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });
    parser.on('error', (err) => reject(new Error(`CSV parse error in ${filename}: ${err.message}`)));
    parser.on('end', () => {
      console.log(`[CSV] Loaded ${records.length} rows from ${filename}`);
      resolve(records);
    });
  });
}

/**
 * Parse ISO date string - returns Date or throws
 */
export function parseDate(str, fieldName = 'date') {
  if (!str || typeof str !== 'string') throw new Error(`Missing ${fieldName}`);
  const d = new Date(str.trim());
  if (isNaN(d.getTime())) throw new Error(`Invalid ${fieldName}: "${str}"`);
  return d;
}

/**
 * Parse float strictly
 */
export function parseFloat2(val, fieldName = 'value') {
  const n = parseFloat(val);
  if (isNaN(n)) throw new Error(`Invalid numeric ${fieldName}: "${val}"`);
  return n;
}

/**
 * Parse int strictly
 */
export function parseInt2(val, fieldName = 'value') {
  const n = parseInt(val, 10);
  if (isNaN(n)) throw new Error(`Invalid integer ${fieldName}: "${val}"`);
  return n;
}
