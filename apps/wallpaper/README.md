# Wallpaper Host

The wallpaper host workspace provides platform harnesses for projecting Ether Computing portals as live wallpapers.
Each platform binary shares the same Bevy application core, loads ECO manifests to configure worlds, and listens for
portal switch events streamed over NATS.

## Layout

- `host/` – shared runtime, CLI, and platform bridges.
- `host/src/bin/windows.rs` – Windows live wallpaper harness built around a D3D12 swapchain.
- `host/src/bin/macos.rs` – macOS screensaver/wallpaper host backed by a `CAMetalLayer` surface.
- `host/src/bin/wayland.rs` – Wayland layer-shell client that targets background surfaces via `smithay-client-toolkit`.

## Running

All binaries share the same CLI and environment contract. The most common flags are shown below:

```text
Usage: eco-wallpaper [OPTIONS]

Options:
      --manifest <PATH>          Path to the ECO manifest to load (env: ECO_MANIFEST)
      --portal <PORTAL_ID>       Portal identifier to activate on startup (env: ECO_PORTAL)
      --openxr                   Enable OpenXR integration when supported (env: ECO_ENABLE_OPENXR)
      --symbolcast <URL>         SymbolCast endpoint for local agent services (env: SYMBOLCAST_URL)
      --agent-service <URL>      Override the agent orchestration endpoint (env: ECO_AGENT_SERVICE)
      --nats-url <URL>           NATS connection string [default: nats://127.0.0.1:4222] (env: ECO_NATS_URL)
```

Each binary can be executed with `cargo run` targeting the desired host:

```bash
# Wayland (Linux)
cargo run -p wallpaper-host --bin wayland -- --manifest ./manifests/aurora.toml

# macOS
cargo run -p wallpaper-host --bin macos -- --portal lobby

# Windows
cargo run -p wallpaper-host --bin windows -- --agent-service http://127.0.0.1:9000
```

When the host starts it loads the supplied ECO manifest via `eco-core`, spins up a Bevy `App` with `eco-render`'s
rendering plugin, and connects to NATS subjects `ethos.chat.*` and `eco.action.*`. Portal events received from those
subjects are validated against the manifest and trigger scene swaps inside the running Bevy world.

## Platform notes

### Windows

The Windows harness initialises a D3D12 swapchain descriptor that can be embedded into the live wallpaper window. The
current implementation focuses on establishing the descriptor and wiring portal updates; the outer shell integration is
ready for hosting within the Windows Desktop Window Manager.

### macOS

On macOS a `CAMetalLayer` is created and attached to an `NSView`. The layer is configured for BGRA rendering and is ready
to be registered with either the ScreenSaver or desktop wallpaper APIs, while the Bevy runtime keeps portals in sync with
NATS updates.

### Wayland

The Wayland host connects to the compositor using `smithay-client-toolkit`, creates a layer-shell surface anchored to all
edges, and commits an initial surface configuration. The layer is prepared for embedding the Bevy renderer as a desktop
background.

## Testing

Unit tests cover manifest parsing and portal event processing. Additional smoke tests that ensure each binary compiles
can be enabled with cargo features:

```bash
cargo test -p wallpaper-host --features smoke-wayland
cargo test -p wallpaper-host --features smoke-macos
cargo test -p wallpaper-host --features smoke-windows
```

Running `cargo test -p wallpaper-host` without extra features will execute the core unit tests.
