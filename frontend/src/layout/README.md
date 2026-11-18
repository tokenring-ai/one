# Layout engine

Every app in TokenRing One runs on this engine (the dockview host it replaced has been removed). The guide to building apps, views and kinds, the view API, testing helpers and pitfalls is [`docs/plugin-apps.md`](../../../docs/plugin-apps.md).

Engine map:
- `types.ts`, `define.ts`: vocabulary (React-free manifests, `defineView` and `defineApp`).
- `model.ts`: the pure reducer, with placement and validation.
- `routes.ts`: URL to view and back (react-router matching).
- `store.ts`, `persistence.ts`, `rpcRemote.ts`: state, undo, and local and remote saving.
- `LayoutApp.tsx`: the one-way route effect, plus the API views use.
- `LayoutSurface.tsx`, `ContainerView.tsx`, `presenters/`, `MobileLayout.tsx`, `PanelHost.tsx`: rendering. Panels render once and their DOM node moves between containers.
- `hooks.ts`, `links.tsx`, `context.ts`: the view-facing API.
