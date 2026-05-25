// Share record storage + helpers. Each /r/<id> URL maps to a record
// in Redis under `share:<id>`. Records are immutable once written and
// have no TTL — viral content should keep working indefinitely.

import { redisGet, redisSet } from './redis';

export type ShareRecord = {
  videoUrl:  string;   // direct mp4 / playable URL
  pageUrl:   string;   // visitraleigh.com page the widget was embedded on
  reelId:    string;   // djb2 hash of videoUrl — used by the widget to deep-link
  title:     string;
  via:       string;   // "Visit Raleigh"
  poster:    string;   // url
  clientId?: string;
  createdAt: number;   // ms epoch
};

const SHARE_PREFIX = 'share:';
const SHORT_ID_BYTES = 6;   // -> 8 base64url chars

// 8-char base64url id (62^8 ≈ 218T combinations). Crypto-random, no
// per-process counter so concurrent edge instances don't collide.
export function generateShareId(): string {
  const bytes = new Uint8Array(SHORT_ID_BYTES);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// djb2 hash of the video URL — mirrors the widget-side reelId so the
// deep-link hash on the destination page resolves to the right reel.
export function reelIdForUrl(u: string): string {
  if (!u) return '';
  let h = 5381;
  for (let i = 0; i < u.length; i++) h = ((h << 5) + h + u.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function writeShare(id: string, rec: ShareRecord): Promise<boolean> {
  return redisSet(SHARE_PREFIX + id, JSON.stringify(rec));
}

export async function readShare(id: string): Promise<ShareRecord | null> {
  const raw = await redisGet(SHARE_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShareRecord;
  } catch {
    return null;
  }
}

// Strict-ish input validation. URLs must be https.
export function validateShareInput(body: any): ShareRecord | string {
  if (!body || typeof body !== 'object') return 'invalid body';
  const { videoUrl, pageUrl, title, via, poster, clientId } = body;
  for (const [k, v] of Object.entries({ videoUrl, pageUrl, title, via, poster })) {
    if (typeof v !== 'string' || !v.trim()) return `missing field: ${k}`;
  }
  if (!/^https:\/\//i.test(videoUrl)) return 'videoUrl must be https';
  if (!/^https:\/\//i.test(pageUrl))  return 'pageUrl must be https';
  if (!/^https:\/\//i.test(poster))   return 'poster must be https';
  if (title.length  > 240) return 'title too long';
  if (via.length    > 120) return 'via too long';
  if (videoUrl.length > 1000 || pageUrl.length > 1000) return 'url too long';
  return {
    videoUrl, pageUrl, title, via, poster,
    reelId:    reelIdForUrl(videoUrl),
    clientId:  typeof clientId === 'string' ? clientId : undefined,
    createdAt: Date.now(),
  };
}
