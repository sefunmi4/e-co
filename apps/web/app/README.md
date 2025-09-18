# App Proxy Shims

This directory only exists so Next.js can discover the `app/` router entrypoints.
Each file simply re-exports the real implementations that live under
`../frontend/app`. Keep anything framework-facing (route definitions,
metadata, layout wrappers) in the frontend folder and adjust these proxies if new
entrypoints are added.
