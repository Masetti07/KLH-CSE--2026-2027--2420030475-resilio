# Security Plan

This is a Phase 0 plan, not a claim that controls are implemented or verified.

Future upload handling must enforce:

- Allowlisted image types and independent content validation.
- Configurable size and resource limits.
- Safe generated filenames rather than trusting user-supplied paths.
- Path normalization and traversal prevention.
- Isolated upload and temporary-processing locations with controlled cleanup.
- Predictable failure responses that do not expose internals or sensitive paths.

Secrets, credentials, tokens, API keys, and private environment files must never be committed. Local SQLite data, runtime uploads, temporary files, and logs are excluded from version control. Dependencies and containers are planned to receive automated vulnerability checks, including Trivy, with results recorded only after real execution.
