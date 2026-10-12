// The river column's own obligations (APP_CUSTOMIZATION_SPEC §6.5, R3-881): the
// sole card has no close; a river of two offers close on both; focus lands on a
// card's title as the accessible name. GroveEntry is stubbed to the PUBLIC render
// contract the river composes (a `grove-page` article with a heading) — the stub
// exists so the river-owned chrome is what's under test, not Grove's body.

import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import River from './River';
import type { RiverCallbacks } from '../hooks/useRiver';

vi.mock('@immediately-run/grove', () => ({
  GroveEntry: ({ entryKey }: { entryKey: string }) => (
    <article className="grove-page" data-entry={entryKey}>
      <h2>{entryKey}</h2>
    </article>
  ),
}));

const HOME = '/app/content/home.mdx';
const ADA = '/app/content/people/ada-lovelace.mdx';

function renderRiver(keys: string[], focused: string) {
  const registered: Array<RiverCallbacks | null> = [];
  const closed: string[] = [];
  const scrolledTo: string[] = [];
  render(
    <River
      keys={keys}
      focused={focused}
      titles={new Map(keys.map((k) => [k, k]))}
      onClose={(k) => closed.push(k)}
      onScrolledTo={(k) => scrolledTo.push(k)}
      registerCallbacks={(cb) => registered.push(cb)}
      announcement={{ id: 1, message: 'Opened Ada Lovelace at the top.' }}
    />,
  );
  const callbacks = () => registered[registered.length - 1];
  return { registered, callbacks, closed, scrolledTo };
}

afterEach(cleanup);

describe('River — the card frame', () => {
  it('the sole card renders no close control (the river is never empty)', () => {
    renderRiver([ADA], ADA);
    expect(screen.queryByRole('button', { name: /Close / })).toBeNull();
  });

  it('a river of two offers close on both cards, wired to the close dispatch', () => {
    const { closed } = renderRiver([HOME, ADA], ADA);
    const buttons = screen.getAllByRole('button', { name: /Close / });
    expect(buttons.length).toBe(2);
    fireEvent.click(buttons[1]);
    expect(closed).toEqual([ADA]);
  });

  it('focusCardTitle puts focus on the card’s heading (the accessible name)', () => {
    const { callbacks } = renderRiver([HOME, ADA], ADA);
    const heading = document.querySelector(`[data-entry="${ADA}"] h2`) as HTMLElement;
    const spy = vi.spyOn(heading, 'focus');
    callbacks()!.focusCardTitle(ADA);
    expect(spy).toHaveBeenCalledWith({ preventScroll: true });
    expect(heading.getAttribute('tabindex')).toBe('-1');
  });

  it('the announcement rides a polite live region', () => {
    renderRiver([ADA], ADA);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toContain('Opened Ada Lovelace');
  });

  it('each card carries the entry as its accessible name', () => {
    renderRiver([HOME, ADA], ADA);
    expect(screen.getByRole('region', { name: ADA })).toBeTruthy();
    expect(screen.getByRole('region', { name: HOME })).toBeTruthy();
  });
});
