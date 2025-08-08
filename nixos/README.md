# NixOS Layer

This directory contains the NixOS configuration for EtherOS.

## Structure
- `flake.nix` – flake entry point with overlays and packages
- `desktop.nix` – desktop environment modules
- `server.nix` – server configuration for remote sessions
- `module.nix` – reusable module definitions
- `shell.nix` – development shell for building examples
- `example/` – small Qt demo used to test native builds

## Usage
```bash
cd nixos
nix develop
nixos-rebuild switch --flake .
```

To build the Qt example:
```bash
cd nixos
nix develop
cd example
cmake -B build
cmake --build build
./build/etheros-example
```
