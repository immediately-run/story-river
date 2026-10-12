// The river's state (APP_CUSTOMIZATION_SPEC §6.3/§6.4, R3-881): a pure reducer over
// the URL. `story` lists the open cards top to bottom as bundle-relative keys; the
// URL path names the focused card. Components only dispatch — every decision about
// order, bounds, focus and push-vs-replace lives here so the operations table is
// one testable surface.

import { keyToHref, sandboxPathToKey } from '@immediately-run/grove';

/** The one query key. Lives here; nothing else spells it (checked in CI by grep). */
export const STORY_PARAM = 'story';

/** The river never holds more than this many cards; a 21st open drops the bottom. */
export const MAX_CARDS = 20;

/** The river, encoded in the URL: the open cards top to bottom (canonical keys,
 *  `/app/content/…`), the focused one first among equals. */
export interface RiverState {
  keys: string[];
  focused: string;
}

/** One row of §6.4's operations table. */
export type RiverOp =
  | { op: 'open-below'; key: string; below: string }
  | { op: 'open-top'; key: string }
  | { op: 'focus'; key: string }
  | { op: 'close'; key: string };

export interface RiverOpResult {
  state: RiverState;
  /** Opening is a push (Back undoes it); focusing and closing are replaces. */
  history: 'push' | 'replace';
}

/** Canonical key → the bundle-relative form the `story` param carries (what
 *  `keyToHref` hands the URL space). */
export const keyToStory = (key: string): string => keyToHref(key);

/** Parse `?story=` + the URL path into a river. `path` is the sandbox path the
 *  host reflects (the `/files/…` form included); it names the focused card. A URL
 *  with no `story` is a river of one card (the path). Keys that arrive malformed
 *  are kept — resolution against the metadata is `dropUnresolvable`'s job (the
 *  notice needs the reader-facing count, which only it can announce). A focused
 *  path missing from `story` joins at the top: the URL names it, so it is open. */
export function parseStory(search: string, path: string): RiverState {
  const focused = sandboxPathToKey(path);
  const raw = new URLSearchParams(search).get(STORY_PARAM) ?? '';
  const keys = raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map((k) => sandboxPathToKey(k.startsWith('/files') || k.startsWith('/') ? k : `/${k}`));
  if (!keys.includes(focused)) keys.unshift(focused);
  return { keys: keys.slice(0, MAX_CARDS), focused: keys.includes(focused) ? focused : keys[0] };
}

/** Serialize a river back onto the query string — `parseStory` of the result is
 *  the identity on the search string (the round-trip the tests pin). */
export function serializeStory(state: RiverState): string {
  const params = new URLSearchParams();
  params.set(STORY_PARAM, state.keys.map(keyToStory).join(','));
  return `?${params.toString()}`;
}

const focusedOf = (keys: string[], wanted: string): string =>
  keys.includes(wanted) ? wanted : (keys[0] ?? wanted);

/** Apply one operation. Opening an already-open card is operation 3 (focus and
 *  scroll, order unchanged, replace) whatever the open op was — a link to an open
 *  entry never duplicates a card. Closing the sole card is refused (the river is
 *  never empty; the UI offers no close there, and the reducer agrees). */
export function apply(state: RiverState, op: RiverOp): RiverOpResult {
  switch (op.op) {
    case 'open-below':
    case 'open-top': {
      if (state.keys.includes(op.key)) {
        return { state: { ...state, focused: op.key }, history: 'replace' };
      }
      const keys = [...state.keys];
      const at =
        op.op === 'open-top' ? 0 : Math.max(0, keys.indexOf(op.below) + 1);
      keys.splice(at, 0, op.key);
      const overflow = keys.length - MAX_CARDS;
      if (overflow > 0) keys.splice(keys.length - overflow, overflow); // drop the bottom-most
      return { state: { keys, focused: op.key }, history: 'push' };
    }
    case 'focus':
      return { state: { ...state, focused: focusedOf(state.keys, op.key) }, history: 'replace' };
    case 'close': {
      if (state.keys.length <= 1) return { state, history: 'replace' };
      const at = state.keys.indexOf(op.key);
      if (at === -1) return { state, history: 'replace' };
      const keys = state.keys.filter((k) => k !== op.key);
      // Focus the card that took its place: the next card down, else the one above.
      const successor = keys[Math.min(at, keys.length - 1)];
      const focused = state.focused === op.key ? successor : state.focused;
      return { state: { keys, focused: focusedOf(keys, focused) }, history: 'replace' };
    }
  }
}

/** Drop keys the corpus cannot resolve (§6.3: on load, with a notice, never a
 *  broken card). Returns the survivors and what was dropped so the river can
 *  announce it. A dropped focus falls to the first survivor. */
export function dropUnresolvable(
  state: RiverState,
  known: (key: string) => boolean,
): { state: RiverState; dropped: string[] } {
  const keys = state.keys.filter(known);
  const dropped = state.keys.filter((k) => !known(k));
  if (dropped.length === 0) return { state, dropped };
  return { state: { keys, focused: focusedOf(keys, state.focused) }, dropped };
}
