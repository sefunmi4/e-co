# Roadmap

The roadmap mirrors the sprint outline described in the architecture plan.

## Sprint 0 – Monorepo Foundation ✅
- [x] Restructure repository into apps/engines/services/sdks layout
- [x] Bootstrap Next.js web shell + JS SDK workspace
- [x] Stub Rust + C++ crates for renderers, compositor, and Q++ bridge

## Sprint 1 – Contracts & SDKs
- [ ] Finalize `ECO.toml` schema and sign/verify flow
- [ ] Generate protobuf + gRPC stubs for Rust, TypeScript, and C++
- [ ] Publish first SymbolCast gesture registry in `@eco/js-sdk`

## Sprint 2 – Service Mesh
- [ ] Flesh out Axum API with search proxy + auth middleware
- [ ] Expand indexer to push vectors into Qdrant
- [ ] Wire eco-agent to run Q++ jobs through the cpp bridge

## Sprint 3 – Surface Integration
- [ ] Embed Bevy WASM renderer inside the Next.js shell with portal navigation
- [ ] Stand up the Tauri desktop host with offline cache + passkey auth
- [ ] Add wallpaper host prototypes for macOS/Windows/Wayland

## Sprint 4 – Distribution
- [ ] Harden NixOS flake into workstation + creator profiles
- [ ] Produce desktop installers bundling SymbolCast + eco-api
- [ ] Deliver lightweight Android/iOS SymbolCast trigger apps

Community contributions are welcome across any slice of the plan—open a discussion to coordinate work.
