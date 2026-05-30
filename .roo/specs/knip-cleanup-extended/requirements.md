# Knip Cleanup Extended (Phase 2) — Requirements

## Overview

This spec continues the Knip cleanup work from the existing [`knip-cleanup`](.roo/specs/knip-cleanup/) spec. The previous pass reduced unused dependencies from 105→46, unused devDependencies from 68→0, and unused exports from 76→12. This phase targets the remaining verified unused items: orphaned catalog entries, unused barrel re-exports, and confirmed unused dependencies.

**Critical context:** Knip does not scan `.vue` file `<script setup>` imports by default — it only analyzes `.ts` files. Dependencies and exports used exclusively in Vue SFCs appear "unused" to Knip. All items in this spec have been manually verified against both `.ts` and `.vue` source files to eliminate false positives.

---

## R1: Remove 12 Orphaned Catalog Entries from pnpm-workspace.yaml

The previous dependency pruning left 12 orphaned entries in the [`pnpm-workspace.yaml`](pnpm-workspace.yaml) catalog. No workspace in the monorepo references these packages.

| Catalog Entry | Line | Verification |
|---------------|------|-------------|
| `@electron/notarize` | 7 | No workspace `package.json` references it |
| `@proj-airi/iconify-meteocons` | 22 | No workspace `package.json` references it |
| `@proj-airi/unplugin-fetch` | 23 | No workspace `package.json` references it |
| `@shopify/draggable` | 24 | Removed from `stage-ui` in previous pass |
| `@types/d3` | 26 | `d3` was removed from `stage-ui` in previous pass |
| `@types/whatwg-mimetype` | 30 | No workspace `package.json` references it |
| `@xsai/embed` | 35 | No workspace `package.json` references it |
| `d3` | 50 | Removed from `stage-ui` in previous pass |
| `drizzle-orm` | 52 | No workspace `package.json` references it |
| `hono` | 58 | Removed from `stage-ui` in previous pass |
| `oxc-minify` | 67 | No workspace `package.json` references it |
| `vite-plugin-mkcert` | 86 | No workspace `package.json` references it |

**Requirement:** Remove these 12 entries from the `catalog` section of [`pnpm-workspace.yaml`](pnpm-workspace.yaml) and run `pnpm install` to update the lockfile.

---

## R2: Remove Unused Barrel Re-Exports

Several barrel files re-export symbols that no external consumer imports from the barrel. The actual consumers import directly from the source module, making the barrel re-export unused.

### R2.1: Remove `getDesktopOverlayReadinessContract` from desktop-overlay contracts barrel

[`contracts.ts`](apps/stage-tamagotchi/src/main/windows/desktop-overlay/rpc/contracts.ts:2) re-exports `getDesktopOverlayReadinessContract` from `../../../../shared/eventa`. The sole consumer [`index.electron.ts`](apps/stage-tamagotchi/src/main/windows/desktop-overlay/rpc/index.electron.ts:23) imports directly from `../../../../shared/eventa`, not from the barrel.

**Requirement:** Remove the `export { getDesktopOverlayReadinessContract }` line from [`contracts.ts`](apps/stage-tamagotchi/src/main/windows/desktop-overlay/rpc/contracts.ts:2). Keep the `export type { DesktopOverlayReadiness }` line if it has external consumers (verify first).

### R2.2: Remove unused component barrel exports from stage-ui-three

[`OrbitControls`](packages/stage-ui-three/src/components/Controls/index.ts:1), [`SkyBox`](packages/stage-ui-three/src/components/Environment/index.ts:2), and [`VRMModel`](packages/stage-ui-three/src/components/Model/index.ts:1) are exported from their respective barrel files. No external consumer imports these from the barrel — all `@proj-airi/stage-ui-three` imports use other entry points (`composables/vrm`, `stores`, etc.).

**Requirement:** Remove the `export` lines from these three barrel files. If the barrel file becomes empty after removal, remove the file entirely and update any `package.json` exports that reference it.

### R2.3: Internalize `loadManifestsFrom` in plugin host registry

[`loadManifestsFrom`](apps/stage-tamagotchi/src/main/services/airi/plugins/host/registry.ts:58) is exported but only called internally at line 326 within the same file's `refresh()` method.

**Requirement:** Remove the `export` keyword from `loadManifestsFrom`, making it a private function within the file.

