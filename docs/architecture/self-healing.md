# Day 4 self-healing behavior

Self-healing preserves the renderer-independent structural and design models. A renderer failure never deletes walls, openings, room semantics, materials, design versions, or corrections.

## Renderer degradation and recovery

The React error boundary reports `FAILED`, closes fullscreen rendering, unmounts the failed Three.js view, and opens the 2D reconstruction. The Control Center explains that the design is preserved and offers a controlled 3D retry. New healthy renderer summaries move the system through `RECOVERY`; three consecutive healthy observations restore `NORMAL` quality. This hysteresis prevents mode flapping.

## Reconstruction and processing recovery

The upload service retains the validated source bytes while processing. On an unexpected processing exception it performs one bounded enhanced attempt. Low reconstruction confidence also selects one enhanced preprocessing pass, using a larger adaptive-threshold window, a stronger morphological close, and wall extraction from the cleaned image. The better-confidence result is retained. If confidence remains below `0.55`, the Control Center exposes `REQUEST_USER_CORRECTION`; confidence is not inflated or hidden.

The retry count is bounded. If processing still fails, the stored source is removed only for the incomplete new record; the browser-selected source remains available for another user-requested attempt.

## Autosave and corrupted snapshots

The browser saves a working snapshot approximately 1.2 seconds after structural or design state settles. Images are not embedded. Each version-1 snapshot contains:

- plan metadata and plan identifier
- normalized structural model, including walls, rooms, and openings
- wall height and all wall/floor/door/window appearance settings
- room semantics and North orientation
- design identifier/name and creation timestamp

Before write or restore, required types, version, plan identity, geometry collections, and configuration maps are validated. Each plan keeps at most three valid snapshots in local storage.

At startup, ResilioSpace searches newest-to-oldest. An invalid newest entry is not loaded. If an older valid entry exists it is restored and the user is told that the previous valid design state was recovered. If none exists, the persisted backend structure remains the safe baseline and autosave health is reported as failed. Snapshot corruption is recorded as `SESSION_CORRUPTION` in Knowledge.

## Limitations

- Browser local storage is device/browser-profile local and may be cleared by the user or browser.
- Snapshot history is not synchronized between browsers and is not a replacement for named SQLite design versions.
- A lost WebGL context that does not surface through React may depend on subsequent telemetry or browser behavior before it is classified.
- The backend Knowledge history is in memory and resets when the process restarts.
- Day 4 prepares allow-listed simulation seams but does not expose the Day 5 Resilience Lab or create real network/CPU/memory faults.
