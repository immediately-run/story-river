// The sidebar's entry list (APP_CUSTOMIZATION_SPEC §6.6, R3-881): every content
// entry in the corpus, titled, sorted. Pure — the chrome renders it.

import { isContentEntry, keyToHref } from '@immediately-run/grove';

export function sidebarEntries(
  metadata: Record<string, unknown> | null,
): Array<{ key: string; label: string }> {
  return Object.keys(metadata ?? {})
    .filter(isContentEntry)
    .sort()
    .map((key) => {
      const meta = metadata?.[key] as { title?: string } | undefined;
      return { key, label: meta?.title ?? keyToHref(key) };
    });
}

/** Reader-facing titles for announcements and aria-labels. */
export function titleMap(metadata: Record<string, unknown> | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const { key, label } of sidebarEntries(metadata)) map.set(key, label);
  return map;
}
