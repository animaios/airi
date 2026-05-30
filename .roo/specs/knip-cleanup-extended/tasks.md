# Knip Cleanup Extended (Phase 2) — Tasks

## D1: Remove 12 Orphaned Catalog Entries

- [ ] **T1.1** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `'@electron/notarize': ^3.1.1` (line 7)
- [ ] **T1.2** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `'@proj-airi/iconify-meteocons': ^0.1.5` (line 22)
- [ ] **T1.3** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `'@proj-airi/unplugin-fetch': ^0.2.3` (line 23)
- [ ] **T1.4** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `'@shopify/draggable': ^1.2.1` (line 24)
- [ ] **T1.5** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `'@types/d3': ^7.4.3` (line 26)
- [ ] **T1.6** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `'@types/whatwg-mimetype': ^5.0.0` (line 30)
- [ ] **T1.7** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `'@xsai/embed': 0.5.0-beta.2` (line 35)
- [ ] **T1.8** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `d3: 7.9.0` (line 50)
- [ ] **T1.9** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `drizzle-orm: ^0.45.2` (line 52)
- [ ] **T1.10** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `hono: 4.11.3` (line 58)
- [ ] **T1.11** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `oxc-minify: ^0.126.0` (line 67)
- [ ] **T1.12** Edit [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — remove `vite-plugin-mkcert: ^2.0.0` (line 86)

---

## D2: Remove Unused Barrel Re-Exports

### D2.1: Remove `getDesktopOverlayReadinessContract` from contracts barrel

- [ ] **T2.1** Search for external imports of `DesktopOverlayReadiness` type from [`contracts.ts`](apps/stage-tamagotchi/src/main/windows/desktop-overlay/rpc/contracts.ts) to determine if the type export should also be removed
- [ ] **T2.2** Remove `export { getDesktopOverlayReadinessContract }` line from [`contracts.ts`](apps/stage-tamagotchi/src/main/windows/desktop-overlay/rpc/contracts.ts:2)
- [ ] **T2.3** If `DesktopOverlayReadiness` type has no external consumers from this barrel, remove that line too; otherwise keep it

### D2.2: Remove unused component barrel exports from stage-ui-three

- [ ] **T2.4** Check [`packages/stage-ui-three/src/index.ts`](packages/stage-ui-three/src/index.ts) for any re-exports from `components/Controls`, `components/Environment`, or `components/Model` barrels
- [ ] **T2.5** If re-exports exist in the main index, remove those lines
- [ ] **T2.6** Delete [`packages/stage-ui-three/src/components/Controls/index.ts`](packages/stage-ui-three/src/components/Controls/index.ts)
- [ ] **T2.7** Delete [`packages/stage-ui-three/src/components/Environment/index.ts`](packages/stage-ui-three/src/components/Environment/index.ts)
- [ ] **T2.8** Delete [`packages/stage-ui-three/src/components/Model/index.ts`](packages/stage-ui-three/src/components/Model/index.ts)

### D2.3: Internalize `loadManifestsFrom` in plugin host registry

- [ ] **T2.9** Search for any test file or external file that imports `loadManifestsFrom` from [`registry.ts`](apps/stage-tamagotchi/src/main/services/airi/plugins/host/registry.ts)
- [ ] **T2.10** Remove `export` keyword from [`loadManifestsFrom`](apps/stage-tamagotchi/src/main/services/airi/plugins/host/registry.ts:58) function declaration (change `export async function` to `async function`)

### D2.4: Clean weather barrel re-exports

- [ ] **T2.11** Search for any file that imports `fetchWeather`, `geocodeCity`, or `mapWmoCode` from [`weather.ts`](apps/stage-tamagotchi/src/renderer/stores/tools/builtin/weather.ts) barrel (not from `./weather-api` directly)
- [ ] **T2.12** If no external barrel consumers found, remove the re-export line `export { fetchWeather, geocodeCity, mapWmoCode } from './weather-api'` from [`weather.ts`](apps/stage-tamagotchi/src/renderer/stores/tools/builtin/weather.ts:10)
- [ ] **T2.13** Verify that `fetchWeather` is still available within the file via the existing `import { fetchWeather } from './weather-api'` at line 6

---

## D3: Remove Confirmed Unused Dependencies

### D3.1: packages/stage-ui-three

- [ ] **T3.1** Run `pnpm --filter @proj-airi/stage-ui-three remove @proj-airi/stage-shared @tresjs/cientos`
- [ ] **T3.2** Run `pnpm install` after removal
- [ ] **T3.3** Run `pnpm -F @proj-airi/stage-ui-three typecheck` to verify no type errors

### D3.2: packages/ui

- [ ] **T3.4** Run `pnpm --filter @proj-airi/ui remove floating-vue`
- [ ] **T3.5** Run `pnpm install` after removal
- [ ] **T3.6** Run `pnpm -F @proj-airi/ui typecheck` to verify no type errors

### D3.3: packages/ui-transitions

- [ ] **T3.7** Check `@vueuse/motion` peer dependency requirements — determine if `@vueuse/core` is required as a peer dep
- [ ] **T3.8** If `@vueuse/core` is not a required peer dep of `@vueuse/motion`, run `pnpm --filter @proj-airi/ui-transitions remove @vueuse/core`
- [ ] **T3.9** If `@vueuse/core` is required, skip this removal and document the finding
- [ ] **T3.10** Run `pnpm install` after removal (if performed)
- [ ] **T3.11** Run `pnpm -F @proj-airi/ui-transitions typecheck` to verify no type errors

---

## Final Verification

- [ ] **T4.1** Run `pnpm install` to ensure lockfile consistency across all changes
- [ ] **T4.2** Run `pnpm -F @proj-airi/stage-tamagotchi typecheck` — confirm no type errors
- [ ] **T4.3** Run `pnpm -F @proj-airi/stage-ui typecheck` — confirm no type errors
- [ ] **T4.4** Run `pnpm -F @proj-airi/stage-ui-three typecheck` — confirm no type errors
- [ ] **T4.5** Run `pnpm -F @proj-airi/ui typecheck` — confirm no type errors
- [ ] **T4.6** Run `pnpm knip` — verify reduced flag counts
- [ ] **T4.7** Run `pnpm lint` — confirm no lint issues from changes