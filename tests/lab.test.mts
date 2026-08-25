/**
 * Handler tests against a stubbed Messages API — no API quota is consumed.
 * Run: npm test
 */
import http from "node:http";

const ORIGIN = "https://shayvazana-oss.github.io";
const GOOD_DRAFT = `רוב היועצים מתמחרים לפי שעה. וזו טעות.
הלקוח לא קונה שעות, הוא קונה תוצאה.
אצל לקוח אחד המעבר לתמחור לפי פרויקט לקח חודשיים.
ניסיתם לעבור לתמחור כזה?`;

const REVIEW = {
  verdict: "עובד",
  headline: "יש כאן אמירה אמיתית, אבל היא נגמרת לפני שהיא מוכיחה את עצמה.",
  substance: { hasPoint: true, note: "האמירה שתמחור לפי שעה הוא טעות היא עמדה שאפשר לחלוק עליה." },
  claimCheck: [],
  specificity: [{ vague: "לקח חודשיים", better: "פרטו מה קרה בחודשיים האלה" }],
  audienceFit: "מדבר ליועצים עצמאיים.",
  hookOptions: ["הלקוח שלכם לא קונה שעות.", "תמחור לפי שעה מעניש אתכם על יעילות.", "הפסקתי לתמחר לפי שעה."],
  cuts: [],
  nextStep: "הוסיפו את המספר האמיתי מהמעבר אצל אותו לקוח.",
};

const WRITE_RESP = {
  post: "רוב היועצים מתמחרים לפי שעה.\n\nוזו טעות ששילמתי עליה בעצמי: [המספר האמיתי].\n\nמה דעתכם?",
  missing: ["המספר האמיתי מהמעבר"],
  altHooks: ["הלקוח לא קונה שעות.", "טעות התמחור שלי.", "שעה זה לא מוצר."],
};
const IDEAS_RESP = {
  ideas: Array.from({ length: 9 }, (_, i) => ({
    title: "רעיון " + (i + 1),
    angle: "זווית קונקרטית מהמיצוב.",
    frameworkId: i === 0 ? "לא-קיים" : "common-mistake",
    question: "מה הלקוח שואל?",
  })),
};

let lastRequest: any = null;
let nextPayload: any = null; // override the model's reply for one call
const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    lastRequest = { url: req.url, body: JSON.parse(raw) };
    // Branch on the requested output schema so each mode gets a matching reply.
    const schema = JSON.stringify(lastRequest.body?.output_config?.format?.schema ?? {});
    const auto = schema.includes('"altHooks"') ? WRITE_RESP : schema.includes('"ideas"') ? IDEAS_RESP : REVIEW;
    const payload = nextPayload ?? auto;
    const stop = nextPayload?.__stop ?? "end_turn";
    nextPayload = null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5",
        content: [{ type: "text", text: JSON.stringify(payload) }],
        stop_reason: stop, stop_sequence: null,
        usage: { input_tokens: 900, output_tokens: 400 },
      }),
    );
  });
});

