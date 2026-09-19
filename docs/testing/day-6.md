# Day 6 validation record

Validation on Windows 11, Python 3.12.0, Node 22.23.2, npm 10.9.8, Docker CLI 29.6.2, on 2026-09-19. Commands ran from the repository root unless a directory is shown. Results below are actual local observations; the CI workflow itself is not considered verified until its remote runs are inspected.

| Check | Command | Observed result |
| --- | --- | --- |
| Backend tests | `.\.venv\Scripts\python.exe -m pytest -q src/backend/tests` | PASS: 90 tests with the installed updated dependency pins; 1 Starlette/httpx deprecation warning. |
| Frontend tests | `npm test` in `src/frontend` | PASS: 8 files, 33 tests. |
| TypeScript | `npx tsc --noEmit` in `src/frontend` | PASS. |
| Frontend production build | `npm run build` in `src/frontend` | PASS with Vite 7.3.6; one non-fatal warning about a >500 kB minified chunk. |
| Locked frontend install | `npm ci` in `src/frontend` | PASS: 169 packages installed; npm reported 2 moderate advisories. |
| Frontend dependency audit | `npm audit` in `src/frontend` | 2 moderate advisories in `@vitest/mocker`/Vitest; no HIGH/CRITICAL. The available npm fix requires a Vitest major-version change, so this was not force-applied. This is not a substitute for Trivy. |
| Compose syntax | `docker compose config --quiet` | PASS. |
| Docker images | `docker compose build` | PARTIAL: after Docker Desktop access was restored, the frontend image built successfully. The backend image stalled while downloading Python packages and the attempt was stopped; no complete Compose image-build result or Day 6 runtime smoke result was obtained. |
| Experiments | `.\.venv\Scripts\python.exe scripts/run_day6_experiments.py` | PASS: 5 of 5 bounded experiments after the dependency updates; five JSON records and `results/experiments/day6-summary.csv` generated. |
| Trivy filesystem scan | Official Trivy 0.74.0, `vuln,secret,misconfig`, all severities | Completed: 0 CRITICAL, 1 HIGH, 2 MEDIUM, 1 LOW, 0 UNKNOWN. Dependency: 2 MEDIUM package findings for one Vitest CVE; secrets: 0; misconfigurations: 1 HIGH backend-root and 1 LOW Dockerfile healthcheck. The generated summary is `results/security/security-summary.md`; local raw JSON is intentionally ignored because metadata contains local Git identity. |
| Python dependency advisory review | `pip-audit -r src/backend/requirements.txt` after installing updated pins | PASS: no known vulnerabilities reported. The earlier pre-update report had 61 feed entries/31 unique IDs across four packages. Both raw local JSON audit reports are ignored, not committed. |
| CI workflow lint | `actionlint .github/workflows/ci.yml` (v1.7.12) | PASS: no diagnostics. Remote GitHub Actions runs still require separate inspection. |
| ASE Actions | `ResilioSpace CI` | NOT VERIFIED: CLI authentication unavailable; inspect after push. |
| Cloud Actions | `ResilioSpace CI` | NOT VERIFIED: CLI authentication unavailable; inspect after push. |

The initial sandboxed frontend test/build attempt could not start esbuild (`spawn EPERM`), before any tests executed. Both succeeded when rerun with the required execution permission. The browser-specific 3D canvas unmount and 2D interaction in experiment B remain manual checks; the Python experiment verifies the fallback command and preservation of actual API plan/design data, not a WebGL rendering session. No physical GPU frame-rate improvement is claimed for experiment A. The Vite build emitted a non-fatal large-chunk warning.

A read-only check of the existing `resiliospace_backend-runtime` named volume found its SQLite file and upload/debug directories owned by root. The backend image-user change was therefore removed before commit; it would have made existing Day 5 state inaccessible without an ownership migration.

To finish local Docker validation with a working engine and package-download network, run `docker compose config --quiet`, `docker compose build`, then the Day 5 documented smoke test. Existing Day 5 Docker validation is historical evidence only, not a substitute for a Day 6 runtime rerun. Both GitHub repositories must be checked independently for all four workflow jobs after the common commit is pushed.
