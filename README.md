# OLEDCare

**A DeepSeek Harness plugin (#dsh-plugin) that protects OLED panels during long agent sessions.**

OLED burn-in protection for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI (`dsh web`).

OLED panels wear where pixels stay lit for hours — exactly what a long agent session does to backgrounds, hairline borders, and bright text. OledCare pushes back on all three:

- **Nap mode** — a true-black (`#000`) full-screen screensaver, so every background pixel switches fully off. It engages automatically after idle minutes, or on demand from the **☾ Nap** button in the session header. A dim drifting clock (so the clock itself does not burn in) shows live agent status — *agent is working / waiting for your input / idle* — and any mouse or key input wakes the screen.
- **Pure-black surfaces** — every dark-scheme background token goes to `#000000`; background pixels turn fully off instead of glowing dark gray.
- **Fainter static borders** — hairline dividers sit at the same pixels all day, so their dark values go dimmer than the shipped palette.
- **Gamma-aware dimming** — white text and bright accent tokens are scaled as a linear-light luminance ratio, so perceived contrast between text shades is preserved while total light output drops.
- **Idle/focus ladder** — normal intensity → deep dim when idle or the window loses focus → nap. Three rungs, each configurable.
- **Hue rotation** — the accent hue drifts through a ~12-hour cycle so static brand-colored icons wear every subpixel evenly.

## Requirements

- DeepSeek Harness (`@deepseek-ai/dsh`) with the `web` profile (`dsh web`)
- pnpm on PATH (`dsh plugin` forwards to it)

## Install

From GitHub:

```sh
dsh plugin --profile web add github:domparent/OLEDCare
```

From a local checkout:

```sh
dsh plugin --profile web add /absolute/path/to/OledCare
```

Then restart `dsh web` and reload the browser tab. Open **Settings → OLED Care** in the settings left nav.

No build step runs on install: `client.js` ships in the harness browser-module format exactly as the browser loads it, so GitHub installs work without allowlisting a `prepare` script.

## Uninstall

```sh
dsh plugin --profile web remove dsh-oled-care
```

Restart `dsh web` afterwards.

## Settings

Three presets — **Off**, **Balanced** (default: black surfaces, 85% text, nap at 10 min), **Maximum** (70% text, deep dim at 3 min, nap at 5 min) — plus a Custom state that appears when you tweak any field:

| Field | What it does |
| --- | --- |
| Pure black backgrounds | Every surface goes `#000`; background pixels turn fully off |
| Fainter static borders | Dims hairline borders beyond the shipped palette |
| Text/accent intensity | Linear-light scaling of white text and bright accents |
| Hue rotation | ~12 h accent-hue cycle for even subpixel wear |
| Deep-dim after idle | Minutes without input before the deeper intensity applies |
| Deep-dim intensity | The dimmer level used while idle or unfocused |
| Deep-dim when unfocused | Apply deep dim whenever the window loses focus |
| Auto nap after idle | Minutes without input before the nap screen engages |

A diagnostics box at the bottom of the settings page shows the live token layer, the resolved body background, the current dim rung, and the nap/idle state.

## How it works

- The package is a profile **bundle**: `dsh.bundle.patch` in `package.json` points at `cordis.patch.yml`, which inserts one plugin row. The client module system scans the row's `dsh.client` declaration into the browser roster and serves `client.js` at `/plugins/dsh-oled-care/client.js`.
- All visual changes go through the client **theme service** as one replaceable token-override layer — the shipped theme is never edited, and removing the plugin restores it exactly.
- UI is composed through the slot system only: `shell.overlay` (nap screen), `conversation.session.header.actions` (nap button), and `settings.section` (settings page).

## Limitations

- Settings live in memory: they reset to the Balanced preset when `dsh web` restarts.
- The light color scheme is left essentially untouched — OLED care targets dark UIs.
- Developed against dsh `0.1.0-rc.x`. The browser module format (`window.__ModuleLoader__.load`) is an internal harness contract; pin your dsh version or check release notes when upgrading.
- No network calls, no telemetry, no persistence, no access to conversation content.

## License

MIT — see [LICENSE](LICENSE).
