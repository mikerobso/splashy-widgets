// GET /api/og-vertical/<id> — production vertical 9:16 OG image, fed
// by the Redis share record at `share:<id>`. Used by /r/<id>'s
// og:image:secure_url meta and offered by the widget's "Share to
// Story" flow as an attachable image.

import { ImageResponse } from '@vercel/og';
import { VerticalCard } from '../../lib/og-cards';
import { loadInterAll } from '../../lib/og-fonts';
import { readShare }    from '../../lib/share';

export const config = { runtime: 'edge' };

const FALLBACK_TITLE  = 'Watch on SPLSHY';
const FALLBACK_VIA    = 'SPLSHY';
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1080&q=85';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 1] || '';

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
  }

  const fonts = await loadInterAll();
  return new ImageResponse(
    <VerticalCard title={title} via={via} poster={poster} />,
    {
      width: 1080,
      height: 1920,
      fonts: fonts.length > 0 ? fonts : undefined,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    }
  );
}
