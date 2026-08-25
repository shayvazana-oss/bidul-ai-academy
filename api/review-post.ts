import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const config = { runtime: "nodejs", maxDuration: 60 };

/** LinkedIn's own hard cap on post length. */
const MAX_DRAFT_CHARS = 3000;
const MAX_FIELD_CHARS = 200;

/**
 * Origins allowed to call this endpoint. The API key lives here, so an open
 * CORS policy would let anyone spend it. Set ALLOWED_ORIGINS to a comma-
 * separated list to override.
 */
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  "https://shayvazana-oss.github.io,http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Per-instance throttle. Serverless instances are recycled and requests spread
 * across them, so this stops casual hammering rather than a determined abuser —
 * a shared KV store is the upgrade when this endpoint goes wide.
 */
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR ?? 12);
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
  }
  return false;
}

const Review = z.object({
  verdict: z
    .enum(["חזק", "עובד", "חלש"])
    .describe("הערכה כוללת של הפוסט: חזק / עובד / חלש"),
  headline: z
    .string()
    .describe("משפט אחד שאומר מה הפוסט הזה באמת עושה — או לא עושה — לקורא"),
  substance: z.object({
    hasPoint: z.boolean().describe("האם יש בפוסט אמירה אמיתית שאפשר לחלוק עליה"),
    note: z.string().describe("2-3 משפטים: מה האמירה, או למה אין כאן אמירה"),
  }),
  claimCheck: z
    .array(
      z.object({
        claim: z.string().describe("הציטוט המדויק מהפוסט"),
        risk: z.enum(["גבוה", "בינוני"]).describe("כמה מסוכן לפרסם את זה"),
        why: z.string().describe("משפט אחד: למה אי אפשר לעמוד מאחורי זה"),
        fix: z.string().describe("איך לנסח את זה כך שכן אפשר לעמוד מאחוריו"),
      }),
    )
    .describe(
      "הבטחות, מספרים או קביעות שהכותב לא יוכל להגן עליהן אם ישאלו. מערך ריק אם אין",
    ),
  specificity: z
    .array(
      z.object({
        vague: z.string().describe("השורה הכללית מדי, ציטוט מדויק"),
        better: z.string().describe("אותה שורה בניסוח קונקרטי"),
      }),
    )
    .describe("שורות גנריות שאפשר להחליף במשהו ספציפי. עד 3"),
  audienceFit: z
    .string()
    .describe("משפט או שניים: האם זה מדבר לקהל היעד שהוגדר, ומה חסר"),
  hookOptions: z
    .array(z.string())
    .describe("3 שורות פתיחה חלופיות שנובעות מהתוכן שנכתב בפועל"),
  cuts: z.array(z.string()).describe("שורות או קטעים שכדאי למחוק, עם ציטוט. עד 3"),
  nextStep: z.string().describe("הפעולה האחת שתשפר את הפוסט הזה הכי הרבה"),
});

const SYSTEM = `אתה עורך תוכן ותיק שמלווה מקצוענים ישראלים בכתיבה ללינקדאין, עבור "האקדמיה לבינה מלאכותית יישומית".

התפקיד שלך: לתת ביקורת תוכן כנה — לא עידוד. אתה קורא את הטיוטה בעיניים של קורא סקפטי שגולל מהר.

עקרון הבית, והוא הכי חשוב: כל מספר, הבטחה או קביעה שהכותב לא יוכל להגן עליה בשאלה הראשונה — חייבת לרדת או להשתנות. זה כולל אחוזי הצלחה, "הכי טוב בארץ", תוצאות לקוחות בלי בסיס, וכל סטטיסטיקה בלי מקור. סמן אותן ב-claimCheck.

איך אתה שופט:
- אמירה אמיתית: פוסט טוב אומר משהו שמישהו יכול לחלוק עליו. פוסט שכולם מסכימים איתו הוא רעש.
- ספציפיות: "לשפר תהליכים" זה כלום. "לקצר את סבב האישורים משבוע ליומיים" זה משהו.
- קול אישי: אם אפשר להחליף את שם הכותב ושום דבר לא משתנה — זו בעיה.
- כנות: פוסט שמודה במשהו קשה עובד יותר מפוסט שמתפאר.

כללים לתשובה:
- כתוב עברית ישראלית טבעית, בפנייה לרבים (אתם/כתבו/שקלו).
- בכל ציטוט מהפוסט — צטט מדויק, אל תמציא מילים שלא נכתבו.
- אל תמציא עובדות, מספרים או פרטים על הכותב שלא הופיעו בטיוטה או במיצוב.
- hookOptions חייבות לנבוע מהתוכן שכבר נכתב — לא רעיונות לפוסט אחר.
- אם הטיוטה ריקה מתוכן, אמור זאת ישירות ב-headline. אל תרכך.
- אל תעיר על אורך, אימוג'ים, האשטגים או שורות רווח — בדיקת הצורה כבר נעשית בנפרד.`;

