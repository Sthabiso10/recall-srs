/**
 * Record the Recall playground as a looping GIF for the README.
 *
 * Drives the real playground in Edge via CDP, screenshots the study widget at
 * each step, and encodes the frames. No ffmpeg or ImageMagick needed.
 *
 *   pnpm docs                                          # terminal 1
 *   npm i -g puppeteer-core gif-encoder-2 pngjs        # once
 *   node scripts/record-demo.mjs                        # terminal 2
 *
 * Deliberately not a workspace dependency: it runs a handful of times a year
 * and nobody installing Recall should pay for a browser driver.
 *
 * The frames are deliberately discrete steps rather than a smooth capture —
 * what sells this library is the *content* of each state (a Korean prompt, the
 * answer, four buttons labelled with real intervals), and holding each state
 * long enough to read beats a fluid video nobody can parse in eight seconds.
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TARGET_URL = 'http://localhost:3000/playground';
const OUT_DIR = 'docs/media/frames';

// Device scale 2 then downscale keeps text crisp; GIFs look soft otherwise.
const WIDTH = 720;
const HEIGHT = 340;
const SCALE = 2;

mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE },
  args: ['--force-color-profile=srgb', '--font-render-hinting=none'],
});

const page = await browser.newPage();
// Dark theme reads better in a README on either GitHub theme.
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForSelector('[data-recall-study]', { timeout: 20_000 });

/**
 * Hide the page chrome so the frame is only the study widget.
 * The README already says what Recall is; the GIF's whole job is to show the
 * loop working, and site navigation in the frame is wasted pixels.
 */
await page.addStyleTag({
  content: `
    /* Everything except the study widget is wasted pixels in an 8s loop. */
    header, footer, h1, [data-recall-dashboard], [data-recall-skip] {
      display: none !important;
    }
    main > div > div:first-child { display: none !important; }
    main { padding: 0 !important; }
    body { background: #0b0f19 !important; overflow: hidden !important; }
    [data-recall-study] { margin: 0 auto !important; padding: 16px 24px !important; gap: 18px !important; }
    [data-recall-card] { min-height: 170px !important; }
  `,
});

const frames = [];
let index = 0;

/**
 * Per-frame delays rather than repeated frames: same on-screen timing, a third
 * of the file size, and each state gets exactly the dwell it needs. The answer
 * frame carries four intervals to read and earns twice the prompt's time.
 */
async function capture(label, delayMs) {
  const buffer = await page.screenshot({ type: 'png' });
  const file = `${OUT_DIR}/${String(index).padStart(2, '0')}-${label}.png`;
  writeFileSync(file, buffer);
  frames.push({ file, delayMs });
  index += 1;
  console.log(`  captured ${label} (${delayMs}ms)`);
}

async function clickText(text) {
  const handle = await page.evaluateHandle((t) => {
    const els = [...document.querySelectorAll('button')];
    return els.find((e) => e.textContent?.trim().startsWith(t)) ?? null;
  }, text);
  const el = handle.asElement();
  if (!el) throw new Error(`No button starting with "${text}"`);
  await el.click();
  await new Promise((r) => setTimeout(r, 350));
}

/* ---- the loop that sells the library ------------------------------- */

// Card 1: prompt, reveal, grade Good.
await capture('q1', 750);
await clickText('Show answer');
await capture('a1', 1500);
await clickText('Good');

// Card 2: same, graded Easy to show a different interval.
await capture('q2', 750);
await clickText('Show answer');
await capture('a2', 1500);
await clickText('Easy');

// Card 3: graded Again, so the ten-minute relearning step is visible.
await capture('q3', 750);
await clickText('Show answer');
await capture('a3', 1500);
await clickText('Again');

// Land on a fresh prompt so the loop restarts cleanly.
await capture('q4', 1100); // hold before the loop restarts

await browser.close();

/* ---- encode -------------------------------------------------------- */

const first = PNG.sync.read(readFileSync(frames[0].file));
const outW = Math.round(first.width / SCALE);
const outH = Math.round(first.height / SCALE);

const encoder = new GIFEncoder(outW, outH, 'neuquant', true);
encoder.setRepeat(0); // loop forever
encoder.setQuality(10);
encoder.start();

for (const { file, delayMs } of frames) {
  encoder.setDelay(delayMs);
  const png = PNG.sync.read(readFileSync(file));
  encoder.addFrame(downscale(png, SCALE));
}

encoder.finish();
const gif = encoder.out.getData();
const target = process.argv[2] ?? 'docs/media/demo.gif';
writeFileSync(target, gif);

console.log(`\n  ${frames.length} frames -> ${target}`);
console.log(`  ${outW}x${outH}, ${(gif.length / 1024).toFixed(0)} kB`);

/**
 * Box-filter downscale. Captured at 2x and averaged down, so text stays legible
 * after the GIF palette quantises it — capturing at 1x produces visibly mushy
 * glyphs at this size.
 */
function downscale(png, factor) {
  const w = Math.round(png.width / factor);
  const h = Math.round(png.height / factor);
  const out = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const sx = x * factor + dx;
          const sy = y * factor + dy;
          if (sx >= png.width || sy >= png.height) continue;
          const i = (sy * png.width + sx) * 4;
          r += png.data[i];
          g += png.data[i + 1];
          b += png.data[i + 2];
          n += 1;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return out;
}
