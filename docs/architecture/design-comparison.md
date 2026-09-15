# Day 3 Design Comparison

Comparison uses two persisted design configurations for the same plan. The summary compares wall height, wall/floor finish distributions, door/window styles, assigned-room count, North orientation, and the latest Traditional Vastu Rule Match Score when available.

To avoid two simultaneous WebGL scenes, the visual comparison uses one Three.js viewer and an explicit **Show Design A / Show Design B** toggle. The active label identifies the configuration currently projected. Structural geometry is shared and remains unchanged; only the selected normalized design configuration changes.

Unsaved draft changes are intentionally absent from comparison until saved. This keeps comparisons reproducible and tied to persisted versions.
