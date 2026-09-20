# ResilioSpace

## Overview

ResilioSpace is a prototype platform for turning clean, top-down 2D residential floor plans into normalized structural representations. Day 6 adds continuous integration, security scanning, a focused security review, and reproducible adaptation experiments to the Day 1–5 workflow.

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

Day 1–6 implement local processing, correction, visualization, design versions, comparison, orientation, the documented traditional-rule prototype, MAPE-K adaptation, self-healing, autosave, the Control Center, controlled fault simulation, Prometheus metrics, local containers, CI validation, and reproducible experiments. The following broader capabilities remain planned:

- Longer-term observability dashboards and retention policy work.
- Production deployment and broader performance/security evaluation.

## Planned Technology Stack

- Frontend: React, Vite, Three.js, `@react-three/fiber`, and `@react-three/drei`.
- Backend: Python 3.12+, FastAPI, OpenCV, NumPy, Pillow, SQLAlchemy, SQLite, `prometheus_client`, and pytest.
- Adaptive engine: Python implementation of a MAPE-K-inspired architecture.
- DevOps and observability: Git, Docker, Docker Compose, Prometheus, GitHub Actions, and Trivy.

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

**Day 6 - CI/CD, Security and Reproducible Experiments**

Implemented functionality includes the prior processing, correction, 2D/3D/design/Vastu/compare workflow plus measured MAPE-K modes, render-quality reduction, 2D fallback, bounded retries, validated snapshots, stability-gated recovery, an explainable Control Center, five reversible Resilience Lab simulations, Prometheus metrics, local containers, CI validation, and generated experiment evidence. CI validates container-ready delivery; deployment remains manual/local. See [Day 6 CI](docs/architecture/ci-cd.md), [experiments](docs/experiments/day-6-experiments.md), [security review](docs/security/security-review.md), and [Day 6 testing](docs/testing/day-6.md).

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

## Docker Compose

With Docker Desktop running:

```powershell
docker compose config
docker compose build
docker compose up -d
```

Open the frontend at `http://localhost:8080`, the backend at `http://localhost:8000`, and Prometheus at `http://localhost:9090`. Stop the stack with `docker compose down`. The backend runtime, including prototype SQLite state and uploaded sources, is stored in a named volume.
