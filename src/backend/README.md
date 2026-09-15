# Backend

The backend securely accepts supported PNG/JPG floor plans, runs the stable Day 1 OpenCV pipeline, and persists normalized structural documents in local SQLite. Day 2 adds validated full-document updates through `PUT /api/plans/{plan_id}/structure`, including room metadata, opening corrections, global wall height, and editing revision metadata.

## Run

From the repository root on Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\src\backend\requirements.txt
Set-Location .\src\backend
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`, with interactive OpenAPI documentation at `http://127.0.0.1:8000/docs`.

## Test

```powershell
.\.venv\Scripts\python.exe -m pytest -q .\src\backend
```
