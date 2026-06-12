# Mobius browser shell — HIVE chamber integration

This document connects **mobius-hive** (world JSON in this repo) to **mobius-browser-shell** (human-facing UI) via the playable **HIVE MMO world simulator** artifact.

Live shell: <https://mobius-browser-shell.vercel.app/#hive>
Simulator artifact: `artifacts/hive-mmo-simulator/` (this repo)

The shell already renders data-driven HIVE panels (`HivePortal`) inside `HiveChamber`. To put the **playable 16-bit world** on top of that live state, embed the simulator as an iframe and point it at the **shell's own `/api/hive/world` edge proxy** so the simulator and the React panels share one live source of truth.

## Architecture (short version)

```
mobius-hive (this repo)                          mobius-browser-shell (vercel)
─────────────────────────────                    ────────────────────────────────────
world/*.json   ◀── canonical write path          /api/hive/world/:path*   (edge proxy, CDN)
artifacts/hive-mmo-simulator/                    public/hive-simulator/   (static copy)
  ├ index.html       ── deploy ──▶               components/chambers/HiveChamber.tsx
  └ simulator.js                                  └ <iframe src="/hive-simulator/...">
```

The simulator reads `/world/*.json` from whatever origin / base URL it's given (`?data=…`). Pointing it at the shell's existing proxy (`?data=/api/hive/world/`) means:

- one cached, CORS-safe source of truth
- no extra deploy when world state refreshes
- automatic fallback chain inherited from the shell (proxy → raw GitHub → bundled `public/world/`)

## Step 1 — deploy the simulator under the shell origin

Copy the two static files into the shell's `public/` tree so they're served same-origin with `/api/hive/world` and `/world` (already bundled in the shell):

```bash
# inside mobius-browser-shell
mkdir -p public/hive-simulator
cp ../mobius-hive/artifacts/hive-mmo-simulator/index.html  public/hive-simulator/
cp ../mobius-hive/artifacts/hive-mmo-simulator/simulator.js public/hive-simulator/
```

Or vendor it via a build hook / `postinstall` script that curls the latest artifact from the canonical path:

```jsonc
// package.json (mobius-browser-shell)
{
  "scripts": {
    "hive:sync-simulator": "mkdir -p public/hive-simulator && curl -fsSL https://raw.githubusercontent.com/kaizencycle/mobius-hive/main/artifacts/hive-mmo-simulator/index.html  -o public/hive-simulator/index.html  && curl -fsSL https://raw.githubusercontent.com/kaizencycle/mobius-hive/main/artifacts/hive-mmo-simulator/simulator.js -o public/hive-simulator/simulator.js"
  }
}
```

Run it in CI before `vite build`. No re-deploy of the shell is needed when world JSON refreshes — only when the simulator code itself changes.

## Step 2 — embed inside `HiveChamber.tsx`

The shell's `HiveChamber` currently lazy-loads only the React `HivePortal`. Add a tabbed view (or stacked panel) so the simulator and the data panels live side-by-side in the same chamber.

