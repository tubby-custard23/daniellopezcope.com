/*
 * A tiny schema-driven settings store with a live panel, shared across pages.
 *
 * Each page declares the knobs it owns via defineTweaks(), reads them back
 * with tweak(), and never has to know the panel exists. The panel builds its
 * own UI from whatever has been declared, so adding a slider is a one-line
 * change at the call site rather than an edit here.
 *
 * Values live in localStorage, so tuning survives a reload without a deploy.
 */

export type TweakSpec = {
  group: string;
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number; // the default, i.e. what the committed source uses
};

const STORAGE_KEY = 'dlc.tweaks.v1';

const specs = new Map<string, TweakSpec>();
const listeners = new Set<(key: string, value: number) => void>();
let overrides: Record<string, number> = readStored();

function readStored(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    // localStorage throws outright in some privacy modes
    return {};
  }
}

function writeStored() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* tuning just will not persist */
  }
}

/** Register knobs. Safe to call from several pages; last definition wins. */
export function defineTweaks(list: TweakSpec[]) {
  for (const spec of list) specs.set(spec.key, spec);
  refreshPanel();
}

/** Current value: a stored override if there is one, otherwise the default. */
export function tweak(key: string): number {
  if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
  const spec = specs.get(key);
  if (!spec) {
    console.warn(`[tweaks] no such knob: ${key}`);
    return 0;
  }
  return spec.value;
}

export function setTweak(key: string, value: number) {
  overrides[key] = value;
  writeStored();
  listeners.forEach(fn => fn(key, value));
}

export function resetTweaks() {
  overrides = {};
  writeStored();
  specs.forEach(spec => listeners.forEach(fn => fn(spec.key, spec.value)));
  refreshPanel();
}

/** Notified on every change - use for values you cannot re-read each frame. */
export function onTweakChange(fn: (key: string, value: number) => void) {
  listeners.add(fn);
}

/* ------------------------------------------------------------------ panel */

let panel: HTMLElement | null = null;
let body: HTMLElement | null = null;

const PANEL_CSS = `
.tweak-panel {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 2000;
  width: 300px;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  background: rgba(12, 10, 16, 0.94);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(140, 120, 180, 0.35);
  border-radius: 10px;
  color: #e8e4f0;
  font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}
.tweak-panel[hidden] { display: none !important; }
.tweak-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 9px 11px;
  border-bottom: 1px solid rgba(140, 120, 180, 0.25);
  position: sticky; top: 0;
  background: rgba(12, 10, 16, 0.97);
}
.tweak-title { letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.75; }
.tweak-actions { display: flex; gap: 5px; }
.tweak-btn {
  background: rgba(120, 100, 160, 0.25);
  border: 1px solid rgba(150, 130, 190, 0.35);
  color: #e8e4f0; border-radius: 5px;
  padding: 3px 7px; font: inherit; cursor: pointer;
}
.tweak-btn:hover { background: rgba(150, 130, 190, 0.4); }
.tweak-group { padding: 7px 11px 9px; }
.tweak-group + .tweak-group { border-top: 1px dashed rgba(140, 120, 180, 0.18); }
.tweak-group-name { opacity: 0.5; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
.tweak-row { margin-bottom: 7px; }
.tweak-row-top { display: flex; justify-content: space-between; gap: 8px; }
.tweak-label { opacity: 0.85; }
.tweak-value { opacity: 0.6; font-variant-numeric: tabular-nums; }
.tweak-row input[type="range"] { width: 100%; margin: 2px 0 0; accent-color: #9c86c8; }
.tweak-hint { padding: 7px 11px 9px; opacity: 0.4; border-top: 1px dashed rgba(140, 120, 180, 0.18); }
`;

function injectCss() {
  if (document.getElementById('tweak-panel-css')) return;
  const style = document.createElement('style');
  style.id = 'tweak-panel-css';
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}

function build() {
  injectCss();

  panel = document.createElement('div');
  panel.className = 'tweak-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="tweak-head">
      <span class="tweak-title">tweaks</span>
      <span class="tweak-actions">
        <button class="tweak-btn" data-act="copy">copy</button>
        <button class="tweak-btn" data-act="reset">reset</button>
        <button class="tweak-btn" data-act="close">✕</button>
      </span>
    </div>
    <div class="tweak-body"></div>
    <div class="tweak-hint">~ toggles · values saved locally</div>
  `;
  body = panel.querySelector('.tweak-body');

  panel.querySelector('[data-act="close"]')?.addEventListener('click', () => togglePanel(false));
  panel.querySelector('[data-act="reset"]')?.addEventListener('click', resetTweaks);
  panel.querySelector('[data-act="copy"]')?.addEventListener('click', copyAsCode);

  document.body.appendChild(panel);
  refreshPanel();
}

function refreshPanel() {
  if (!body) return;

  const groups = new Map<string, TweakSpec[]>();
  specs.forEach(spec => {
    if (!groups.has(spec.group)) groups.set(spec.group, []);
    groups.get(spec.group)!.push(spec);
  });

  body.innerHTML = '';

  groups.forEach((rows, name) => {
    const wrap = document.createElement('div');
    wrap.className = 'tweak-group';
    wrap.innerHTML = `<div class="tweak-group-name">${name}</div>`;

    for (const spec of rows) {
      const current = tweak(spec.key);
      const row = document.createElement('div');
      row.className = 'tweak-row';
      row.innerHTML = `
        <div class="tweak-row-top">
          <span class="tweak-label">${spec.label}</span>
          <span class="tweak-value" data-for="${spec.key}">${current}</span>
        </div>
      `;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(current);
      input.addEventListener('input', () => {
        const value = Number(input.value);
        setTweak(spec.key, value);
        const readout = row.querySelector(`[data-for="${spec.key}"]`);
        if (readout) readout.textContent = String(value);
      });

      row.appendChild(input);
      wrap.appendChild(row);
    }

    body!.appendChild(wrap);
  });
}

/* Emit the current settings as source, so a session of fiddling can be
   promoted into the committed defaults instead of living in localStorage. */
function copyAsCode() {
  const lines: string[] = [];
  const groups = new Map<string, TweakSpec[]>();
  specs.forEach(spec => {
    if (!groups.has(spec.group)) groups.set(spec.group, []);
    groups.get(spec.group)!.push(spec);
  });

  groups.forEach((rows, name) => {
    lines.push(`// ${name}`);
    for (const spec of rows) {
      const current = tweak(spec.key);
      const changed = current !== spec.value ? `   // was ${spec.value}` : '';
      lines.push(`${spec.key}: ${current},${changed}`);
    }
    lines.push('');
  });

  const text = lines.join('\n');
  navigator.clipboard?.writeText(text).catch(() => {});
  console.log('[tweaks] current values:\n' + text);
}

export function togglePanel(show?: boolean) {
  if (!panel) build();
  if (!panel) return;
  panel.hidden = show === undefined ? !panel.hidden : !show;
}

/** Call once per page. Binds ~ to show the panel. */
export function mountTweakPanel() {
  document.addEventListener('keydown', e => {
    // never steal the key while someone is typing
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === '~' || e.key === '`' || e.code === 'Backquote') {
      e.preventDefault();
      togglePanel();
    }
  });
}
