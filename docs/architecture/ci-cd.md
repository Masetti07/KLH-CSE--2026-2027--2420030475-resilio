# Day 6 CI and container-ready delivery

`.github/workflows/ci.yml` runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. It uses read-only repository permissions, GitHub-hosted Ubuntu runners, and four jobs:

| Job | Validation |
| --- | --- |
| Backend | Python 3.12 dependencies, complete pytest suite, reproducible Day 6 experiments and result artifact |
| Frontend | Node 22 `npm ci`, Vitest, TypeScript, production build |
| Security | Trivy filesystem vulnerability/secret/misconfiguration JSON report artifact, then HIGH/CRITICAL gate |
| Container | `docker compose config --quiet` and `docker compose build` |

The first Trivy stage includes all severities, development dependencies, and misconfigurations without hiding unfixed findings. The second stage fails on HIGH/CRITICAL dependency vulnerabilities or secrets, including unfixed ones. Misconfigurations remain visible in the artifact and require explicit review; the known backend-root finding is documented as an accepted local-prototype risk because switching users without migrating the existing root-owned volume would make saved data inaccessible. Runtime dependencies, action versions, and the scanner database can change, so a fresh CI run is authoritative. There is no SARIF upload and no write permission or deployment secret.

This is **continuous integration**, plus validation of images that are ready for **manual local delivery** with Docker Compose. The workflow neither publishes images nor deploys to a cloud or production environment. Operators start the application locally using the documented Compose commands after validation.

The MAPE-K engine is separate: it adapts a running application's render quality, fallback, and recovery based on runtime observations. GitHub Actions runs during software development to test and build a revision; it does not perform runtime self-healing.
