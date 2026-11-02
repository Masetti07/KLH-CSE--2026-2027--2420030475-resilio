# Backend image dependency security patch

Reviewed on 2026-11-02 using the complete Trivy artifacts from both main
repositories (Actions runs 41423203915 and 41423239952). The findings match:
Pillow 12.3.0 has 5 CRITICAL, 23 HIGH and 13 MEDIUM vulnerability entries. No other
package vulnerability or secret finding appears in either complete report.
All 41 Pillow entries specify 13.0.0 as their fixed version.

## Minimal update and compatibility

`src/backend/requirements.txt` changes only `Pillow==12.3.0` to `Pillow==13.0.0`.
It is the only Python dependency manifest in this repository; there is no Python
lockfile. FastAPI 0.141.1, Starlette 1.3.1, OpenCV 4.12.0.88, NumPy 2.2.6 and all
other direct pins remain unchanged.

There is no published 12.3.1 security backport. Pillow 13 is the first fixed
release and requires Python >=3.11, compatible with the existing Python 3.12
runtime. Official wheels are available for Python 3.12 Windows, manylinux and
musllinux. The application uses Image.open(), verify(), format/size inspection,
and OpenCV/NumPy decoding; none of the removed Pillow 13 APIs is used in this path.
See [Pillow 13 release notes](https://github.com/python-pillow/Pillow/blob/13.0.0/docs/releasenotes/13.0.0.rst)
and the [OpenJPEG advisory](https://github.com/advisories/GHSA-78g4-xqwv-q3g8).

## Complete HIGH/CRITICAL dependency inventory

The following inventory retains the CI Trivy severity classifications; upstream
severity labels may differ. Every row affects Pillow 12.3.0 and is fixed in 13.0.0.

| Advisory | Trivy severity |
| --- | --- |
| CVE-2026-112393 | CRITICAL |
| CVE-2026-112398 | CRITICAL |
| CVE-2026-112403 | CRITICAL |
| CVE-2026-112900 | CRITICAL |
| CVE-2026-96639 | CRITICAL |
| CVE-2026-112390 | HIGH |
| CVE-2026-112392 | HIGH |
| CVE-2026-112397 | HIGH |
| CVE-2026-112399 | HIGH |
| CVE-2026-112400 | HIGH |
| CVE-2026-112402 | HIGH |
| CVE-2026-112404 | HIGH |
| CVE-2026-112405 | HIGH |
| CVE-2026-112406 | HIGH |
| CVE-2026-112892 | HIGH |
| CVE-2026-112893 | HIGH |
| CVE-2026-112894 | HIGH |
| CVE-2026-112895 | HIGH |
| CVE-2026-112896 | HIGH |
| CVE-2026-112897 | HIGH |
| CVE-2026-112902 | HIGH |
| CVE-2026-96637 | HIGH |
| CVE-2026-96640 | HIGH |
| CVE-2026-96642 | HIGH |
| CVE-2026-96643 | HIGH |
| CVE-2026-96644 | HIGH |
| CVE-2026-96778 | HIGH |
| GHSA-78g4-xqwv-q3g8 | HIGH |

## Separate existing configuration finding

Both complete reports also show HIGH misconfiguration DS-0002 for the backend
container's root user. It remains documented in [the earlier security review](security-review.md).
It is not a Python dependency vulnerability and is outside the existing
vulnerability/secret gate. This patch does not change container behavior,
scanner settings, severity thresholds or ignore rules. No Docker execution or
frontend test suite is required for this dependency-only update.

## Validation

- A fresh interpreter reports Pillow's Python package and native extension both
  at 13.0.0. All installed direct versions match requirements.txt.
- `python -m pip check`: no broken requirements.
- From `src/backend`, the focused command was:

```text
python -u -m pytest -q -o faulthandler_timeout=60 tests/test_api.py tests/test_processing.py tests/test_processing_repair.py tests/test_structure_editing.py tests/test_starter_plans.py
```

The initial sandboxed attempt stalled without results and was stopped. After
explicit approval for one retry outside the sandbox, all 45 tests passed in
51.74 seconds. One Starlette/httpx TestClient deprecation warning remains; no
framework migration or warning suppression was added.

- `python -m pip_audit -r src/backend/requirements.txt --format json`: 33 resolved
  packages audited on Windows, zero known vulnerabilities. The genuine full audit
  and downloaded CI reports stay in ignored local audit storage, not in Git.
- No frontend suites, Docker execution, or container builds were run.
- Trivy is not available on PATH. The unchanged CI scan must still verify the
  new requirements on Linux with its own advisory database. The separate existing
  Docker root-user warning remains; this is not a claim of a clean configuration scan.

Previously running backend processes need a restart to load the updated native
image library. No running development server was stopped during this update.
