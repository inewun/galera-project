const BASE = '/api';

type ApiErrorPayload = {
  message?: unknown;
  detail?: unknown;
  error?: unknown;
  _embedded?: {
    errors?: unknown;
  };
};

function uniqueMessages(messages: string[]): string[] {
  return Array.from(new Set(messages.map((item) => item.trim()).filter(Boolean)));
}

function collectMessages(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];

  const payload = value as ApiErrorPayload;
  const nested = Array.isArray(payload._embedded?.errors)
    ? payload._embedded.errors.flatMap(collectMessages)
    : [];
  const direct = typeof payload.message === 'string' ? [payload.message] : [];

  return [...nested, ...direct];
}

function parseJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonStart = text.indexOf('{');
    if (jsonStart === -1) return null;

    try {
      return JSON.parse(text.slice(jsonStart));
    } catch {
      return null;
    }
  }
}

function readableErrorMessage(status: number, statusText: string, text: string): string {
  const payload = parseJsonFromText(text) as ApiErrorPayload | null;

  if (payload) {
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;

    if (typeof payload.detail === 'string') {
      const detailPayload = parseJsonFromText(payload.detail);
      const detailMessages = uniqueMessages(collectMessages(detailPayload));
      if (detailMessages.length > 0) return detailMessages.join(' ');
      if (payload.detail.trim() && !payload.detail.includes('{')) return payload.detail;
    }

    if (payload.detail && typeof payload.detail === 'object') {
      const detailMessages = uniqueMessages(collectMessages(payload.detail));
      if (detailMessages.length > 0) return detailMessages.join(' ');
    }

    const messages = uniqueMessages(collectMessages(payload));
    if (messages.length > 0) return messages.join(' ');

    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  }

  return text.trim() || `${status} ${statusText}`;
}

async function raiseForStatus(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text();
  throw new Error(readableErrorMessage(res.status, res.statusText, text));
}

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);

  await raiseForStatus(res);

  return res.json() as Promise<T>;
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  await raiseForStatus(res);

  return res.json() as Promise<T>;
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  await raiseForStatus(res);

  return res.json() as Promise<T>;
}

export async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
  });

  await raiseForStatus(res);

  return res.json() as Promise<T>;
}
