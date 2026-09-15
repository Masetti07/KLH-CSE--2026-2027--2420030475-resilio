# ResilioSpace

## Overview

ResilioSpace is a prototype platform for turning clean, top-down 2D residential floor plans into normalized structural representations. Day 4 adds a measured MAPE-K runtime, adaptive Three.js quality, safe 2D fallback, bounded enhanced processing, local validated snapshots, corrupted-state recovery, and an explainable Control Center to the Day 1–3 workflow.

## Problem Statement

Conventional 2D floor plans can be difficult for non-specialists to interpret spatially. A visual workflow that connects a floor-plan image to an editable model and an interactive 3D view can make layouts easier to explore while preserving uncertainty and user control.

## Proposed Solution

The planned workflow is:

`2D floor plan -> image processing -> editable structural model -> simplified 3D reconstruction -> customization and analysis`

The structural model—not renderer-specific scene objects—is the source of truth for editing, rendering, analysis, persistence, comparison, and recovery. A MAPE-K-inspired adaptive engine monitors confidence, processing health, API behavior, renderer performance, and autosave health to select controlled operating modes.

## Objectives

- Accept and validate supported PNG and JPG floor plans.
- Produce a best-effort structural reconstruction with visible confidence and uncertainty.
- Allow users to inspect and eventually correct walls, rooms, doors, and windows.
- Generate linked 2D and simplified interactive 3D views from one structural model.
- Support appearance customization, saved versions, and design comparison.
- Provide explainable Traditional Vastu Rule Analysis for cultural-reference purposes.
- Provide measured runtime adaptation, graceful degradation, stability-gated recovery, and explainable local observability.
- Maintain a secure, testable, reproducible, free-to-run development workflow.

## Implemented and Planned Features

Day 1–4 implement local processing, correction, visualization, design versions, comparison, orientation, the documented traditional-rule prototype, MAPE-K adaptation, self-healing, autosave, and the Control Center. The following broader capabilities remain planned:

- Controlled Resilience Lab simulations and restoration.
- Prometheus metrics and longer-term observability storage.
- Docker, Docker Compose, GitHub Actions, Trivy, and automated tests.

## Planned Technology Stack

- Frontend: React, Vite, Three.js, `@react-three/fiber`, `@react-three/drei`, and Recharts.
- Backend: Python 3.12+, FastAPI, OpenCV, NumPy, Pillow, SQLAlchemy, SQLite, and pytest.
- Adaptive engine: Python implementation of a MAPE-K-inspired architecture.
- DevOps and observability: Git, GitHub, Docker, Docker Compose, Prometheus, GitHub Actions, and Trivy.

The project will use free and open-source components and will not require paid APIs, commercial CAD services, cloud platforms, or an external database.

## Architecture Overview

The planned architecture centers on a renderer-independent structural model containing plans, walls, rooms, doors, windows, materials, orientation, and metadata.

```text
Floor-plan image
       |
Image processing and confidence assessment
       |
Structural model (source of truth)
       |
       +-- 2D editor
       +-- 3D renderer
       +-- Vastu engine
       +-- persistence and autosave/recovery
       +-- design comparison
```

Three.js scene objects will be derived views and will never become the primary data model. See [docs/architecture/README.md](docs/architecture/README.md) for the planned boundaries.

## Repository Structure

```text
src/          Backend and frontend application source code
docs/         Project, architecture, testing, security, Vastu, and experiment plans
data/         Original synthetic sample plans and generator
results/      Genuine generated results only
reports/      Generic project reports
```

## Development Roadmap

1. Phase 0 — Project foundation and governing documentation.
2. Phase 1 — Structural model contracts and validation.
3. Phase 2 — Secure input and best-effort image-processing pipeline.
4. Phase 3 — Linked 2D editing and simplified 3D reconstruction.
5. Phase 4 — Design tools, persistence, and comparison.
6. Phase 5 — Transparent Vastu analysis.
7. Phase 6 — Adaptation, self-healing, resilience, and observability.
8. Phase 7 — Reproducible evaluation, security checks, and packaging.

Roadmap entries describe intent, not completed functionality.

## Current Status

**Day 4 - MAPE-K Adaptation and Self-Healing**

Implemented functionality includes the Day 1–3 processing, correction, 3D viewer, Design Studio, versions, comparison, room semantics, orientation, and Traditional Vastu Rule Analysis plus measured MAPE-K modes, real render-quality reduction, 2D renderer fallback, bounded enhanced preprocessing, versioned working snapshots, previous-valid-snapshot restoration, stability-gated recovery, system APIs, and an explainable Control Center. See [docs/architecture/mape-k.md](docs/architecture/mape-k.md), [docs/architecture/self-healing.md](docs/architecture/self-healing.md), and [docs/testing/day-4.md](docs/testing/day-4.md).

## Local Development

Prerequisites: Python 3.12+, Node.js, and npm.

Backend, from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\src\backend\requirements.txt
Set-Location .\src\backend
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Frontend, in a second PowerShell window from the repository root:

```powershell
Set-Location .\src\frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The API runs at `http://127.0.0.1:8000`, and its interactive documentation is at `http://127.0.0.1:8000/docs`.

## Limitations

The current prototype targets clean PNG/JPG images of single-floor residential layouts, viewed top-down, with clearly visible walls, predominantly orthogonal geometry, and common/simple door and window representations. It does not promise perfect reconstruction of arbitrary architectural drawings. Automatic detection exposes uncertainty, and manual correction is available.

Traditional Vastu Rule Analysis will be informational and culturally referential. It will not be presented as scientifically validated architectural or structural guidance.

## License/Usage Note

No license has been selected yet. Until a license is added, no permission to copy, modify, or distribute this repository is granted by default. The software is planned as a prototype and must not be treated as architectural, structural, legal, safety, engineering, or scientific advice.
