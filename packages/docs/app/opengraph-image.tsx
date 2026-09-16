import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * The social card, rendered rather than drawn.
 *
 * Every share of the docs, the repo or an npm page on X, Slack, Discord or
 * LinkedIn renders this. Keeping it as code rather than a checked-in PNG means
 * the headline can never drift from the one on the homepage, and the colours
 * come from the same tokens as the site.
 *
 * Satori (what `next/og` renders with) supports a subset of CSS: flexbox only,
 * no `grid`, and any element with more than one child needs an explicit
 * `display: flex`. It also cannot parse `oklch()`, so the brand tokens are
 * inlined here as their sRGB equivalents. If you change a colour in
 * `globals.css`, change it here too.
 */

export const alt =
  'Recall: spaced repetition you do not have to build again. FSRS scheduling, headless React components, and pluggable storage.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The site is `output: 'export'`, so this has to be baked at build time rather
 * than rendered per request. That also means the font fetch below happens once
 * during the build, never on a visitor's request.
 */
export const dynamic = 'force-static';

/* --- Brand tokens, converted from the oklch() values in globals.css ------ */
const BG = '#08090a';
const SURFACE = '#0f1012';
const LINE = '#23252a';
const FG = '#f7f8f8';
const MUTED = '#8a8f98';
const SUBTLE = '#62666d';
const ACCENT = '#3876dd'; // --accent  oklch(0.58 0.17 260)
const ACTION = '#ea3c3f'; // --action  oklch(0.62 0.21 25)

/** Every glyph the card draws, so the font subset stays tiny. */
const GLYPHS =
  'Recallspacedrepetitionyoudon’thavetobuildagain.FSRSscheduling,headlessReactcomponents,andpluggablestorage58kBbrotli0dependenciesTypeScriptstrictrecall-srs-docs.vercel.app·';

/**
 * Inter, as a TTF that Satori can actually parse.
 *
 * Google serves woff2 to modern browsers and Satori cannot read woff2, so the
 * ancient User-Agent is deliberate: it makes the API return truetype. Failure
 * is non-fatal — an OG image in the fallback font is worth more than a broken
 * deploy, so this returns null and the card renders in Satori's default face.
 */
async function loadInter(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(GLYPHS)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' } },
    ).then((r) => r.text());

    const url = /src: url\((.+?)\)/.exec(css)?.[1];
    if (!url) return null;

    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/** The mark, inlined so the renderer never has to fetch from itself. */
function markDataUri(): string | null {
  try {
    const file = path.join(process.cwd(), 'public', 'brand', 'recall-icon-128.png');
    return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [regular, semibold, mark] = await Promise.all([
    loadInter(400),
    loadInter(600),
    Promise.resolve(markDataUri()),
  ]);

  const fonts = [
    regular && {
      name: 'Inter',
      data: regular,
      weight: 400 as const,
      style: 'normal' as const,
    },
    semibold && {
      name: 'Inter',
      data: semibold,
      weight: 600 as const,
      style: 'normal' as const,
    },
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: BG,
        // A cool wash behind the headline, so the card is not a flat slab.
        backgroundImage: `radial-gradient(900px 500px at 12% -10%, rgba(56, 118, 221, 0.20), transparent 70%)`,
        padding: '64px 72px',
        fontFamily: fonts.length > 0 ? 'Inter' : undefined,
      }}
    >
      {/* The accent rule doubles as the two brand colours, in order. */}
      <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0 }}>
        <div style={{ width: 380, height: 6, backgroundColor: ACCENT }} />
        <div style={{ width: 120, height: 6, backgroundColor: ACTION }} />
      </div>

      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Satori renders to a PNG, so `next/image` has nothing to optimise here. */}
        {mark !== null && <img src={mark} width={64} height={64} alt="" />}
        <div
          style={{
            marginLeft: mark !== null ? 20 : 0,
            fontSize: 36,
            fontWeight: 600,
            color: FG,
            letterSpacing: '-0.02em',
          }}
        >
          Recall
        </div>
      </div>

      {/* Headline, in two lines so the break never lands somewhere daft. */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 68,
            fontWeight: 600,
            color: FG,
            letterSpacing: '-0.035em',
            lineHeight: 1.08,
          }}
        >
          <div style={{ display: 'flex' }}>Spaced repetition you</div>
          <div style={{ display: 'flex' }}>don’t have to build again</div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 26,
            fontSize: 27,
            color: MUTED,
            letterSpacing: '-0.01em',
          }}
        >
          FSRS scheduling, headless React components, and pluggable storage.
        </div>
      </div>

      {/* Footer: the three claims worth making, and where to go. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${LINE}`,
          paddingTop: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {['5.8 kB brotli', '0 dependencies', 'TypeScript strict'].map((chip, i) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                marginLeft: i === 0 ? 0 : 12,
                padding: '9px 18px',
                borderRadius: 999,
                border: `1px solid ${LINE}`,
                backgroundColor: SURFACE,
                fontSize: 22,
                color: MUTED,
              }}
            >
              {chip}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 22, color: SUBTLE }}>
          recall-srs-docs.vercel.app
        </div>
      </div>
    </div>,
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
