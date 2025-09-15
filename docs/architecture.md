# E-CO Architecture

The Ether Computing & OS stack is organised as a monorepo that lets every surface (web, desktop, VR, mobile) consume the same primitives. Each layer maps to a concrete technology choice so features can land once and flow everywhere.

## Core Pillars

- **ECO Manifest (`ECO.toml`)** – declarative world definition describing portals, components, and SymbolCast configuration. Implemented in `engines/eco-core` with Rust + Serde.
- **Rendering** – Bevy (`engines/eco-render`) drives both native and WebGPU/WebXR builds. The wallpaper host and desktop shell reuse this renderer.
- **Window Management** – `engines/eco-wm` layers a smithay compositor for Wayland while Windows/macOS hosts mirror frame capture into Bevy textures.
- **Messaging Plane** – gRPC (see `proto/`) handles low-latency RPC (`SymbolCast`, `EcoActions`, `Search`, `WindowControl`). NATS subjects fan out events such as `eco.gesture.detected` and `eco.window.pin`.
- **SDKs** – `sdks/js`, `sdks/rust`, and `sdks/cpp-qpp` expose the same manifest, command, and Q++ bindings across TypeScript, Rust, and C++.

## Service Topology

| Service | Stack | Responsibilities |
| --- | --- | --- |
| `services/api` | Axum, tonic | REST + gRPC gateway, auth verification, search proxy |
| `services/indexer` | Tantivy, Qdrant | Ingest world metadata, vectorise assets, maintain search indices |
| `services/agent` | async-nats, SymbolCast | React to gestures/events, orchestrate Q++ jobs |
| `symbolcastd` | C++ core + Rust wrapper | Stream pointer data, run ONNX models, emit gestures |

The services communicate over localhost by default but can be deployed across nodes with mutual TLS.

## Application Surfaces

- **Web (`apps/web`)** – Next.js 14 app with Bevy WASM canvas, command palette, environment manager, and SymbolCast dashboard.
- **Desktop (`apps/desktop`)** – Tauri shell (planned) embedding the web app, bridging OS-level hotkeys and offline caches.
- **Wallpaper (`apps/wallpaper`)** – Native hosts that project Bevy scenes behind desktop windows and listen for portal updates via NATS.
- **VR Search** – Reuses the renderer and portal graph to present search results as teleportable worlds.

## Data Lifecycle

1. A user draws a gesture captured by SymbolCast (C++ + ONNX Runtime).
2. `symbolcastd` streams `PointerEvent` messages via gRPC to the automation agent.
3. The agent looks up the gesture in the JS SDK registry and publishes `eco.action.cast` on NATS.
4. Services like `eco-api` or the window manager consume the action to update UI or launch Q++ tasks.
5. Resulting state changes emit back into the web shell through the shared SDK and websockets.

## Packaging & Distribution

- **NixOS** – `distro/nix/flake.nix` defines the reproducible dev shell and future system profiles.
- **Desktop** – Tauri bundling with auto-updates; Windows/macOS installers wrap the wallpaper host and SymbolCast daemon.
- **Mobile/Wearables** – Lightweight SymbolCast trigger apps, sharing the JS SDK via React Native or WASM.

This architecture keeps the primitives composable: manifests stay declarative, services communicate through well-defined contracts, and renderers operate consistently across every host.
