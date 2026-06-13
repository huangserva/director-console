# Director Console M0 Review Notes

Date: 2026-06-12
Role: reviewer
Dispatch: c1d83e74-d49f-43d4-9048-e3186ad74a47

## Scope

Reviewed:

- `apps/console-api/src/server.mjs`, `src/index.mjs`, `test/server.test.mjs`
- `console-web/src/App.tsx`, `src/lib/api.ts`, `src/lib/props.ts`, `src/lib/catalog.ts`, `console-web/README.md`
- `hyperframes-composer/manifests/sample-text.json`
- Baseline docs: `docs/PLAN.md`, `docs/digital-human-video-pipeline/product-requirements.md`, ADRs `0001` to `0003`, `.hive/plan.md`

## Findings

Blocking:

- `POST /inspect` is not manifest-scoped. The web sends `{ name }`, but the API ignores the body and runs the composer `inspect` script against the current generated `index.html`. If the selected manifest differs from the last composed manifest, Inspect can show stale or wrong results. Minimal fix: either make inspect accept a manifest name and compose/point inspect at that output, or make the web require/run compose before inspect and document that inspect is for the current generated preview.

Suggestions:

- `console-web/README.md` and `src/lib/api.ts` still describe the API contract as proposed/tolerant even though the API is now implemented. The residual tolerated alternatives should be trimmed or clearly marked as legacy until removed.
- API tests cover invalid PUT no-overwrite with `component: NotRegistered`, but not illegal `scene_type`. Add a direct API test for a valid component with an invalid `scene_type` to lock the catalog constraint at the HTTP boundary.
- Add a direct preview traversal regression test. Manual checks confirmed encoded `..` escapes outside `hyperframes-composer` are blocked with 403, but the current API test only verifies a normal preview file.
- Malformed percent-encoding in preview paths currently falls through to the generic error path. Consider returning 400 for `decodeURIComponent` failures.
- Worker research notes for this M0 web shell currently exist under `/Users/huangzongning/development/paseo/creative/.hive/...`, not `director-console/.hive/...`. The team should standardize the PM document target directory per dispatch workspace.

## Verification

- `npm test` in `apps/console-api`: 8/8 passing.
- `npm run lint` in `apps/console-api`: passing.
- `npm test` in `console-web`: 6/6 passing.
- `npm run build` in `console-web`: passing.
- Manual preview security smoke:
  - `/api/preview/%2e%2e%2fpackage.json` -> 403
  - `/api/preview/%2e%2e%2fREADME.md` -> 403
  - `/api/preview/%2e%2e%2fapps%2fconsole-api%2fsrc%2fserver.mjs` -> 403
  - `/api/preview/%00` -> 400

## PM Docs

Added this research note and paired HTML report in `director-console/.hive/`.
Added `.hive/open-questions.md` to record the document-location policy question.
