# Edzell Halloween AR Walk

A free, no-app-install AR experience: open the site on a phone, walk around
the neighbourhood, and see Halloween decorations appear over the camera view
at fixed real-world locations.

Built with [A-Frame](https://aframe.io/) + [AR.js](https://ar-js-org.github.io/AR.js-Docs/) (location-based mode) —
both free/open-source, loaded from CDN, no build step, no paid AR SDK.

## Current status: Phase 1 mock-up

Decorations are plain coloured shapes (spheres, cones, boxes) at placeholder
GPS coordinates near Edzell, not final 3D models yet. The goal of this phase
is only to confirm that GPS + compass placement actually works when you walk
around outside — once that's solid, Phase 3 swaps the shapes for real
Sketchfab models.

## Running it

**This must be served over HTTPS** — camera, geolocation, and compass access
are all blocked by browsers on plain HTTP (localhost is exempt, but that's
only useful for testing on the same machine, not a phone over Wi-Fi).

Easiest path: push this folder to a GitHub repo and enable **GitHub Pages**
in the repo's Settings → Pages (branch: main, folder: /). You'll get a free
`https://<username>.github.io/<repo>/` URL — open that on your phone.

For quicker iteration without a full deploy each time, you can tunnel a
local server with something like `npx localtunnel` or `ngrok http 8000`
after running `python3 -m http.server 8000` in this folder.

## Testing checklist

1. Open the URL on a phone, outdoors (GPS/compass don't work well indoors).
2. Tap **Start AR**, allow camera / location / (iPhone) motion when prompted.
3. Tap the **debug** button (bottom right) to see live lat/lon/accuracy —
   useful for confirming GPS is actually updating.
4. Walk toward where a shape should be and turn to see if it lines up with
   the real-world direction. Expect some drift/jitter — phone GPS is only
   accurate to ~5–10m and compass calibration varies by phone.
5. Test on at least one Android (Chrome) and one iOS (Safari) device —
   permission flows differ between them.

## Editing the decorations

Everything lives in [decorations.js](decorations.js) — an array of
`{ id, lat, lon, shape, color, scale, label }`. To add/move a decoration:

1. Find the real spot in Google Maps, long-press (mobile) or right-click
   (desktop) it, and copy the coordinates that pop up.
2. Add/edit an entry with those coordinates.
3. Refresh the site — no other code changes needed.

`shape` can be any [A-Frame primitive](https://aframe.io/docs/1.5.0/introduction/html-and-primitives.html)
name: `box`, `sphere`, `cone`, `cylinder`, `octahedron`, `dodecahedron`,
`torus`, etc.

## Roadmap

- [x] Phase 1 — shape mock-up proves GPS placement works
- [ ] Phase 2 — on-screen distance/compass indicator, "found it" tracking
- [ ] Phase 3 — swap shapes for real Sketchfab `.glb` models (check each
      model's license — CC-BY is fine for this personal/non-commercial use,
      just credit the artist in this README)
- [ ] Phase 4 — polish: loading states, sound, maybe offline asset caching
- [ ] Phase 5 — final walk-through test with friends before Halloween night

## Credits

Decoration models: TBD (Phase 3) — Sketchfab artist credits will go here.
