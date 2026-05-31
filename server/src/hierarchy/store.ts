import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Path to the local JSON file that stores the group hierarchy. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, 'hierarchy.json');

/**
 * A map of group id → parent group id (or null for root groups).
 */
export type HierarchyMap = Record<string, string | null>;

/**
 * Reads the hierarchy from the local JSON file.
 * Returns an empty object if the file does not exist.
 */
export async function readHierarchy(): Promise<HierarchyMap> {
  try {
    if (!existsSync(FILE_PATH)) {
      return {};
    }
    const raw = await readFile(FILE_PATH, 'utf-8');
    return JSON.parse(raw) as HierarchyMap;
  } catch (err) {
    throw new Error(
      `Failed to read hierarchy file at ${FILE_PATH}: ${(err as Error).message}`,
    );
  }
}

/**
 * Validates that the provided value is a valid HierarchyMap
 * (an object where every value is a string or null).
 */
function isValidHierarchy(value: unknown): value is HierarchyMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  for (const val of Object.values(value)) {
    if (typeof val !== 'string' && val !== null) {
      return false;
    }
  }
  return true;
}

/**
 * Writes the hierarchy to the local JSON file.
 * Validates the input before writing.
 * Creates the data directory if it does not exist.
 * Returns the saved map.
 */
export async function writeHierarchy(map: HierarchyMap): Promise<HierarchyMap> {
  if (!isValidHierarchy(map)) {
    throw new Error(
      'Invalid hierarchy: expected an object with string | null values',
    );
  }

  try {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }

    const json = JSON.stringify(map, null, 2);
    await writeFile(FILE_PATH, json, 'utf-8');

    return map;
  } catch (err) {
    throw new Error(
      `Failed to write hierarchy file at ${FILE_PATH}: ${(err as Error).message}`,
    );
  }
}
