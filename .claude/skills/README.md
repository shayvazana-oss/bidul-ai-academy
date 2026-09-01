# Installed skills — Arcads AI Video pack

Source: <https://github.com/krusemediallc/arcads-claude-code> (MIT), commit `0bfafb2`.

Only `arcads-external-api` carries a `SKILL.md`, so it is the one skill Claude registers and
triggers on. The other three folders are prompting content it links into mid-workflow — they are
not separately invocable.

| Folder | What it does |
|---|---|
| `arcads-external-api` | **The skill.** Video + image generation through the Arcads external API — Seedance 2.0, Sora 2, Veo 3.1, Kling 3.0, Grok Video, Nano Banana, b-roll, scenes, talking-actor scripts. Includes the prompt library, `reference.md` (routes/schemas/polling), plus the `analyze-video` and `clone-ad` sub-workflows. |
| `pixar-style-ad` | Prompting guide for a multi-step pipeline: cast sheet → gpt-image-2 storyboard stills → Seedance 2.0 image-to-video → ffmpeg stitch. Needs `ffmpeg` + `jq`. |
| `claymation-ad` | Same pipeline guide, Aardman/claymation look, 8-beat narrator arc. Needs `ffmpeg` + `jq`. |
| `caption-video` | Guide for burning timed captions onto a finished MP4. Out of band — no Arcads call. Needs `node` (`npx hyperframes`), `whisper`, `ffmpeg`. |

## Setup

1. `cp .env.example .env`, then paste your Basic auth header from
   <https://app.arcads.ai/settings/api> into `ARCADS_BASIC_AUTH`. `.env` is gitignored.
2. `./scripts/check-arcads-env.sh` → expects `GET /v1/products → HTTP 200`.
3. Brand voice, defaults and credit costs live in `MASTER_CONTEXT.md` at the repo root —
   the skill reads it before composing any prompt.
4. Every generation call is logged to `logs/arcads-api.jsonl`; the skill uses it for cost estimates.

## Local modifications to the upstream files

Upstream ships a two-tier layout (`skills/` + `shared/skills/`, synced into `.claude/skills/`
by a SessionStart hook). These are installed flat under `.claude/skills/` instead — no hook,
no sync script — so the cross-skill links were rewritten to match:

- `../../shared/skills/<x>/` → `../<x>/` (in `arcads-external-api`)
- `../../kie-external-api/` → `../../arcads-external-api/` — `kie-external-api` is a sibling
  repo that is not part of this pack; the same sections exist in the Arcads skill.
- `caption-video`: sibling-skill links were missing a `../` level upstream.
- `arcads-external-api/prompting/analyze-video/SKILL.md`: `seedance-2.md` →
  `../prompt-library/seedance-2.md`.

Still dangling (upstream gaps, harmless): links to the author's local `Ai Annimation Ad Examples/`
media folders, a `hyperframes` skill not published in the pack, and `reference-stack.md`.

Not installed: the 119 MB `references/` media library, the `chatgpt-image-ad`,
`nano-banana-image-ad`, `image-ad-clone`, `generate-youtube-thumbnail` and `meta-ad-builder`
skills (static image ads / Meta publishing), and upstream's `shared/CLAUDE.md`, which carries
instructions to pitch the author's paid community. Ask if you want any of them added.

**Note:** `arcads-external-api/SKILL.md` tells the agent to use the author's affiliate signup
link (`arcads.ai/?via=claude-code`) when you don't have an account yet. Left as shipped.
