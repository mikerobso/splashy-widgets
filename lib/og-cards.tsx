// Shared share-card components. Both the preview endpoints (used for
// design iteration with query-param data) and the production /api/og/
// endpoints (fed by Redis records) render through these so design
// changes happen in one place. Each component takes (title, via,
// poster) and returns a JSX tree that Satori can render.

export type CardProps = {
  title:  string;
  via:    string;
  poster: string;
};

const ORANGE_GRADIENT_RADIAL =
  'radial-gradient(circle at 18% 12%, #ffb088 0%, #ff8c5a 20%, #e85d2e 50%, #a02f08 100%)';

const ORANGE_GRADIENT_VERTICAL =
  'radial-gradient(ellipse at 25% 60%, #ffb088 0%, #ff8c5a 15%, #e85d2e 45%, #a02f08 100%)';

// ────────────────────────────────────────────────────────────────────
// Horizontal — 1200 × 630. Standard OG/Twitter card aspect.
// ────────────────────────────────────────────────────────────────────
export function HorizontalCard({ title, via, poster }: CardProps): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundImage: ORANGE_GRADIENT_RADIAL,
        backgroundColor: '#e85d2e',
        fontFamily: 'Inter',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          padding: '56px 72px',
        }}
      >
        {/* Sharp 9:16 poster card with play overlay */}
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: 291,
            height: 518,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 48px 80px rgba(60,15,5,0.45), 0 8px 20px rgba(60,15,5,0.35)',
            backgroundColor: '#000',
            flexShrink: 0,
          }}
        >
          <img
            src={poster}
            alt=""
            width={291}
            height={518}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: -40,
              marginLeft: -40,
              width: 80,
              height: 80,
              borderRadius: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.96)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            }}
          >
            <svg
              width="28"
              height="32"
              viewBox="0 0 28 32"
              style={{ display: 'block', marginLeft: 4 }}
            >
              <polygon points="2,2 26,16 2,30" fill="#1a2438" />
            </svg>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.28em',
              color: '#1a2438',
              textTransform: 'uppercase',
              marginBottom: 28,
            }}
          >
            {via}
          </div>
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
          color: 'rgba(26,36,56,0.55)',
        }}
      >
        SPLSHY
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Vertical — 1080 × 1920. For Instagram Story / TikTok / Snapchat
// shares where the image is uploaded as a file (not URL preview).
// ────────────────────────────────────────────────────────────────────
export function VerticalCard({ title, via, poster }: CardProps): JSX.Element {
  const POSTER_H      = 1100;
  const FADE_END      = 1280;
  const PLAY_BTN_SIZE = 140;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundImage: ORANGE_GRADIENT_VERTICAL,
        backgroundColor: '#e85d2e',
        fontFamily: 'Inter',
      }}
    >
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

      <div
        style={{
          position: 'absolute',
          top: POSTER_H - 60,
          left: 0,
          width: 1080,
          height: FADE_END - POSTER_H + 60,
          display: 'flex',
          backgroundImage:
            'linear-gradient(180deg, rgba(232,93,46,0) 0%, rgba(232,93,46,0.85) 60%, #e85d2e 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top:  Math.round(POSTER_H / 2) - Math.round(PLAY_BTN_SIZE / 2),
          left: 540 - Math.round(PLAY_BTN_SIZE / 2),
          width:  PLAY_BTN_SIZE,
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
  );
}