### R2.4: Verify and clean weather barrel re-exports

[`weather.ts`](apps/stage-tamagotchi/src/renderer/stores/tools/builtin/weather.ts:10) re-exports `fetchWeather`, `geocodeCity`, and `mapWmoCode` from `./weather-api`. The test file [`weather.test.ts`](apps/stage-tamagotchi/src/renderer/stores/tools/builtin/weather.test.ts:3) imports directly from `./weather-api`. Need to verify whether any other file imports these from the barrel.

**Requirement:** Search for external imports from the `weather.ts` barrel. If none exist, remove the re-export line. Note: `fetchWeather` is used internally in the same file (line 19), so it must remain available — just not re-exported.

---

## R3: Remove Confirmed Unused Dependencies

Only dependencies with zero imports in both `.ts` and `.vue` files are targeted. The following have been verified as truly unused:

### R3.1: packages/stage-ui-three — Remove `@proj-airi/stage-shared` and `@tresjs/cientos`

| Package | Verification |
|---------|-------------|
| `@proj-airi/stage-shared` | Zero imports in `.ts` and `.vue` files under `packages/stage-ui-three/src/` |
| `@tresjs/cientos` | Zero imports in `.ts` and `.vue` files under `packages/stage-ui-three/src/` |

**Note:** The following `stage-ui-three` dependencies were initially proposed for removal but are **FALSE POSITIVES** — they are used in `.vue` files:
- `@tresjs/core` — used in `ThreeScene.vue`, `VRMModel.vue`, `SkyBox.vue`, `OrbitControls.vue`
- `@tresjs/post-processing` — used in `ThreeScene.vue`
- `culori` — used in `ThreeScene.vue`
- `postprocessing` — used in `ThreeScene.vue`
- `@proj-airi/ui` — used in `ThreeScene.vue` (imports `Screen`)

**Requirement:** Remove only `@proj-airi/stage-shared` and `@tresjs/cientos` from [`packages/stage-ui-three/package.json`](packages/stage-ui-three/package.json).

### R3.2: packages/ui — Remove `floating-vue`

| Package | Verification |
|---------|-------------|
| `floating-vue` | Zero imports in `.ts` and `.vue` files under `packages/ui/src/` |

**Requirement:** Remove `floating-vue` from [`packages/ui/package.json`](packages/ui/package.json:31).

### R3.3: packages/ui-transitions — Remove `@vueuse/core`

| Package | Verification |
|---------|-------------|
| `@vueuse/core` | Zero direct imports in `.ts` and `.vue` files under `packages/ui-transitions/src/` |

**Caveat:** `@vueuse/core` may be an implicit peer dependency of `@vueuse/motion` (listed in the same `package.json`). Verify that removing it does not break `@vueuse/motion` functionality before removing.

**Requirement:** Verify `@vueuse/motion` peer dependency requirements. If `@vueuse/core` is not required as a peer dep, remove it from [`packages/ui-transitions/package.json`](packages/ui-transitions/package.json:30).

---

## Out of Scope

- **116 unused exported types** — Requires per-file analysis of each type. Too large for this fast-task spec; deferred to a future dedicated spec.
- **Remaining 46 unused dependencies** — Most are false positives (used in `.vue` files). A full Knip config update to include `.vue` scanning would resolve these systematically, which is a separate concern.
- **`sparkNotifyCommandSchema` exports** — Verified as FALSE positives; widely used across `core-agent` and `stage-ui`.
- **`generateHeadless` export** — Verified as FALSE positive; used via Eventa IPC invoke pattern.
- **`es-toolkit` and `pixi-filters` in stage-ui-live2d** — Verified as FALSE positives; used in `Model.vue`.
- **`dompurify`, `reka-ui`, `vaul-vue`, `web-haptics`, `@proj-airi/chromatic` in stage-ui** — All verified as FALSE positives; used in `.vue` files.

## Verification Requirements

After completing all changes:

1. `pnpm install` — ensure lockfile consistency
2. `pnpm -F @proj-airi/stage-ui-three typecheck` — confirm no type errors
3. `pnpm -F @proj-airi/ui typecheck` — confirm no type errors
4. `pnpm -F @proj-airi/stage-tamagotchi typecheck` — confirm no type errors
5. `pnpm knip` — verify reduced flag counts
6. `pnpm lint` — confirm no lint issues