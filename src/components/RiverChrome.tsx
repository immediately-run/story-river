// The river's chrome (APP_CUSTOMIZATION_SPEC §6.6, R3-881): the mockup's slim top
// nav, the sidebar tree with the open markers, and the desktop rail that follows
// the focused card (its table of contents and the "In the river" list). Every
// link's plain click rides the navigation policy — chrome links insert at the top
// (§6.4, the TiddlyWiki top insert the mockup keeps).

import { useMemo } from 'react';
import { keyToHref, useHeadings, followLinkOnClick } from '@immediately-run/grove';
import type { FollowLinkTarget } from '@immediately-run/grove';

interface ChromeLinkProps {
  target: FollowLinkTarget;
  follow: (t: FollowLinkTarget) => void;
  className?: string;
  children: React.ReactNode;
  open?: boolean;
  focused?: boolean;
}

/** One chrome link: real href (modifier/middle-click still new-tab), plain click
 *  through the policy. `open` draws the mockup's hollow ring marker. */
export function RiverLink({ target, follow, className, children, open, focused }: ChromeLinkProps) {
  const cls = [
    'river-link',
    open === true ? 'river-link--open' : '',
    focused === true ? 'river-link--focused' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <a href={target.href} className={cls} onClick={followLinkOnClick(follow, target)}>
      {children}
    </a>
  );
}

export function RiverNav({
  siteTitle,
  links,
  follow,
  light,
  onToggleLight,
}: {
  siteTitle: string;
  links: Array<{ key: string; label: string }>;
  follow: (t: FollowLinkTarget) => void;
  light: boolean;
  onToggleLight: () => void;
}) {
  return (
    <header className="river-nav">
      <span className="river-nav__title">{siteTitle}</span>
      <nav aria-label="Site">
        {links.map((l) => (
          <RiverLink key={l.key} target={{ key: l.key, href: keyToHref(l.key) }} follow={follow}>
            {l.label}
          </RiverLink>
        ))}
      </nav>
      <button
        type="button"
        className="river-nav__theme"
        aria-pressed={light}
        aria-label={light ? 'Switch to the dark theme' : 'Switch to the light theme'}
        onClick={onToggleLight}
      >
        {light ? 'Dark' : 'Light'}
      </button>
    </header>
  );
}

/** The sidebar tree: entries grouped by their top folder, open cards ring-marked,
 *  the focused entry highlighted (§6.6). */
export function RiverSidebar({
  entries,
  state,
  follow,
  titles,
}: {
  entries: Array<{ key: string; label: string }>;
  state: { keys: string[]; focused: string };
  follow: (t: FollowLinkTarget) => void;
  titles: Map<string, string>;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Array<{ key: string; label: string }>>();
    for (const e of entries) {
      const rel = keyToHref(e.key).replace(/^\//, '');
      const dir = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '';
      const list = map.get(dir) ?? [];
      list.push(e);
      map.set(dir, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  return (
    <nav className="river-sidebar" aria-label="Wiki">
      {groups.map(([dir, list]) => (
        <div key={dir || 'top'} className="river-sidebar__group">
          {dir ? <div className="river-sidebar__dir">{dir}</div> : null}
          {list.map((e) => (
            <RiverLink
              key={e.key}
              target={{ key: e.key, href: keyToHref(e.key) }}
              follow={follow}
              open={state.keys.includes(e.key)}
              focused={state.focused === e.key}
            >
              {titles.get(e.key) ?? e.label}
            </RiverLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** The desktop rail (§6.6): the focused card's table of contents and the open
 *  river, following the reader. Backlinks wait on the Grove seam (see the README). */
export function RiverRail({
  focusedKey,
  state,
  follow,
  titles,
}: {
  focusedKey: string;
  state: { keys: string[]; focused: string };
  follow: (t: FollowLinkTarget) => void;
  titles: Map<string, string>;
}) {
  const headings = useHeadings(focusedKey);
  return (
    <aside className="river-rail" aria-label="In this card">
      {headings.length > 0 ? (
        <div className="river-rail__group">
          <div className="river-rail__label">On this page</div>
          {headings.map((h) => (
            <a
              key={h.id + h.text}
              className={`river-rail__toc river-rail__toc--l${h.level}`}
              href={`#${h.id}`}
            >
              {h.text}
            </a>
          ))}
        </div>
      ) : null}
      <div className="river-rail__group">
        <div className="river-rail__label">In the river</div>
        {state.keys.map((k) => (
          <RiverLink
            key={k}
            target={{ key: k, href: keyToHref(k), from: focusedKey }}
            follow={follow}
            focused={state.focused === k}
          >
            {titles.get(k) ?? k}
          </RiverLink>
        ))}
      </div>
    </aside>
  );
}
