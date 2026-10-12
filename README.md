# Story river

A TiddlyWiki-style reading mode for Grove wikis (APP_CUSTOMIZATION_SPEC §6): entries
accumulate in one column of cards; following a link opens the target below the card you
were reading; a link to an open card scrolls back to it. The river encodes its whole
state in the URL — the path names the focused card, `?story=` lists the open ones — so
a link is a river, Back undoes an open, and stock Grove reading the same URL still
lands on the focused entry.

## Composed from public exports only

The app depends on `@immediately-run/grove` exact-pinned and imports nothing but its
export map (`@immediately-run/grove`, `./theme.css`, `./styles.css`). An ESLint
`no-restricted-imports` rule fails lint on any deep path (G-CUST-7); the exports'
shape is exercised by the tests.

## The state machine

`src/lib/river.ts` owns everything: `parseStory` / `serializeStory` / `apply` over the
§6.4 operations table (open-below, open-top, focus, close), the 20-card bound (a 21st
open drops the bottom card), and the never-empty rule. Opening is a history push;
focusing and closing are replaces. `src/lib/riverPolicy.ts` turns a followed link into
an operation; `src/hooks/useRiver.ts` turns operations into `navigate()` calls.

## Opening a wiki with it

The package declares the §4b.2 opener opt-in:

```jsonc
"immediately.run": { "opens": [ { "app": "self", "version": "^1" } ] }
```

A wiki names this app either as its opener (`opensWith: { "app":
"github:immediately-run/story-river", … }`) or as a declared view beside Grove. Either
way the delegated corpus arrives read-only; the boot gate
(`useOpenWikiBoot`) points Grove's content root at it before the first card renders.
The river renders every card through the safe renderer whatever the bundle declares
(§6.7), via the shell context.

## Known seam gaps (filed as R3-1199, not worked around)

- **Backlinks in the rail**: Grove's `Backlinks` reads the routed entry and its body
  scan (`bodyLinksTo`) is internal — a shell cannot ask "who links to THIS key". The
  rail ships with the focused card's table of contents and the "In the river" list;
  backlinks join when Grove exports the seam.
- **Search and the footer**: neither is in the export map, so the nav ships without
  search and the page without a footer.
- **The home entry's theme + stylesheets river-wide** (§6.7): the read that
  establishes them has no public composition path, so the river carries neither —
  and asserts no read state nothing established.

All four are the item's prescribed move — a Grove item (R3-1199), never a deep import.
The theme CONTROL is the river's own (the shell contract's `light`/`setLight`), wired
to grove's `theme.css` `[data-theme]` cascade.
