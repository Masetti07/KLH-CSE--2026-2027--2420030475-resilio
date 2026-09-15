# Testing Strategy

Executed application evidence is recorded in [Day 1](day-1.md), [Day 2](day-2.md), [Day 3](day-3.md), and [Day 4](day-4.md).

The planned testing approach includes:

- Unit tests for structural-model validation, geometry, rules, adapters, and recovery decisions.
- API and integration tests for uploads, processing, persistence, fallbacks, and error handling.
- Frontend tests for editing, accessible interactions, uncertainty display, and failure states.
- Deterministic tests for MAPE-K mode transitions and recovery policies.
- End-to-end tests using original synthetic sample plans.
- Security checks, dependency scanning, container scanning, and path/file validation tests.
- Reproducible performance and resilience experiments with recorded configuration and raw outputs.

Only actually executed results may be reported. Future test documentation must identify the command, environment, inputs, outcome, and known limitations.
