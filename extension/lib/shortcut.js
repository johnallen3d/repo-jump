// The in-page palette shortcut. Kept in storage so it can be changed in options.
// Default: ⌥⌘K on macOS (⌘⇧K is Cra's "Clear Today"), Ctrl+Alt+K elsewhere.
export const DEFAULT_SHORTCUT = /Mac/.test(globalThis.navigator?.platform ?? '')
  ? { code: 'KeyK', meta: true, alt: true, ctrl: false, shift: false }
  : { code: 'KeyK', meta: false, alt: true, ctrl: true, shift: false };

export function matches(e, s) {
  return e.code === s.code && e.metaKey === s.meta && e.altKey === s.alt && e.ctrlKey === s.ctrl && e.shiftKey === s.shift;
}

export function fromEvent(e) {
  return { code: e.code, meta: e.metaKey, alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey };
}

export function label(s) {
  const key = s.code.replace(/^Key|^Digit/, '');
  return `${s.ctrl ? '⌃' : ''}${s.alt ? '⌥' : ''}${s.shift ? '⇧' : ''}${s.meta ? '⌘' : ''}${key}`;
}
