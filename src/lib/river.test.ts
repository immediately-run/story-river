// The operations table of APP_CUSTOMIZATION_SPEC §6.4, one case per row, over the
// pure reducer. Keys are the REAL sample corpus's (the Meridian wiki Grove ships),
// through the real metadata shape — `useAllMetadata()` is keyed by the canonical
// `/app/content/…` path with the entry's frontmatter as the value — so the tests
// exercise the exact key space the river runs in.

import { describe, expect, it } from 'vitest';
import { apply, dropUnresolvable, MAX_CARDS, parseStory, serializeStory, STORY_PARAM } from './river';

// The real corpus's canonical keys + the real frontmatter shape (grove's sample
// wiki — `content/` in the grove repository; the metadata store indexes these
// paths with the entries' frontmatter as the value).
const CORPUS: Record<string, { title?: string; layout?: string; tags?: string[] }> = {
  '/app/content/home.mdx': { title: 'Meridian handbook.', layout: 'post' },
  '/app/content/handbook/onboarding.mdx': { title: 'Onboarding, day one to week one.', layout: 'doc', tags: ['handbook'] },
  '/app/content/people/ada-lovelace.mdx': { title: 'Ada Lovelace.', layout: 'doc', tags: ['person'] },
};
const KNOWN = new Set(Object.keys(CORPUS));
const HOME = '/app/content/home.mdx';
const ADA = '/app/content/people/ada-lovelace.mdx';
const ONBOARDING = '/app/content/handbook/onboarding.mdx';

// §6.3: `story` keys are bundle-relative — what `keyToHref` produces (the fork's
// anchor-stripped form). The tests write them the way a URL carries them.
const H = (key: string) => key.replace(/^\/app/, '');

describe('parseStory', () => {
  it('a URL with no story is a river of one card (the path)', () => {
    const s = parseStory('', '/files/content/people/ada-lovelace.mdx');
    expect(s).toEqual({ keys: [ADA], focused: ADA });
  });

  it('the story param lists the open cards; the focused path joins at the top when absent', () => {
    const s = parseStory(`?${STORY_PARAM}=${H(ADA)},${H(ONBOARDING)}`, '/files/content/home.mdx');
    expect(s.keys).toEqual([HOME, ADA, ONBOARDING]);
    expect(s.focused).toBe(HOME);
  });

  it('the focused path is honoured when the story names it', () => {
    const s = parseStory(`?${STORY_PARAM}=${H(HOME)},${H(ADA)}`, '/files/content/people/ada-lovelace.mdx');
    expect(s.focused).toBe(ADA);
    expect(s.keys).toEqual([HOME, ADA]);
  });

  it('G-CUST-8: story ignored, the focused path resolves to a real entry', () => {
    // Stock Grove reads only the path. The river's parse of the same URL must
    // land on the same real entry the metadata knows.
    const s = parseStory('', '/files/content/handbook/onboarding.mdx');
    expect(KNOWN.has(s.focused)).toBe(true);
    expect(CORPUS[s.focused]?.title).toBe('Onboarding, day one to week one.');
  });

  it('parse ∘ serialize is the identity on the query string', () => {
    const state = parseStory(`?${STORY_PARAM}=${H(HOME)},${H(ADA)}`, '/files/content/people/ada-lovelace.mdx');
    const round = parseStory(serializeStory(state), '/files/content/people/ada-lovelace.mdx');
    expect(round).toEqual(state);
    expect(serializeStory(round)).toBe(serializeStory(state));
  });
});

