// GET /api/og/<id> — production horizontal OG image, fed by the Redis
// share record at `share:<id>`. Used by /r/<id>'s og:image meta tag
// so chat-thread previews always render from canonical share data.

import { ImageResponse } from '@vercel/og';
import { HorizontalCard } from '../../lib/og-cards';
import { loadInterAll }   from '../../lib/og-fonts';
import { readShare }      from '../../lib/share';

export const config = { runtime: 'edge' };

const FALLBACK_TITLE  = 'Watch on SPLSHY';
const FALLBACK_VIA    = 'SPLSHY';
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=900&q=80';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // /api/og/<id>
  const id = url.pathname.replace(/^\/api\/og\//, '').replace(/\/$/, '');

  let title  = FALLBACK_TITLE;
  let via    = FALLBACK_VIA;
  let poster = FALLBACK_POSTER;

  if (id && /^[A-Za-z0-9_-]{4,16}$/.test(id)) {
    const rec = await readShare(id);
    if (rec) {
      title  = rec.title;
      via    = rec.via;
      poster = rec.poster;
    }
    // Missing record falls through to the placeholder card. We never
    // 404 the OG image because some social crawlers cache failures
    // aggressively and would never re-fetch.
  }

  const fonts = await loadInterAll();
  return new ImageResponse(
    <HorizontalCard title={title} via={via} poster={poster} />,
    {
      width: 1200,
      height: 630,
      fonts: fonts.length > 0 ? fonts : undefined,
      headers: {
        // Share records are immutable so the rendered image is too.
        // Long cache + immutable hint lets CDNs hold it indefinitely.
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    }
  );
}
