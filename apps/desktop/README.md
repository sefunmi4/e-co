# E-CO Desktop Shell

This directory hosts the native desktop initiatives that wrap the Ether ecosystem experiences. The long-term plan is to deliver
a Tauri-based shell that can embed the Ether Pod web runtime while exposing local integrations and SymbolCast input from the
native daemon.

## Projects

### Ether Net (`apps/desktop/ether-net`)

A VR-inspired search and landing experience that greets creators when they launch the desktop shell. It surfaces private
artifacts, pod worlds, and sharing controls before you invite friends or publish your space to the global Ether Net directory.
Boot it locally with:

```bash
cd apps/desktop/ether-net
npm install
npm run dev
```

> The remaining desktop shell scaffolding will extend this experience in a future sprint by binding it to the Tauri host.
