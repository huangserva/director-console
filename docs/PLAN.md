# Director Console — Build Plan

Maps the PRD (`digital-human-video-pipeline/`) onto the real assets copied into this repo.

## Reality vs PRD

The PRD's idealized `apps/console-api|web` + `packages/*` mostly already exist as
`hyperframes-composer`. ~70% of the packaging backend is built and verified (memos-v3).

| PRD module | Real asset here | Status |
| --- | --- | --- |
| `packagingPlan` | `hyperframes-composer/manifests/*.json` | ✅ verified |
| `component-registry` | `components/catalog.json` + `registry.mjs` | ✅ |
| `hyperframes-generator` | `scripts/compose.mjs` | ✅ |
| `protocol` validation | `scripts/manifest-rules.mjs` + `schemas/` | ✅ |
| pipeline stage runners | the three `codex-skills/` | ✅ (CLI/skill form) |
| `console-api` | `apps/console-api/` (Node http) | ✅ M0 endpoints live |
| `console-web` | `console-web/` (Vite+React, M0 web shell) | ✅ wired to confirmed contract, verified vs live API |
| `recipe / workflow-run / checkpoint` | — | ❌ build |

## Milestones

- **M0 — Web shell over the working composer.** Thin API (`list/load/save manifest`,
  `compose`, `lint`, `render` = exec existing npm scripts) + minimal web (load manifest →
  list scenes → edit one card's props → recompose → show lint/inspect). No TTS/DUIX.
  - _Web shell (`console-web/`) done 2026-06-12:_ Vite+React, generic props-text editor
    (flatten string/number leaves to dotted-path inputs), scene_type constrained to
    `catalog.json`, `/api` proxy → `:4099` (no CORS).
  - _Contract converged 2026-06-12:_ `console-api` landed; `console-web` README + `api.ts`
    now match the **confirmed** contract (PUT 422 `{error,failures}` surfaced in Lint panel;
    compose `{ok,code,previewUrl,stdout,stderr,...}`; manifest-scoped inspect echoes `name`).
    Verified end-to-end against the live API (list/get/PUT-200+422/compose/preview/lint/inspect).
    No residual contract mismatch. (Live `inspect` returns `ok:false` in this env — the heavy
    hyperframes CLI needs a render/browser setup; a contract-shape concern, not a web bug.)
- **M1 — Route B** (finished video → ASR → manifest → render). Least new infra; proves shell.
- **M2 — recipe + workflow-run + checkpoint** schemas (PRD §11 fields).
- **M3 — Route A** full digital-human chain (script-first → TTS → duix-heygem → ASR → composer).
- **M4 — Packaging Studio** expansion toward `director-packaging-console-ui` reference.
- **M5 — Product-introduction recipe.**

## Open Questions — recommended defaults (to confirm)

1. **Default ASR** → FunASR / Paraformer via
   `/opt/homebrew/Caskroom/miniconda/base/envs/cosyvoice/bin/python`; raw Paraformer ONNX
   models exist under `~/.config/hive` but are not the default until a `sherpa_onnx`/ONNX
   wrapper is verified. Whisper.cpp small is the fallback.
2. **Default TTS** → CosyVoice3 master API (`http://127.0.0.1:4090`, already in composer `.env.example`),
   voice = source-clone zero-shot reference (do not alter the production master).
3. **Execution model** → start synchronous + persisted stage logs; defer task queue to post-MVP.
4. **Minimum preview** → generated HTML preview first (composer already emits `index.html`); MP4 later.
5. **Recipe/theme location** → project-level first; promote to global `templates/` once stable.

## Orchestration split

- Production (TTS / ASR / DUIX / render) → Codex workers via the three codex-skills.
- Console engineering (API + web shell, recipe/workflow layer) → fullstack workers.
- Claude orchestrates + reviews; does not run production itself.
