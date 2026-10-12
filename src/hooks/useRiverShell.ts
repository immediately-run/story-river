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

/** Canonical key → the requestEdit target: the delegated mount's file under
 *  dispatch, the working-tree path in a fork. */
function editTargetOf(key: string): { file: { mountId: string; relPath: string } } | { path: string } {
  if (isContentReadOnly() || getCorpusMountId()) {
    const root = contentDir();
    return { file: { mountId: getCorpusMountId() ?? '', relPath: '/' + key.slice(root.length) } };
  }
  return { path: keyToHref(key).replace(/^\//, '') };
}

export function useRiverShell(siteTitle: string): GroveShell {
  const mounts = useMounts();
  const corpusMountId = getCorpusMountId();
  const writable = useMemo(() => {
    if (!corpusMountId) return !isContentReadOnly();
    const m = (mounts ?? []).find((x) => x.id === corpusMountId);
    return m ? m.readerCanEdit === true : false;
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
      stylesheetsStatus: 'ready',
    }),
    [light, vw, writable, openEditor, editBusy, editRefused, siteTitle],
  );
}
