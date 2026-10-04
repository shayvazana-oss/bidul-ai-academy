---
name: hebrew-ig-carousel
description: Build a Hebrew Instagram carousel (RTL) in a clean "graph-paper orange" style - giant outlined step numbers, real-looking app windows, an 8-bit mascot - rendered locally from HTML to 1080x1350 PNGs with headless Chrome. Exact Hebrew text, no image-generation credits. Use when the user asks for a carousel, קרוסלה, שקפים לאינסטגרם, a step-by-step guide as slides, or wants their own version of a carousel they saw.
---

# Hebrew IG Carousel

Turns a topic, a guide, a reel or a video into a Hebrew Instagram carousel. Slides are built as one HTML page and
screenshotted in headless Chrome, so every Hebrew letter is exact (AI image models break Hebrew) and nothing costs
credits. Created by @shaishot_ai.

| Job | Open |
|---|---|
| Look, colours, fonts, slide anatomy, mascot poses | `reference/style.md` |
| Start a new deck | copy `templates/base.html` |
| A finished 7-slide deck to copy patterns from | `templates/example-meta-ads.html` |
| Render PNGs + contact sheet | `scripts/render.py` |

## First run: settings

Ask the user once, then reuse for the session:
- **Instagram handle** for the footer (goes in `const HANDLE` at the top of the deck's script).
- **Accent colour** (default `#E95223`, set in `const OR` and `--or`).
- **Comment keyword** for the CTA (for example `מדריך`).

## Defaults

- 6-8 slides: **cover → one slide per step → optional bonus → CTA**. Merge small steps. No filler slides.
- CTA = `תגיבו את המילה "<WORD>"` + an Instagram comment mock with the word + `ואשלח לכם אותו בפרטי, בחינם`.
- Deck folder: `./carousels/YYYY-MM-DD-<slug>/` with `carousel.html`, `slides/`, `caption.txt`.
  A redesign goes in `carousel-v2.html` + `slides-v2/` so the old version survives.

## Process

1. **Get the content.** A topic, a guide, a transcript, or a carousel the user liked.
   **Someone else's carousel:** take the idea and the steps only. Rewrite every line in the user's words, merge
   slides, and use this design. Never copy wording or layout.
2. **Plan in chat:** one line per slide (tag, headline, orange key words, the app window it shows, hand note,
   mascot pose). Use the user's cover headline verbatim if they gave one.
3. **Write the deck:** copy `templates/base.html` into the deck folder as `carousel.html`, set `HANDLE`, `N`, one
   `S.push` per slide. Each step slide shows *the real thing happening* inside an app window (a chat, a terminal,
   a settings page, a dashboard), not an icon flowchart.
4. **Render:** `python3 ${CLAUDE_SKILL_DIR}/scripts/render.py carousel.html slides 01_cover,02_step,...`
   Then **look at `slides/contact.jpg`** and fix overlaps (mascot on text, note on the footer, window off-canvas).
   Re-render until clean.
5. **Caption** in `caption.txt`: hook line, 2-3 value lines, the comment-word CTA, `שמרו לאחר כך.`, 5 hashtags.
   No em dashes, no hype words.
6. **Deliver** the PNGs and say which text is illustrative (example budgets, product names, IDs).

## Rules

- Light ground always. Orange only for key words, near-black for the rest.
- Brand marks come from `assets/icons` (simple-icons SVGs as CSS masks). Add more from
  `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/<name>.svg`. Product icons come from lucide via jsDelivr.
  A brand with no public mark gets a dark tile with a white initial.
- Numbers on slides are real/sourced or clearly illustrative, and you say which.
- Hand notes use Amatic SC, which has no Hebrew glyphs, so Hebrew falls back to a narrow system face. If the user
  has a Hebrew handwriting font file, add it with `@font-face` and use it for `.hand`.
- Never post automatically.
