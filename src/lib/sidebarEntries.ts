// The sidebar's entry list (APP_CUSTOMIZATION_SPEC §6.6, R3-881): every content
// entry in the corpus, titled, sorted. Pure — the chrome renders it.

import { isContentEntry, keyToHref } from '@immediately-run/grove';

export function sidebarEntries(
  metadata: Record<string, unknown> | null,
): Array<{ key: string; label: string }> {
  return Object.keys(metadata ?? {})
    .filter(isContentEntry)
    .sort()
    .map((key) => ({ key, label: titleOf(metadata, key) }));
}

/** The ONE reader-facing spelling of an entry's title: the frontmatter title
 *  without its typeset trailing period (announcements, aria-labels, sidebar and
 *  rail all render this exact string). */
export function titleOf(metadata: Record<string, unknown> | null, key: string): string {
  const meta = metadata?.[key] as { title?: string } | undefined;
  if (meta?.title) return String(meta.title).replace(/\.$/, '');
  const rel = keyToHref(key).replace(/^\//, '').replace(/\.mdx?$/, '');
  const crumb = rel.split('/').pop() ?? rel;
  return crumb.charAt(0).toUpperCase() + crumb.slice(1);
}

/** Reader-facing titles for announcements and aria-labels. */
export function titleMap(metadata: Record<string, unknown> | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const { key, label } of sidebarEntries(metadata)) map.set(key, label);
  return map;
}
