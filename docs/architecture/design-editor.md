# Day 3 Architectural Design Studio

## Boundary

The Design Studio edits `DesignConfiguration`, not Three.js objects and not detected structural geometry:

```text
StructuralPlan -> DesignConfiguration -> React Three Fiber projection
```

The existing structural editor remains responsible for wall endpoints, room polygons, opening classification, and structural confidence. Design configuration adds appearance, room semantics, North orientation, and a design-specific wall height. While a design is active, `DesignConfiguration.wall_height` is the single effective height used by both sliders and the renderer; the structural height is only the fallback/default used before a design is active. Changing height marks the design unsaved, updates wall geometry live, and does not issue a camera-reset command.

## Material strategy

All patterned presets use locally generated `CanvasTexture` maps with `MeshStandardMaterial`. Paint and Neutral remain clean flat materials. No remote textures, paid assets, external APIs, or runtime downloads are used.

- Walls: Paint, Wood Panel, Brick Style, Concrete Style.
- Floors: Wood, Tile, Marble Style, Concrete, Neutral.
- Doors: Standard, Sliding, Double; configurable normalized width and colour.
- Windows: Standard, Wide, Floor-to-Ceiling; configurable normalized width, approximate height, and tint.

Brick Style draws mortar lines, alternating offset rows, and vertical divisions. Wood Panel and Wood draw alternating local tones, seams, and deterministic grain marks. Tile draws a grid, Marble Style draws subtle veins, and both concrete presets use deterministic mottling. Texture repeats are based on world dimensions (for example, one brick tile per approximately 1.2 × 0.6 normalized world units), so long surfaces repeat more often instead of stretching one pattern. Maps use repeat wrapping, mipmapped linear minification, linear magnification, anisotropic filtering, and sRGB colour space. Textures are memoized per material component and disposed whenever their inputs change or their mesh unmounts. These are visual prototypes, not manufacturer materials or construction specifications.

## Selection and semantics

The shared selection state drives 2D/3D highlighting, the Inspector, and the visible Room Assignments list. Every detected room has separate name and controlled semantic-type fields; selecting a list entry selects the same room used by the renderer and Inspector. Room Assignments is a full-width Design Studio section with responsive rows and readiness counts rather than an internally scrolling sidebar. Pooja room is displayed as “Pooja / Prayer Room.” Manual design semantics are authoritative; structural room name/type values are used only as initial hints when a design configuration is created.

The 2D reconstruction projects each current semantic name at the approximate polygon centroid. A custom name wins, followed by the friendly room-type label and then `Room N`. Labels ignore pointer events so wall/opening editing remains available. Selecting a room surface in 3D shows the same name, type, and detection confidence in the Inspector. Assigning a purpose changes only design metadata associated with an existing room ID; it never creates geometry.

Unknown openings must first be classified in Structure mode. Newly created or reclassified structural elements receive local default design settings through configuration reconciliation.

## Limitations

Room floor meshes use the Day 2 rectangular room projection rather than polygon triangulation. Procedural textures are intentionally stylized rather than photorealistic, doors/windows remain simplified panels, and dimensions remain approximate normalized units.
