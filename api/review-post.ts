import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const config = { runtime: "nodejs", maxDuration: 60 };

/** LinkedIn's own hard cap on post length. */
const MAX_DRAFT_CHARS = 3000;
const MAX_FIELD_CHARS = 200;

/**
 * Origins allowed to call this endpoint. A missing or unlisted Origin is
 * refused, so drive-by scanners and casual scripts never reach the model.
 *
 * This is a speed bump, not authentication: `curl -H "Origin: <allowed>"`
 * forges it in one line. Real access control needs something the page can
 * prove — a signed short-lived token, Vercel deployment protection, or a
 * Turnstile check. The rate cap below is the actual brake on spend.
 */
const DEFAULT_ORIGIN = "https://shayvazana-oss.github.io";
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  `${DEFAULT_ORIGIN},http://localhost:3000,http://127.0.0.1:3000`
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const FALLBACK_ORIGIN = ALLOWED_ORIGINS[0] ?? DEFAULT_ORIGIN;

/**
 * Per-instance throttle. Serverless instances are recycled and requests spread
 * across them, so this stops casual hammering rather than a determined abuser —
 * a shared KV store is the upgrade when this endpoint goes wide.
 */
function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const RATE_LIMIT = envInt("RATE_LIMIT_PER_HOUR", 12);
/**
 * Instance-wide ceiling. The per-IP cap below can only be as trustworthy as the
 * header it keys on, and off-Vercel nothing stops a caller forging a fresh IP
 * per request. This ceiling doesn't depend on any header, so it bounds the bill
 * even when the per-IP bucket is defeated.
 */
const GLOBAL_LIMIT = envInt("GLOBAL_LIMIT_PER_HOUR", Math.max(RATE_LIMIT * 10, 60));
/** Callers whose IP the platform did not resolve share one stricter bucket. */
const UNKNOWN_IP_LIMIT = Math.max(1, Math.floor(RATE_LIMIT / 4));
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_TRACKED_IPS = 5000;
const hits = new Map<string, number[]>();
let globalHits: number[] = [];

type Throttle = null | "ip" | "global";

function throttled(ip: string): Throttle {
  const now = Date.now();
  const fresh = (ts: number) => now - ts < RATE_WINDOW_MS;

  globalHits = globalHits.filter(fresh);
  if (globalHits.length >= GLOBAL_LIMIT) return "global";

  const limit = ip === "unknown" ? UNKNOWN_IP_LIMIT : RATE_LIMIT;
  const recent = (hits.get(ip) ?? []).filter(fresh);
  if (recent.length >= limit) {
    hits.set(ip, recent);
    return "ip";
  }

  recent.push(now);
  hits.set(ip, recent);
  globalHits.push(now);

  if (hits.size > MAX_TRACKED_IPS) {
    for (const [k, v] of hits) if (!v.some(fresh)) hits.delete(k);
    // Still over after pruning expired entries (a flood of distinct keys):
    // evict oldest-inserted until under the cap. Map preserves insertion order.
    for (const k of hits.keys()) {
      if (hits.size <= MAX_TRACKED_IPS) break;
      if (k !== ip) hits.delete(k);
    }
  }
  return null;
}

/**
 * Only the platform-appended hop is trustworthy. The leftmost x-forwarded-for
 * entry is whatever the client sent, so keying the throttle on it would let one
 * caller mint unlimited buckets by varying the header.
 */
function clientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) return vercel.split(",").pop()!.trim() || "unknown";
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",").pop()!.trim() || "unknown";
  return "unknown";
}

/**
 * NOTE: `zodOutputFormat` only forwards a fixed keyword set to the wire schema
 * (type/description/properties/required/items/...). `enum`, `maxItems` and
 * `maxLength` are demoted into the description as prose, so they guide the model
 * but constrain nothing — and a strict zod type would then *throw* on any drift.
 * So the schema stays permissive and `normalize()` below does the enforcing.
 */
