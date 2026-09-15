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

## Build

```powershell
npm run build
```

Run strict checks and utility tests with:

```powershell
npx tsc --noEmit
npm test
```
