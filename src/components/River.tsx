// The river column (APP_CUSTOMIZATION_SPEC §6.4/§6.5/§6.7/§6.8, R3-881): one
// bordered card per open entry, `GroveEntry frame:'none'` inside a river-owned
// frame whose header bar carries copy-link and close. Cards mount lazily — a
// card below the fold renders a skeleton until it nears the viewport (§6.8) —
// and focus/scroll land here; the policy navigates.

import { useCallback, useEffect, useRef, useState } from 'react';
import { GroveEntry, keyToHref } from '@immediately-run/grove';
import { serializeStory } from '../lib/river';
import type { RiverAnnouncement, RiverCallbacks } from '../hooks/useRiver';

interface RiverProps {
  keys: string[];
  focused: string;
  titles: Map<string, string>;
  onClose: (key: string) => void;
  onScrolledTo: (key: string) => void;
  registerCallbacks: (cb: RiverCallbacks | null) => void;
  announcement: RiverAnnouncement | null;
}

/** The §R-IX-7 polite live region: open, close and the found highlight are
 *  announced here. One region, one latest message. */
function Announcer({ announcement }: { announcement: RiverAnnouncement | null }) {
  return (
    <div className="river-sr" role="status" aria-live="polite">
      {announcement?.message ?? ''}
    </div>
  );
}

/** The §6.3 copy-link control: this entry focused, a river of one — built from
 *  the entry's OWN href (never the focused card's path), with a copied/failed
 *  state, never a fire-and-forget write. */
function CopyLinkButton({ entryKey, title }: { entryKey: string; title: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="river-card__copy"
      aria-label={`Copy a link to ${title}`}
      onClick={() => {
        const base = window.location.href.split('#')[0].split('?')[0];
        const url =
          base.replace(/[^/]*$/, '') +
          keyToHref(entryKey).replace(/^\//, '') +
          serializeStory({ keys: [entryKey], focused: entryKey });
        navigator.clipboard
          ?.writeText(url)
          .then(() => setState('copied'))
          .catch(() => setState('failed'));
        window.setTimeout(() => setState('idle'), 1500);
      }}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy link'}
    </button>
  );
}

/** One card's lazy mount (§6.8): a skeleton until the card nears the viewport,
 *  then the real `GroveEntry`. The observer watches the wrapper (always in the
 *  DOM) and disconnects at first intersection. */
function CardBody({ entryKey }: { entryKey: string }) {
  const wrapper = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(
    // Environments with no observer (tests, old engines) render at once.
    () => typeof IntersectionObserver === 'undefined',
  );
  useEffect(() => {
    const el = wrapper.current;
    if (!el || mounted) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      // "Nears the viewport": two viewport-heights on either side.
      { rootMargin: '200% 0px 200% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);
  if (mounted) return <GroveEntry entryKey={entryKey} frame="none" />;
  return (
    <div ref={wrapper} className="river-card__skeleton" aria-hidden="true">
      <div className="river-card__skeleton-line river-card__skeleton-line--title" />
      <div className="river-card__skeleton-line" />
      <div className="river-card__skeleton-line" />
      <div className="river-card__skeleton-line river-card__skeleton-line--short" />
    </div>
  );
}

/** One bordered card: the header bar (copy, close), the §6.5 frame, and the DOM
 *  node the focus/scroll callbacks aim at. The ref is the card's own —
 *  registered upward on commit, never read during render. */
function Card({
  entryKey,
  focused,
  title,
  sole,
  onClose,
  onRegister,
}: {
  entryKey: string;
  focused: boolean;
  title: string;
  sole: boolean;
  onClose: (key: string) => void;
  onRegister: (key: string, el: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    onRegister(entryKey, ref.current);
    return () => onRegister(entryKey, null);
  }, [entryKey, onRegister]);
  return (
    <section
      ref={ref}
      data-river-key={entryKey}
      className={focused ? 'river-card river-card--focused' : 'river-card'}
      aria-label={title}
    >
      <div className="river-card__bar">
        <CopyLinkButton entryKey={entryKey} title={title} />
        {!sole ? (
          <button
            type="button"
            className="river-card__close"
            aria-label={`Close ${title}`}
            onClick={() => onClose(entryKey)}
          >
            ×
          </button>
        ) : null}
      </div>
      <CardBody entryKey={entryKey} />
    </section>
  );
}

/** The §6.7 scroll rule: whichever card the reader scrolls to the top of the
 *  viewport becomes the focused card, by replace, debounced — a reload lands on
 *  what the reader was reading. The observer is registered inside the effect
 *  over the card registry the Card components fill. */
function useScrolledTo(
  keys: string[],
  onScrolledTo: (key: string) => void,
  cardRefs: React.RefObject<Map<string, HTMLElement | null>>,
) {
  const cb = useRef(onScrolledTo);
  useEffect(() => {
    cb.current = onScrolledTo;
  }, [onScrolledTo]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    let last = '';
    let timer: number | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const topmost = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!topmost) return;
        const key = (topmost.target as HTMLElement).dataset.riverKey ?? '';
        if (!key || key === last) return;
        last = key;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => cb.current(key), 400);
      },
      { rootMargin: '0px 0px -85% 0px', threshold: 0 },
    );
    for (const key of keys) {
      const el = cardRefs.current?.get(key);
      if (el) io.observe(el);
    }
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [keys, cardRefs]);
}

export default function River({
  keys,
  focused,
  titles,
  onClose,
  onScrolledTo,
  registerCallbacks,
  announcement,
}: RiverProps) {
  const cardRefs = useRef(new Map<string, HTMLElement | null>());
  useScrolledTo(keys, onScrolledTo, cardRefs);

  const onRegister = useCallback((key: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(key, el);
    else cardRefs.current.delete(key);
  }, []);

  useEffect(() => {
    registerCallbacks({
      focusCardTitle: (key) => {
        const card = cardRefs.current.get(key);
        const heading = card?.querySelector<HTMLElement>('.grove-page h1, .grove-page h2');
        if (!heading) return;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      },
      scrollToCard: (key) => {
        cardRefs.current.get(key)?.scrollIntoView({ block: 'start' });
      },
      highlightCard: (key) => {
        const card = cardRefs.current.get(key);
        if (!card) return;
        card.classList.remove('river-card--found');
        void card.offsetWidth; // restart the animation on a re-find
        card.classList.add('river-card--found');
        window.setTimeout(() => card.classList.remove('river-card--found'), 1600);
      },
      // An OPEN: dispatch is a postMessage, so the new card is not in the DOM
      // when the policy runs (§6.4 row 1 — "focuses it, scrolls it into view").
      // Retry until the card's body commits, then do both.
      focusWhenMounted: (key) => {
        let tries = 0;
        const attempt = () => {
          tries += 1;
          const card = cardRefs.current.get(key);
          const heading = card?.querySelector<HTMLElement>('.grove-page h1, .grove-page h2');
          if (!card || !heading) {
            if (tries < 40) window.setTimeout(attempt, 50); // ~2 s of render waits
            return;
          }
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
          card.scrollIntoView({ block: 'start' });
        };
        attempt();
      },
    });
    return () => registerCallbacks(null);
  }, [registerCallbacks]);

  return (
    <div className="river" data-focused={focused}>
      <Announcer announcement={announcement} />
      {keys.map((key) => (
        <Card
          key={key}
          entryKey={key}
          focused={key === focused}
          title={titles.get(key) ?? key}
          sole={keys.length === 1}
          onClose={onClose}
          onRegister={onRegister}
        />
      ))}
    </div>
  );
}
