# Day 2 Interactive 3D Reconstruction

## Structural-model source of truth

Three.js objects are rendering output only:

```text
Normalized StructuralPlan
        ↓
utils/geometry.ts transformation
        ↓
React Three Fiber meshes
```

No Three.js mesh is persisted or used to update authoritative geometry. Corrections, opening classifications, and wall height flow from the structural model into a fresh React rendering projection.

## Coordinate transformation

The transformation layer uses a plan scale of 10 approximate world units:

- Normalized 2D `x` maps to world `X` as `(x - 0.5) × 10`.
- Normalized 2D `y` maps to world `Z` as `(y - 0.5) × 10`.
- The plan center `(0.5, 0.5)` becomes the world origin `(0, 0, 0)`.
- World `Y` is vertical. The floor is centered at approximately `Y = 0`.
- Global wall height defaults to 3.0 approximate units and is stored as `wall_height` in the structural model.

Dimensions are approximate/normalized because the input does not establish an architectural scale.

## Wall meshes

For each structural wall, the transformation layer calculates world-space length, midpoint, angle, and thickness. A rectangular box mesh is centered at the midpoint, raised by half the global wall height, and rotated around world Y. Structural thickness is scaled when available, with a documented minimum of 0.12 world units.

## Openings

Day 1 already splits final wall geometry around detected opening candidates. Day 2 therefore renders simplified door, window, or unknown-marker geometry in those structural gaps rather than embedding them in an authoritative solid wall. Doors use an opaque brown panel, windows use a translucent blue panel raised to a sill, and unknown candidates use an amber marker. Reclassification in the 2D editor immediately changes this projection.

## Floor, camera, and selection

The floor, camera, and grid are derived from the current wall bounds rather than a fixed sample or fixed 10 × 10 presentation. The bounds utility calculates the generated model's center, width, depth, height, and enclosing radius. A room, opening, or normalized-plan fallback is used only when a structure has no walls.

Perspective framing places the camera on an elevated diagonal and uses the limiting horizontal/vertical field of view plus a safety margin. Top framing separately fits width and depth to the current canvas aspect ratio. Both paths derive clipping planes and OrbitControls minimum/maximum distances from the same bounds. Reset recomputes the perspective frame, including after wall-height changes; Top and 3D/Perspective are also adaptive.

The source panel and inspector can collapse without removing their state, and viewport-filling 3D mode hides non-essential layout chrome while preserving controls, selection, and Escape-to-exit behavior. Walls, rooms/floor, doors, and windows remain selectable through shared React state.

## Failure boundary

The 3D subtree is wrapped in a React error boundary. A renderer exception presents Retry and Return to 2D actions while leaving the structural model and saved corrections intact.

## Known limitations

- Opening panels are symbolic, not photorealistic or construction-ready models.
- Room overlays use bounding rectangles rather than triangulated room polygons.
- There are no ceilings, furniture, stairs, roofs, materials, or lighting controls.
- Bounding-box framing guarantees a consistent safe fit, but exact visible pixel occupancy varies with the building aspect ratio and viewing angle.
- The initial JavaScript bundle includes Three.js and triggers Vite's 500 kB chunk-size warning; code splitting is future optimization work.