describe('apply — the §6.4 operations table', () => {
  const one = (focused: string): { keys: string[]; focused: string } => ({ keys: [focused], focused });

  it('follows a link, inside a card, to an entry not open: inserts directly below, focuses, push', () => {
    const state = { keys: [HOME, ADA], focused: ADA };
    const r = apply(state, { op: 'open-below', key: ONBOARDING, below: ADA });
    expect(r.state.keys).toEqual([HOME, ADA, ONBOARDING]);
    expect(r.state.focused).toBe(ONBOARDING);
    expect(r.history).toBe('push');
  });

  it('follows a link from chrome to an entry not open: inserts at the top, focuses, push', () => {
    const r = apply(one(ADA), { op: 'open-top', key: ONBOARDING });
    expect(r.state.keys).toEqual([ONBOARDING, ADA]);
    expect(r.state.focused).toBe(ONBOARDING);
    expect(r.history).toBe('push');
  });

  it('follows a link to an entry already open: order unchanged, focus moves, replace', () => {
    const state = { keys: [HOME, ADA, ONBOARDING], focused: ONBOARDING };
    const r = apply(state, { op: 'open-below', key: HOME, below: ONBOARDING });
    expect(r.state.keys).toEqual([HOME, ADA, ONBOARDING]);
    expect(r.state.focused).toBe(HOME);
    expect(r.history).toBe('replace');
    const r2 = apply(state, { op: 'open-top', key: ADA });
    expect(r2.state.keys).toEqual(state.keys);
    expect(r2.history).toBe('replace');
  });

  it('closes a card: removed, focus moves to the next card down', () => {
    const state = { keys: [HOME, ADA, ONBOARDING], focused: ADA };
    const r = apply(state, { op: 'close', key: ADA });
    expect(r.state.keys).toEqual([HOME, ONBOARDING]);
    expect(r.state.focused).toBe(ONBOARDING);
    expect(r.history).toBe('replace');
  });

  it('closes the bottom card: focus moves to the one above', () => {
    const state = { keys: [HOME, ADA, ONBOARDING], focused: ADA };
    const r = apply(state, { op: 'close', key: ONBOARDING });
    expect(r.state.keys).toEqual([HOME, ADA]);
    expect(r.state.focused).toBe(ADA);
  });

  it('closing a card the reader is not on leaves the focus alone', () => {
    const state = { keys: [HOME, ADA, ONBOARDING], focused: ADA };
    const r = apply(state, { op: 'close', key: HOME });
    expect(r.state.focused).toBe(ADA);
  });

  it('the sole card has no close: the river is never empty', () => {
    const r = apply(one(ADA), { op: 'close', key: ADA });
    expect(r.state).toEqual(one(ADA));
  });

  it('the 21st open drops the bottom card', () => {
    const keys = Array.from({ length: MAX_CARDS }, (_, i) => `/app/content/pages/p${String(i).padStart(2, '0')}.mdx`);
    const state = { keys, focused: keys[0] };
    const fresh = '/app/content/pages/fresh.mdx';
    const r = apply(state, { op: 'open-below', key: fresh, below: keys[0] });
    expect(r.state.keys.length).toBe(MAX_CARDS);
    expect(r.state.keys[1]).toBe(fresh);
    expect(r.state.keys).not.toContain(keys[keys.length - 1]); // the bottom-most went
    expect(r.state.focused).toBe(fresh);
  });

  it('focus is a replace', () => {
    const state = { keys: [HOME, ADA], focused: HOME };
    const r = apply(state, { op: 'focus', key: ADA });
    expect(r.state.focused).toBe(ADA);
    expect(r.history).toBe('replace');
  });

  it('[[x#sec-4]] rides the open operation; the fragment lands within x (the href carries it)', () => {
    // The reducer owns the open; the fragment rides the navigation target the
    // policy builds — asserted at the component level (River.test.tsx).
    const r = apply(one(HOME), { op: 'open-below', key: ADA, below: HOME });
    expect(r.state.focused).toBe(ADA);
    expect(r.history).toBe('push');
  });
});

describe('dropUnresolvable', () => {
  it('drops keys the corpus cannot resolve and reports them', () => {
    const state = parseStory(
      `?${STORY_PARAM}=${H(HOME)},${encodeURIComponent('/content/renamed-away.mdx')},${H(ADA)}`,
      '/files/content/home.mdx',
    );
    const { state: cleaned, dropped } = dropUnresolvable(state, (k) => KNOWN.has(k));
    expect(cleaned.keys).toEqual([HOME, ADA]);
    expect(dropped).toEqual(['/app/content/renamed-away.mdx']);
    expect(cleaned.focused).toBe(HOME);
  });

  it('a dropped focus falls to the first survivor', () => {
    const state = { keys: ['/app/content/gone.mdx', ADA], focused: '/app/content/gone.mdx' };
    const { state: cleaned, dropped } = dropUnresolvable(state, (k) => KNOWN.has(k));
    expect(dropped).toEqual(['/app/content/gone.mdx']);
    expect(cleaned).toEqual({ keys: [ADA], focused: ADA });
  });

  it('drops nothing when every key resolves', () => {
    const state = parseStory(`?${STORY_PARAM}=${H(HOME)},${H(ADA)}`, '/files/content/home.mdx');
    const { state: cleaned, dropped } = dropUnresolvable(state, (k) => KNOWN.has(k));
    expect(dropped).toEqual([]);
    expect(cleaned).toEqual(state);
  });
});
