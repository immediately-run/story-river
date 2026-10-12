// The river's React half (APP_CUSTOMIZATION_SPEC §6, R3-881): the URL is the only
// state; this hook turns the pure reducer's outputs into SDK navigations and owns
// the §6.4 interaction obligations — focus to the opened/closed-to card's title,
// scroll-into-view, and the polite announcements. Components only dispatch.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate, useAllMetadata, useRoute } from '@immediately-run/sdk';
import { isContentEntry, keyToHref } from '@immediately-run/grove';
import { titleOf } from '../lib/sidebarEntries';
import {
  apply,
  closeSuccessor,
  dropUnresolvable,
  parseStory,
  serializeStory,
  type RiverOpResult,
  type RiverState,
} from '../lib/river';
import { riverFollow } from '../lib/riverPolicy';

export interface RiverAnnouncement {
  id: number;
  message: string;
}

/** What the card container registers so open/close can move focus and scroll. */
export interface RiverCallbacks {
  focusCardTitle: (key: string) => void;
  scrollToCard: (key: string) => void;
  highlightCard: (key: string) => void;
  /** An OPEN defers until the new card commits (dispatch is a postMessage). */
  focusWhenMounted: (key: string) => void;
}

export function useRiver() {
  const route = useRoute();
  const sandboxPath = route.sandboxPath ?? '/';
  const [path, search] = useMemo(() => {
    const at = sandboxPath.indexOf('?');
    return at === -1 ? [sandboxPath, ''] : [sandboxPath.slice(0, at), sandboxPath.slice(at)];
  }, [sandboxPath]);

  const metadata = useAllMetadata() as Record<string, unknown> | null;
  const known = useMemo(() => new Set(Object.keys(metadata ?? {}).filter(isContentEntry)), [metadata]);

  const raw = useMemo(() => parseStory(search, path), [search, path]);
  const cleaned = useMemo(() => dropUnresolvable(raw, (k) => known.has(k)), [raw, known]);
  const state: RiverState = known.size > 0 ? cleaned.state : raw;
  // Gated on the metadata having arrived: `known` is empty on cold load and a
  // false "N entries were dropped" must not announce before it could know.
  const dropped = useMemo(() => (known.size > 0 ? cleaned.dropped : []), [known, cleaned]);

  const [announcement, setAnnouncement] = useState<RiverAnnouncement | null>(null);
  const seq = useRef(0);
  const announce = useCallback((message: string) => {
    seq.current += 1;
    setAnnouncement({ id: seq.current, message });
  }, []);

  // §6.3: unresolvable keys are dropped on load with a notice in the river.
  useEffect(() => {
    if (dropped.length === 0) return;
    announce(
      dropped.length === 1
        ? 'One linked entry is no longer here and was dropped from the river.'
        : `${dropped.length} linked entries are no longer here and were dropped from the river.`,
    );
  }, [dropped, announce]);

  const registered = useRef<RiverCallbacks | null>(null);
  const registerCallbacks = useCallback((cb: RiverCallbacks | null) => {
    registered.current = cb;
  }, []);

  // Apply an operation and reflect it onto the URL. The focused card's href is the
  // path; `story` rides as the query; history push/replace comes from the reducer.
  // A fragment lands within the new focused card (Grove's own ScrollToFragment
  // waits for the render); any stale hash is dropped on an open.
  const dispatch = useCallback(
    (result: RiverOpResult, note: string, fragment?: string) => {
      announce(note);
      navigate(keyToHref(result.state.focused) + serializeStory(result.state) + (fragment ? `#${fragment}` : ''), {
        replace: result.history === 'replace',
        viewedDocument: keyToHref(result.state.focused).replace(/^\//, ''),
      });
      return result;
    },
    [announce],
  );

  // Built at CLICK time, not render: the card callbacks are ref-held (they
  // register at mount), and the §4.3 policy reads them only when a link is
  // followed.
  const follow = useCallback(
    (target: Parameters<ReturnType<typeof riverFollow>>[0]) => {
      riverFollow({
        state,
        dispatch,
        getCallbacks: () => registered.current,
        titleOf: (k) => titleOf(metadata, k),
      })(target);
    },
    [state, dispatch, metadata],
  );

  const openTop = useCallback((key: string) => follow({ key, href: keyToHref(key) }), [follow]);

  const focusCard = useCallback(
    (key: string) => {
      dispatch(apply(state, { op: 'focus', key }), `Moved to ${titleOf(metadata, key)}.`);
      registered.current?.focusCardTitle(key);
      registered.current?.scrollToCard(key);
    },
    [dispatch, state, metadata],
  );

  const closeCard = useCallback(
    (key: string) => {
      const result = apply(state, { op: 'close', key });
      if (result.state === state) return; // the sole card has no close
      dispatch(result, `Closed ${titleOf(metadata, key)}.`);
      // The card that took its place takes DOM focus too (§6.4) — the rule's
      // one home is the reducer's closeSuccessor.
      const successor = closeSuccessor(state, key);
      if (successor) registered.current?.focusCardTitle(successor);
    },
    [dispatch, state, metadata],
  );

  return {
    state,
    known,
    metadata,
    dropped,
    announcement,
    follow,
    openTop,
    focusCard,
    closeCard,
    registerCallbacks,
  };
}
