# Rendering modes: CLI/SSR vs client-side

Neither mode has a render quota. The Remotion License governs **who may use Remotion for free**
(individuals, non-profits, for-profit organisations with up to three employees, noncommercial
evaluation); it does not count renders. Choosing a mode is a capability and fidelity decision, not a
licence one.

A wasted-agent-session error such as `429 usage_limit_reached` from the host (for example "you've hit
your session limit") comes from the **model account running the agent**, not from Remotion and not
from a render. Switching rendering mode cannot prevent it: the spend happens while the agent plans
and writes code, before any render begins.

## The two modes

| | CLI / server-side (`@remotion/renderer`) | Client-side (`@remotion/web-renderer`) |
| --- | --- | --- |
| Runs in | Node, or Lambda / Vercel Sandbox / Cloud Run / GitHub Actions | A browser tab |
| Encoding | FFmpeg | WebCodecs via Mediabunny, no FFmpeg |
| Bundling | Required (`@remotion/bundler`) | None: component and config passed directly |
| Fidelity | Full browser screenshot | Canvas emulation of layout and styles (limited) |
| Concurrency | Multi-process | Single, but a headful browser usually has the GPU |
| Availability | Stable, the long-standing default | Stable from **4.0.491** |
| Telemetry | Only when a `licenseKey` is set | **Always one event per render**, even with no key |
| Browser floor | The bundled/pinned Chrome-compatible binary | Chrome 94+, Firefox 130+, Safari 26+ (WebCodecs) |

## Why this pipeline keeps CLI/SSR as the default

Client-side rendering emulates layout and styles onto a canvas instead of screenshotting the page,
so only a subset of CSS is honoured. For motion design of the kind these Skills produce, the
unsupported list is exactly where the look lives:

- `z-index` is **not supported** — draw order is DOM order, so the four-layer parallax stack has to be
  re-authored back-to-front.
- `background-blend-mode` and `backdrop-filter` are **not supported**.
- Only **linear-gradient** backgrounds are supported; other `background-image` values (including
  radial gradients used for sun glow or vignettes) are not.
- `object-position`, `perspective`, `perspective-origin` and `transform-style` are **not supported**.
- Anything not explicitly listed is unsupported.

CLI/SSR takes a real screenshot, so every CSS effect renders exactly as reviewed in the proof frames.
That is why the helper, the proof gate and the measured export all use it.

## When client-side rendering is the right choice

- The **user is hands-on in Remotion Studio**: "Render in browser" is available from 4.0.491 and needs
  no Node renderer or FFmpeg.
- The host environment has a browser but no way to run a Node renderer or a pinned Chrome binary.
- The composition is built from the supported subset on purpose: flat shapes, transforms, opacity,
  linear gradients, borders, clip-path, text. That is a real style, not a compromise.
- Delivery is quick and small, and per-render telemetry is acceptable.

If a composition needs full fidelity **and** must render in the browser, use the optional
[HTML-in-canvas capture](https://www.remotion.dev/docs/client-side-rendering/html-in-canvas) mode,
which screenshots instead of emulating and lifts the CSS limitations. Treat it as a separate,
separately reviewed route: it is not the default of `renderMediaOnWeb()`.

Operational notes from the official documentation: renders in a background tab are throttled (the
Web Worker timer fallback keeps them progressing but slower), and `pageResponsiveness` trades speed
for a responsive page.

## What adopting client-side rendering would require here

`@remotion/web-renderer` is **not** in the scaffold's pinned dependency set. Adopting it means:

1. Pin it to the same version as the other `@remotion/*` packages (`4.0.539` today). Mixed versions
   are unsupported.
2. Extend `scripts/project.mjs` `DEPENDENCIES` and its installed-metadata check, so a pin drift still
   fails loudly.
3. Add a separate helper command with its own evidence: a browser session, the WebCodecs availability
   check, the resulting blob download, and the same encoded-property review as a CLI export.
4. Keep the CLI export as the delivery gate unless the user explicitly accepts a browser render as a
   distinct artifact.

Until those steps run and are evidenced, client-side rendering stays **documented but unverified** in
this repository.
