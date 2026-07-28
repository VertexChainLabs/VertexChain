# Frontend Contributing Guidelines

For general environment setup, monorepo layout, git workflow, and PR conventions, please refer to the [Root CONTRIBUTING.md](../../CONTRIBUTING.md). This document covers **Frontend (Next.js) workspace-specific** rules only.

## Table of Contents

- [Project Layout](#project-layout)
- [Component Conventions](#component-conventions)
- [Accessibility (a11y)](#accessibility-a11y)
- [E2E Testing & `data-testid` Convention](#e2e-testing--data-testid-convention)
- [Unit Tests](#unit-tests)

## Project Layout

```
Frontend/
├── src/
│   ├── app/           # Next.js App Router pages, layouts, and global styles
│   ├── components/    # Reusable UI (split by feature folder, e.g. `map/`, `landing/`)
│   └── styles/        # Global CSS and Tailwind-related assets
├── e2e/               # Playwright end-to-end tests
├── public/            # Static assets served as-is
└── *.config.ts        # next.config, tailwind.config, playwright.config, vitest.config
```

Prefer **feature folders** under `src/components/`. Each folder owns its components, tests, and internal helpers (e.g. `src/components/map/` exports `Map.tsx`, `AddGistModal.tsx`, `MapLoader.tsx`, and co-located `*.test.tsx` files).

## Component Conventions

- **Client Components** must start with `'use client';` at the top of the file. Server Components are the default — add the directive only when you need hooks, browser APIs, or DOM events.
- **Dynamic imports** for heavy libraries (Leaflet, Mapbox, etc.) must set `ssr: false` and live in a dedicated loader component (see `MapLoader.tsx`).
- Use **Tailwind utility classes** for styling. Avoid one-off inline `style` objects unless a value is dynamic.
- **Export props as interfaces**, not type aliases, so they show up clearly in Storybook / generated docs.

## Accessibility (a11y)

Accessibility is a first-class concern, not an afterthought. Every new interactive component must:

- Have a meaningful `role` when the semantic element isn't enough (e.g. `role="dialog"` for modals).
- Expose a label for assistive tech: visible text content, `aria-label`, or an associated `<label htmlFor>` / `aria-labelledby`.
- Trap and restore focus when implementing modals, popovers, or overlays.
- Provide a `role="status"` / `role="alert"` and `aria-live` region for any state that changes asynchronously (geolocation, network responses, etc.).
- Pass [`axe-core`](https://github.com/dequelabs/axe-core) with no serious/critical violations. PRs to pages under `src/app/` should be exercised by the `axe-core` Playwright checks in `Frontend/e2e/`.

## E2E Testing & `data-testid` Convention

End-to-end tests in `Frontend/e2e/` are written with [Playwright](https://playwright.dev/). To keep them stable across translations, copy changes, and visual refactors, we use **`data-testid` attributes** as the **primary** selector for elements that are interacted with or asserted on.

### Naming

- Use **kebab-case**, prefixed with the component's domain (usually the feature name) so test IDs don't collide across feature folders.
  - ✅ `map-loader`, `map-add-gist-button`, `map-add-gist-modal`, `map-add-gist-modal-input`, `map-add-gist-modal-submit`
  - ❌ `addButton`, `submit_btn`, `modal-input`
- Multiple DOM roles inside one component should stack the parent prefix at the front, **concatenated with kebab-case separators — never nested**. The pattern is `<feature>-<component>-<elementKind>`. For `AddGistModal`, this becomes `map-add-gist-modal-<elementKind>` because the modal lives in the `map` feature; do not write things like `map/add-gist-modal/input` or `map_add_gist_modal_input`.
- Use suffix words for the element kind when they're not implicit: `-button`, `-submit`, `-input`, `-title`. Avoid generic suffixes like `-wrapper` or `-container` unless there's a real wrapper div.

### When to add one

Add a `data-testid` only when **one of the following is true** for the element:

1. A Playwright test interacts with it (clicks, fills, types).
2. A Playwright test asserts on its presence, visibility, text content, or attributes.
3. The element is a long-lived loading / state container whose visibility is asserted across tests (e.g. `map-loader`).

**Do not** add `data-testid` to every `<div>` or layout container — only to the ones tests actually need. Test IDs are a public API for the test suite; treat them like exports.

### Migrating selectors

Prefer `page.getByTestId('…')` in new E2E tests. The following are considered fragile and should be migrated as you encounter them:

| Fragile (avoid)                                     | Stable replacement                            |
| ---------------------------------------------------- | --------------------------------------------- |
| `page.getByText('Map is loading...')`                | `page.getByTestId('map-loader')`              |
| `page.getByRole('button', { name: 'Add new gist' })` | `page.getByTestId('map-add-gist-button')`     |
| `page.getByRole('dialog')`                           | `page.getByTestId('map-add-gist-modal')`      |
| `page.getByLabel('Gist content')`                    | `page.getByTestId('map-add-gist-modal-input')`|
| `page.getByRole('button', { name: /pin gist/i })`    | `page.getByTestId('map-add-gist-modal-submit')` |

Keep `aria-label`, `aria-labelledby`, and visible text intact on the underlying components — they are there for screen readers and unit tests, not as e2e selectors.

### Accessibility is separate

A `data-testid` **never replaces** an `aria-label`, `role`, or semantic element. If you find yourself wanting to remove a label "because the test now uses `getByTestId`", don't — labels are for humans using assistive technology; test IDs are for automation. Both must coexist.

## Unit Tests

- Co-locate `*.test.tsx` files next to the component under test.
- Use [`vitest`](https://vitest.dev/) + [`@testing-library/react`](https://testing-library.com/docs/react-testing-library/intro/).
- Mock heavy third-party libraries (`react-leaflet`, `framer-motion`, `next/dynamic`) at the top of the file so tests don't load a real Leaflet map.
- Prefer queries in this order: `getByRole` → `getByLabelText` → `getByTestId` → `getByText` (last resort). When you need a stable hook, use the same `data-testid` values as the Playwright suite so the convention is uniform across both test layers.

---

When in doubt, look at how `Frontend/src/components/map/` implements these rules — it's the reference example for new feature folders.
