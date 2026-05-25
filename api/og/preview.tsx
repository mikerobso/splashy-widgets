// Horizontal OG share card preview — 1200×630 PNG generated at the edge
// via Satori (@vercel/og). Iteration target: feels genuinely premium in
// a chat thread (iMessage, WhatsApp, Slack, IG DM, X). Sample data
// only at this stage; once design is locked we'll swap to /api/og/[id]
// fed by Redis-stored share records. Query params (title, via, poster)
// let us iterate without touching code.

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const FALLBACK_TITLE  = 'Best brunch in downtown Raleigh';
const FALLBACK_VIA    = 'Visit Raleigh';
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=900&q=80';

// Pull a single Inter weight from Google Fonts as raw TTF so Satori
// can lay text with it (Satori needs binary font data, not CSS). The
// vintage User-Agent forces Google to serve TTF instead of WOFF2 —
// not every Satori build handles woff2 reliably.
async function loadInter(weight: 400 | 600 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.93 Safari/537.36',
        },
      }
    ).then((r) => r.text());
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/);
    if (!match) return null;
    const buf = await fetch(match[1]).then((r) => r.arrayBuffer());
    return buf;
  } catch {
    return null;
  }
}

export default async function handler(request: Request) {
  const url    = new URL(request.url);
  const title  = url.searchParams.get('title')  || FALLBACK_TITLE;
  const via    = url.searchParams.get('via')    || FALLBACK_VIA;
  const poster = url.searchParams.get('poster') || FALLBACK_POSTER;

  const [regular, semibold, bold] = await Promise.all([
    loadInter(400),
    loadInter(600),
    loadInter(700),
  ]);
  const fonts: any[] = [];
  if (regular)  fonts.push({ name: 'Inter', data: regular,  style: 'normal', weight: 400 });
  if (semibold) fonts.push({ name: 'Inter', data: semibold, style: 'normal', weight: 600 });
  if (bold)     fonts.push({ name: 'Inter', data: bold,     style: 'normal', weight: 700 });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          // Restrained radial gradient — subtle depth, no noise.
          backgroundImage: 'radial-gradient(ellipse at 30% 25%, #143a5f 0%, #06111f 75%)',
          backgroundColor: '#06111f',
          fontFamily: 'Inter',
        }}
      >
        {/* Foreground content row */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            padding: '56px 72px',
          }}
        >
          {/* Sharp 9:16 poster card with stacked shadow + play overlay */}
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: 291,
              height: 518,
              borderRadius: 20,
              overflow: 'hidden',
              // Two-layer shadow: long ambient + tight contact = real depth
              boxShadow:
                '0 48px 80px rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.4)',
              backgroundColor: '#000',
              flexShrink: 0,
            }}
          >
            <img
              src={poster}
              alt=""
              width={291}
              height={518}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* Play-button glyph — soft white disc with a triangle.
                Signals "this is a video" at a glance in chat threads. */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: -36,
                marginLeft: -36,
                width: 72,
                height: 72,
                borderRadius: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.92)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
            >
              {/* CSS triangle via borders */}
              <div
                style={{
                  display: 'flex',
                  width: 0,
                  height: 0,
                  marginLeft: 6,
                  borderTop: '12px solid transparent',
                  borderBottom: '12px solid transparent',
                  borderLeft: '20px solid #06111f',
                }}
              />
            </div>
          </div>

          {/* Text column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              paddingLeft: 72,
              color: 'white',
            }}
          >
            {/* Eyebrow: tiny uppercase brand in soft teal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.28em',
                color: '#7dd3e0',
                textTransform: 'uppercase',
                marginBottom: 28,
              }}
            >
              {via}
            </div>
            {/* Title — confident, tight, lots of presence */}
            <div
              style={{
                display: 'flex',
                fontSize: 76,
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: '-0.035em',
                color: '#ffffff',
              }}
            >
              {title}
            </div>
          </div>
        </div>

        {/* SPLSHY watermark, bottom-right corner */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            right: 56,
            display: 'flex',
            alignItems: 'center',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.34em',
            color: 'rgba(255,255,255,0.38)',
          }}
        >
          SPLSHY
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  );
}
