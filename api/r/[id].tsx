// GET /r/<id> — the redirect bouncer. Serves a minimal HTML page with
// rich OG/Twitter meta tags so chat clients (iMessage, WhatsApp, Slack,
// IG DM, X) render a beautiful preview card. The page itself bounces
// to the original visitraleigh.com URL (with a #splshy-<reelId> hash
// so the widget can auto-open to the specific video) in ~50ms via
// JS + meta-refresh. Crawlers see the meta tags before any redirect
// fires; humans get bounced through to the real destination.

import { readShare } from '../../lib/share';

export const config = { runtime: 'edge' };

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function notFoundHtml(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Link not found · SPLSHY</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:48px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#e85d2e;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
  .wrap{max-width:480px}
  h1{font-size:32px;font-weight:700;margin:0 0 12px;letter-spacing:-0.02em}
  p{font-size:16px;opacity:0.9;margin:0}
  a{color:#fff;text-decoration:underline}
</style>
</head><body>
<div class="wrap">
  <h1>Link not found</h1>
  <p>This share link doesn't exist or has been removed.<br>Visit <a href="https://splshy.com">splshy.com</a> to learn more.</p>
</div>
</body></html>`;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Last path segment. Works whether the function is hit at /r/<id>
  // (via vercel.json rewrite) or at /api/r/<id> directly.
  const segments = url.pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 1] || '';
  if (!id || !/^[A-Za-z0-9_-]{4,16}$/.test(id)) {
    return new Response(notFoundHtml(), {
      status:  404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const rec = await readShare(id);
  if (!rec) {
    return new Response(notFoundHtml(), {
      status:  404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Build the final destination URL with #splshy-<reelId> so the
  // widget on the destination page can scroll itself into view and
  // open the right reel automatically.
  const dest = `${rec.pageUrl}${rec.pageUrl.includes('#') ? '' : '#splshy-' + rec.reelId}`;

  // OG image URLs point back at our edge endpoints so they regenerate
  // from the canonical Redis record (no params to keep in sync).
  const ogImg     = `https://splshy.com/api/og/${encodeURIComponent(id)}`;
  const ogImgVert = `https://splshy.com/api/og-vertical/${encodeURIComponent(id)}`;
  const titleEsc  = escHtml(rec.title);
  const viaEsc    = escHtml(rec.via);
  const destEsc   = escHtml(dest);
  const description = `Watch on ${rec.via}.`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${titleEsc} · ${viaEsc}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escHtml(description)}">

<!-- Open Graph -->
<meta property="og:type" content="video.other">
<meta property="og:title" content="${titleEsc}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:image" content="${escHtml(ogImg)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${escHtml('https://splshy.com/r/' + id)}">
<meta property="og:site_name" content="SPLSHY">

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleEsc}">
<meta name="twitter:description" content="${escHtml(description)}">
<meta name="twitter:image" content="${escHtml(ogImg)}">

<!-- Vertical companion (for clients that prefer 9:16) -->
<meta property="og:image:secure_url" content="${escHtml(ogImgVert)}">

<!-- Bounce to the real destination. Meta-refresh covers no-JS; the
     script fires immediately for everyone else. -->
<meta http-equiv="refresh" content="0;url=${destEsc}">
<script>window.location.replace(${JSON.stringify(dest)});</script>

<style>
  body{margin:0;padding:48px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#e85d2e;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
  .wrap{max-width:480px}
  h1{font-size:28px;font-weight:700;margin:0 0 12px;letter-spacing:-0.02em}
  p{font-size:15px;opacity:0.92;margin:0 0 24px}
  a{display:inline-block;padding:14px 24px;background:#1a2438;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.02em}
</style>
</head>
<body>
<div class="wrap">
  <h1>Opening ${viaEsc}…</h1>
  <p>If you're not redirected in a moment:</p>
  <a href="${destEsc}">Continue to ${viaEsc} →</a>
</div>
</body>
</html>`;

  return new Response(html, {
    status:  200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short cache so iteration is fast; the underlying record is
      // immutable so we could cache longer, but social-platform OG
      // crawlers respect this header and we want to keep iteration
      // pressure low for now.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
