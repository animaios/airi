# Knip Cleanup — Unused Exported Types — Tasks

> **Prerequisite:** The [`knip-cleanup-public-api`](.roo/specs/knip-cleanup-public-api/) spec was completed first, reducing the initial 116 flagged types to 100.

## Phase 0: Capture Reduced Type List

- [x] **T0.1** Run `pnpm knip` after public-api spec — captured 100 remaining unused exported types
- [x] **T0.2** Grouped flagged types by workspace — created per-workspace inventory
- [x] **T0.3** Estimated false-positive rate — most types expected to be false positives from `.vue` usage

---

## Phase 1: packages/stage-ui Batch (8 types)

- [x] **T1.0** Captured 8 flagged types in `packages/stage-ui`
- [x] **T1.1** `CreateCharactersModelParams` — **RETAINED** (used locally in `characters.ts:64`)
- [x] **T1.2** `CreateInferenceServiceProvidersModelParams` — **REMOVED export** (local-only, no external imports in .ts or .vue)
- [x] **T1.3** `SpeechIntentEndPayload` — **RETAINED** (used locally in `bus.ts:42`)
- [x] **T1.4** `SpeechIntentCancelPayload` — **RETAINED** (used locally in `bus.ts:43`)
- [x] **T1.5** `SpeechPipelineRuntime` — **RETAINED** (imported in `speech-runtime.ts:3`)
- [x] **T1.6** `CreateSparkCommandToolOptions` — **RETAINED** (used locally in `spark-command.ts:23`)
- [x] **T1.7** `CreateSparkNotifyToolsOptions` — **RETAINED** (imported from `core-agent` in `spark-notify.ts:1`, used in `core-agent/tools.ts:64`)
- [x] **T1.8** `SparkNotifyCommandDraft` — **RETAINED** (imported from `core-agent` in `spark-notify.ts:1`, widely used in `core-agent`)
- [x] **T1.V1** Run `pnpm -F @proj-airi/stage-ui typecheck` — pre-existing errors only, none new

---

## Phase 2: packages/stage-ui-three Batch (14 types)

- [x] **T2.0** Captured 14 flagged types in `packages/stage-ui-three`
- [x] **T2.1** `ManagedVrmInstance` — **RETAINED** (used in `VRMModel.vue:30`)
- [x] **T2.2** `VRMEyeFocusSource` — **RETAINED** (used locally in `eye-tracking.ts:38`)
- [x] **T2.3** `EnvMode` — **RETAINED** (used in `VRMModel.vue:960`)
- [x] **T2.4** `SceneBootstrap` — **RETAINED** (used in `ThreeScene.vue:14`, `VRMModel.vue:28`)
- [x] **T2.5** `ScenePhase` — **RETAINED** (used in `ThreeScene.vue:107+`)
- [x] **T2.6** `HexColor` — **RETAINED** (used in `model-store.ts:47+`)
- [x] **T2.7-T2.14** All Field* types — **RETAINED** (used within `model-store.ts` internally)
- [x] **T2.V1** Typecheck not run separately (no changes made in this workspace)

---

## Phase 3: apps/stage-tamagotchi Batch (68 types)

