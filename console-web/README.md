# Director Console — Web Shell (M0)

The minimal browser UI for the M0 milestone: load a manifest → list its scenes →
edit one card's text props → recompose → preview the generated HTML + lint/inspect.

It is a thin client over the **console-api** (built separately). No business logic
lives here beyond editing text and calling the API.

## Run

```bash
npm install
npm run dev            # Vite dev server on http://localhost:5174
```

The dev server proxies everything under `/api` to the console-api
(`http://127.0.0.1:4099` by default). The browser only ever talks to the Vite
origin, so **the API does not need CORS**. Point at a different API with:

```bash
PASEO_CONSOLE_API=http://127.0.0.1:5000 npm run dev
```

Other scripts: `npm test` (unit tests for the props core), `npm run build`
(typecheck + production bundle into `dist/`).

## What it does (M0 closed loop)

1. `GET /manifests` → manifest dropdown.
2. `GET /manifests/:name` → scene list (`id / component / scene_type / start / duration`).
3. Select a scene → every **string/number leaf** in `props` becomes one input,
   labelled by its dotted path (`stat.title`, `items.0`, …). `scene_type` is a
   dropdown constrained to the component's allowed types from the locked
   `catalog.json`; `component` is read-only. We **only edit text** — we never add,
   remove, or restructure props (timeline/drag editing is M4).
4. **Save** → `PUT /manifests/:name` with the full edited manifest.
5. **Recompose** → `POST /compose/:name`, then preview the generated HTML in an
   iframe at the API-served `previewUrl`. M0 preview is HTML, not MP4.
6. **Lint** / **Inspect** → render the results (lint failures as a list).

Save is auto-run before compose/lint/inspect so the backend always sees the
latest edits. Because the API validates on `PUT` (see below), an invalid edit is
rejected at save time and its failures are shown in the Lint panel.

## API contract (confirmed)

Confirmed against the live console-api (`apps/console-api/src/server.mjs`). All
paths are proxied under `/api`. The reader in `src/lib/api.ts` matches these
shapes directly; the only back-compat read kept is the bare-array fallback for
`GET /manifests`.

| Method & path          | Request body  | Response                                                                                  |
| ---------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `GET /manifests`       | —             | `200 { manifests: string[] }` — names, no `.json` suffix                                  |
| `GET /manifests/:name` | —             | `200` the manifest JSON (has `scenes[]`); `404 { error }` if missing                      |
| `PUT /manifests/:name` | manifest JSON | `200 { ok: true, path }`; **`422 { error, failures: string[] }`** when invalid (not written) |
| `POST /compose/:name`  | —             | `200\|500 { ok, code, previewUrl, htmlPath, output, stdout, stderr, logPath }`            |
| `POST /lint`           | `{ name }`    | `200 { ok, failures: string[] }` — also `POST /lint/:name`                                |
| `POST /inspect`        | `{ name }`    | `200 { ok, code, output, stdout, stderr, logPath, name }` — also `POST /inspect/:name`    |

Notes:

- **`failures` is the lint shape** — the composer's `validateManifest()` returns a
  `string[]`, surfaced verbatim (empty = pass). `PUT` runs the same validation and
  returns those same strings under `failures` on `422`.
- **Preview loads media** because the API serves the composed `index.html` and its
  relative `.mp4`/`.wav` assets under `previewUrl` (`/api/preview/...`).
- **Inspect is manifest-scoped**: the API composes the requested manifest first,
  then inspects, and echoes the `name` back. The web saves the current edits before
  calling Inspect, and the result header shows which manifest it ran against.
- `compose` returns extra fields (`name`, etc.) the client ignores. If the API adds
  or changes a field, align it in `src/lib/api.ts` — one place, no scattering.

## Verification

`src/lib/props.ts` (flatten/apply) is covered by `npm test` (6 tests). The full
HTTP loop was verified **against the live console-api** through the Vite proxy:
list → get → **PUT** (200 `{ok,path}` for a valid manifest; **422 `{error,failures}`**
for an injected illegal `scene_type`) → **compose** (200, real `index.html`, 9
scenes) → **preview** (served HTML) → **lint** (`{ok,failures}`) → **inspect**
(manifest-scoped, echoes `name`).
