# Utility Scripts

Helper scripts that run as part of the Next.js build or test pipeline live in
this folder. They should be lightweight Node scripts with minimal dependencies.
Currently `copy-env.js` mirrors the shared environment manifest into `public/`
so the UI can load available worlds at runtime.
