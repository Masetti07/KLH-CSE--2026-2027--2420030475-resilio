# Day 5 validation

Day 5 validation covers the five controlled scenarios, recovery hysteresis, preservation of persisted structures/designs, actual PERFORMANCE renderer settings, local autosave rejection/restoration, Prometheus updates, and all existing regression suites.

## Automated checks

Run from the repository root:

```powershell
Set-Location src/backend
../../.venv/Scripts/python.exe -m pytest -q

Set-Location ../frontend
npm test
npx tsc --noEmit
npm run build

Set-Location ../..
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose down
```

The scenario tests assert real MAPE-K history and state transitions. Frontend tests assert that PERFORMANCE changes DPR and shadow cost, and that a malformed newest snapshot is rejected in favor of a valid predecessor. Metrics tests scrape `/metrics` before and after real operations rather than asserting fabricated values.

## Manual smoke test

1. Start the local services or Compose stack and load a supported clean plan.
2. Confirm Reconstruction, 3D View, fullscreen, Design Studio, saved versions, Compare, orientation, and Traditional Vastu Rule Analysis.
3. Open Resilience Lab. Run each scenario individually and inspect Current Mode, Current Condition, Selected Strategy, Adaptation Outcome, and the `SIMULATED CONDITION` banner.
4. For Processing Failure, select a source, activate the scenario, run Detect Structure once, clear it, and retry the still-selected source.
5. For renderer and low-FPS scenarios, clear the scenario and observe RECOVERY remain conservative until three healthy renderer reports complete.
6. For autosave corruption, confirm the rejection/recovery message and preserved geometry/design.
7. Open Control Center and confirm its state/history matches the Lab. Open `/metrics` and query `up{job="resiliospace-backend"}` in Prometheus; it should be `1`.

The prototype supports only the documented V1 input scope. Browser/WebGL behavior still requires a manual check because unit tests do not emulate a real GPU context.

## Manual-browser processing-failure fix

Manual Docker browser validation found that choosing a replacement source correctly discarded the previous reconstruction, but the workspace section navigation was also hidden because it was conditional on a valid structure. After the controlled processing failure, this made Resilience Lab unreachable even though the replacement source and active simulation were correctly preserved.

The navigation is now independent of reconstruction success. Structure, Control Center, and Resilience Lab remain available during empty, processing, and error states. Design Studio, Vastu, and Compare stay visible but disabled until a valid structural reconstruction exists. This preserves stale-state protection while allowing the user to inspect the real `PROCESSING_FAILURE → RETRY_PROCESSING` event, explicitly clear the simulation in Resilience Lab, return to Structure, and retry the same selected source.
