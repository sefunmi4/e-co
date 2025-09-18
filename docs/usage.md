# Usage Guide

This guide covers the development workflow for the E-CO monorepo.

## Prerequisites

- Node.js 20+
- Rust toolchain (via `rustup`)
- CMake (for the C++ Q++ bridge)
- Optional: Nix with flakes enabled (`nix develop ./distro/nix` provides all dependencies)

## Bootstrapping

```bash
npm install       # installs workspace dependencies
npm run build     # compiles the JS SDK used by the web shell
```

## Running the Web Shell

```bash
cd apps/web/pod-world
npm run dev
```

The development server runs on `http://localhost:3000`. Environment definitions live in `shared/environments.json` and are copied to `apps/web/pod-world/public/environments.json` automatically by the `copy-env` script.

## Testing

```bash
npm test          # runs SDK + web component unit tests
```

Rust crates and services can be tested individually, e.g. `cargo test -p eco-core`.

## Working with Manifests

Example `ECO.toml` manifests are stored under `examples/worlds/`. Use the `eco-core` crate or the `@eco/js-sdk` helpers to parse and validate manifests during development.

## Nix Development Shell

```bash
nix develop ./distro/nix
```

The shell provides Node.js, Rust, Protobuf, and CMake. It is the recommended environment for hacking on the Rust services or the C++ SDK.

## Adding Assets

Place shared background assets in `apps/web/pod-world/public/` and reference them from `shared/environments.json`. For custom Bevy worlds, extend the manifest registry with new component IDs and load them via dynamic modules.
