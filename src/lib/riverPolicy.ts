// The §4.3 policy the river provides (APP_CUSTOMIZATION_SPEC §6.4, R3-881) —
// extracted from `useRiver` so the click semantics are testable against the pure
// reducer without the SDK route/metadata seams. `useRiver` wires it to `navigate`.

import { apply, type RiverOpResult, type RiverState } from './river';
import type { RiverCallbacks } from '../hooks/useRiver';
import type { FollowLinkTarget } from '@immediately-run/grove';

export interface RiverFollowDeps {
  state: RiverState;
  dispatch: (result: RiverOpResult, note: string, fragment?: string) => void;
  /** The card callbacks register at mount; read at CLICK time, never at render. */
  getCallbacks: () => RiverCallbacks | null;
  titleOf: (key: string) => string;
}

/** Chrome links (no `from`) insert at the top — the TiddlyWiki top insert the
 *  mockup keeps. A link inside a card inserts directly below its card. A link to
 *  an open card focuses and scrolls (and the reducer makes it a replace); the
 *  found card is briefly highlighted. A `#fragment` rides the navigation target
 *  in both cases and lands within the card. */
export function riverFollow({ state, dispatch, getCallbacks, titleOf }: RiverFollowDeps) {
  return (target: FollowLinkTarget): void => {
    const opened = !state.keys.includes(target.key);
    const result = opened
      ? target.from
        ? apply(state, { op: 'open-below', key: target.key, below: target.from })
        : apply(state, { op: 'open-top', key: target.key })
      : apply(state, { op: 'focus', key: target.key });
    const label = titleOf(target.key);
    dispatch(
      result,
      opened
        ? target.from
          ? `Opened ${label} below its link.`
          : `Opened ${label} at the top.`
        : `Moved to ${label}.`,
      // [[x#sec-4]] lands on the section within x's card whether x was open or
      // not (§6.4's fragment row); Grove's own ScrollToFragment waits for the
      // render and resolves it entry-scoped.
      target.fragment,
    );
    const callbacks = getCallbacks();
    callbacks?.focusCardTitle(target.key);
    if (!opened) {
      callbacks?.scrollToCard(target.key);
      callbacks?.highlightCard(target.key);
    }
  };
}
