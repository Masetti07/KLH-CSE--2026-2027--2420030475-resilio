# Floor-Plan Processing Foundation

## Status

Implemented and verified on Day 1 for clean, supported synthetic PNG plans and API-generated PNG/JPG fixtures. The pipeline is best-effort and is not an architectural drawing interpreter.

## Secure intake

`POST /api/plans/upload` accepts multipart files with `.png`, `.jpg`, or `.jpeg` extensions. Intake checks the extension, reads no more than 10 MB plus one sentinel byte, verifies image content with Pillow, requires the decoded format to match the extension, enforces minimum dimensions and a 25-megapixel limit, and decodes independently with OpenCV. The original user filename is retained only as display metadata. Storage paths use server-generated UUIDs and server-selected extensions.

Runtime uploads, SQLite data, and debug artifacts live in ignored directories. The processed-preview endpoint accepts only the fixed artifact names `threshold`, `cleaned`, and `edges`; it does not accept filesystem paths.

## Pipeline stages

The orchestration in `app/processing/pipeline.py` calls focused transformations in `app/processing/stages.py`:

1. Decode validation.
2. Grayscale conversion.
3. CLAHE contrast normalization.
4. Adaptive thresholding.
5. Morphological cleanup.
6. Canny edge extraction.
7. Contour extraction.
8. Probabilistic Hough line extraction for diagnostics.
9. Directional dark-ink morphology that converts thick orthogonal runs to center lines.
10. Near-duplicate removal using normalized axis and endpoint tolerances.
11. Collinear merging across raster gaps no larger than `0.010`, with axis proximity limited to `0.012`.
12. Door/window detection and opening-aware final wall segmentation.
13. Contour-based room candidates, followed by geometry-based removal of large enclosing contours that duplicate multiple contained room regions.
14. Heuristic confidence estimation and warnings.

Threshold, cleaned, and edge images are retained as runtime debug artifacts. Detection output is converted immediately into the implementation-independent structural schema.

## API surface

- `GET /health` reports service availability.
- `POST /api/plans/upload` validates, processes, persists, and returns plan metadata plus structure.
- `GET /api/plans/{plan_id}` returns persisted plan metadata.
- `GET /api/plans/{plan_id}/structure` returns the normalized structural model.
- `GET /api/plans/{plan_id}/artifacts/{artifact_name}` returns an allowlisted processing preview.

## Failure behavior

Invalid extensions, empty uploads, malformed content, content/extension mismatches, small dimensions, and resource-limit violations produce controlled client errors. When processing fails after storage, the just-written upload is removed and the database transaction is not committed.

## Known limitations

- Orthogonal center-line consolidation is designed for the supported clean-plan scope; skewed, curved, or unusually thin walls may be omitted.
- Room contours are geometric candidates and are not semantically classified.
- Room counts come directly from the valid polygons in `StructuralPlan.rooms`; filenames and sample names never determine the count. The enclosing-duplicate filter rejects a large contour only when it contains at least two substantially smaller candidates whose combined area covers most of it. In the deterministic `sample_simple_1bed.png`, the former fourth candidate was the whole-plan interior overlapping the three generated regions, so the valid detected count is three.
- Door detection uses swing-arc/leaf component geometry near walls. Window detection combines thin wall-aligned marker geometry with optional synthetic marker color support; arbitrary blueprint symbols may be missed or misclassified.
- Opening-driven wall splitting is best-effort, so a candidate with an inaccurate position or width can create an inaccurate structural gap.
- Confidence is a bounded heuristic based on candidate evidence, not a calibrated accuracy probability.
- Text, furniture, dimension lines, skew, low contrast, and non-orthogonal geometry may reduce result quality.
- Manual correction is planned but not implemented.
