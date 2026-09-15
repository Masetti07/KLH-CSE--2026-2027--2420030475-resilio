# Day 3 Design Persistence

## Data model

SQLite stores each design in the `designs` table with `id`, `plan_id`, `name`, timestamps, normalized JSON configuration, and the latest optional analysis. The configuration contains design wall height, per-wall appearance, per-room floor appearance, per-opening door/window settings, per-room semantic assignments, and optional orientation (`0`, `90`, `180`, or `270`). Three.js objects are never stored.

IDs in configuration maps are validated against the referenced structural plan. Invalid wall, room, or opening references receive HTTP 409. Pydantic also validates colours, dimensions, preset values, and orientation.

## API

- `GET /api/plans/{plan_id}/designs`
- `POST /api/plans/{plan_id}/designs`
- `GET /api/designs/{design_id}`
- `PUT /api/designs/{design_id}`
- `POST /api/designs/{design_id}/duplicate`
- `DELETE /api/designs/{design_id}`
- `POST /api/designs/{design_id}/vastu-analysis`

New plans receive a local `Design 1` when the workspace first loads designs. Save updates the name and complete configuration. Save As/Duplicate copies normalized configuration into a new record without copying stale analysis. Deletion requires explicit browser confirmation; deleting the last design creates a fresh default design.

Room names and semantic types are design-specific overrides. A new configuration takes any structural values as optional initial hints; after that, the design configuration is authoritative for Design Studio and Traditional Vastu Rule Analysis. This avoids silently merging two changing semantic sources. Loading a saved design restores its height, room assignments, appearance, orientation, and its own latest valid analysis.

## Unsaved-state policy

The frontend compares the active name/configuration with its last saved snapshot. It labels changes, warns before switching designs or replacing the plan, and installs a page-unload warning. Analysis saves current configuration first so orientation and room semantics evaluated by the backend match persisted state. Any configuration edit clears the active analysis in both frontend state and the persisted design on save.

Selecting a different source file is a session boundary. After the unsaved-change confirmation (when needed), the frontend immediately clears the processed result, structural history, selection, renderer input, design editor, comparison IDs, Vastu result/overlay, and old restoration pointer. It does not delete saved plans or designs from SQLite. A failed processing attempt leaves the cleared session in an explicit error state and never restores the previous plan.
