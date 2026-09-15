# Structural Model

The Day 1 structural model is the source of truth exposed by the backend. It contains normalized, renderer-independent data and no OpenCV contours, matrices, or renderer scene objects.

## Plan

- `id`: safe UUID assigned by the service.
- `source_dimensions`: positive pixel width and height.
- `normalized_dimensions`: unit-space width and height, currently `1.0 × 1.0`.
- `overall_confidence`: bounded `0.0–1.0` heuristic estimate.
- `processing_metadata`: pipeline version, ordered stages, warnings, and runtime debug-artifact references.
- `walls`, `rooms`, `openings`: normalized candidate collections.

## Wall

Walls have unique IDs; normalized start/end coordinates; normalized thickness; and bounded confidence. Coordinates are constrained to `0.0–1.0`.

## Room

Rooms have an ID, polygon of at least three normalized points, optional user-facing name and type, and bounded confidence. Day 1 leaves name and type unset.

## Opening

Openings have an ID, optional known wall ID, normalized position and width, probable type (`door`, `window`, or `unknown`), and bounded confidence. The Day 1 repair classifies best-effort door swing and window-marker candidates in supported clean plans. Final wall runs are split around these candidates so openings remain meaningful to future structural consumers.

## Persistence and projections

SQLAlchemy stores plan lifecycle metadata and the validated structural document in SQLite. The frontend reads this document and projects it into SVG. Neither SQLite records nor SVG elements add geometry that is absent from the model. Future editing, visualization, analysis, recovery, and comparison must continue to operate through this contract.