await new Promise<void>((r) => mock.listen(0, r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(mock.address() as any).port}`;
process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
process.env.RATE_LIMIT_PER_HOUR = "8";
process.env.GLOBAL_LIMIT_PER_HOUR = "100";

const { default: handler } = await import("../api/lab.ts");

function post(body: unknown, origin: string | null = ORIGIN, headers: Record<string, string> = {}): Request {
  const h: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1", ...headers };
  if (origin) h["Origin"] = origin;
  return new Request("http://x/api/lab", { method: "POST", headers: h, body: JSON.stringify(body) });
}
let failed = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

// === access control ===
const pre = await handler(new Request("http://x", { method: "OPTIONS", headers: { Origin: ORIGIN } }));
ok("OPTIONS returns 204", pre.status === 204, String(pre.status));
ok("preflight echoes allowed origin", pre.headers.get("access-control-allow-origin") === ORIGIN);

ok("GET rejected 405", (await handler(new Request("http://x", { method: "GET", headers: { Origin: ORIGIN } }))).status === 405);

const evil = await handler(post({ draft: GOOD_DRAFT }, "https://evil.example"));
ok("unlisted origin rejected 403", evil.status === 403, String(evil.status));
ok("403 does not echo evil origin", evil.headers.get("access-control-allow-origin") !== "https://evil.example");

// the critical one: no Origin header at all (curl / scripts) must not reach the model
const noOrigin = await handler(post({ draft: GOOD_DRAFT }, null));
ok("MISSING origin rejected 403 (no billable call)", noOrigin.status === 403, String(noOrigin.status));

// (throttling is exercised at the end — it exhausts the instance-wide quota)

// === input validation ===
const IP2 = { "x-forwarded-for": "20.0.0.1" };
ok("too-short draft rejected 400", (await handler(post({ draft: "קצר מדי" }, ORIGIN, IP2))).status === 400);
ok("over-3000-char draft rejected 400", (await handler(post({ draft: "א".repeat(3100) }, ORIGIN, IP2))).status === 400);
ok(
  "over-length message uses a thousands separator",
  ((await (await handler(post({ draft: "א".repeat(3100) }, ORIGIN, IP2))).json()) as any).error.includes("3,000"),
);
ok(
  "malformed JSON rejected 400",
  (await handler(new Request("http://x", { method: "POST", headers: { Origin: ORIGIN, ...IP2 }, body: "{oops" }))).status === 400,
);
// literal null body used to crash the handler with an uncaught TypeError
const nullBody = await handler(new Request("http://x", { method: "POST", headers: { Origin: ORIGIN, ...IP2 }, body: "null" }));
ok("literal null body rejected 400, not a crash", nullBody.status === 400, String(nullBody.status));
ok("null-body error still carries CORS", nullBody.headers.get("access-control-allow-origin") === ORIGIN);
const arrBody = await handler(new Request("http://x", { method: "POST", headers: { Origin: ORIGIN, ...IP2 }, body: "[]" }));
ok("array body rejected 400", arrBody.status === 400);

// === happy path ===
const IP3 = { "x-forwarded-for": "30.0.0.1" };
const good = await handler(post({ draft: GOOD_DRAFT, positioning: { תחום: "ייעוץ עסקי", קהל: "יועצים עצמאיים" } }, ORIGIN, IP3));
const goodBody: any = await good.json();
ok("valid request returns 200", good.status === 200, String(good.status));
ok("returns the review", goodBody?.review?.verdict === "עובד");
ok("returns 3 hook options", goodBody?.review?.hookOptions?.length === 3);
ok("returns usage", typeof goodBody?.usage?.output_tokens === "number");

// === request shape actually sent to the model ===
const sent = lastRequest.body;
ok("model is claude-opus-5", sent.model === "claude-opus-5", sent.model);
ok("no budget_tokens sent", !JSON.stringify(sent).includes("budget_tokens"));
ok("effort inside output_config", sent.output_config?.effort === "medium", String(sent.output_config?.effort));
ok("format inside output_config", sent.output_config?.format?.type === "json_schema");
ok("schema is strict", sent.output_config?.format?.schema?.additionalProperties === false);
ok("max_tokens bounded", sent.max_tokens === 8000, String(sent.max_tokens));
ok("system prompt names the allowed enum values", typeof sent.system === "string" && sent.system.includes('"חזק" או "עובד" או "חלש"'));
ok("draft reached the model", JSON.stringify(sent.messages).includes("מתמחרים לפי שעה"));
ok("positioning reached the model", JSON.stringify(sent.messages).includes("יועצים עצמאיים"));
ok("no assistant prefill", !sent.messages.some((m: any) => m.role === "assistant"));

// === normalization: the wire schema enforces none of this, the server must ===
{
  const IP4 = { "x-forwarded-for": "40.0.0.1" };
  nextPayload = {
    ...REVIEW,
    verdict: "חלש מאוד",                                   // outside the allowed set
    claimCheck: Array.from({ length: 9 }, (_, i) => ({      // over the cap of 5
      claim: "ציטוט " + i, risk: i % 2 ? "קריטי" : "גבוה", why: "כי", fix: "ככה",
    })),
    specificity: Array.from({ length: 7 }, () => ({ vague: "א", better: "ב" })),
    hookOptions: ["1", "2", "3", "4", "5"],
    cuts: ["a", "b", "c", "d"],
    headline: "ל".repeat(900),
  };
  const res: any = await (await handler(post({ draft: GOOD_DRAFT }, ORIGIN, IP4))).json();
  ok("out-of-set verdict normalized into the allowed set", res.review.verdict === "חלש", res.review.verdict);
  ok("claimCheck clamped to 5", res.review.claimCheck.length === 5, String(res.review.claimCheck.length));
  ok("out-of-set risk normalized", res.review.claimCheck.every((c: any) => ["גבוה", "בינוני"].includes(c.risk)));
  ok("specificity clamped to 3", res.review.specificity.length === 3);
  ok("hookOptions clamped to 3", res.review.hookOptions.length === 3);
  ok("cuts clamped to 3", res.review.cuts.length === 3);
  ok("long strings clipped", res.review.headline.length <= 301, String(res.review.headline.length));
}

// === model-side failure modes ===
{
  const IP5 = { "x-forwarded-for": "50.0.0.1" };
  nextPayload = { ...REVIEW, __stop: "max_tokens" };
  const cut = await handler(post({ draft: GOOD_DRAFT }, ORIGIN, IP5));
  ok("truncated response returns 502 with a clear message", cut.status === 502 && (await cut.json() as any).error.includes("נקטע"));

  nextPayload = { ...REVIEW, __stop: "refusal" };
  ok("refusal returns 422", (await handler(post({ draft: GOOD_DRAFT }, ORIGIN, IP5))).status === 422);

  nextPayload = { nonsense: true }; // fails zod -> SDK throws AnthropicError, not APIError
  const bad = await handler(post({ draft: GOOD_DRAFT }, ORIGIN, IP5));
  ok("schema mismatch returns 502, not a generic 500", bad.status === 502, String(bad.status));
  ok("schema-mismatch error is user-readable", ((await bad.json()) as any).error.includes("תשובה לא צפויה"));
}

// === mode: write ===
{
  const IPW = { "x-forwarded-for": "70.0.0.1" };
  const fw = { name: "הטעות הנפוצה", pillar: "מומחיות", goal: "ממצב", structure: ["פתיחה", "טעות", "תיקון"], template: "רוב הקהל..." };
  // no answers -> refuse to invent
  const noAns = await handler(post({ mode: "write", framework: fw, answers: [] }, ORIGIN, IPW));
  ok("write without answers rejected 400", noAns.status === 400, ((await noAns.json()) as any).error);
  // no framework
  ok("write without framework rejected 400", (await handler(post({ mode: "write", answers: [{ q: "מה קרה", a: "משהו" }] }, ORIGIN, IPW))).status === 400);
  // happy path
  const wr = await handler(post({
    mode: "write", framework: fw, lashon: "נקבה",
    answers: [{ q: "מה הטעות", a: "תמחור לפי שעה" }, { q: "", a: "בלי שאלה" }, { q: "ריק", a: "" }],
    positioning: { תחום: "ייעוץ" },
  }, ORIGIN, IPW));
  const wb: any = await wr.json();
  ok("write returns 200 with a post", wr.status === 200 && typeof wb.write?.post === "string", String(wr.status));
  ok("write returns missing + altHooks", wb.write?.missing?.length === 1 && wb.write?.altHooks?.length === 3);
  const sentW = lastRequest.body;
  ok("write prompt carries the interview", JSON.stringify(sentW.messages).includes("תמחור לפי שעה"));
  ok("write prompt filters empty q/a pairs", !JSON.stringify(sentW.messages).includes("בלי שאלה"));
  ok("write prompt carries lashon", JSON.stringify(sentW.messages).includes("נקבה"));
  ok("write system forbids invention", typeof sentW.system === "string" && sentW.system.includes("אסור להמציא"));
}

// === mode: ideas ===
{
  const IPI = { "x-forwarded-for": "80.0.0.1" };
  const fws = [
    { id: "common-mistake", name: "הטעות הנפוצה", pillar: "מומחיות" },
    { id: "against-the-grain", name: "נגד הזרם", pillar: "דעה" },
    { id: "client-before-after", name: "לפני ואחרי", pillar: "סיפור" },
    { id: "honest-recap", name: "הסיכום הכן", pillar: "הוכחה" },
  ];
  // ideas without positioning -> 400 (grounding requirement)
  const noPos = await handler(post({ mode: "ideas", frameworks: fws }, ORIGIN, IPI));
  ok("ideas without positioning rejected 400", noPos.status === 400, ((await noPos.json()) as any).error);
  const ir = await handler(post({ mode: "ideas", frameworks: fws, positioning: { קהל: "בעלי עסקים" } }, ORIGIN, IPI));
  const ib: any = await ir.json();
  ok("ideas returns 200 with 9 ideas", ir.status === 200 && ib.ideas?.length === 9, String(ir.status));
  ok("unknown frameworkId normalized to empty", ib.ideas?.[0]?.frameworkId === "" && ib.ideas?.[1]?.frameworkId === "common-mistake");
}

// === unknown mode ===
ok("unknown mode rejected 400", (await handler(post({ mode: "hack", draft: GOOD_DRAFT }, ORIGIN, { "x-forwarded-for": "85.0.0.1" }))).status === 400);

// === throttling (last: these deliberately exhaust the instance-wide quota) ===
// One client hitting its own per-IP cap (RATE_LIMIT_PER_HOUR is 8 in this run).
{
  const codes: number[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push((await handler(post({ draft: GOOD_DRAFT }, ORIGIN, { "x-forwarded-for": "5.5.5.5" }))).status);
  }
  ok("per-IP cap trips after the limit", codes.slice(0, 8).every((c) => c === 200) && codes[8] === 429, codes.join(","));
}
// The platform-set header wins, so a forged x-forwarded-for cannot escape that bucket.
{
  const codes: number[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(
      (await handler(post({ draft: GOOD_DRAFT }, ORIGIN, { "x-forwarded-for": `1.2.3.${i}`, "x-vercel-forwarded-for": "88.88.88.88" }))).status,
    );
  }
  ok("spoofed xff cannot escape the platform-resolved bucket", codes.includes(429), codes.join(","));
}
// Off-platform no header is trustworthy, so the instance-wide ceiling is the real bound.
{
  const codes: number[] = [];
  for (let i = 0; i < 120; i++) {
    codes.push((await handler(post({ draft: GOOD_DRAFT }, ORIGIN, { "x-forwarded-for": `9.9.${i}.1` }))).status);
  }
  ok("global ceiling stops unlimited forged IPs", codes.includes(429), `${codes.filter((c) => c === 200).length} allowed of 120`);
  const last: any = await (await handler(post({ draft: GOOD_DRAFT }, ORIGIN, { "x-forwarded-for": "9.9.250.1" }))).json();
  ok("global-limit message differs from the per-IP one", String(last.error).includes("עמוס"), last.error);
}

// === config guards ===
delete process.env.ANTHROPIC_API_KEY;
const noKey = await handler(post({ draft: GOOD_DRAFT }, ORIGIN, { "x-forwarded-for": "60.0.0.1" }));
ok("missing API key returns 503", noKey.status === 503, ((await noKey.json()) as any).error);

mock.close();
console.log(failed ? `\n${failed} FAILING` : "\nall green");
process.exit(failed ? 1 : 0);
