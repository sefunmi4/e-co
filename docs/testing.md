# Testing

## Playwright end-to-end coverage

Ethos' storefront flow is exercised via Playwright using deterministic fixture
data. The spec renders a lightweight harness and walks the exact
pod → artifact → checkout success path to confirm the copy, pricing totals, and
success messaging stay stable.

### Prerequisites

Playwright is already a dependency of the Ether Pod workspace. Install its
node_modules from the monorepo root:

```bash
npm ci --workspace apps/web/ether-pod
```

Install the browsers once (omit `--with-deps` if they are already cached):

```bash
cd apps/web/ether-pod
npx playwright install --with-deps
cd -
```

### Run the Ethos pod checkout spec

Execute the Ethos Playwright suite from the repository root:

```bash
npx playwright test --config apps/web/ethos/tests/playwright.config.ts
```

Add `--ui` to open the trace viewer / UI runner:

```bash
npx playwright test --config apps/web/ethos/tests/playwright.config.ts --ui
```

The deterministic seed powering the flow lives in
`apps/web/ethos/tests/fixtures/demoData.ts`.
