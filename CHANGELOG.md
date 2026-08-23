# Changelog

All notable changes to OledCare are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Smooth nap transitions: the nap screen now fades in and out over ~0.4 s
  instead of snapping (instant for `prefers-reduced-motion` users).
- Optional "Gradual wind-down" setting: the screen fades to black over the
  30 seconds before auto-nap engages; any input cancels it instantly.
- Chinese README (`README.zh-CN.md`) with a language switcher in both files.

## [1.1.0] - 2026-08-22

### Added

- Settings persist in the browser's `localStorage` (key `dsh-oled-care:v1`),
  so presets and custom mixes survive `dsh web` restarts. Storage is guarded
  everywhere — where it is unavailable the plugin keeps its previous
  in-memory behavior. Still no network calls, no telemetry, and runtime state
  (nap, focus, last activity) is never persisted.
- Accessibility: the nap button exposes `aria-pressed`, and every settings
  control carries an `aria-label` fed from its visible field label.
- CI check workflow: syntax-checks both bundles and verifies the
  `dsh.bundle.patch` manifest resolves to a cordis patch with an insert row.

## [1.0.0] - 2026-08-20

### Added

- Initial release: true-black nap screensaver with drifting clock and live
  session status, pure-black surfaces, fainter static borders, gamma-aware
  text/accent dimming behind an idle/focus ladder, and ~12 h accent-hue
  rotation. Off / Balanced / Maximum presets plus a settings page with
  diagnostics.
