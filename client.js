/**
 * OledCare browser half: OLED burn-in care for the DeepSeek Harness Web GUI.
 *
 * - Nap mode: a true-black (#000) full-screen overlay with a drifting clock
 *   and live session status, so background pixels switch fully off while the
 *   machine sits idle.
 * - Pure-black surfaces: dark-scheme background tokens go to #000000.
 * - Fainter static borders: hairlines sit at fixed pixels all day, so their
 *   dark-scheme values go dimmer than the shipped palette.
 * - Gamma-aware dimming of text and accent tokens behind an idle/focus
 *   ladder: normal intensity -> deep dim when idle or unfocused -> nap.
 * - Slow accent-hue rotation (~12 h cycle) so static icons wear every
 *   subpixel evenly.
 *
 * This file IS the shipped browser bundle — there is no build step. The
 * wrapper is the harness client-module format: the shell seeds
 * window.__ModuleLoader__ before any plugin loads, and the injected `require`
 * answers platform modules (react) from the shell's frozen module table.
 */
window.__ModuleLoader__.load({
  id: 'dsh-oled-care',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    /** Cordis plugin name. */
    const name = 'oled-care'

    /** Required client services: the slot registry and the theme service. */
    const inject = ['slots', 'theme']

    /**
     * Mount OLED Care: the token layer, activity/focus tracking, the nap
     * overlay, the session-header nap button, and the settings section.
     * @param {import('@deepseek-ai/cordis').Context} ctx - browser plugin context.
     */
    function apply(ctx) {
      const slots = ctx.slots
      const theme = ctx.theme
      const h = React.createElement

      // --- shared state; settings fields persist via localStorage below,
      // runtime fields (nap, focused, lastAct) stay in memory ---
      const state = {
        nap: false,
        preset: 'balanced',
        autoNap: true,
        idleMin: 10,
        deepDimMin: 5,
        deepDimPct: 60,
        focusDim: true,
        focused: true,
        faintBorders: true,
        hue: true,
        blackBg: true,
        dimPct: 85,
        lastAct: Date.now(),
      }
      const PRESETS = {
        off: {
          label: 'Off', desc: 'No modifications',
          patch: { blackBg: false, faintBorders: false, dimPct: 100, deepDimPct: 60, deepDimMin: 5, focusDim: false, autoNap: false, idleMin: 10, hue: false },
        },
        balanced: {
          label: 'Balanced', desc: 'Black surfaces, gentle dim, nap at 10 min',
          patch: { blackBg: true, faintBorders: true, dimPct: 85, deepDimPct: 60, deepDimMin: 5, focusDim: true, autoNap: true, idleMin: 10, hue: true },
        },
        maximum: {
          label: 'Maximum', desc: 'Deeper dim at 3 min, nap at 5 min',
          patch: { blackBg: true, faintBorders: true, dimPct: 70, deepDimPct: 45, deepDimMin: 3, focusDim: true, autoNap: true, idleMin: 5, hue: true },
        },
      }

      // --- persistence: settings live in localStorage only — still no
      // network, no telemetry, no conversation access. Storage can throw
      // (private mode, quota), so every access is guarded and falls back to
      // the in-memory defaults above. ---
      const STORE_KEY = 'dsh-oled-care:v1'
      try {
        const raw = localStorage.getItem(STORE_KEY)
        const saved = raw ? JSON.parse(raw) : null
        if (saved && typeof saved === 'object') {
          for (const k of ['autoNap', 'focusDim', 'faintBorders', 'hue', 'blackBg']) {
            if (typeof saved[k] === 'boolean') state[k] = saved[k]
          }
          if (typeof saved.dimPct === 'number' && saved.dimPct >= 50 && saved.dimPct <= 100) state.dimPct = saved.dimPct
          if (typeof saved.deepDimPct === 'number' && saved.deepDimPct >= 30 && saved.deepDimPct <= 100) state.deepDimPct = saved.deepDimPct
          if (Number.isInteger(saved.idleMin) && saved.idleMin >= 1 && saved.idleMin <= 120) state.idleMin = saved.idleMin
          if (Number.isInteger(saved.deepDimMin) && saved.deepDimMin >= 1 && saved.deepDimMin <= 120) state.deepDimMin = Math.min(saved.deepDimMin, state.idleMin)
          if (typeof saved.preset === 'string' && (saved.preset in PRESETS || saved.preset === 'custom')) state.preset = saved.preset
        }
      } catch (err) { /* storage unreadable — keep defaults */ }
      const saveSettings = () => {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify({
            preset: state.preset,
            autoNap: state.autoNap,
            idleMin: state.idleMin,
            deepDimMin: state.deepDimMin,
            deepDimPct: state.deepDimPct,
            focusDim: state.focusDim,
            faintBorders: state.faintBorders,
            hue: state.hue,
            blackBg: state.blackBg,
            dimPct: state.dimPct,
          }))
        } catch (err) { /* storage unwritable — settings stay in-memory */ }
      }

      // --- self-diagnostics surfaced on the settings page ---
      const status = {
        themeId: '',
        tokensApplied: 0,
        tokenError: '',
        hueDeg: 0,
        resolvedBg: '',
        dimNow: 100,
      }
      const subs = new Set()
      const emit = () => { subs.forEach((fn) => fn()) }
      const useOledState = () => {
        const pair = React.useState(0)
        const setTick = pair[1]
        React.useEffect(() => {
          const fn = () => setTick((t) => t + 1)
          subs.add(fn)
          return () => { subs.delete(fn) }
        }, [])
        return state
      }
      const setNap = (v) => {
        if (state.nap === v) return
        state.nap = v
        if (!v) state.lastAct = Date.now()
        emit()
      }

      // Ground-truth probe: the theme presenter writes tokens inline on
      // <body>. getComputedStyle forces a synchronous style flush, so this
      // runs only on a re-apply (settings edits, dim-rung changes, the slow
      // hue tick) — never on a fast or per-frame timer.
      const probe = () => {
        try {
          if (document.body) {
            status.resolvedBg = getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim()
          } else {
            status.resolvedBg = 'probe unavailable'
          }
        } catch (err) {
          status.resolvedBg = 'probe failed: ' + String(err)
        }
      }

      // Dark-surface tokens the UI actually consumes, with light-scheme
      // fallbacks close to the shipped light palette (dark -> pure black).
      const SURFACE_TOKENS = {
        '--dsw-alias-bg-base': '#ffffff',
        '--dsw-alias-bg-layer-1': '#ffffff',
        '--dsw-alias-bg-layer-2': '#ffffff',
        '--dsw-alias-bg-layer-3': '#ffffff',
        '--dsw-alias-bg-overlay': '#f7f7f8',
        '--dsw-alias-bg-module-platform': '#f5f5f7',
        '--dsw-specific-sidebar-fill': '#f7f7f8',
        '--dsw-specific-menu': '#f7f7f8',
        '--dsw-specific-input-major': '#ffffff',
        '--dsw-specific-bubble': '#f5f8fd',
        '--dsw-specific-tip': '#f5f5f7',
        '--dsw-alias-markdown-code-block': '#f5f5f7',
        '--dsw-alias-markdown-code-block-banner': '#f0f0f2',
        '--dsw-alias-markdown-inline-code': '#f0f0f2',
        '--dsw-alias-tooltip-bg': '#2c2c2e',
        '--dsw-alias-toast-bg': '#353538',
        '--dsw-hovercard-bg': '#2c2c2e',
      }
      // Static hairline borders: lit 24/7 at fixed pixel positions, so the
      // dark values go fainter than the shipped palette.
      const BORDER_TOKENS = {
        '--dsw-alias-border-l1': { light: 'rgba(0, 0, 0, 0.04)', dark: 'rgba(255, 255, 255, 0.03)' },
        '--dsw-alias-border-l2': { light: 'rgba(0, 0, 0, 0.1)', dark: 'rgba(255, 255, 255, 0.06)' },
        '--dsw-alias-border-l3': { light: 'rgba(0, 0, 0, 0.12)', dark: 'rgba(255, 255, 255, 0.08)' },
        '--dsw-alias-border-l4': { light: 'rgba(0, 0, 0, 0.16)', dark: 'rgba(255, 255, 255, 0.1)' },
      }
      // Bright label/accent tokens (dark-scheme bases from the shipped palette).
      const DIM_TOKENS = {
        '--dsw-alias-label-primary': [249, 250, 251],
        '--dsw-alias-label-secondary': [207, 211, 214],
        '--dsw-alias-label-tertiary': [173, 178, 184],
        '--dsw-alias-button-contrast-fill': [249, 250, 251],
        '--dsw-alias-brand-text': [249, 250, 251],
        '--dsw-alias-state-error-primary': [242, 90, 90],
        '--dsw-alias-state-success-primary': [34, 197, 94],
        '--dsw-alias-state-warn-primary': [245, 158, 11],
        '--dsw-alias-state-business-primary': [103, 158, 254],
      }
      // Gamma-aware dimming: pct is a linear-light luminance ratio, so
      // perceived contrast ratios between text shades survive the scaling.
      const scale = (base, pct) => {
        const f = pct / 100
        return 'rgb(' + base.map((c) => {
          const lin = Math.pow(c / 255, 2.2)
          return Math.round(255 * Math.pow(lin * f, 1 / 2.2))
        }).join(', ') + ')'
      }
      // The idle/focus ladder: normal dim -> deep dim (idle or unfocused) -> nap.
      const effectiveDim = () => {
        if (state.focusDim && !state.focused) return Math.min(state.dimPct, state.deepDimPct)
        if (Date.now() - state.lastAct > state.deepDimMin * 60000) return Math.min(state.dimPct, state.deepDimPct)
        return state.dimPct
      }

      // ONE layer: overrideTokens keys layers by source, and calling again
      // with the same source replaces that source's whole layer, so re-apply
      // needs no pre-dispose; keep only the newest disposer for teardown.
      let tokensDispose = null
      let lastScheme = ''
      let lastDimApplied = -1
      let applyTimer = null
      const applyTokens = () => {
        status.tokensApplied = 0
        status.tokenError = ''
        let scheme = 'dark'
        try { scheme = String(theme.getTheme().active.colorScheme) } catch (err) { /* keep dark default */ }
        lastScheme = scheme
        const tokens = {}
        if (state.blackBg) {
          for (const tokenName of Object.keys(SURFACE_TOKENS)) {
            tokens[tokenName] = { light: SURFACE_TOKENS[tokenName], dark: '#000000' }
          }
        }
        if (state.faintBorders) {
          for (const tokenName of Object.keys(BORDER_TOKENS)) tokens[tokenName] = BORDER_TOKENS[tokenName]
        }
        if (state.hue) {
          const hue = Math.floor(((Date.now() / 60000) % 720) / 720 * 360)
          status.hueDeg = hue
          tokens['--dsw-alias-brand-primary'] = {
            light: 'hsl(' + hue + ', 65%, 42%)',
            dark: 'hsl(' + hue + ', 70%, 60%)',
          }
        }
        const dimNow = effectiveDim()
        status.dimNow = dimNow
        lastDimApplied = dimNow
        if (scheme === 'dark' && dimNow < 100) {
          for (const tokenName of Object.keys(DIM_TOKENS)) {
            const dimmed = scale(DIM_TOKENS[tokenName], dimNow)
            tokens[tokenName] = { light: dimmed, dark: dimmed }
          }
        }
        const names = Object.keys(tokens)
        if (names.length === 0) {
          // Preset Off: remove the layer entirely so the shipped theme shows.
          if (tokensDispose !== null) { tokensDispose(); tokensDispose = null }
          probe()
          emit()
          return
        }
        try {
          tokensDispose = theme.overrideTokens('dsh-oled-care', tokens)
          status.tokensApplied = names.length
        } catch (err) {
          status.tokenError = String(err)
          console.error('oled-care: token override failed', String(err))
        }
        probe()
        emit()
      }
      // Slider drags fire per input tick; trailing-debounce those applies so a
      // drag costs one token restack (and one style-flush probe), not dozens.
      const scheduleApply = () => {
        if (applyTimer !== null) clearTimeout(applyTimer)
        applyTimer = setTimeout(() => { applyTimer = null; applyTokens() }, 150)
      }
      const reapplyIfDimMoved = () => {
        const d = effectiveDim()
        if (d !== lastDimApplied) applyTokens()
        else status.dimNow = d
      }

      ctx.effect(() => {
        try {
          const snap = theme.getTheme()
          status.themeId = String(snap.preference) + ' (active: ' + String(snap.active.id) + ')'
        } catch (err) {
          status.themeId = 'unreadable: ' + String(err)
        }
        applyTokens()
        return () => {
          if (applyTimer !== null) { clearTimeout(applyTimer); applyTimer = null }
          if (tokensDispose !== null) { tokensDispose(); tokensDispose = null }
        }
      }, 'oled-care: token layer')
      // Recompute only on a real color-scheme flip (our own overrideTokens
      // also emits theme/change; reacting unconditionally would loop).
      ctx.on('theme/change', (snap) => {
        const scheme = snap && snap.active && snap.active.colorScheme
        if (scheme !== undefined && String(scheme) !== lastScheme) applyTokens()
      })
      ctx.effect(() => {
        const id = setInterval(() => { if (state.hue) applyTokens() }, 5 * 60 * 1000)
        return () => clearInterval(id)
      }, 'oled-care: hue rotation tick')

      // --- activity tracking + focus sensing for the idle ladder ---
      ctx.effect(() => {
        const onAct = () => { state.lastAct = Date.now(); reapplyIfDimMoved() }
        const evs = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart']
        evs.forEach((e) => document.addEventListener(e, onAct, { passive: true }))
        return () => evs.forEach((e) => document.removeEventListener(e, onAct))
      }, 'oled-care: activity tracking')
      ctx.effect(() => {
        const onBlur = () => { state.focused = false; reapplyIfDimMoved(); emit() }
        const onFocus = () => { state.focused = true; state.lastAct = Date.now(); reapplyIfDimMoved(); emit() }
        window.addEventListener('blur', onBlur)
        window.addEventListener('focus', onFocus)
        return () => {
          window.removeEventListener('blur', onBlur)
          window.removeEventListener('focus', onFocus)
        }
      }, 'oled-care: focus tracking')
      ctx.effect(() => {
        const id = setInterval(() => {
          if (state.autoNap && !state.nap && Date.now() - state.lastAct > state.idleMin * 60000) {
            setNap(true)
            return
          }
          if (!state.nap) { reapplyIfDimMoved(); emit() }
        }, 15000)
        return () => clearInterval(id)
      }, 'oled-care: idle ladder')

      // --- styles (one owned tag, removed with the plugin fiber) ---
      const CSS = [
        '.oled-nap{position:fixed;inset:0;background:#000;z-index:99999;pointer-events:auto;outline:none;cursor:none;overflow:hidden}',
        '.oled-nap-clock{position:absolute;left:0;top:0;color:#2e2e2e;font-size:64px;font-weight:200;user-select:none;animation:oled-drift 90s linear infinite alternate}',
        '.oled-nap-status{font-size:15px;color:#2a2a2a;margin-top:10px;font-weight:400}',
        '.oled-nap-hint{font-size:13px;color:#242424;margin-top:12px;font-weight:400}',
        '@keyframes oled-drift{0%{transform:translate(5vw,8vh)}20%{transform:translate(60vw,15vh)}40%{transform:translate(72vw,62vh)}60%{transform:translate(30vw,78vh)}80%{transform:translate(8vw,44vh)}100%{transform:translate(50vw,30vh)}}',
        '.oled-nap-button{display:inline-flex;align-items:center;gap:4px;background:transparent;border:none;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:4px 6px;border-radius:6px;font:inherit;font-size:12px;line-height:1}',
        '.oled-nap-button:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
        '.oled-page{display:flex;flex-direction:column;gap:22px;padding:4px 0;max-width:680px;color:var(--dsw-alias-label-primary)}',
        '.oled-group{display:flex;flex-direction:column;gap:4px}',
        '.oled-group-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}',
        '.oled-presets{display:flex;gap:10px;flex-wrap:wrap}',
        // Our own chrome must not use the surface/border tokens we override —
        // with pure-black + faint borders active they would be invisible.
        // color-mix against currentColor stays visible in both schemes.
        '.oled-preset{flex:1;min-width:150px;text-align:left;background:color-mix(in srgb, currentColor 4%, transparent);border:1px solid color-mix(in srgb, currentColor 14%, transparent);border-radius:8px;padding:10px 12px;cursor:pointer;color:var(--dsw-alias-label-primary);font:inherit}',
        '.oled-preset:hover{border-color:color-mix(in srgb, currentColor 25%, transparent)}',
        // Harness brand blue (#5886D1), pinned: --dsw-alias-brand-primary is
        // hue-rotated by this plugin, so our own chrome must not follow it.
        '.oled-preset.active{border-color:#5886d1;box-shadow:0 0 0 1px #5886d1}',
        '.oled-preset.static{cursor:default}',
        '.oled-preset-name{font-weight:600;font-size:13px}',
        '.oled-preset-desc{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:3px}',
        '.oled-field{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid color-mix(in srgb, currentColor 10%, transparent)}',
        '.oled-field:last-child{border-bottom:none}',
        '.oled-field-label{font-size:13px}',
        '.oled-field-desc{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;max-width:420px}',
        '.oled-num{width:64px;background:color-mix(in srgb, currentColor 4%, transparent);color:var(--dsw-alias-label-primary);border:1px solid color-mix(in srgb, currentColor 18%, transparent);border-radius:4px;padding:2px 6px}',
        '.oled-slider{display:flex;align-items:center;gap:8px;font-size:13px}',
        '.oled-slider input[type=range]{width:110px;accent-color:#5886d1}',
        '.oled-diag{padding:10px;border:1px solid color-mix(in srgb, currentColor 14%, transparent);border-radius:8px;font-size:11px;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:3px}',
        '.oled-diag-title{font-weight:600;color:var(--dsw-alias-label-primary)}',
        // Sits at the very top of our settings content. The host's header
        // band (with "Open configuration file") is outside the slot and the
        // scroll container clips anything pushed above our top edge, so this
        // is the highest position we can reliably occupy.
        '.oled-star{font-size:12px;color:var(--dsw-alias-label-secondary)}',
        '.oled-star a{color:inherit;text-decoration:none;border-bottom:1px dotted color-mix(in srgb, currentColor 40%, transparent)}',
        '.oled-star a:hover{color:var(--dsw-alias-label-primary)}',
        '.oled-contact{font-size:12px;color:var(--dsw-alias-label-secondary)}',
        '.oled-contact a{color:inherit;text-decoration:none;border-bottom:1px dotted color-mix(in srgb, currentColor 40%, transparent)}',
        '.oled-contact a:hover{color:var(--dsw-alias-label-primary)}',
      ].join('\n')
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-oled-care'
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => tag.remove()
      }, 'oled-care: styles')

      // --- nap overlay: the gate subscribes to nothing but our own state;
      // the screen (sessions-store hook, clock interval) exists only while
      // napping, so idle streaming frames cost zero work here. ---
      // NapLayout holds the presentation; NapScreenWithSessions is a separate
      // component so the sessions-store hook is called unconditionally
      // (a conditional hook call would break React's hook ordering).
      function NapLayout(props) {
        const pair = React.useState(new Date())
        const now = pair[0]
        const setNow = pair[1]
        const didFocus = React.useRef(false)
        React.useEffect(() => {
          const id = setInterval(() => setNow(new Date()), 1000)
          return () => clearInterval(id)
        }, [])
        const pad = (n) => String(n).padStart(2, '0')
        const wake = () => setNap(false)
        return h('div', {
          className: 'oled-nap',
          tabIndex: -1,
          ref: (el) => { if (el && !didFocus.current) { didFocus.current = true; el.focus() } },
          onMouseMove: wake,
          onMouseDown: wake,
          onKeyDown: wake,
          onTouchStart: wake,
        },
          h('div', { className: 'oled-nap-clock' },
            pad(now.getHours()) + ':' + pad(now.getMinutes()),
            h('div', { className: 'oled-nap-status' }, String(props.sessionStatus)),
            h('div', { className: 'oled-nap-hint' }, 'nap mode — move the mouse or press any key to wake'),
          ),
        )
      }
      function NapScreenWithSessions(props) {
        const sessionStatus = props.useSessions((list) => {
          const id = list.current
          if (id === undefined) return 'no active session'
          const row = list.byId[id]
          if (row === undefined) return 'no active session'
          if (row.pendingInteraction) return 'agent is waiting for your input'
          return row.running ? 'agent is working' : 'session idle'
        })
        return h(NapLayout, { sessionStatus: sessionStatus })
      }
      function NapScreen(props) {
        return props.useSessions !== undefined && props.useSessions !== null
          ? h(NapScreenWithSessions, props)
          : h(NapLayout, { sessionStatus: 'no active session' })
      }
      function NapOverlay(props) {
        const s = useOledState()
        if (!s.nap) return null
        return h(NapScreen, props)
      }

      // --- session header trigger ---
      function NapButton() {
        const s = useOledState()
        return h('button', {
          type: 'button',
          className: 'oled-nap-button',
          title: s.nap ? 'Nap mode active' : 'Nap mode: pure black screen to rest OLED pixels',
          'aria-pressed': s.nap,
          onClick: () => setNap(true),
        }, '☾ Nap')
      }

      // --- settings page ---
      // Local string state while editing so the field can be cleared and
      // retyped; commits only in-range values, resyncs from state on blur.
      // Defined at apply scope (not inside SettingsPage) so the component
      // identity — and its local state — survives settings re-renders.
      function MinutesInput(props) {
        const pair = React.useState(String(props.value))
        const text = pair[0]
        const setText = pair[1]
        return h('input', {
          type: 'number', min: 1, max: 120, value: text, className: 'oled-num',
          'aria-label': props.label,
          onChange: (e) => {
            const t = e.target.value
            setText(t)
            const n = Number(t)
            if (t !== '' && Number.isInteger(n) && n >= 1 && n <= 120) props.onCommit(n)
          },
          onBlur: () => setText(String(props.value)),
        })
      }
      function SettingsPage() {
        const s = useOledState()
        const update = (patch, debounced) => {
          Object.assign(state, patch)
          state.preset = 'custom'
          saveSettings()
          if (debounced === true) scheduleApply()
          else applyTokens()
          emit()
        }
        const applyPreset = (key) => { Object.assign(state, PRESETS[key].patch); state.preset = key; saveSettings(); applyTokens(); emit() }
        const checkbox = (checked, onChange, label) => h('input', {
          type: 'checkbox', checked: checked, 'aria-label': label,
          onChange: (e) => onChange(e.target.checked),
        })
        const slider = (value, min, onChange, label) => h('div', { className: 'oled-slider' },
          h('input', {
            type: 'range', min: min, max: 100, step: 5, value: value, 'aria-label': label,
            onChange: (e) => onChange(Number(e.target.value)),
          }),
          h('span', null, value + '%'),
        )
        // The control is a factory receiving the field's label text, so each
        // input's aria-label can never drift from its visible label.
        const field = (labelText, desc, control) => h('div', { className: 'oled-field' },
          h('div', null,
            h('div', { className: 'oled-field-label' }, labelText),
            h('div', { className: 'oled-field-desc' }, desc),
          ),
          control(labelText),
        )
        const presetCard = (key) => h('button', {
          type: 'button',
          className: 'oled-preset' + (s.preset === key ? ' active' : ''),
          onClick: () => applyPreset(key),
        },
          h('div', { className: 'oled-preset-name' }, PRESETS[key].label),
          h('div', { className: 'oled-preset-desc' }, PRESETS[key].desc),
        )
        const idleFor = Math.round((Date.now() - s.lastAct) / 60000)
        return h('div', { className: 'oled-page' },
          // Quiet header link — opens the repo in a new tab, no tracking.
          h('div', { className: 'oled-star' },
            'Enjoying OLEDCare? ',
            h('a', {
              href: 'https://github.com/domparent/OLEDCare',
              target: '_blank',
              rel: 'noopener noreferrer',
            }, '☆ Star it on GitHub'),
          ),
          h('div', { className: 'oled-group' },
            h('div', { className: 'oled-group-title' }, 'Preset'),
            h('div', { className: 'oled-presets' },
              presetCard('off'),
              presetCard('balanced'),
              presetCard('maximum'),
              s.preset === 'custom'
                ? h('div', { className: 'oled-preset static active' },
                    h('div', { className: 'oled-preset-name' }, 'Custom'),
                    h('div', { className: 'oled-preset-desc' }, 'Your own mix — pick a preset to reset'),
                  )
                : null,
            ),
          ),
          h('div', { className: 'oled-group' },
            h('div', { className: 'oled-group-title' }, 'Appearance'),
            field('Pure black backgrounds', 'Every surface goes #000, so background pixels turn fully off.', (label) => checkbox(s.blackBg, (v) => update({ blackBg: v }), label)),
            field('Fainter static borders', 'Hairline borders sit at the same pixels all day; this dims them further.', (label) => checkbox(s.faintBorders, (v) => update({ faintBorders: v }), label)),
            field('Text/accent intensity', 'Scales white text and bright accents. Linear-light ratio: perceived contrast is preserved.', (label) => slider(s.dimPct, 50, (v) => update({ dimPct: v }, true), label)),
            field('Hue rotation', 'Slowly cycles the accent hue (~12h cycle) so static icons wear all subpixels evenly.', (label) => checkbox(s.hue, (v) => update({ hue: v }), label)),
          ),
          h('div', { className: 'oled-group' },
            h('div', { className: 'oled-group-title' }, 'Idle & focus'),
            field('Deep-dim after idle', 'Minutes without input before the deeper intensity applies. Clamped to the nap delay.', (label) => h(MinutesInput, { value: s.deepDimMin, label: label, onCommit: (v) => update({ deepDimMin: Math.min(v, s.idleMin) }) })),
            field('Deep-dim intensity', 'The dimmer intensity used while idle or unfocused.', (label) => slider(s.deepDimPct, 30, (v) => update({ deepDimPct: v }, true), label)),
            field('Deep-dim when unfocused', 'Apply deep-dim whenever this window loses focus.', (label) => checkbox(s.focusDim, (v) => update({ focusDim: v }), label)),
            field('Auto nap after idle', 'Minutes without input before the true-black nap screen engages. Lowering this also lowers deep-dim.', (label) => h(MinutesInput, { value: s.idleMin, label: label, onCommit: (v) => update({ idleMin: v, deepDimMin: Math.min(s.deepDimMin, v) }) })),
          ),
          h('div', { className: 'oled-diag' },
            h('div', { className: 'oled-diag-title' }, 'Diagnostics'),
            h('div', null, 'theme: ' + (status.themeId || '?')),
            h('div', null, 'token layer: ' + (status.tokensApplied > 0 ? status.tokensApplied + ' tokens applied' : 'off') + (status.tokenError ? ' — error: ' + status.tokenError : '')),
            h('div', null, 'resolved body --dsw-alias-bg-base: ' + (status.resolvedBg || '?')),
            h('div', null, 'dim now: ' + status.dimNow + '% (base ' + s.dimPct + '%, deep ' + s.deepDimPct + '%)' + (s.focused ? '' : ' · window unfocused')),
            h('div', null, 'hue: ' + (s.hue ? 'rotating, now ' + status.hueDeg + '°' : 'off')),
            h('div', null, 'nap: ' + (s.nap ? 'active' : 'off') + ' · idle for ~' + idleFor + ' min (deep-dim at ' + s.deepDimMin + ', nap at ' + s.idleMin + ')'),
          ),
          // Feedback link — GitHub issues, so requests stay tracked in one
          // place and the reporter gets notified on progress.
          h('div', { className: 'oled-contact' },
            'Found a bug or want a new feature? ',
            h('a', {
              href: 'https://github.com/domparent/OLEDCare/issues/new',
              target: '_blank',
              rel: 'noopener noreferrer',
            }, 'Open an issue'),
            ' — I read every one.',
          ),
        )
      }

      // --- slot registrations ---
      ctx.effect(() => slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'oled-nap', label: 'OLED nap overlay' },
        (props) => h(NapOverlay, props),
      )), 'oled-care: nap overlay slot')
      ctx.effect(() => slots.inject('conversation.session.header.actions', () => slots.register(
        { name: 'conversation.session.header.actions', id: 'oled-nap', order: 30, label: 'Nap mode' },
        () => h(NapButton, null),
      )), 'oled-care: nap button slot')
      ctx.effect(() => slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'oled-care', order: 30, label: 'OLEDCare' },
        () => h(SettingsPage, null),
      )), 'oled-care: settings section slot')
    }

    exports.name = name
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
