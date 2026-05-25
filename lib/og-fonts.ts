// Edge-safe Google-Fonts → TTF loader used by every OG endpoint. The
// vintage User-Agent forces Google to serve TTF instead of WOFF2 (some
// Satori builds don't handle WOFF2 reliably). Returns null on failure
// so callers can fall through to the default font without crashing.

export async function loadInter(weight: 400 | 600 | 700): Promise<ArrayBuffer | null> {
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
    return await fetch(match[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export type InterFonts = Array<{
  name: 'Inter';
  data: ArrayBuffer;
  style: 'normal';
  weight: 400 | 600 | 700;
}>;

// Load 400 / 600 / 700 in parallel and return the array shape Satori
// wants. Missing weights are silently dropped (fallback to default).
export async function loadInterAll(): Promise<InterFonts> {
  const [regular, semibold, bold] = await Promise.all([
    loadInter(400),
    loadInter(600),
    loadInter(700),
  ]);
  const fonts: InterFonts = [];
  if (regular)  fonts.push({ name: 'Inter', data: regular,  style: 'normal', weight: 400 });
  if (semibold) fonts.push({ name: 'Inter', data: semibold, style: 'normal', weight: 600 });
  if (bold)     fonts.push({ name: 'Inter', data: bold,     style: 'normal', weight: 700 });
  return fonts;
}
