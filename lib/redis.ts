// Thin Upstash REST wrapper for edge functions. Uses the same Vercel-
// KV-style env var names that the Storage integration provisions on
// connection. Fallback chain covers both `KV_*` and `STORAGE_KV_*`
// naming so this works regardless of how the Vercel project was wired.

const URL =
  process.env.KV_REST_API_URL ||
  process.env.STORAGE_KV_REST_API_URL ||
  '';
const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.STORAGE_KV_REST_API_TOKEN ||
  '';

function ensureConfig(): void {
  if (!URL || !TOKEN) {
    throw new Error('Redis (Upstash) env vars not configured');
  }
}

export async function redisGet(key: string): Promise<string | null> {
  ensureConfig();
  const res = await fetch(`${URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result: string | null };
  return data?.result ?? null;
}

export async function redisSet(key: string, value: string): Promise<boolean> {
  ensureConfig();
  const res = await fetch(`${URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: value,
  });
  return res.ok;
}

export async function redisIncr(key: string): Promise<number | null> {
  ensureConfig();
  const res = await fetch(`${URL}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result: number };
  return typeof data?.result === 'number' ? data.result : null;
}
