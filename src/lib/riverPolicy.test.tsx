// The §6.4 click semantics at the policy seam (R3-881): a plain click inside a
// card calls the policy and inserts below; a link to an open card focuses without
// inserting; chrome links insert at the top; the found card is highlighted. The
// clicks run through `followLinkOnClick` — the PUBLIC anchor contract Grove's own
// links carry — so the path exercised here is the one production rides.

import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { followLinkOnClick, type FollowLinkTarget } from '@immediately-run/grove';
import { riverFollow } from './riverPolicy';
import type { RiverCallbacks } from '../hooks/useRiver';
import type { RiverOpResult } from './river';

const HOME = '/app/content/home.mdx';
const ADA = '/app/content/people/ada-lovelace.mdx';
const ONBOARDING = '/app/content/handbook/onboarding.mdx';

function harness(keys: string[], focused: string) {
  const dispatched: RiverOpResult[] = [];
  const fragments: Array<string | undefined> = [];
  const notes: string[] = [];
  const called: string[] = [];
  const callbacks: RiverCallbacks = {
    focusCardTitle: (k) => called.push(`focus:${k}`),
    scrollToCard: (k) => called.push(`scroll:${k}`),
    highlightCard: (k) => called.push(`found:${k}`),
    focusWhenMounted: (k) => called.push(`when:${k}`),
  };
  const follow = riverFollow({
    state: { keys, focused },
    dispatch: (result, note, fragment) => {
      dispatched.push(result);
      fragments.push(fragment);
      notes.push(note);
    },
    getCallbacks: () => callbacks,
    titleOf: (k) => k,
  });
  return { follow, dispatched, fragments, notes, called };
}

/** A real anchor wired with the public `followLinkOnClick` contract — Grove's own
 *  WikiLink click path (plain click → policy, modified click → browser). */
function CardLink({ target, follow }: { target: FollowLinkTarget; follow: (t: FollowLinkTarget) => void }) {
  return (
    <a
      href={`https://frame.test/files${target.href}`}
      data-testid={`link-${target.key}-${target.from ?? 'chrome'}`}
      onClick={followLinkOnClick(follow, target)}
    >
      open
    </a>
  );
}

afterEach(cleanup);

describe('riverFollow — the §6.4 operations at the click seam', () => {
  it('a plain click in a card inserts the target directly below and focuses it (push)', () => {
    const h = harness([HOME, ADA], ADA);
    render(<CardLink target={{ key: ONBOARDING, href: ONBOARDING.replace(/^\/app/, ''), from: ADA }} follow={h.follow} />);
    fireEvent.click(screen.getByTestId(`link-${ONBOARDING}-${ADA}`));
    expect(h.dispatched.length).toBe(1);
    expect(h.dispatched[0].state.keys).toEqual([HOME, ADA, ONBOARDING]);
    expect(h.dispatched[0].state.focused).toBe(ONBOARDING);
    expect(h.dispatched[0].history).toBe('push');
    // The open defers focus+scroll to the card's mount (§6.4 row 1) — both land.
    expect(h.called).toContain(`when:${ONBOARDING}`);
    expect(h.notes[0]).toContain('below its link');
  });

  it('a link to an open card focuses without inserting: order unchanged, replace, found highlight', () => {
    const h = harness([HOME, ADA, ONBOARDING], ONBOARDING);
    render(<CardLink target={{ key: HOME, href: HOME.replace(/^\/app/, ''), from: ONBOARDING }} follow={h.follow} />);
    fireEvent.click(screen.getByTestId(`link-${HOME}-${ONBOARDING}`));
    expect(h.dispatched[0].state.keys).toEqual([HOME, ADA, ONBOARDING]);
    expect(h.dispatched[0].state.focused).toBe(HOME);
    expect(h.dispatched[0].history).toBe('replace');
    expect(h.called).toContain(`scroll:${HOME}`);
    expect(h.called).toContain(`found:${HOME}`);
  });

  it('a chrome link inserts at the top (no `from`)', () => {
    const h = harness([ADA], ADA);
    render(<CardLink target={{ key: ONBOARDING, href: ONBOARDING.replace(/^\/app/, '') }} follow={h.follow} />);
    fireEvent.click(screen.getByTestId(`link-${ONBOARDING}-chrome`));
    expect(h.dispatched[0].state.keys).toEqual([ONBOARDING, ADA]);
    expect(h.dispatched[0].history).toBe('push');
    expect(h.notes[0]).toContain('at the top');
  });

  it('a modifier click never reaches the policy (the browser keeps the tab)', () => {
    const h = harness([HOME], HOME);
    render(<CardLink target={{ key: ADA, href: ADA.replace(/^\/app/, ''), from: HOME }} follow={h.follow} />);
    fireEvent.click(screen.getByTestId(`link-${ADA}-${HOME}`), { metaKey: true });
    expect(h.dispatched.length).toBe(0);
  });

  it('[[x#sec-4]] on an already-open card: focus, replace, and the fragment rides', () => {
    const h = harness([HOME, ADA], ADA);
    render(<CardLink target={{ key: ADA, href: ADA.replace(/^\/app/, ''), from: HOME, fragment: 'sec-4' }} follow={h.follow} />);
    fireEvent.click(screen.getByTestId(`link-${ADA}-${HOME}`));
    expect(h.dispatched[0].state.focused).toBe(ADA);
    expect(h.dispatched[0].history).toBe('replace');
    expect(h.fragments[0]).toBe('sec-4');
  });

  it('[[x#sec-4]] on a closed card: open, push, and the fragment rides', () => {
    const h = harness([HOME], HOME);
    render(<CardLink target={{ key: ADA, href: ADA.replace(/^\/app/, ''), from: HOME, fragment: 'sec-4' }} follow={h.follow} />);
    fireEvent.click(screen.getByTestId(`link-${ADA}-${HOME}`));
    expect(h.dispatched[0].state.focused).toBe(ADA);
    expect(h.dispatched[0].history).toBe('push');
    expect(h.fragments[0]).toBe('sec-4');
  });
});
