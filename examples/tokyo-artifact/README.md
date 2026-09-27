# God's Eye Tokyo

A single-file, keyless spin-off of God's Eye View, set up to look at Tokyo. It
is built to run as a claude.ai Artifact, which can't reach live feeds, so it
bundles the repo's own offline data and computes everything in the browser.

What it shows:

- An orthographic globe framed on Tokyo and Japan, with four sensor looks
  (Normal, NVG, FLIR ironbow, CRT) that echo `src/styles`.
- Every satellite in `data/tle` (834 after deduplication), propagated live with
  SGP4 via satellite.js. Click one for its ground track, footprint and look
  angle from Tokyo. "True altitude" draws orbits at their real height.
- Tokyo's sky: sunrise and sunset in JST, objects above 10° right now,
  Japan's own satellites (Himawari, Michibiki/QZS, JCSAT, BSAT, Superbird),
  and the next 48 hours of ISS and Tiangong passes, flagged visible when the
  station is sunlit and Tokyo is dark.
- Large airports worldwide plus medium ones within 600 km of Tokyo
  (`data/airports.json`), and the homicide-rate choropleth (`data/safety.json`).

Limits: the TLEs are only as fresh as the last `data/tle` refresh. Low orbits
(ISS, Tiangong) drift by hundreds of kilometres within a few weeks, so pass
times are rough; GPS and GEO positions hold up far longer.

## Build

```bash
npm i --no-save world-atlas@2        # Natural Earth 1:50m coastlines
node examples/tokyo-artifact/build.mjs   # -> examples/tokyo-artifact/dist/gods-eye-tokyo.html
```

`template.html` is the page; the build step inlines the data in place of the
`/*__GEV_DATA__*/null` marker. The output is about 1 MB and has no runtime
dependencies beyond d3, topojson and satellite.js from public CDNs.
