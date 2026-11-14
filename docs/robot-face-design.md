# Physical AERO-BOT face

This is a face-only extension of the existing Falcon/AEROSENSE identity for a local robot-display demonstration. PRODUCT.md, the existing DESIGN.md and `.impeccable/robot-face-brief.md` remain the authority. The implementation does not establish a new visual direction or change dashboard tokens.

## Identity and comparison

The supplied `C:/Users/ADMIN/Downloads/Falcon Gemastik Aerosense (1).ai` is the identity reference. The repository retains its extracted reference in `artifacts/robot-face/illustrator-source.png` and `mascot-source.svg`, and the existing supplied poses in `public/assets/aerobot/falcon/`.

The extracted Illustrator reference and calm WebP define the round bird-robot head, two crown tufts, circular ear modules, cyan/cobalt shell, pale visor, blue beak and inward triangular eye glints. The revised rigging plate retains the head, shell and visor; editable SVG paths supply the facial features. Smooth raster shading and new expression overlays make this an extension, not a pixel-identical, fully vector reconstruction of the Illustrator artwork. Scoped static drawing review accepted the revised closed, half-open and open beaks in six recaptured images: the contours align, the curved cavity extends beneath the upper lip, and the detached outline, pale seam, lip slit and horizontal plate defects are resolved.

## Source values

These are local renderer values extracted from `public/robot-display/screen.css` and `expression.js`, not additions to the application's global token system. Shell and visor gradients remain baked into the supplied-derived raster plate.

| Element | Implemented source value |
| --- | --- |
| Display background | `#071522`; radial center `#123854` at 50% / 70%, returning to `#071522` at 68% |
| Notices | `#e8f5ff`; Inter, system-ui, sans-serif; 14 px / 1.5 |
| Eye gradient | `#0759B7` to `#064995` |
| Brows | `#759CD9` |
| Triangular glints | Left `#ECF0FF`; right `#E4EBFF` |
| Upper beak gradient | `#1678D4` through `#0959B6` to `#08499C` |
| Lower beak gradient | `#176AC1` to `#154586` |
| Mouth cavity gradient | `#082B5B` to `#14599A` |
| Normal character filter | `hue-rotate(0deg) saturate(.98)` |
| Warning character filter | `hue-rotate(-165deg) saturate(.98)`; whole mascot yellow/gold |
| Danger character filter | `hue-rotate(140deg) saturate(.98)`; whole mascot red |

The filter wraps the entire character, including its raster shell, visor, eyes, brows and beak. These are whole-head color states, not small status accents. The normal filter transition is 650 ms with `cubic-bezier(.22,1,.36,1)`.

## Proportions and face rig

The plate is placed at its authored 1280 × 1280 size inside SVG `viewBox="0 150 1280 1040"`. Default `xMidYMid meet` contains the head proportionally; **C** switches to `xMidYMid slice`, which fills proportionally and may crop edges. Neither mode stretches the mascot to the display rectangle. Use contain when all essential features must remain visible.

The editable eye centers are `(431,759)` and `(744,750)`. The SVG rig changes eyelid opening, eye/glint position, brow rotation, head tilt and vertical lift while keeping those features attached to the head. Upper and lower beaks are separate gradient-filled SVG paths hinged at `(688,918)`: the upper rotates up to `+4°` and the lower up to `-32°` with audio amplitude. A curved gradient cavity appears while speaking; the closed-beak crease fades as it opens. No copied raster beak, clipping strip or source-image mask is used.

The main screen contains the face, with connection/playback notices only when needed. Captions and keyboard help are initially hidden; **H** toggles help. No dashboard UI is placed on this renderer.

## Modes and response intent

| Mode | Implemented behavior |
| --- | --- |
| Sleeping | Neutral color, nearly closed eyes, closed beak |
| Waking | Happy expression, eyelid opening and a brief blink; listening begins after 1.9 seconds |
| Listening | Idle face with closed beak |
| Thinking | Attentive rightward gaze and a small head tilt |
| Speaking | Lower beak follows the selected audio source; completion returns to listening |

Expression choices are `neutral`, `happy`, `concerned`, `warning`, `danger` and `surprised`. `expressionFor` reads response text plus explicit severity/expression metadata. Explicit warning/danger severity wins; danger and warning text precede supplied mood so danger text overrides the legacy `face:happy` command. The small Indonesian/English heuristic also handles selected negated danger phrases. This recognizes response intent; it does not infer a person's emotions from their voice.

For an audio file, robot-command audio or mirrored outgoing web audio, Web Audio samples 512 time-domain values and computes actual RMS amplitude. The implemented normalized beak target is `clamp((rms - .008) * 12)`, smoothed by the animation loop; silence closes the beak. Browser device speech synthesis exposes no PCM here, so its local example uses an estimated oscillating rhythm. Do not describe that example as measured audio synchronization.

The same-origin web companion analyzes outgoing audio silently (`monitorOnly`); the chat remains the audible source. It requires the same origin, browser profile and signed-in session. Source support for this companion does not establish that the web bundle has been deployed.

This first display handles the face and outgoing audio. It does not capture microphone audio; attentive listening eyes are a display state. Infrared wake sensing and an always-listening microphone remain deferred.

## Reduced motion

`prefers-reduced-motion: reduce` removes the color-filter transition, idle blinking, head tilt and vertical bob. Sleep/wake eyelid state changes and the speech-driven beak remain functional; reduced motion is not a completely frozen face. The renderer reads the preference while animating.

## Editable sources and handoff boundary

- `public/robot-display/assets/mascot-plate-v2.png`: raster rigging plate edited from the supplied-derived head, with eyes, brows and the old beak removed while retaining shell and visor. The exact imagegen prompt is embedded in the PNG. The abandoned `mascot-base.png` was removed.
- `public/robot-display/expression.js`: readable expression rules, SVG eye/brow/glint paths, separate upper/lower beaks, curved cavity and shared hinge. `screen.js` owns state, timing and audio analysis; `screen.css` owns the display surface.
- `artifacts/robot-face/design/`: ten state SVGs, `AERO-BOT-Expression-Atlas.svg` and `manifest.json`, regenerated by `scripts/export-robot-face-design.mjs` with the revised rig. SVG files embed the raster plate; eye, brow and both beak layers remain editable SVG elements. They are static design snapshots, not an executable audio demonstration.
- The manifest records [the created Figma file](https://www.figma.com/design/27zSF5ONx1HX9sCTWY6Sa7) with `figmaCanvasPopulated: false` and reason `Starter MCP tool limit`. The file remained blank when the write quota blocked population. The local SVGs are the available handoff; no completed Figma canvas is claimed.

This documentation records repository source, reference assets and a scoped static drawing verdict. Static drawings do not verify continuous motion or audio playback, production deployment, live robot hardware, a particular Gemini playback session or human acoustic-emotion recognition. Local renderer and replay evidence must remain separate from those claims.


## Expression refinement, 2 November 2026
Happy eyes form crescents; surprised eyes become four-point glints. Concern and alert states adjust eyelids and brow angles. SVG paths remain attached to the head. The beak opens with a 4-degree upper and 32-degree lower jaw, with the cavity contour computed from the same hinge transforms. Audio RMS uses a low noise gate and square-root compression to make quiet speech visible; silence closes the jaws. Browser replay verifies audio amplitude, silence, color, proportional display and same-origin messaging. No microphone emotion model is claimed.

