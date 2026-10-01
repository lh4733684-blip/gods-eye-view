#!/usr/bin/env node
// Bundles the repo's own offline data into single self-contained HTML pages
// (a claude.ai Artifact can't fetch live feeds, so everything ships inline).
//
//   npm i --no-save world-atlas@2 topojson-client@3
//   node examples/artifacts/build.mjs tokyo   [out.html]
//   node examples/artifacts/build.mjs narita  [out.html]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const page = process.argv[2];
if (!['tokyo', 'narita'].includes(page)) {
  console.error('usage: build.mjs <tokyo|narita> [out.html]');
  process.exit(1);
}
const out = process.argv[3] || path.join(here, 'dist', `gods-eye-${page}.html`);
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const require = createRequire(import.meta.url);
function resolveDep(spec) {
  try {
    return require.resolve(spec, { paths: [root, process.cwd()] });
  } catch {
    console.error(`${spec} not found. Run: npm i --no-save world-atlas@2 topojson-client@3`);
    process.exit(1);
  }
}

function haversineKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// Satellites: CelesTrak groups bundled in data/tle, deduplicated by NORAD id.
function loadTle() {
  const groups = [
    ['stations', 'stations'], ['gps-ops', 'gps'], ['galileo', 'galileo'],
    ['glo-ops', 'glonass'], ['geo', 'geo'], ['visual', 'visual'],
  ];
  const seen = new Set();
  const tle = [];
  for (const [file, group] of groups) {
    const lines = fs.readFileSync(path.join(root, 'data/tle', `${file}.txt`), 'utf8').split(/\r?\n/);
    for (let i = 0; i + 2 < lines.length + 1; i++) {
      if (!lines[i + 1]?.startsWith('1 ') || !lines[i + 2]?.startsWith('2 ')) continue;
      const norad = lines[i + 1].slice(2, 7).trim();
      if (!seen.has(norad)) {
        seen.add(norad);
        tle.push([lines[i].trim(), lines[i + 1].trimEnd(), lines[i + 2].trimEnd(), group]);
      }
      i += 2;
    }
  }
  return tle;
}

// Sutherland–Hodgman clip of a lon/lat ring to an axis-aligned box. Planar is
// fine here: the Narita box is a few degrees across and far from the antimeridian.
function clipRing(ring, [x0, y0, x1, y1]) {
  const edges = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ];
  const cross = [
    (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1],
  ];
  let pts = ring;
  for (let e = 0; e < 4 && pts.length; e++) {
    const input = pts;
    pts = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const inCur = edges[e](cur), inPrev = edges[e](prev);
      if (inCur) {
        if (!inPrev) pts.push(cross[e](prev, cur));
        pts.push(cur);
      } else if (inPrev) {
        pts.push(cross[e](prev, cur));
      }
    }
  }
  return pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
}

const airportsSrc = readJson('data/airports.json');
const safety = readJson('data/safety.json');
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch {}
const meta = {
  commit,
  builtAt: new Date().toISOString(),
  airportsGenerated: airportsSrc.generated,
  safetyGenerated: safety.generated,
  safetySource: safety.sources?.[0]?.name || 'World Bank / UNODC',
};

let data;
if (page === 'tokyo') {
  const TOKYO = { lat: 35.6812, lon: 139.7671 };
  const land = JSON.parse(fs.readFileSync(resolveDep('world-atlas/land-50m.json'), 'utf8'));
  // Every large airport worldwide, plus medium ones near Tokyo.
  const airports = airportsSrc.airports
    .filter((a) => a.type === 'large' || (a.type === 'medium' && haversineKm(TOKYO, a) <= 600))
    .map((a) => [
      a.iata || a.icao || a.id, a.icao || a.id, a.name, a.municipality || '', a.country,
      +a.lat.toFixed(4), +a.lon.toFixed(4), a.elevationFt ?? null, a.longestFt ?? null,
      (a.runways || []).length, a.type === 'large' ? 1 : 0,
    ]);
  const countries = safety.countries.map((c) => [c.iso3, c.name, c.rate, c.year, c.rings]);
  data = { meta, land, airports, countries, tle: loadTle() };
} else {
  const nrt = airportsSrc.airports.find((a) => a.icao === 'RJAA');
  const BOX = [138.4, 34.4, 142.4, 37.2];
  const { feature } = await import(resolveDep('topojson-client'));
  const land10 = JSON.parse(fs.readFileSync(resolveDep('world-atlas/land-10m.json'), 'utf8'));
  const geo = feature(land10, land10.objects.land);
  const rings = [];
  const polys = geo.type === 'FeatureCollection' ? geo.features.flatMap((f) => [f.geometry]) : [geo.geometry];
  for (const g of polys) {
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of list) {
      const outer = poly[0];
      const clipped = clipRing(outer, BOX);
      if (clipped.length >= 3) rings.push(clipped);
    }
  }
  // Airfields within 160 km of Narita, with full runway geometry.
  const airfields = airportsSrc.airports
    .filter((a) => haversineKm(nrt, a) <= 160)
    .map((a) => ({
      icao: a.icao || a.id, iata: a.iata || '', name: a.name, city: a.municipality || '',
      type: a.type, lat: a.lat, lon: a.lon, elevFt: a.elevationFt ?? null, longestFt: a.longestFt ?? null,
      runways: (a.runways || []).map((r) => ({
        ident: r.ident, lengthFt: r.lengthFt, widthFt: r.widthFt, surface: r.surface, lit: r.lit,
        le: [r.leLat, r.leLon], he: [r.heLat, r.heLon],
      })),
    }));
  data = { meta, box: BOX, land: rings, airfields, tle: loadTle() };
}

const template = fs.readFileSync(path.join(here, `${page}.html`), 'utf8');
const marker = '/*__GEV_DATA__*/null';
if (!template.includes(marker)) throw new Error('template is missing the data marker');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, template.replace(marker, () => JSON.stringify(data)));
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
