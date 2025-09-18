# Frontend

This directory houses the client-facing pieces of the E-CO web shell. The Next.js
App Router entrypoints, layouts, and global styles live under `app/`, while the
route shims in `../app/` simply re-export them so the framework can continue to
auto-discover pages. Reusable UI building blocks – such as the desktop shell,
command palette, and dashboards – sit in `components/` alongside their
co-located tests.

Expect to find presentation code, hooks, and other browser-only logic here.