const Review = z.object({
  verdict: z.string().describe('הערכה כוללת במילה אחת: "חזק" או "עובד" או "חלש"'),
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
        risk: z.string().describe('רמת הסיכון במילה אחת: "גבוה" או "בינוני"'),
        why: z.string().describe("משפט אחד: למה אי אפשר לעמוד מאחורי זה"),
        fix: z.string().describe("איך לנסח את זה כך שכן אפשר לעמוד מאחוריו"),
      }),
    )
    .describe(
      "עד 5 הבטחות, מספרים או קביעות שהכותב לא יוכל להגן עליהן אם ישאלו. מערך ריק אם אין",
    ),
  specificity: z
    .array(
      z.object({
        vague: z.string().describe("השורה הכללית מדי, ציטוט מדויק"),
        better: z.string().describe("אותה שורה בניסוח קונקרטי"),
      }),
    )
    .describe("עד 3 שורות גנריות שאפשר להחליף במשהו ספציפי"),
  audienceFit: z
    .string()
    .describe("משפט או שניים: האם זה מדבר לקהל היעד שהוגדר, ומה חסר"),
  hookOptions: z
    .array(z.string())
    .describe("בדיוק 3 שורות פתיחה חלופיות שנובעות מהתוכן שנכתב בפועל"),
  cuts: z.array(z.string()).describe("עד 3 שורות או קטעים שכדאי למחוק, עם ציטוט"),
  nextStep: z.string().describe("הפעולה האחת שתשפר את הפוסט הזה הכי הרבה"),
});

type ReviewOut = z.infer<typeof Review>;

const VERDICTS = ["חזק", "עובד", "חלש"] as const;
const RISKS = ["גבוה", "בינוני"] as const;

function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  const v = value.trim();
  return allowed.find((a) => v === a) ?? allowed.find((a) => v.includes(a)) ?? fallback;
}
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

/** The schema cannot enforce its own limits, so clamp everything before it ships. */
function normalize(r: ReviewOut) {
  return {
    verdict: pick(r.verdict, VERDICTS, "עובד"),
    headline: clip(r.headline, 300),
    substance: { hasPoint: r.substance.hasPoint, note: clip(r.substance.note, 600) },
    claimCheck: r.claimCheck.slice(0, 5).map((c) => ({
      claim: clip(c.claim, 300),
      risk: pick(c.risk, RISKS, "בינוני"),
      why: clip(c.why, 300),
      fix: clip(c.fix, 300),
    })),
    specificity: r.specificity
      .slice(0, 3)
      .map((s) => ({ vague: clip(s.vague, 300), better: clip(s.better, 300) })),
    audienceFit: clip(r.audienceFit, 400),
    hookOptions: r.hookOptions.slice(0, 3).map((h) => clip(h, 200)),
    cuts: r.cuts.slice(0, 3).map((c) => clip(c, 300)),
    nextStep: clip(r.nextStep, 300),
  };
}

const SYSTEM = `אתה עורך תוכן ותיק שמלווה מקצוענים ישראלים בכתיבה ללינקדאין, עבור "האקדמיה לבינה מלאכותית יישומית".

התפקיד שלך: לתת ביקורת תוכן כנה — לא עידוד. אתה קורא את הטיוטה בעיניים של קורא סקפטי שגולל מהר.

עקרון הבית, והוא הכי חשוב: כל מספר, הבטחה או קביעה שהכותב לא יוכל להגן עליה בשאלה הראשונה — חייבת לרדת או להשתנות. זה כולל אחוזי הצלחה, "הכי טוב בארץ", תוצאות לקוחות בלי בסיס, וכל סטטיסטיקה בלי מקור. סמן אותן ב-claimCheck.

איך אתה שופט:
- אמירה אמיתית: פוסט טוב אומר משהו שמישהו יכול לחלוק עליו. פוסט שכולם מסכימים איתו הוא רעש.
- ספציפיות: "לשפר תהליכים" זה כלום. "לקצר את סבב האישורים משבוע ליומיים" זה משהו.
- קול אישי: אם אפשר להחליף את שם הכותב ושום דבר לא משתנה — זו בעיה.
- כנות: פוסט שמודה במשהו קשה עובד יותר מפוסט שמתפאר.

ערכים מותרים, בדיוק כך ובלי שום תוספת:
- verdict: "חזק" או "עובד" או "חלש"
- risk: "גבוה" או "בינוני"

מגבלות אורך שחובה לעמוד בהן: claimCheck עד 5 פריטים, specificity עד 3, cuts עד 3, hookOptions בדיוק 3. כל שדה טקסט — עד 300 תווים.

כללים לתשובה:
- כתוב עברית ישראלית טבעית, בפנייה לרבים (אתם/כתבו/שקלו).
- בכל ציטוט מהפוסט — צטט מדויק, אל תמציא מילים שלא נכתבו.
- אל תמציא עובדות, מספרים או פרטים על הכותב שלא הופיעו בטיוטה או במיצוב.
- hookOptions חייבות לנבוע מהתוכן שכבר נכתב — לא רעיונות לפוסט אחר.
- אם הטיוטה ריקה מתוכן, אמור זאת ישירות ב-headline. אל תרכך.
- אל תעיר על אורך, אימוג'ים, האשטגים או שורות רווח — בדיקת הצורה כבר נעשית בנפרד.`;

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const satisfies readonly NonNullable<
  Anthropic.OutputConfig["effort"]
