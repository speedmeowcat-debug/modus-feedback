# Sound design: no random SFX

One rule: **a sound exists because something visible happens, on the frame it happens.** Picture and sound read one `createTimeline()` object. A cue without a `scores:` sentence is rejected by the timeline; a cue whose frame was typed by hand instead of derived from the motion is a smell.

## 1. Motion → cue kind
| visible event | cue kind | anchor (what sits on `frame`) | frame comes from |
|---|---|---|---|
| hard cut / theme switch | `snap` (+ `impact` if heavy) | start | `T.cut` frame |
| heavy word or object lands | `impact`, `thud` | start | spring arrival or first frame of a slam |
| fast travel (slide, morph, camera move) | `whoosh` | peak | `springPeakVelocityFrame` / `easePeakVelocityFrame` / camera function |
| tension before a hit | `riser` | **end** (falling edge) | the hit's frame |
| long glide, underline draw | `sweep` | peak | midpoint of the draw |
| slow reveal | `swell` | peak | reveal peak |
| UI press | `click` | start | cursor-press frame |
| small UI arrival, list item, bar | `pop`, `tick`, `blip` | start | `springArrivalFrame(start, spring, 0.8–0.95)` |
| typed glyph | `type` | start | per-glyph spring arrival |
| success / resolution | `chime`, `shimmer` | start | completion frame (the visible arrival is just *before* it; QA looks 8 frames back) |

## 2. Visual → sound parameters
- `intensity` ← size/energy of the visual (maps to level on a dB curve and to hardness).
- `brightness` ← size and lightness: small + bright = high, big + dark = low.
- `pan` ← horizontal screen position (UI at centre = 0; alternate sides for passing objects).
- `pitch` ← a chord tone of the music (`root|third|fifth|octave`, or a note) so tonal cues sit in the key; ascending bars/ticks climb the scale.
- `dur`/`peak` ← the duration of the motion and where its fastest part is.

## 3. Music
`music` on the timeline: `bpm` (choose a frame-locked tempo: at 30 fps 90, 100, 120 BPM = 20, 18, 15 frames per beat), `key`, `mode`, `bars`, `progression` (scale degrees per bar), `layers` (pad, bass, arp, kick, hat, clap, pulse), `arc` (energy per bar — the arrangement follows the shots). Shot boundaries on bar lines; hits on beats. Music ducks under cues automatically.

## 4. Mix
Defaults: integrated **-14 LUFS**, true peak **-1.5 dBTP**, `mix.musicDb` sets the music level (the examples use -9…-10), 0.4–0.5 s fade-out. One reference asks for -2 dBTP re-measured after AAC; change `mix.truePeakDb` if the platform needs it.

## 5. Rules that came from failures
- Tonal peaks (chime, shimmer, blip) need a short reverb; a long tail moves the audible peak late and breaks sync (a reverb gain bug did exactly this and was caught by the stem check).
- Cues of the same kind a few frames apart (typing, bars) need rising intensity and varying pitch, or they sound like a machine gun.
- Do not score what you cannot see: the QA `cue-visual` check fails a cue with no visible change near its frame.
- Leave air: a deliberate hold of silence is a sound decision too (declare the hold).

## 6. Verification
`python3 tools/render_audio.py <timeline.json> --out <dir>` → `audio.wav`, stems, `audio.report.json`. `python3 tools/verify_sync.py <timeline.json> <dir>` → each cue's audible event vs its frame (tolerance half a frame; 25 ms for smoothed peaks), plus placement in the stem. Loudness was cross-checked against ffmpeg `ebur128`, including on the final AAC mp4s (-14.1, -14.4, -14.2 LUFS).

**Not verified:** how it sounds. The synthesis is procedural (no samples); timing, level and loudness are measured, taste is not. Listen before shipping.