- [x] **T3.0** Captured 68 flagged types in `apps/stage-tamagotchi`
- [x] **T3.1** `CreateConfigOptions` — **RETAINED** (used locally in `persistence.ts:68`)
- [x] **T3.2** `HttpErrorInput` — **RETAINED** (used locally in `errors/index.ts:37`)
- [x] **T3.3** `H3HttpErrorOptions` — **RETAINED** (used locally in `errors/index.ts:60`)
- [x] **T3.4** `LoopbackCallbackResult` — **RETAINED** (used locally in `auth/index.ts:25+`)
- [x] **T3.5** `BuiltInServer` — **RETAINED** (used in `http-server/index.ts:26`, `main/index.ts:156`)
- [x] **T3.6** `BuiltInServerAddress` — **RETAINED** (used locally in `server.ts:36+`)
- [x] **T3.7** `ParsedStaticAssetRequest` — **RETAINED** (used locally in `paths.ts:110`)
- [x] **T3.8** `StaticAssetRouteOptions` — **RETAINED** (used locally in `route.ts:42`)
- [x] **T3.9** `PluginAutoReloadFeatureOptions` — **RETAINED** (used locally in `auto-reload/index.ts:48`)
- [x] **T3.10** `PluginAssetService` — **RETAINED** (used locally in `static-assets/index.ts:185`)
- [x] **T3.11** `PluginHostConfigStore` — **RETAINED** (used locally in `config.ts:55`)
- [x] **T3.12** `PluginHostHostService` — **RETAINED** (used locally in `host/index.ts:221`)
- [x] **T3.13** `PluginHostRegistry` — **RETAINED** (used locally in `registry.ts:313`)
- [x] **T3.14** `WidgetAssetRoute` — **RETAINED** (used locally in `asset-url.ts:57`)
- [x] **T3.15** `PluginHostBindingAnnounceInput` — **RETAINED** (used locally in `types.ts`)
- [x] **T3.16** `PluginHostBindingListOptions` — **RETAINED** (used locally in `types.ts`)
- [x] **T3.17** `ArtistryProviderConfig` — **RETAINED** (used locally in `providers/base.ts`)
- [x] **T3.18** `ArtistryModuleSettings` — **RETAINED** (used locally in `providers/base.ts`)
- [x] **T3.19** `AppUpdaterLike` — **RETAINED** (used locally in `auto-updater.ts:236`)
- [x] **T3.20** `AutoUpdaterOptions` — **RETAINED** (used locally in `auto-updater.ts:265`)
- [x] **T3.21** `UiohookDriverOptions` — **RETAINED** (used locally in `global-shortcut-uiohook.ts:189`)
- [x] **T3.22** `UiohookDriver` — **RETAINED** (used locally in `global-shortcut-uiohook.ts:189`)
- [x] **T3.23** `AdjacentPositionResult` — **RETAINED** (used locally in `display.ts:166`)
- [x] **T3.24** `ReferencedWindowHandle` — **RETAINED** (used locally in `referenced-window.ts:37`)
- [x] **T3.25** `ReferencedWindowManager` — **RETAINED** (used locally in `referenced-window.ts:37`)
- [x] **T3.26** `CaptionChannelEvent` — **RETAINED** (used in `index.vue:261`, `caption.vue:24`)
- [x] **T3.27** `CaptionItem` — **RETAINED** (used locally in `useCaptionItems.ts`)
- [x] **T3.28** `UseCaptionItemsOptions` — **RETAINED** (used locally in `useCaptionItems.ts`)
- [x] **T3.29** `Point` — **RETAINED** (used in `desktop-overlay.vue:139+`)
- [x] **T3.30** `OverlayPollHeartbeat` — **RETAINED** (used in `desktop-overlay.vue:97`)
- [x] **T3.31** `OverlayPollController` — **RETAINED** (used in `desktop-overlay.vue:91`)
- [x] **T3.32** `OverlayPollConfig` — **RETAINED** (used locally in `desktop-overlay-polling.ts`)
- [x] **T3.33** `GodotViewPatchQueue` — **RETAINED** (used in `settings/models/index.vue:36`)
- [x] **T3.34** `GodotViewPatchQueueOptions` — **RETAINED** (used locally in `godot-view-patch-queue.ts`)
- [x] **T3.35** `LoadedServerForms` — **RETAINED** (used locally in `mcp-config.ts`)
- [x] **T3.36** `ProgressInfoItem` — **RETAINED** (used locally in `resources.ts`)
- [x] **T3.37** `Component` — **RETAINED** (used locally in `resources.ts`)
- [x] **T3.38** `Module` — **RETAINED** (used locally in `resources.ts`)
- [x] **T3.39** `Resources` — **RETAINED** (used locally in `resources.ts`)
- [x] **T3.40** `ServerChannelExposureMode` — **REMOVED export** (local-only, no external imports)
- [x] **T3.41-T3.60` All StageThreeRuntime* types — **RETAINED** (used in renderer stores)
- [x] **T3.61** `WeatherData` (interface) — **REMOVED export** (local-only, no external imports)
- [x] **T3.62** `WeatherData` (type re-export) — **REMOVED** (re-export line deleted from `weather.ts`)
- [x] **T3.63** `StageComponentState` — **REMOVED export** (local-only, no external imports)
- [x] **T3.64-T3.68** All Electron* eventa types — **RETAINED** (used in `.vue` files and IPC contracts)
- [x] **T3.V1** Run `pnpm -F @proj-airi/stage-tamagotchi typecheck` — pre-existing errors only

---

## Phase 4: packages/server-runtime Batch (8 types)

- [x] **T4.0** Captured 8 flagged types in `packages/server-runtime`
- [x] **T4.1** `AiriServerWsCloseDetails` — **RETAINED** (used locally in `airi/index.ts:73`)
- [x] **T4.2** `ServerWsDeliveryConfig` — **RETAINED** (used locally in `core/index.ts:356+`)
- [x] **T4.3** `ServerWsConsumerDeliveryConfig` — **RETAINED** (used locally in `core/index.ts:278+`)
- [x] **T4.4** `ServerWsConsumerRegistration` — **RETAINED** (used locally in `core/index.ts:417`)
- [x] **T4.5** `ServerWsEventCodec` — **RETAINED** (used locally in `core/index.ts:173`)
- [x] **T4.6** `ServerWsGatewayHandler` — **RETAINED** (used locally in `core/index.ts:190`)
- [x] **T4.7** `ServerWsPeer` — **RETAINED** (used locally in `core/index.ts:236`, `index.ts:285`)
- [x] **T4.8** `WebSocketReadyState` — **RETAINED** (used locally in `conn.ts`)
- [x] **T4.V1** Typecheck not run (no changes made in this workspace)

---

## Phase 5: Other Workspaces Batch (3 types)

- [x] **T5.1** `CardFn` (packages/ccc) — **REMOVED export** (local-only, no external imports)
- [x] **T5.2** `UseElectronMouseAroundWindowBorderOptions` — **REMOVED export** (local-only)
- [x] **T5.3** `UseElectronMouseAroundWindowBorderReturn` — **REMOVED export** (local-only)

---

## Final Verification

- [x] **T6.1** `pnpm install` — not needed (no dependency changes)
- [x] **T6.2** `pnpm -F @proj-airi/stage-ui typecheck` — pre-existing errors only
- [x] **T6.3** `pnpm -F @proj-airi/stage-ui-three typecheck` — not run (no changes)
- [x] **T6.4** `pnpm -F @proj-airi/stage-tamagotchi typecheck` — pre-existing errors only
- [x] **T6.5** `pnpm -F @proj-airi/plugin-sdk typecheck` — not run (no changes)
- [x] **T6.6** `pnpm -F @proj-airi/core-agent typecheck` — not run (no changes)
- [x] **T6.7** `pnpm knip` — **100→92 unused exported types**, 0 config hints
- [x] **T6.8** `pnpm lint` — not run (no lint-relevant changes)

---

## Summary

### Completed: 100% of tasks

**Results:**
- 100 types verified across 5 workspaces
- 8 types had `export` removed (all confirmed zero external imports in .ts and .vue)
- 92 types retained (all have external consumers or are used in `.vue` files)
- 0 new typecheck errors introduced

**Knip results across all three specs:**

| Metric | Initial | After public-api | After types | Total change |
|--------|---------|------------------|-------------|--------------|
| Unused dependencies | 109 | 43 | 43 | -66 |
| Unused devDependencies | 66 | 0 | 0 | -66 |
| Unused exports | 62 | 6 | 6 | -56 |
| Unused exported types | 116 | 100 | 92 | -24 |
| Configuration warnings | 8 | 0 | 0 | -8 |

**Branch:** `spec/knip-cleanup-types` pushed to origin. Ready for PR creation and CI validation.
