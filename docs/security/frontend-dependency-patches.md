# Frontend dependency security patches

Reviewed on 2026-11-02. Application source, assets, renderer configuration and
security workflow settings are unchanged.

| Dependency path | Previous | Resolution |
| --- | --- | --- |
| Vite | 7.3.6 | 7.3.7; retain the Vite 7 release line |
| Vite → PostCSS → source-map-js | 1.2.1 | 1.2.2, pinned with an npm override |
| Vitest → tinypool | 3.2.7 → 1.1.1 | Vitest 4.1.12 removes Tinypool entirely |

The npm registry had no published Tinypool 1.2.2 backport. Vitest 3.2.7 declares
`tinypool: ^1.1.1`; forcing Tinypool 2.x would bypass that compatibility contract.
The two critical advisories are [worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)
and [run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr); 2.1.1 alone
does not fix the second advisory. Removing Tinypool through the supported
[Vitest 4 pool migration](https://v4.vitest.dev/guide/migration.html#pool-rework)
addresses both without an incompatible transitive override.

Vitest 4.1.12 supports Vite 7 and the existing Node 22 environment. It also includes
the fixes for [Vitest UI access](https://github.com/advisories/GHSA-5xrq-8626-4rwp),
[mocker redirect traversal](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), and
[manual mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8).
The other patches address [Vite file access](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22)
and [source-map-js denial of service](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
Only the required test-runner dependency graph and the two targeted runtime/build
dependencies were updated. No vulnerability suppression or severity change was made.

## Validation

From `src/frontend`, the following checks were executed once after installation:

```text
npm test -- --maxWorkers=2 src/App.test.tsx src/components/FurnitureLibrary.test.tsx src/components/FurnitureLibraryInteractions.test.tsx src/components/ThreeViewer.test.tsx src/components/PlanSvgOpeningDrag.test.tsx src/components/PropQuickEdit.test.tsx src/components/PropMeshes.test.tsx src/utils/floorPropDrag.test.ts src/utils/glbFurniture.test.js src/utils/materialTextures.test.ts src/utils/openingReassignment.test.tsx
npx tsc --noEmit
npm run build
```

- Focused tests: 151 passed across 11 files.
- TypeScript: passed.
- Production build: passed; existing large-chunk warning remains.
- `npm ls vite vitest source-map-js tinypool --all`: Vite 7.3.7, Vitest 4.1.12,
  source-map-js 1.2.2; no Tinypool dependency.
- Final `npm audit --json`: zero known vulnerabilities, including development dependencies.
- Trivy was not available on PATH. Its unchanged CI scan must still verify the
  result with its own advisory database; npm audit is not a substitute for Trivy.

The installed npm 10 resolver hit an internal optional-peer resolution error.
A temporary npm 11.6.2 runner completed installation without changing global npm,
using `--ignore-scripts` and without `--force` or `--legacy-peer-deps`.
These are point-in-time dependency checks, not a general security guarantee.
