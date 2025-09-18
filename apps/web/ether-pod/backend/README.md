# Backend helpers

Server-leaning utilities that drive the Ether Pod web experience belong here.
These modules run inside the same Next.js process and are imported via the
`@backend/*` TypeScript alias. Today the folder contains lightweight data shims
such as `lib/frequency.ts`, which mocks Q++ signal analysis until the real
service is wired in. Future API handlers, data loaders, and integration glue
should land beside it.

Because these helpers execute within Next.js' server runtime they do not require
a separate Node service—use regular Next.js API routes or server components to
call into them.
