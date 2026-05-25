// Vertical 9:16 share card preview — design-iteration endpoint. Takes
// query params (title, via, poster) so we can iterate visually
// without touching code. Production endpoint at
// /api/og-vertical/[id].tsx pulls the same data from a Redis share
// record instead.

import { ImageResponse } from '@vercel/og';
import { VerticalCard } from '../../lib/og-cards';
import { loadInterAll } from '../../lib/og-fonts';

export const config = { runtime: 'edge' };

const FALLBACK_TITLE  = 'Best brunch in downtown Raleigh';
const FALLBACK_VIA    = 'Visit Raleigh';
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1080&q=85';

export default async function handler(request: Request) {
  const url    = new URL(request.url);
  const title  = url.searchParams.get('title')  || FALLBACK_TITLE;
  const via    = url.searchParams.get('via')    || FALLBACK_VIA;
  const poster = url.searchParams.get('poster') || FALLBACK_POSTER;
  const fonts  = await loadInterAll();

  return new ImageResponse(
    <VerticalCard title={title} via={via} poster={poster} />,
    {
      width: 1080,
      height: 1920,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  );
}
