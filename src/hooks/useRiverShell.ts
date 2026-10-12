// The shell value the river provides to Grove (APP_CUSTOMIZATION_SPEC §6.7, R3-881):
// `safe: true` pins every card to the non-executable safe renderer whatever the
// bundle declares, and the edit affordance fields wire Grove's own §4.1 header to
// the §5a path — `requestEdit` with the readerCanEdit gate — so the river never
// reimplements the affordance, it only chooses the verb, as the shell contract
// (`GroveShell.openEditor`) expects.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { requestEdit, useMounts } from '@immediately-run/sdk';
import {
  contentDir,
  getCorpusMountId,
  isContentReadOnly,
  keyToHref,
  type GroveShell,
} from '@immediately-run/grove';

/** Canonical key → the requestEdit target, mirroring Grove's own affordance: the
 *  delegated corpus is read-only by construction, so dispatch asks the workbench
 *  to open the entry's bundle-file source under the reader's authority (§5a.3 —
 *  the `file` class is refused read-only at call time and would never open); a
 *  fork opens its own working-tree source. */
function editTargetOf(key: string): { bundleFile: string } | { path: string } {
  if (getCorpusMountId()) {
    const root = contentDir();
    return { bundleFile: '/' + key.slice(root.length) };
  }
  return { path: keyToHref(key).replace(/^\//, '') };
}

export function useRiverShell(siteTitle: string): GroveShell {
  const mounts = useMounts();
  const corpusMountId = getCorpusMountId();
  const writable = useMemo(() => {
    // §5a.5 / R3-876: the hint is advisory and three-valued — an ABSENT hint
    // means unknown, which means OFFER (the in-place refusal note renders if the
    // host disagrees); only an explicit false hides the affordance.
    if (!corpusMountId) return !isContentReadOnly();
    const m = (mounts ?? []).find((x) => x.id === corpusMountId);
    return m ? m.readerCanEdit !== false : true;
  }, [mounts, corpusMountId]);

  const [vw, setVw] = useState<'mobile' | 'desktop'>(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop',
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setVw(mq.matches ? 'mobile' : 'desktop');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const [light, setLight] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
  }, [light]);

  // The §5a request and its §6.5 dispositions: busy while in flight; a refusal
  // leaves a short inline note (the header's `refused` slot); `cancelled` nothing.
  const [editBusy, setEditBusy] = useState(false);
  const [editRefused, setEditRefused] = useState(false);
  const openEditor = useCallback(
    (entryKey: string) => {
      setEditRefused(false);
      setEditBusy(true);
      requestEdit(editTargetOf(entryKey))
        .then(() => setEditBusy(false))
        .catch((err: { code?: string }) => {
          setEditBusy(false);
          if (err?.code !== 'cancelled') setEditRefused(true);
        });
    },
    [],
  );

  return useMemo(
    () => ({
      theme: 'river',
      setTheme: () => {},
      light,
      setLight,
      menuOpen: false,
      setMenuOpen: () => {},
      searchOpen: false,
      setSearchOpen: () => {},
      drawerOpen: false,
      setDrawerOpen: () => {},
      vw,
      navMode: 'top',
      writable,
      openEditor,
      editBusy,
      editRefused,
      editHint: writable
        ? 'Opens this entry in the workbench editor; a save can be proposed back to the source.'
        : 'The reader view is read-only, so editing is unavailable here.',
      siteTitle,
      // §6.7: the safe renderer, always, whatever the bundle declares.
      safe: true,
      navItems: [],
      // Per-card values are the cards' own (GroveEntry frame 'none' derives them);
      // the shell's copies exist for the stock page and stay neutral here.
      entryKey: '',
      includePath: '',
      layout: 'doc',
      // The river renders its own focused-card rail; per-card Toc/Backlinks stay off.
      showRails: false,
      mins: 0,
      missing: false,
      directory: { status: 'none' },
      // §6.7's home-entry stylesheets/theme carry into the river only when
      // Grove exports the read (R3-1199); asserting a read state nothing
      // established would be the lie it replaces.
    }),
    [light, vw, writable, openEditor, editBusy, editRefused, siteTitle],
  );
}
