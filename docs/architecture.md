# EtherOS Architecture

This document outlines the high level design of the EtherOS project.

## Overview

EtherOS combines a minimal NixOS layer with a browser-based desktop UI. The goal is to provide a portable, cloud-friendly environment that can run on a wide range of devices while remaining easy to customize.

### Components

- **NixOS Layer** — Provides the base operating system and system services. The configuration is defined through flakes for reproducibility.
- **Web UI** — A React + Tailwind web application that renders the desktop environment in the browser. This allows remote access and easy iteration.
- **Runtime** — Shared logic for gestures, commands and state synchronization between the OS layer and the web interface.
- **Qt Example** — A small C++/Qt program (compatible with Q++) used to validate native tooling.

## Data Flow

1. User interacts with the web interface using gestures or voice commands.
2. Commands are translated into actions within the runtime.
3. The runtime communicates with the NixOS layer to execute system-level tasks or file operations.
4. Updates are reflected back in the web UI in real time.

## Multi-platform Targets

EtherOS builds are defined through Nix flakes. Example configurations exist for a
headless **server** image and a graphical **desktop** image. Future work will
extend the runtime to mobile and wearable clients using React Native so that the
same command APIs operate everywhere.

## Future Work

This architecture will evolve as we integrate real SymbolCast input and additional modules. Contributions and feedback are welcome.
