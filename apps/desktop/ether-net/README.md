# Ether Net Desktop Shell

Ether Net is a cross-platform desktop experience designed as the bridge between your private pod-world studio and the public
Ether directory. This initial prototype focuses on the VR-inspired landing page that every creator sees when launching the
application.

## Features

- **Personal landing space** — Render volumetric artifacts that can be kept private, shared with friends, or published to the
global Ether Net search index.
- **Search-first UX** — Filter artifacts, pod worlds, and collaborators from the left rail before teleporting into a space.
- **Presence controls** — Invite friends, toggle private mode, or publish to the global directory directly from the desktop
shell.
- **Three.js preview** — The main canvas uses WebGL (via `@react-three/fiber`) to preview your curated world while you decide
what to expose.

## Getting started

```bash
cd apps/desktop/ether-net
npm install
npm run dev
```

The dev server boots on [http://localhost:4173](http://localhost:4173) and auto-reloads as you iterate on the VR gallery or the
search interface. Build assets with `npm run build` or serve the static preview via `npm run preview`.

> **Next steps**: Integrate the pod-world directory APIs and Ethos repo sync so artifacts reflect real project data, and wrap
> this experience in the Tauri shell defined in `apps/desktop/README.md`.
