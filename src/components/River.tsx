// The river column (APP_CUSTOMIZATION_SPEC §6.4/§6.5/§6.7, R3-881): one bordered
// card per open entry, `GroveEntry frame:'none'` inside a river-owned frame that
// carries close and copy-link. Focus and scroll land here; the policy navigates.

import { useEffect, useRef } from 'react';
import { GroveEntry } from '@immediately-run/grove';
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

/** The §6.3 copy-link control: this entry focused, a river of one. */
function copyLinkFor(key: string): string {
  const base = window.location.href.split('#')[0].split('?')[0];
  return base + serializeStory({ keys: [key], focused: key });
}

/** The §6.7 scroll rule: whichever card the reader scrolls to the top of the
 *  viewport becomes the focused card, by replace, debounced — a reload lands on
 *  what the reader was reading. An IntersectionObserver on the card tops is the
 *  browser's own statement of "what the reader is reading". */
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
    });
    return () => registerCallbacks(null);
  }, [registerCallbacks]);

  return (
    <div className="river" data-focused={focused}>
      <Announcer announcement={announcement} />
      {keys.map((key) => {
        const sole = keys.length === 1;
        return (
          <section
            key={key}
            data-river-key={key}
            ref={(el) => {
              cardRefs.current.set(key, el);
            }}
            className={key === focused ? 'river-card river-card--focused' : 'river-card'}
            aria-label={titles.get(key) ?? key}
          >
            {!sole ? (
              <div className="river-card__bar">
                <button
                  type="button"
                  className="river-card__close"
                  aria-label={`Close ${titles.get(key) ?? key}`}
                  onClick={() => onClose(key)}
                >
                  ×
                </button>
              </div>
            ) : null}
            <GroveEntry entryKey={key} frame="none" />
            <button
              type="button"
              className="river-card__copy"
              aria-label={`Copy a link to ${titles.get(key) ?? key}`}
              onClick={() => void navigator.clipboard?.writeText(copyLinkFor(key))}
            >
              Copy link
            </button>
          </section>
        );
      })}
    </div>
  );
}
