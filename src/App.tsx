// Root component — immediately.run renders the default export of THIS file.
// The story river (APP_CUSTOMIZATION_SPEC §6, R3-881): a TiddlyWiki-style reading
// mode for a wiki, composed from @immediately-run/grove's public exports only.
// Global CSS is imported here (not in main.tsx) because immediately.run's runtime
// never loads main.tsx.
import '@immediately-run/grove/theme.css';
import '@immediately-run/grove/styles.css';
import './river.css';

import { useMemo } from 'react';
import { GroveShellContext, NavigationPolicyContext, useOpenWikiBoot } from '@immediately-run/grove';
import { useRiver } from './hooks/useRiver';
import { useRiverShell } from './hooks/useRiverShell';
import { sidebarEntries, titleMap } from './lib/sidebarEntries';
import River from './components/River';
import { RiverNav, RiverRail, RiverSidebar } from './components/RiverChrome';

function Boot({ status, message }: { status: string; message: string }) {
  if (status === 'failed') return <div className="river-boot">{message}</div>;
  return <div className="river-boot river-boot--waiting" aria-busy="true" />;
}

function App() {
  const boot = useOpenWikiBoot();
  const river = useRiver();
  const titles = useMemo(() => titleMap(river.metadata), [river.metadata]);
  const entries = useMemo(() => sidebarEntries(river.metadata), [river.metadata]);
  const shell = useRiverShell('Story river');

  if (boot.status === 'waiting' || boot.status === 'failed') {
    return <Boot status={boot.status} message={boot.message} />;
  }

  // The nav's links (the mockup's slim top bar): the wiki's home entry, then its
  // directory page when the corpus ships one.
  const home = entries.find((e) => e.key.endsWith('/home.mdx')) ?? entries[0];
  const directory = entries.find((e) => e.key.endsWith('/directory.mdx'));
  const navLinks = home ? (directory ? [home, directory] : [home]) : [];

  return (
    <GroveShellContext.Provider value={shell}>
      <NavigationPolicyContext.Provider value={river.follow}>
        <div className="river-page">
          <RiverNav
            siteTitle="Story river"
            links={navLinks}
            follow={river.follow}
            light={shell.light}
            onToggleLight={() => shell.setLight(!shell.light)}
          />
          <div className="river-body">
            <RiverSidebar entries={entries} state={river.state} follow={river.follow} titles={titles} />
            <main className="river-main">
              <River
                keys={river.state.keys}
                focused={river.state.focused}
                titles={titles}
                onClose={river.closeCard}
                onScrolledTo={river.focusCard}
                registerCallbacks={river.registerCallbacks}
                announcement={river.announcement}
              />
            </main>
            <RiverRail
              focusedKey={river.state.focused}
              state={river.state}
              follow={river.follow}
              titles={titles}
            />
          </div>
        </div>
      </NavigationPolicyContext.Provider>
    </GroveShellContext.Provider>
  );
}

export default App;
