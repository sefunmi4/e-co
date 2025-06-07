# Usage Guide

This guide explains how to set up a development environment for EtherOS.

## Prerequisites

- **Nix** with flakes enabled
- **Node.js** (for the web interface)

## Running the Web Interface

1. Navigate to the `web` directory:
   ```bash
   cd web
   ```
2. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

The application will be available at `http://localhost:5173` by default.

## Building the NixOS Layer

1. Enter the `nixos` directory:
   ```bash
   cd nixos
   ```
2. Drop into the development shell and build:
   ```bash
   nix develop
   nixos-rebuild switch --flake .
   ```

This will apply the configuration to your machine. Use caution when running on a non-test system.

## Creating a Bootable ISO

To experiment on other hardware, you can build a bootable ISO:

```bash
cd nixos
nix build .#iso
```

The resulting image can be flashed to a USB drive for quick installation.
