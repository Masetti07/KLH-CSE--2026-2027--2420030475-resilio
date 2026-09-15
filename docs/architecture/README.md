# Architecture

This index covers the implemented Day 1–4 prototype and distinguishes later planned systems.

## Source of truth

The planned structural model is renderer-independent and will represent:

- `Plan`
- `Walls`
- `Rooms`
- `Doors`
- `Windows`
- `Materials`
- `Orientation`
- `Metadata`

The 2D editor, Three.js renderer, Traditional Vastu Rule Analysis, persistence, autosave/recovery, and design comparison will consume this model. Three.js scene objects will be disposable projections of model state, never authoritative data.

## Planned components

- A React/Vite frontend for upload, editing, visualization, analysis, comparison, resilience controls, and dashboards.
- A FastAPI backend for validated uploads, processing, model operations, persistence, experiments, and metrics.
- An OpenCV/NumPy/Pillow processing pipeline that returns best-effort geometry plus explicit confidence data.
- SQLite persistence through SQLAlchemy.
- A Python MAPE-K-inspired adaptive engine with monitoring, analysis, planning, execution, and knowledge boundaries (implemented in Day 4).
- Prometheus-compatible observability.

## Planned data flow

```text
Validated image -> preprocessing -> detection + uncertainty
                                      |
                                      v
                              structural model
                        /       /      |       \
                    2D UI   3D view  analysis  persistence/recovery
```

Component contracts, schemas, ownership, and failure semantics will be documented when implementation begins.

Implemented architecture notes:

- [Floor-plan processing](floor-plan-processing.md)
- [Structural model](structural-model.md)
- [Day 2 structural editor](2d-editor.md)
- [Day 2 interactive 3D reconstruction](3d-reconstruction.md)
- [Day 3 Design Studio](design-editor.md)
- [Day 3 design persistence](design-persistence.md)
- [Day 3 design comparison](design-comparison.md)
- [Day 4 MAPE-K adaptation](mape-k.md)
- [Day 4 self-healing and snapshots](self-healing.md)
