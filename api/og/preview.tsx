// Horizontal OG share card preview — 1200×630 PNG generated at the edge
// via Satori (@vercel/og). Sample data only at this stage; once design
// is locked we'll swap to /api/og/[shareId] fed by Redis-stored share
// records. Query params (title, via, poster) let us iterate without
// touching code.

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const FALLBACK_TITLE  = 'Best brunch in downtown Raleigh';
const FALLBACK_VIA    = 'VisitRaleigh';
// Unsplash food image — temporary stand-in for the actual Vimeo poster.
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=900&q=80';

export default async function handler(request: Request) {
  const url    = new URL(request.url);
  const title  = url.searchParams.get('title')  || FALLBACK_TITLE;
  const via    = url.searchParams.get('via')    || FALLBACK_VIA;
  const poster = url.searchParams.get('poster') || FALLBACK_POSTER;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#082440',
        }}
      >
        {/* Backdrop layer: same poster scaled up. Satori has no blur
            filter, so we soften with a heavy dark gradient on top. */}
        <img
          src={poster}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.35)',
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            backgroundImage: 'linear-gradient(135deg, rgba(8,36,64,0.7) 0%, rgba(8,36,64,0.94) 100%)',
          }}
        />

        {/* Foreground content row */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            padding: '64px 72px',
          }}
        >
          {/* Sharp 9:16 poster card */}
          <div
            style={{
              display: 'flex',
              width: 282,
              height: 502,
              borderRadius: 22,
              overflow: 'hidden',
              boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
              backgroundColor: '#000',
              flexShrink: 0,
            }}
          >
            <img
              src={poster}
              alt=""
              width={282}
              height={502}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* Text column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              paddingLeft: 64,
              color: 'white',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                marginBottom: 28,
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 26,
                fontWeight: 500,
                opacity: 0.82,
              }}
            >
              via {via}
            </div>
          </div>
        </div>

        {/* SPLSHY watermark, bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            right: 64,
            display: 'flex',
            alignItems: 'center',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.20em',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          SPLSHY
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
