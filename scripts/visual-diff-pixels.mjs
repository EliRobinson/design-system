#!/usr/bin/env node
/* Reports exactly which pixels differ between two PNGs, and by how much.

   Playwright writes -expected/-actual/-diff images for a failed comparison,
   but the diff image only shows you *that* something moved. When a failure is
   a handful of pixels, the coordinates are the whole diagnosis: they say
   whether you are looking at a shifted layout, a re-rasterised glyph run, or
   the antialiased corner of one box. Reading them off a picture by eye does
   not work at that scale, which is how issue #65 burned a day.

   See docs/agents/visual-regression.md for what to do with the output.

   Usage:
     node scripts/visual-diff-pixels.mjs <expected.png> <actual.png> [--all]
     pnpm visual:diff <expected.png> <actual.png>
*/

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { inflateSync } from 'node:zlib';

/* A deliberately small PNG reader: 8-bit RGB/RGBA, non-interlaced, which is
   what Playwright writes. Pulling in a decoder dependency for this would mean
   a lockfile entry on a debugging aid. */
function decode(path) {
  const buf = readFileSync(path);

  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path} is not a PNG`);

  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`${path}: bit depth ${data[8]} unsupported`);
      colorType = data[9];
      if (data[12] !== 0) throw new Error(`${path}: interlaced PNGs unsupported`);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;

    pos += 12 + length;
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`${path}: colour type ${colorType} unsupported`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  /* Undo the per-scanline filters. Each row picks one of five predictors
     (PNG spec 9.2), all relative to the pixel left of it and the row above. */
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prior = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);

    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? cur[i - channels] : 0;
      const up = prior[i];
      const upLeft = i >= channels ? prior[i - channels] : 0;
      let value = line[i];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dul = Math.abs(p - upLeft);
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }

      cur[i] = value & 0xff;
    }
  }

  return { width, height, channels, data: out };
}

const [expectedPath, actualPath, ...flags] = process.argv.slice(2);

if (!expectedPath || !actualPath) {
  process.stderr.write('usage: visual-diff-pixels.mjs <expected.png> <actual.png> [--all]\n');
  process.exit(2);
}

const expected = decode(expectedPath);
const actual = decode(actualPath);

/* A size change is a layout shift, and then every pixel below it "differs".
   Say so rather than printing a million coordinates: the number to chase is
   the height delta, not the diff count. */
if (expected.width !== actual.width || expected.height !== actual.height) {
  const delta = actual.height - expected.height;
  const sign = delta > 0 ? '+' : '';

  process.stdout.write(
    `size differs: expected ${expected.width}x${expected.height}, ` +
      `actual ${actual.width}x${actual.height} (height ${sign}${delta})\n`,
  );
  process.exit(1);
}

const hits = [];

for (let y = 0; y < expected.height; y++) {
  for (let x = 0; x < expected.width; x++) {
    const e = y * expected.width * expected.channels + x * expected.channels;
    const a = y * actual.width * actual.channels + x * actual.channels;

    if (
      expected.data[e] !== actual.data[a] ||
      expected.data[e + 1] !== actual.data[a + 1] ||
      expected.data[e + 2] !== actual.data[a + 2]
    ) {
      hits.push({
        x,
        y,
        expected: [expected.data[e], expected.data[e + 1], expected.data[e + 2]],
        actual: [actual.data[a], actual.data[a + 1], actual.data[a + 2]],
      });
    }
  }
}

const worst = hits.reduce((max, hit) => {
  const delta = Math.max(...hit.expected.map((v, i) => Math.abs(v - hit.actual[i])));
  return Math.max(max, delta);
}, 0);

process.stdout.write(
  `${expected.width}x${expected.height}  differing=${hits.length}  largest channel delta=${worst}\n`,
);

const shown = flags.includes('--all') ? hits : hits.slice(0, 20);

for (const hit of shown) {
  process.stdout.write(
    `  (${hit.x},${hit.y})  expected rgb(${hit.expected.join(',')})  actual rgb(${hit.actual.join(',')})\n`,
  );
}

if (shown.length < hits.length) {
  process.stdout.write(`  ... ${hits.length - shown.length} more (pass --all)\n`);
}

process.exit(hits.length ? 1 : 0);
