# Ether Net Desktop

Ether Net is a cross-platform desktop VR world search engine powered by Tauri and Bevy. This package currently contains the initial scaffolding for the application including the Tauri bootstrap, command wiring, and placeholder core systems for search, teleportation, artifacts, and presence.

## Development

1. Install dependencies: `npm install` at repo root to ensure workspace tooling is available.
2. Set environment variables (see `.env.example`).
3. Run the desktop shell:

```bash
npm run dev:ether-net
```

The command launches the Tauri dev server which in turn boots a minimal Bevy scene placeholder.

## Structure

- `src-tauri/` – Rust sources for the desktop runtime.
  - `main.rs` – Tauri + Bevy bootstrap.
  - `app_state.rs` – shared application state managed by Tauri.
  - `commands.rs` – Tauri commands invoked from the frontend panels.
  - `core/` – placeholder domain modules (search, portals, artifacts, presence, teleport router).
  - `ui/` – reserved for Bevy UI scenes to be implemented in subsequent phases.

Future work will flesh out the Bevy experience, integrate the artifact drive, and add real presence networking.
