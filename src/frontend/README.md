# Frontend

The Day 3 React/Vite interface preserves the structural workspace and adds local Design Studio configuration, named design versions, comparison, room semantics, orientation, and transparent Traditional Vastu Rule Analysis. SVG and Three.js objects remain projections rather than authoritative data.

## Run

```powershell
Set-Location .\src\frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The backend must be running at `http://127.0.0.1:8000` unless `VITE_API_URL` is configured.

The workspace provides Structure, Design Studio, Vastu, and Compare sections alongside the existing editing, persistence, and protected 3D controls.

Design Studio includes eight lightweight home props: Clock, Painting, Bed, Sofa, Table, Armchair, Cupboard, and Flower Vase. Select a wall for wall decor or a room for furniture, then add it from Home Props. The 2D plan supports selecting and dragging room props; selected props can also be rotated, nudged, moved along a wall, or deleted from the panel. The 3D view renders the same saved prop data. Props belong to a design version, are included in working snapshots, and do not affect Traditional Vastu Rule Analysis. Placement is approximate and room movement is constrained to the room's bounding box.

Structure editing offers optional Traditional Vastu Assist. When enabled and North is confirmed, its subtle nine-zone overlay and selected-room guidance update from the current unsaved geometry and room semantics. The preview calls the same backend rule evaluator used by full Traditional Vastu Rule Analysis; it does not save or move rooms. The View Full Analysis action saves pending structural edits before opening the detailed Vastu page. Structural saves invalidate prior stored analysis results.

The introduction links to the existing start screen with upload, three included sample PNG plans, and four local editable starter templates. Samples use the existing upload and OpenCV reconstruction path. Starter templates are created through `POST /api/plans/starters/{kind}` and saved as the same structural plan type as uploads; their geometry is illustrative and can be corrected in the Structure workspace. Blank Plan first asks for width (3–30 m), depth (3–30 m), and wall height (2.2–5 m), then submits these values as JSON to the starter endpoint. The resulting plan has four exterior walls, no rooms or openings, and optional physical dimension metadata in the shared structural model. Other templates retain their existing path. Structure editing offers Free Wall with independently movable endpoints and Straight Wall with an approximate metre length, horizontal or vertical placement, and whole-wall dragging. Plans without physical dimension metadata use an approximate 10 m normalized scale for new straight walls. Starter plans have no original or processed source image. Choosing and creating a replacement plan checks for unsaved changes before replacing the active workspace.

The hero's Start Designing link and Start another plan open the three starting choices without discarding the current plan merely to view them. Creating a new plan replaces the active workspace after the existing unsaved-change check. Blank spaces retain their entered dimensions and wall height in Structure, Design Studio, and 3D. Edit Structure offers a manual rectangular Add Room tool for blank spaces; drag a room to move it or its lower-right handle to resize it inside the exterior boundary, then set its name and type. This is a user-defined region, not inferred enclosure detection. Selecting a wall offers Add Door and Add Window at that wall's midpoint; drag either along the wall. Download 2D Plan exports the current structural walls, rooms, labels, doors, and windows as a clean PNG for later upload. Design Studio also offers quick controls next to the 3D view for a selected prop; direct 3D dragging is not provided.

## Build

```powershell
npm run build
```

Run strict checks and utility tests with:

```powershell
npx tsc --noEmit
npm test
```
