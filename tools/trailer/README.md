# Trailer renderer

Builds the ~84 s Spotter trailer (1920×1080, 30 fps, H.264 + AAC) without ffmpeg. Everything runs locally in headless Chrome; nothing is sent anywhere.

- `timeline.js`: one shared timeline (scene times, hits, callouts, which part of the demo recording plays when).
- `audio.js`: original soundtrack synthesized in code (120 BPM, A minor). Seeded, so it renders the same each time.
- `trailer.js` / `trailer.html`: all scenes drawn on a canvas, recorded with MediaRecorder.
- `render.js`: Node driver (Chrome DevTools protocol), serves the page and your demo recording on 127.0.0.1.

Re-render (from this folder, Windows, Chrome installed):

```
node render.js --root . --page trailer.html --video "..\..\Spotter Demo.mp4" --out "..\..\Spotter Trailer.mp4" --wav "..\..\Spotter Trailer soundtrack.wav"
```

Takes about 90 seconds (it records in real time). Preview single frames with `--page "trailer.html?preview=5,20,40" --shots out`.

Known quirk: a render can contain one or two ~0.5 s frame holds (encoder hiccup at a varying time). If it shows, render again.
