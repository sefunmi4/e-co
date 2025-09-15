# 🧠 Ether Computing & OS (E-CO) Monorepo

E-CO is a modular immersive operating environment that unifies Q++ compute, SymbolCast input, and world-scale search across web, desktop, VR, and NixOS deployments. This repository now follows a unified “choose-once, use-everywhere” stack that maps directly to every platform component.

## 📦 Repository Layout

```
apps/
  web/         – Next.js + Bevy WASM canvas for the browser shell
  desktop/     – (stub) Tauri host wrapping the web UI
  wallpaper/   – (stub) native wallpaper hosts wired into the renderer
engines/
  eco-core/    – Rust ECS core + ECO.toml manifest loader
  eco-render/  – Bevy scene graph + lighting systems
  eco-wm/      – Rust Wayland compositor scaffolding
services/
  api/         – Axum gateway for search/actions
  indexer/     – Tantivy/Qdrant index feeder
  agent/       – Automation daemon listening to NATS & gRPC events
sdks/
  js/          – TypeScript runtime shared by the UI & tools
  rust/        – Rust SDK exporting manifest helpers
  cpp-qpp/     – C++ bridge for the Q++ runtime
tools/
  packer/      – (stub) world bundler + signer
  symbolcast/  – (stub) gesture model training suite
distro/
  nix/         – flake-based development shell
  linux/       – packaging notes for Debian/RPM/Arch
examples/worlds/ – reference ECO manifests and assets
proto/            – gRPC/Protobuf service contracts
shared/           – data shared across packages (e.g. environments)
```

## 🚀 Quick Start

### Install Dependencies

Use the repo-level dev shell or your system tooling:

```bash
# optional but recommended
direnv allow . # if you use direnv + Nix flakes
nix develop ./distro/nix   # or install Node.js 20 + Rust + CMake manually
```

### Bootstrap workspaces

```bash
npm install
npm run build            # builds the JS SDK so the web app can import it
```

### Run the Web Shell (Next.js)

```bash
cd apps/web
npm run dev
```

The page loads a Bevy-powered procedural terrain canvas, SymbolCast mock UI, and window manager overlay. Environment metadata is pulled from `shared/environments.json` and mirrored into `apps/web/public/environments.json` during the build step.

### Test the shared SDKs

```bash
npm test           # runs the JS SDK + web component unit tests
```

Additional Rust crates and services ship with their own `cargo test` targets; run them as needed when iterating on those layers.

## 🧩 Cross-Cutting Infrastructure

- **Identity**: OIDC providers (Keycloak/Auth0) with WebAuthn passkeys.
- **Protocols**: gRPC (Protobuf) for low-latency RPC, NATS for event fan-out.
- **Storage/Search**: Postgres for state, Tantivy + Qdrant for text/vector search.
- **Graphics**: Bevy on `wgpu`, targeting native (OpenXR) and WebGPU/WebXR.
- **Packaging**: Tauri desktop shell, Next.js web app, Nix flakes for reproducible dev environments.

## 📡 gRPC Interfaces

See the [`proto/`](proto) directory for service contracts:

- `SymbolCast.Recognize(stream PointerEvent) -> Gesture`
- `EcoActions.Cast(Action) -> ActionAck`
- `Search.Query(QueryRequest) -> stream WorldCard`
- `WindowControl.{List,Pin,Move,Focus}`

Corresponding NATS subjects emit portal, window, and gesture events such as `eco.gesture.detected`, `eco.action.cast`, and `ethos.chat.msg`.

## 🗺️ ECO.toml Manifest

The `engines/eco-core` crate defines and validates the signed `ECO.toml` schema. Example manifests live in `examples/worlds/`. Each manifest includes:

- world metadata (`name`, `version`, `entry_scene`)
- portal graph definitions (`[[portals]]`)
- service components (`[[components]]`)
- SymbolCast runtime configuration (`[symbolcast]`)

## 🛣️ Roadmap (Sprint Outline)

1. Finalize ECO.toml schema + protobuf contracts, generate language bindings.
2. Expand the web MVP with navigation between portals and world manifests.
3. Flesh out Axum API + in-memory search backed by Tantivy/Qdrant.
4. Replace SymbolCast mock with a streaming daemon backed by ONNX Runtime.
5. Wrap the web shell in Tauri and expose global hotkeys & offline cache.
6. Harden the Nix flake to deliver full workstation + mobile profiles.

## 🤝 Contributing

We welcome experiments across graphics, symbolic input, and distributed OS design. Open an issue or start a discussion to collaborate on any slice of the stack.

## 🪪 License

MIT — build, remix, and extend the platform freely.
