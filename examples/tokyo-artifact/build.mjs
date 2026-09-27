#!/usr/bin/env node
// Bundles the repo's own offline data into a single self-contained HTML page
// (a claude.ai Artifact can't fetch live feeds, so everything ships inline).
//
//   npm i --no-save world-atlas@2
//   node examples/tokyo-artifact/build.mjs [out.html]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = process.argv[2] || path.join(here, 'dist', 'gods-eye-tokyo.html');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const TOKYO = { lat: 35.6812, lon: 139.7671 };
const LOCAL_RADIUS_KM = 600;

function haversineKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// Land outline: Natural Earth 1:50m via world-atlas (not a repo dependency).
const require = createRequire(import.meta.url);
let landPath;
try {
  landPath = require.resolve('world-atlas/land-50m.json', { paths: [root, process.cwd()] });
} catch {
  console.error('world-atlas not found. Run: npm i --no-save world-atlas@2');
  process.exit(1);
}
const land = JSON.parse(fs.readFileSync(landPath, 'utf8'));

// Airports: every large airport worldwide, plus medium ones near Tokyo.
const airportsSrc = readJson('data/airports.json');
const airports = airportsSrc.airports
  .filter((a) => a.type === 'large' || (a.type === 'medium' && haversineKm(TOKYO, a) <= LOCAL_RADIUS_KM))
  .map((a) => [
    a.iata || a.icao || a.id, a.icao || a.id, a.name, a.municipality || '', a.country,
    +a.lat.toFixed(4), +a.lon.toFixed(4), a.elevationFt ?? null, a.longestFt ?? null,
    (a.runways || []).length, a.type === 'large' ? 1 : 0,
  ]);

// Countries: homicide rate per 100k with simplified outlines.
const safety = readJson('data/safety.json');
const countries = safety.countries.map((c) => [c.iso3, c.name, c.rate, c.year, c.rings]);

// Satellites: CelesTrak groups bundled in data/tle, deduplicated by NORAD id.
const GROUPS = [
  ['stations', 'stations'], ['gps-ops', 'gps'], ['galileo', 'galileo'],
  ['glo-ops', 'glonass'], ['geo', 'geo'], ['visual', 'visual'],
];
const seen = new Set();
const tle = [];
for (const [file, group] of GROUPS) {
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

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch {}

const data = {
  meta: {
    commit,
    builtAt: new Date().toISOString(),
    airportsGenerated: airportsSrc.generated,
    safetyGenerated: safety.generated,
    safetySource: safety.sources?.[0]?.name || 'World Bank / UNODC',
  },
  land, airports, countries, tle,
};

const template = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
const marker = '/*__GEV_DATA__*/null';
if (!template.includes(marker)) throw new Error('template is missing the data marker');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, template.replace(marker, () => JSON.stringify(data)));
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB) · ${tle.length} satellites · ${airports.length} airports · ${countries.length} countries`);
