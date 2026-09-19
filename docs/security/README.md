# Security Plan

This original security plan is supplemented by the [Day 6 focused review](security-review.md). The review documents implemented controls, actual checks, findings, and limits; it is not a penetration test.

Future upload handling must enforce:

- Allowlisted image types and independent content validation.
- Configurable size and resource limits.
- Safe generated filenames rather than trusting user-supplied paths.
- Path normalization and traversal prevention.
- Isolated upload and temporary-processing locations with controlled cleanup.
- Predictable failure responses that do not expose internals or sensitive paths.

Secrets, credentials, tokens, API keys, and private environment files must never be committed. Local SQLite data, runtime uploads, temporary files, and logs are excluded from version control. Day 6 adds a Trivy repository scan in CI; its findings and any local scan results are recorded only after real execution. Container image vulnerability scanning remains outside this focused filesystem scan.
