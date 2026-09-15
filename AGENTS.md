# ResilioSpace Development Instructions

Read this file before every task in this repository.

## Scope and dependencies

- Keep the repository generic: never add personal, institutional, academic-course, or supervisor details.
- Use only free/open-source dependencies. Do not require paid APIs, commercial CAD services, cloud platforms, or an external database unless the user explicitly changes the scope.
- V1 supports clean PNG/JPG, single-floor, top-down residential plans with visible walls, predominantly orthogonal geometry, and common/simple openings. Never imply arbitrary plans can be reconstructed perfectly.

## Architecture

- The renderer-independent structural model is the source of truth. It must represent Plan, Walls, Rooms, Doors, Windows, Materials, Orientation, and Metadata.
- Derive the 2D editor, Three.js scene, Vastu analysis, persistence, recovery, and comparison from that model. Never use Three.js objects as the primary data model.
- Expose automatic-detection uncertainty and preserve a path to manual correction.

## Vastu policy

- Call the feature “Traditional Vastu Rule Analysis.” Treat it as informational and cultural-reference material, never scientific, engineering, safety, legal, structural, or architectural advice.
- Each rule must define `id`, `title`, `room_type`, `preferred_zones`, `description`, `severity`, `source_reference`, and `enabled`.
- Include the required disclaimer in every user-facing Vastu experience.

## Security and reliability

- Never commit credentials, passwords, tokens, API keys, private `.env` files, or sensitive user data.
- Validate upload type, file content, and size; generate safe filenames; prevent path traversal; and isolate runtime/temporary files.
- Handle failures explicitly, provide accessible error states, preserve keyboard usability, and do not rely on color alone to communicate status.
- Design recovery around multiple validated snapshots and previous-valid-snapshot restoration.

## Testing and evidence

- Add proportionate automated tests for every implementation change, including success, failure, validation, and recovery paths where relevant.
- Run applicable tests and checks before reporting completion. Document commands and actual outcomes.
- Never fabricate accuracy, confidence, performance, security, experiment, or test results. Store only genuinely generated artifacts in `results/`.
- Never claim a feature is implemented, working, secure, accessible, or verified until direct inspection or execution supports the claim.

## Git and documentation

- Codex may perform safe Git inspection, staging, commits, fetches, and normal non-force pushes under the dual-repository workflow below.
- Update documentation when contracts, behavior, setup, limitations, security controls, or test procedures change.
- Mark planned work as planned and distinguish prototypes from production-ready behavior.

## Dual repository workflow

1. ResilioSpace has one local, common implementation. Do not create subject-specific copies of the application.
2. The common implementation is intended to be synchronized to two GitHub repositories.
3. Remote `ase` represents the ASE submission repository.
4. Remote `cloud` represents the Cloud/CNAD submission repository.
5. Codex is authorized to perform safe Git inspection, staging, commits, fetches, and normal non-force pushes.
6. Commit only meaningful milestones after their applicable validation passes.
7. After a milestone passes validation, normally synchronize the same common implementation and commit to both compatible repositories.
8. Never force-push or use force-with-lease.
9. Never destructively rewrite published history.
10. Never automatically delete remote branches, tags, or repositories.
11. Never commit credentials, tokens, passwords, private environment files, local virtual environments, `node_modules`, temporary files, runtime uploads, processing artifacts, or machine-specific state.
12. Common source code and common documentation must remain subject-neutral.
13. Subject-specific submission documentation may be prepared separately later without forking the application implementation.
14. If the repositories diverge unexpectedly or contain incompatible history, stop and report the divergence instead of resolving it destructively.
