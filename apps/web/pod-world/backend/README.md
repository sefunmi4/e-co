# Backend

Server-leaning utilities that drive the web experience belong here. Today it
contains lightweight data shims such as `lib/frequency.ts`, which represents
mocked Q++ signal analysis until the real service is wired in. Future API
handlers, data loaders, and integration glue should land beside it. Everything in
this folder is reachable via the `@backend/*` TypeScript alias so the frontend
can consume it safely.
