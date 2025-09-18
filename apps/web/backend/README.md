# Backend

Server-leaning utilities that drive the web experience belong here. Today it contains lightweight data shims such as `lib/frequency.ts`, which represents mocked Q++ signal analysis until the real service is wired in. Future API handlers, data loaders, and integration glue should land beside it.

Anything shared with the frontend should be exported through typed helpers so UI layers can consume them safely.