>[];
/** Thinking tokens bill as output, so the default trades a little depth for predictable cost. */
const EFFORT = EFFORTS.find((e) => e === process.env.REVIEW_EFFORT?.trim()) ?? "medium";

function cap(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : FALLBACK_ORIGIN;
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
  // Deny by default: a missing Origin is a non-browser caller, not a trusted one.
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "המקור הזה אינו מורשה לקרוא ל-API." }, 403, origin);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(
      { error: "השרת לא מוגדר: חסר ANTHROPIC_API_KEY במשתני הסביבה." },
      503,
      origin,
    );
  }

  const throttle = throttled(clientIp(request));
  if (throttle) {
    return json(
      {
        error:
          throttle === "global"
            ? "הכלי עמוס כרגע והגיע למכסת השעה שלו. נסו שוב בעוד זמן מה."
            : `הגעתם למכסת הביקורות לשעה (${RATE_LIMIT}). נסו שוב בעוד זמן מה.`,
      },
      429,
      origin,
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "גוף הבקשה אינו JSON תקין." }, 400, origin);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return json({ error: "גוף הבקשה אינו JSON תקין." }, 400, origin);
  }
  const body = raw as Record<string, unknown>;

  const draft = cap(body.draft, MAX_DRAFT_CHARS + 1);
  if (draft.length < 40) {
    return json({ error: "הטיוטה קצרה מדי לביקורת תוכן (מינימום 40 תווים)." }, 400, origin);
  }
  if (draft.length > MAX_DRAFT_CHARS) {
    return json(
      {
        error: `הטיוטה ארוכה מ-${MAX_DRAFT_CHARS.toLocaleString("he-IL")} תווים — מעל המגבלה של לינקדאין.`,
      },
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

  // timeout x (maxRetries + 1) must fit inside maxDuration, or Vercel kills the
  // invocation mid-retry and the friendly 504 below never gets to run.
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(Review), effort: EFFORT },
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
    if (response.stop_reason === "max_tokens") {
      return json({ error: "הניתוח נקטע באמצע. נסו טיוטה קצרה יותר." }, 502, origin);
    }
    if (!response.parsed_output) {
      return json({ error: "התקבלה תשובה לא צפויה מהמודל. נסו שוב." }, 502, origin);
    }

    return json(
      {
        review: normalize(response.parsed_output),
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
    // AnthropicError is the SDK base class: schema-validation failures land here,
    // not in the APIError branch above.
    if (error instanceof Anthropic.AnthropicError) {
      console.error("structured output parse failed", error.message);
      return json({ error: "התקבלה תשובה לא צפויה מהמודל. נסו שוב." }, 502, origin);
    }
    console.error("Unexpected error", error);
    return json({ error: "שגיאה לא צפויה בשרת." }, 500, origin);
  }
}
