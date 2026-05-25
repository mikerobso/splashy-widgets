// Vertical 9:16 share image — 1080×1920 PNG generated at the edge via
// Satori (@vercel/og). Intended for "Share to Instagram Story" /
// TikTok / Snapchat flows where the image is uploaded as a file (not
// a URL preview). Composition: full-bleed poster on top, soft gradient
// transition into a SPLSHY-orange band on the bottom that holds the
// eyebrow + title + brand mark. Critical content stays inside IG
// Story safe zones (top ~250px and bottom ~250px get partially covered
// by IG's chrome).

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const FALLBACK_TITLE  = 'Best brunch in downtown Raleigh';
const FALLBACK_VIA    = 'Visit Raleigh';
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1080&q=85';

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

  // Layout geometry (1080 × 1920):
  //   y=0    → 1100   : poster zone (full bleed, top-anchored crop)
  //   y=1100 → 1280   : soft gradient fade from poster into orange
  //   y=1280 → 1920   : orange brand band (eyebrow + title + mark)
  const POSTER_H        = 1100;
  const FADE_END        = 1280;
  const PLAY_BTN_SIZE   = 140;
  const PLAY_BTN_TOP    = Math.round(POSTER_H / 2) - Math.round(PLAY_BTN_SIZE / 2);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          // Orange gradient lives on the root so it shows through the
          // bottom band. Anchor the highlight in the upper part of the
          // visible orange (the poster covers the top of the canvas).
          backgroundImage:
            'radial-gradient(ellipse at 25% 60%, #ffb088 0%, #ff8c5a 15%, #e85d2e 45%, #a02f08 100%)',
          backgroundColor: '#e85d2e',
          fontFamily: 'Inter',
        }}
      >
        {/* Full-bleed poster, top-anchored crop so action stays in frame */}
        <img
          src={poster}
          alt=""
          width={1080}
          height={POSTER_H}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1080,
            height: POSTER_H,
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />

        {/* Soft gradient fade — poster fades into orange. 180px tall
            band starting at the poster's bottom edge. */}
        <div
          style={{
            position: 'absolute',
            top: POSTER_H - 60,    // start fade slightly before poster ends
            left: 0,
            width: 1080,
            height: FADE_END - POSTER_H + 60,
            display: 'flex',
            backgroundImage:
              'linear-gradient(180deg, rgba(232,93,46,0) 0%, rgba(232,93,46,0.85) 60%, #e85d2e 100%)',
          }}
        />

        {/* Play-button glyph — soft white disc with SVG triangle.
            Centered in the visible poster area. Size scales with the
            larger canvas (140px vs 80px on horizontal). */}
        <div
          style={{
            position: 'absolute',
            top: PLAY_BTN_TOP,
            left: 540 - Math.round(PLAY_BTN_SIZE / 2),
            width: PLAY_BTN_SIZE,
            height: PLAY_BTN_SIZE,
            borderRadius: PLAY_BTN_SIZE / 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.96)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
          }}
        >
          <svg
            width="48"
            height="56"
            viewBox="0 0 28 32"
            style={{ display: 'block', marginLeft: 6 }}
          >
            <polygon points="2,2 26,16 2,30" fill="#1a2438" />
          </svg>
        </div>

        {/* Text column — eyebrow + title. Lives in the orange band. */}
        <div
          style={{
            position: 'absolute',
            top: 1340,
            left: 80,
            right: 80,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Eyebrow: tiny uppercase brand in deep navy */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.26em',
              color: '#1a2438',
              textTransform: 'uppercase',
              marginBottom: 36,
            }}
          >
            {via}
          </div>
          {/* Title — confident, tight, lots of presence */}
          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.035em',
              color: '#ffffff',
            }}
          >
            {title}
          </div>
        </div>

        {/* SPLSHY watermark — bottom-right, just inside the IG Story
            safe zone (bottom ~250px gets covered by IG's send-message UI). */}
        <div
          style={{
            position: 'absolute',
            bottom: 290,
            right: 80,
            display: 'flex',
            alignItems: 'center',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.34em',
            color: 'rgba(26,36,56,0.55)',
          }}
        >
          SPLSHY
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  );
}
