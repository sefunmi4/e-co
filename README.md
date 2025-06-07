# 🧠 Ether Computing & OS — Modular Immersive Desktop Environment (MVP)

EtherOS is a next-gen modular desktop environment built for immersive computing, symbolic input, and decentralized session portability.

This repo contains:
- A **NixOS-based desktop environment layer**
- A **browser-accessible web interface**
- A shared runtime system for gestures, state, and command handling

---

## 🚀 Goals

- Create a lightweight, declarative desktop layer on top of NixOS
- Simulate VR/immersive computing with SymbolCast input (gestures & voice)
- Use devices as personal cloud mesh nodes (e.g., headless laptops)
- Offer browser-based access for testing, collaboration, and mobile users

---

## 📁 Structure

```plaintext
nixos/     → Flake + overlays for NixOS DE setup
web/       → Web version of EtherOS UI (React + Tailwind + Three.js)
runtime/   → Shared SymbolCast + state logic
docs/      → Architecture, usage, and planning docs
nixos/example/   → Small Qt demo showing a native window
```


⸻

## ⚙️ Getting Started

### Prerequisites

EtherOS relies on the [Nix package manager](https://nixos.org/download.html).
Install Nix with flakes enabled before building any part of the project.


### 🔹 Run the Web Version
```bash
cd web
npm install
npm run dev
```

### 🔹 Build the Runtime Library

The runtime package compiles TypeScript sources to `dist/`. Build it with:

```bash
npm run build -w runtime
```
The compiled library can then be consumed from `runtime/dist`.

### 🔹 Build NixOS Layer

You must have Nix + flakes enabled.
```bash
cd nixos
nix develop
nixos-rebuild switch --flake .
```

### 🔹 Build the Qt Example

An example Qt application lives in `nixos/example` to verify the native build
toolchain. From within the Nix shell run:

```bash
cd nixos
nix develop
cd example
cmake -B build
cmake --build build
./build/etheros-example
```

### Environment Assets
The list of available environments lives in `shared/environments.json`. Add your own entries there and provide matching background images in `web/public/`. Images such as `forest.jpg`, `chamber.jpg`, and `island.jpg` are user supplied and ignored by Git.



---

## 🌌 MVP Features (WIP)
	•	Modular folder structure
	•	Basic desktop layout in web
	•	SymbolCast input (mock gestures + voice)
	•	NixOS flake for personal DE boot
	•	Shared command & file system logic

---

## 📚 Documentation
	•	docs/architecture.md – Full system vision
	•	docs/roadmap.md – MVP goals + phases
	•	docs/usage.md – Dev setup for Nix & Web

---

## 🤝 Contributing

This project is in active development. If you love OS dev, symbolic UI, or immersive experiences — join us!

---

## 🌐 License

MIT — feel free to remix, fork, and build with us.

---

Want me to:
- Scaffold the folders + stub files in a zip?
- Create starter `flake.nix` or web `vite.config.ts`?
- Write the architecture doc next?

Let’s build ✨