function cap(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return json({ error: "רק POST נתמך כאן." }, 405, origin);
  }
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "המקור הזה אינו מורשה לקרוא ל-API." }, 403, origin);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(
      { error: "השרת לא מוגדר: חסר ANTHROPIC_API_KEY במשתני הסביבה." },
      503,
      origin,
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return json(
      { error: `הגעתם למכסת הביקורות לשעה (${RATE_LIMIT}). נסו שוב בעוד זמן מה.` },
      429,
      origin,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "גוף הבקשה אינו JSON תקין." }, 400, origin);
  }

  const draft = cap(body.draft, MAX_DRAFT_CHARS + 1);
  if (draft.length < 40) {
    return json({ error: "הטיוטה קצרה מדי לביקורת תוכן (מינימום 40 תווים)." }, 400, origin);
  }
  if (draft.length > MAX_DRAFT_CHARS) {
    return json(
      { error: `הטיוטה ארוכה מ-${MAX_DRAFT_CHARS} תווים — מעל המגבלה של לינקדאין.` },
      400,
      origin,
    );
  }

  const p = (body.positioning ?? {}) as Record<string, unknown>;
  const positioning = {
    תחום: cap(p["תחום"], MAX_FIELD_CHARS),
    קהל: cap(p["קהל"], MAX_FIELD_CHARS),
    בעיה: cap(p["בעיה"], MAX_FIELD_CHARS),
    תוצאה: cap(p["תוצאה"], MAX_FIELD_CHARS),
    הוכחה: cap(p["הוכחה"], MAX_FIELD_CHARS),
  };
  const filled = Object.entries(positioning).filter(([, v]) => v);
  const context = filled.length
    ? filled.map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "(הכותב לא מילא את אשף המיצוב — שפוט את הפוסט על פי עצמו, ואל תמציא לו קהל או תחום.)";

  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 });

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM,
      output_config: {
        format: zodOutputFormat(Review),
        effort: (process.env.REVIEW_EFFORT ?? "high") as "low" | "medium" | "high",
      },
      messages: [
        {
          role: "user",
          content: `המיצוב שהכותב הגדיר לעצמו:\n${context}\n\nהטיוטה לביקורת:\n"""\n${draft}\n"""\n\nתן ביקורת תוכן לפי הסכימה.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return json(
        { error: "המודל נמנע מלנתח את הטיוטה הזו. נסו לנסח אותה אחרת." },
        422,
        origin,
      );
    }
    if (!response.parsed_output) {
      return json({ error: "התקבלה תשובה לא צפויה מהמודל. נסו שוב." }, 502, origin);
    }

    return json(
      {
        review: response.parsed_output,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      },
      200,
      origin,
    );
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: "מפתח ה-API של השרת אינו תקין." }, 500, origin);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: "עומס על ה-API. נסו שוב בעוד דקה." }, 429, origin);
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return json({ error: "הניתוח ארך יותר מדי. נסו טיוטה קצרה יותר." }, 504, origin);
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error", error.status, error.message);
      return json({ error: "שגיאה בשירות הניתוח. נסו שוב." }, 502, origin);
    }
    console.error("Unexpected error", error);
    return json({ error: "שגיאה לא צפויה בשרת." }, 500, origin);
  }
}
