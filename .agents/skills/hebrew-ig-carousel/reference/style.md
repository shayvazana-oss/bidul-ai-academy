# Style: "graph-paper orange"

All tokens and helpers live in `templates/base.html`; this file says what they are for.

## Canvas
- 1080×1350 (4:5). Ground `#F6F2EA` with a 54 px graph-paper grid (`#0000000b` lines).
- Step slides add a soft orange radial blob in the top-left corner (`.blob`).

## Type
| Role | Font | Notes |
|---|---|---|
| Headline `h1` | Karantina 700, 150 px (cover 176) | right-aligned at `right:64px; top:132px`, two lines, key words in `<span class="o">` (orange) |
| Underline | `UL(x,y,w)` | hand-drawn orange stroke under the key words, roughly y 440 for a two-line h1 |
| Sub text `.sub` | Heebo 700, 38 px | 2-3 lines, `top:500px`, important phrase in `<b>` (orange) |
| Step number `.num` | Karantina 330 px, transparent with a 5 px orange outline | top-left: `01`, `02`… bonus is `+1` at 250 px |
| Tag `.tag` | Heebo 800 30 px, black pill top-right | `<b>שלב 1</b> · נושא` |
| Hand note `.hand` | Amatic SC 700 52-66 px | one per slide, with `arrow(x,y,size,rot,flip)` when it points at something |
| Code / URLs `.mono` | JetBrains Mono | always LTR-isolated |

## The hero: an app window
`win(x,y,w,title,inner)`: white, 26 px radius, 3 px black border, **hard orange offset shadow 12 px**, traffic lights,
title on the right of the bar. Inside, use:
- `.me` user chat bubble (beige), `.cl` Claude reply row (`claude(42)` + text)
- `.row` list row with icon + label + `.ok` status chip (green "✓ מחובר", or orange "מושהה")
- a dark terminal variant (see slide 3 of the example) for Claude Code / `/mcp`
Windows sit at `left:150px`, width 870, between y≈680 and y≈1100.

## Mascot (8-bit, drawn in code)
`guy(x,y,px,prop,wave,critter)`: square-head pixel guy, orange hoodie, grey shorts; optional orange critter.
Props: `plug` (connecting), `glass` (checking), `pencil` (brief/writing), `list` (checklist), `cam` (images),
`cup` (cover, relaxed). `wave=true` on the CTA. Size: px 5-9 on step slides, 13 on the cover. Keep him clear of
text, windows and the footer (footer band is y > 1260).

## Footer
`foot(i,N)`: Instagram glyph + `HANDLE` bottom-left, bookmark + `שמרו לאחר כך` bottom-right (omitted on the CTA).

## Slide recipes
- **Cover:** tag `מדריך קצר · N שלבים`, three-line h1 (last line orange), a Claude chat window showing the promise
  happening, hand note hook at left (`אתם רק מאשרים`), mascot with `cup`.
- **Step:** blob + num + tag + h1 + UL + sub + one window + one hand note + mascot.
- **Bonus:** like a step, `+1`, tag `בונוס`.
- **CTA:** centered h1 `רוצים את המדריך המלא?`, `תגיבו את המילה`, the word huge in orange (300 px), an Instagram
  comment mock with the word and a red heart, hand note `ואשלח לכם אותו בפרטי, בחינם`, waving mascot.

## Avoid
- Copying another creator's layout or wording. Take the idea, rewrite it, use this design.
- AI-generated slide images with Hebrew text: the letters come out broken or mirrored. That is why this skill renders HTML.
