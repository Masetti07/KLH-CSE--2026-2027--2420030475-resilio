# Project Overview

ResilioSpace is a planned prototype for converting supported 2D residential floor-plan images into an editable structural representation and a simplified interactive 3D visualization. It aims to help non-specialist users understand space, explore appearance choices, compare design versions, and view transparent Traditional Vastu Rule Analysis.

## Intended workflow

1. Validate a clean PNG or JPG floor-plan image.
2. Preprocess the image and detect walls, room regions, and simple openings on a best-effort basis.
3. Report reconstruction confidence and uncertainty.
4. Build a renderer-independent structural model.
5. Allow manual inspection and correction in a 2D editor.
6. Derive a simplified interactive 3D view from the same model.
7. Apply appearance choices, save versions, compare designs, and run optional Vastu analysis.

## Initial scope

V1 is limited to clean, single-floor, top-down residential plans with clearly visible walls, predominantly orthogonal geometry, and common/simple door and window symbols. Arbitrary architectural drawings and perfect reconstruction are explicitly outside the promise of the system.

## Adaptation and resilience research

A MAPE-K-inspired engine is planned with NORMAL, PERFORMANCE, DEGRADED, and RECOVERY modes. It will investigate confidence-aware processing, rendering-performance adaptation, graceful degradation, controlled recovery, validated autosave snapshots, fallbacks, and observable decisions. A controlled Resilience Lab is planned for reproducible failure simulations. None of these features is implemented in Phase 0.

## Guiding constraints

- The structural model is the source of truth.
- Automatic results expose uncertainty and remain correctable.
- The stack remains free to use and locally reproducible.
- Security, accessibility, error handling, testing, and evidence accompany implementation.
- Claims about results come only from actual execution.