```tsx
// components/chambers/HiveChamber.tsx (mobius-browser-shell)
import React, { Suspense, lazy, useState } from 'react';
import { ShellErrorBoundary } from '../ShellErrorBoundary';
import { ErrorCodes } from '../../errors/errorCodes';
import { useAtlasErrorLog } from '../useAtlasErrorLog';

const HiveLab = lazy(() =>
  import('../Labs/HivePortal').then((m) => ({ default: m.HivePortal })),
);

type HiveView = 'world' | 'panels';

export const HiveChamber: React.FC = () => {
  const logToAtlas = useAtlasErrorLog();
  const [view, setView] = useState<HiveView>('world');

  // Same-origin proxy → live state without re-deploying the shell.
  // shell=<self>  → portals in the simulator deep-link back into this shell.
  const simulatorSrc =
    '/hive-simulator/?data=/api/hive/world/&shell=' +
    encodeURIComponent(window.location.origin);

  return (
    <div className="hive-room">
      <div className="hive-crt">
        <div className="hive-head">
          <h2>HIVE — QUEST LOG</h2>
          <div className="hive-stats">
            <button
              type="button"
              className="hive-stat"
              onClick={() => setView('world')}
              aria-pressed={view === 'world'}
            >
              WORLD
            </button>
            <button
              type="button"
              className="hive-stat"
              onClick={() => setView('panels')}
              aria-pressed={view === 'panels'}
            >
              PANELS
            </button>
            <span className="hive-blink">▶</span>
          </div>
        </div>

        <div className="hive-content">
          {view === 'world' ? (
            <iframe
              title="HIVE 16-bit World Simulator"
              src={simulatorSrc}
              className="hive-simulator-frame"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ShellErrorBoundary
              appName="HIVE (16-bit JRPG)"
              appIcon="🎮"
              errorCode={ErrorCodes.HIVE_SESSION_LOST}
              onError={logToAtlas}
            >
              <Suspense fallback={null}>
                <HiveLab />
              </Suspense>
            </ShellErrorBoundary>
          )}
        </div>

        <div className="hive-bottom">
          <span>HIVE v1.0 · ROOM 02</span>
          <span>PRESS <span className="hive-blink">▶</span> TO CONTINUE</span>
        </div>
      </div>
    </div>
  );
};
```

Matching CSS (add to `index.css` or the existing `hive-room` stylesheet):

```css
.hive-simulator-frame {
  width: 100%;
  height: 100%;
  min-height: 540px;
  border: 0;
  background: #050510;
  display: block;
}
```

## Step 3 — wire `?chamber=<id>` portals into the shell router

The simulator's portals open `<shell>/?chamber=<id>` in a new tab. Map those IDs to existing tabs/labs in the shell router (or to hash routes such as `#hive`, `#oaa`, `#vault`, `#reflections`, `#sentinel`).

```ts
// somewhere early in App.tsx (mobius-browser-shell)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const chamber = params.get('chamber');
  if (!chamber) return;

  // route to the matching tab. Adjust to your router's API.
  const target: Record<string, string> = {
    hive: '#hive',
    oaa: '#oaa',
    vault: '#vault',
    reflections: '#reflections',
    sentinel: '#sentinel',
  };
  if (target[chamber]) {
    window.location.hash = target[chamber];
    params.delete('chamber');
    const q = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash);
  }
}, []);
```

## Local preview

From the **mobius-hive** repository root:

```bash
npx --yes serve . --listen 8787
# open http://127.0.0.1:8787/artifacts/hive-mmo-simulator/
```

Same-origin fetches against `/world/current-world.json` will succeed because `serve` exposes the repo root. If served from a different host (or `file://`), the HUD shows **DEMO DATA** and controls still work.

## Simulator query parameters

| Param      | Purpose                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `shell`    | Base URL for **LAUNCH SHELL** (default `https://mobius-browser-shell.vercel.app`).                                         |
| `data`     | Base URL for world JSON. Absolute (`https://…/`) or relative to the embedding origin (`/api/hive/world/`). Must end with `/`. |
| `demo=1`   | Force embedded demo projection (no network).                                                                               |
| `commits`  | Footer label (e.g. commit count string).                                                                                   |

Recommended embed when hosted under the shell origin:

```
/hive-simulator/?data=/api/hive/world/&shell=https://mobius-browser-shell.vercel.app
```

Alternate (direct from this repo's raw, CORS permitting):

```
/hive-simulator/?data=https://raw.githubusercontent.com/kaizencycle/mobius-hive/main/&shell=https://mobius-browser-shell.vercel.app
```

## Contract alignment

The HUD reads the same fields the shell's `TopStatusBar` already consumes:

- `current-world.json`: `cycle`, `integrity.gi`, `vault.progress`, `active_events`, `active_quests`
- Sentinel dialogue: `voice` / `dialogue.default` / `runtime_overlay.voice` from each `world/sentinels/*.json`

The hive repo remains the **canonical write path** for `world/`; the simulator and shell are **read-only consumers**.

## Theming

Visual language: **Midnight Galaxy** — deep indigo/green field, cyan portals, gold accents, `Press Start 2P` (loaded from Google Fonts in `index.html`). It composes cleanly inside the shell's CRT-styled `.hive-crt` wrapper without further styling.
