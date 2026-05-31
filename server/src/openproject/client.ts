import { config } from '../config.js';
import type { HalCollection } from './types.js';

/**
 * Builds a Basic authorisation header value for the OpenProject API.
 */
function basicAuthHeader(): string {
  const encoded = Buffer.from(`apikey:${config.opApiKey}`).toString('base64');
  return `Basic ${encoded}`;
}

/** Shared headers sent with every request. */
function defaultHeaders(): Record<string, string> {
  return {
    Authorization: basicAuthHeader(),
    Accept: 'application/json',
  };
}

/**
 * Performs a GET request to the OpenProject API.
 * Throws if the response status is not 2xx.
 */
export async function opGet<T>(path: string): Promise<T> {
  const url = `${config.opBaseUrl}${path}`;
  const response = await fetch(url, { headers: defaultHeaders() });

  if (!response.ok) {
    const body = await response.text().catch(() => '(unable to read body)');
    throw new Error(
      `OpenProject API error: GET ${path} – ${response.status} ${response.statusText}\n${body}`,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Fetches every page of a paginated HAL collection and returns a flat array of
 * all elements across pages.
 *
 * @param path    – API path, e.g. `/api/v3/work_packages`
 * @param query   – optional query parameters to forward on every page
 */
export async function getCollection<T>(
  path: string,
  query?: Record<string, string | number>,
): Promise<T[]> {
  const allElements: T[] = [];
  const pageSize = 100;
  let offset = 1;
  let total = Infinity;

  while (allElements.length < total) {
    const params = new URLSearchParams(
      query as Record<string, string>,
    );
    params.set('pageSize', String(pageSize));
    params.set('offset', String(offset));

    const separator = path.includes('?') ? '&' : '?';
    const pagePath = `${path}${separator}${params.toString()}`;

    const page = await opGet<HalCollection<T>>(pagePath);

    total = page.total;
    allElements.push(...page._embedded.elements);

    // Safety: if the page returned zero elements, break to avoid an infinite loop
    if (page._embedded.elements.length === 0) break;

    offset += 1; // OpenProject uses page number (1,2,3…), NOT element offset
  }

  return allElements;
}

/**
 * Extracts the numeric ID from a HAL href.
 *
 * Example: `/api/v3/users/42` → `"42"`
 *          `null`             → `null`
 *          `""`               → `null`
 */
export function idFromHref(href: string | null): string | null {
  if (!href) return null;
  const segments = href.split('/').filter(Boolean);
  const last = segments.at(-1);
  return last ?? null;
}
