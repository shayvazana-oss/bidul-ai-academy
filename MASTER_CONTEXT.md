# Master context — Arcads creative workspace

One place for humans and agents to keep **brand voice**, **defaults**, **credit costs**, and
**what we learned**. The `arcads-external-api` skill reads this file before composing any prompt.

**Never put API keys here.** Credentials live in `.env` only.

---

## Brand — היחידה ללימודי חוץ

- **Who we are:** ארגון הכשרה מקצועית בישראל, 4 קמפוסים, תעודות בהסמכה ממשלתית, אלפי בוגרים בשנה,
  שותפויות עם התעשייה האווירית (IAI/ELTA) ו-HUBTEC.
- **Audience:** מבוגרים בגילאי 25–50 בישראל שמחפשים הסבה מקצועית או קידום שכר. רובם מגיעים מוואטסאפ,
  פייסבוק ואינסטגרם, בנייד, בעברית.
- **Tone:** ישיר, מעשי, ישראלי. בלי פלאף, בלי תרגומית. מספרים קונקרטיים לפני הבטחות.
- **Words to use:** תעודה בהסמכה ממשלתית, סבסוד, מחיר סופי, שכר ממוצע, השמה, 4 קמפוסים, מקומות אחרונים.
- **Words to avoid:** "הזדמנות של פעם בחיים", "שנה את חייך", סופרלטיבים בלי מספר שמגבה אותם,
  הבטחות תעסוקה שאי אפשר לעמוד בהן.
- **Financial framing (always in this order):** מחיר שוק → סבסוד → **מחיר סופי**. מודגש ב-**₪** ו-**%**.
- **Language:** כל קריאייטיב מיועד לקהל ישראלי → עברית, RTL, מבנה מותאם מובייל.
  ב-Arcads: `language` בעברית כשנתמך; אחרת השחקן מדבר אנגלית והכיתוביות בעברית מתווספות בשלב העריכה.

## My workspace (fill on first run)

- **Default Arcads product** (`productId` → name):
- **Default folder convention:** `Arcads API - YYYY-MM-DD` (נוצר אוטומטית בתחילת סשן).
- **Default aspect ratio:** 9:16 (Reels / Stories / WhatsApp status). 1:1 לפיד.
- **Default duration:** 15s לוואטסאפ, 8–15s לפיד.

## Credit costs (fill from real runs)

Source of truth is `logs/arcads-api.jsonl` (`creditsCharged` per call). Fill the table below once
real numbers exist; until then the agent must say "estimate" and ask before generating.

| Model | Config | ~Credits |
|---|---|---|
| seedance-2.0 | 15s image-to-video | |
| veo31 | | |
| nano-banana-2 | single image | |

## Reference images

Local-only, gitignored (`references/`):
- `references/influencers/` — דמויות/פרזנטורים לשחזור
- `references/products/` — צילומי מוצר (חומרי קורס, קמפוס, תעודה)
- `references/aesthetics/` — לוחות סגנון (ugc-selfie וכו')

## Universal prompting principles

### UGC realism
- **Camera imperfection block** בכל פרומפט UGC: motion blur, overexposure, grain, lens distortion,
  off-center framing, soft focus. בלי זה זה נראה מלוטש מדי ולא עובר כ-UGC.
- **Skin realism block (חובה):** 3–4 רמזים עדינים — "visible pores, slight unevenness in skin tone,
  minor undereye shadows, hint of shine from natural oils". לא להשתמש ב-acne/pimples/blemishes.
- **סדר תמונות ייחוס:** character hero → product → style refs.

### Influencer / character recreation
- תמיד שני שלבים: (1) סטיל, (2) אישור המשתמש, (3) רק אז וידאו מה-startFrame. אין לדלג על האישור —
  וידאו יקר, סטילס זולים לאיטרציה.

### Image QA
- לבדוק ידיים, אצבעות, פנים, אובייקטים ממוזגים, ארטיפקטים. עד 2 ריטריים (3 ניסיונות).

### Video prompting
- **No subtitles, no captions, no text overlays** — להוסיף לכל פרומפט; מודלים רבים שורפים כיתוביות כברירת מחדל.
- **Human motion cues (חובה)** כשיש אדם בפריים: 3–4 רמזים (breaking eye contact, head tilts,
  weight shifts, grip adjustments), אחרת הדמות נראית קפואה.

## Project snapshot — Arcads

- **API base:** `https://external-api.arcads.ai`
- **Auth:** HTTP Basic — `ARCADS_BASIC_AUTH` (header מוכן) או `ARCADS_API_KEY`. ערכים ב-`.env`
  ב-single quotes. בדיקה: `./scripts/check-arcads-env.sh`.
- **Logging:** כל קריאת generation נרשמת ל-`logs/arcads-api.jsonl`.

## Changelog

### 2026-09-01 — Arcads skill installed
- **Decision:** התקנת `arcads-external-api` (+ pixar-style-ad, claymation-ad, caption-video)
  תחת `.claude/skills/` בריפו, כדי שהסקיל יהיה זמין בכל סשן ולא רק בסביבה מקומית.
- **Why:** להריץ הפקת קריאייטיב UGC וידאו מול Arcads ישירות מ-Claude Code, עם קונטקסט המותג כאן.
