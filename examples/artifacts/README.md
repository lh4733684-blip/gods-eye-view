# Artifact pages

Single-file, keyless spin-offs of God's Eye View, built to run as claude.ai
Artifacts. An Artifact can't reach live feeds, so each page bundles the repo's
own offline data and computes everything in the browser.

## God's Eye Tokyo (`tokyo.html`)

- An orthographic globe framed on Tokyo with four sensor looks (Normal, NVG,
  FLIR ironbow, CRT) that echo `src/styles`.
- Every satellite in `data/tle`, propagated live with SGP4 via satellite.js,
  with ground track, footprint and look angle from Tokyo.
- Tokyo's sky: sun times in JST, objects above 10°, Japan's own satellites
  (Himawari, Michibiki/QZS, JCSAT, BSAT, Superbird) and the next 48 hours of
  ISS and Tiangong passes.
- Large airports worldwide plus medium ones near Tokyo, and the homicide-rate
  choropleth from `data/safety.json`.

## God's Eye Narita (`narita.html`)

- A top-down map of Narita with both runways drawn to scale from the threshold
  coordinates in `data/airports.json`, 10 NM approach lines with mile ticks,
  range rings, and every airfield within 160 km (military bases highlighted).
- A crosswind calculator: enter the METAR wind and it gives head/tail and
  crosswind for each runway end and highlights the favoured one.
- The sky over Narita: sun times, satellites above 10° and station passes.

## Limits

TLEs are only as fresh as the last `data/tle` refresh. Low orbits (ISS,
Tiangong) drift by hundreds of kilometres within a few weeks, so pass times are
rough. Neither page has live flights or weather. Not for navigation.

## Build

```bash
npm i --no-save world-atlas@2 topojson-client@3
node examples/artifacts/build.mjs tokyo    # -> examples/artifacts/dist/gods-eye-tokyo.html
node examples/artifacts/build.mjs narita   # -> examples/artifacts/dist/gods-eye-narita.html
```

Each page's HTML is a template; the build step inlines the data in place of the
`/*__GEV_DATA__*/null` marker.
