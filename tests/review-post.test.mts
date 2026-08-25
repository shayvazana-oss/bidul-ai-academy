import http from "node:http";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

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
  hookOptions: ["הלקוח שלכם לא קונה שעות.", "תמחור לפי שעה מעניש אתכם על יעילות.", "הפסקתי לתמחר לפי שעה. הנה מה שקרה."],
  cuts: [],
  nextStep: "הוסיפו את המספר האמיתי מהמעבר אצל אותו לקוח.",
};

// Mock Messages API: assert the request shape, return a structured-output response.
let lastRequest: any = null;
const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    lastRequest = { url: req.url, body: JSON.parse(raw) };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-opus-5",
        content: [{ type: "text", text: JSON.stringify(REVIEW) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 900, output_tokens: 400 },
      }),
    );
  });
});

await new Promise<void>((r) => mock.listen(0, r));
const port = (mock.address() as any).port;
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
process.env.RATE_LIMIT_PER_HOUR = "3";

const { default: handler } = await import("../api/review-post.ts");

function post(body: unknown, origin: string | null = ORIGIN, ip = "1.1.1.1"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": ip };
  if (origin) headers["Origin"] = origin;
  return new Request("http://x/api/review-post", { method: "POST", headers, body: JSON.stringify(body) });
}
const ok = (label: string, cond: boolean, extra = "") =>
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);

// --- schema sanity ---
const fmt: any = zodOutputFormat(
  (await import("zod")).z.object({ a: (await import("zod")).z.string() }),
);
ok("zodOutputFormat produces a json_schema format", fmt?.type === "json_schema", JSON.stringify(fmt?.type));

// --- CORS preflight ---
const pre = await handler(new Request("http://x", { method: "OPTIONS", headers: { Origin: ORIGIN } }));
ok("OPTIONS returns 204", pre.status === 204, String(pre.status));
ok("preflight echoes allowed origin", pre.headers.get("access-control-allow-origin") === ORIGIN);

// --- method / origin guards ---
const get = await handler(new Request("http://x", { method: "GET", headers: { Origin: ORIGIN } }));
ok("GET rejected 405", get.status === 405, String(get.status));
const evil = await handler(post({ draft: GOOD_DRAFT }, "https://evil.example"));
ok("disallowed origin rejected 403", evil.status === 403, String(evil.status));
ok("403 does not echo evil origin", evil.headers.get("access-control-allow-origin") !== "https://evil.example");

// --- input validation ---
const short = await handler(post({ draft: "קצר מדי" }));
ok("too-short draft rejected 400", short.status === 400, (await short.clone().json()).error);
const long = await handler(post({ draft: "א".repeat(3100) }));
ok("over-3000-char draft rejected 400", long.status === 400, (await long.clone().json()).error);
const badJson = await handler(
  new Request("http://x", { method: "POST", headers: { Origin: ORIGIN, "x-forwarded-for": "9.9.9.9" }, body: "{oops" }),
);
ok("malformed JSON rejected 400", badJson.status === 400);

// --- happy path ---
const good = await handler(post({ draft: GOOD_DRAFT, positioning: { תחום: "ייעוץ עסקי", קהל: "יועצים עצמאיים" } }, ORIGIN, "2.2.2.2"));
const goodBody = await good.json();
ok("valid request returns 200", good.status === 200, String(good.status));
ok("returns parsed review object", goodBody?.review?.verdict === "עובד", JSON.stringify(goodBody).slice(0, 90));
ok("returns 3 hook options", goodBody?.review?.hookOptions?.length === 3);
ok("returns usage", typeof goodBody?.usage?.output_tokens === "number");
ok("CORS header on success", good.headers.get("access-control-allow-origin") === ORIGIN);

// --- request shape actually sent to the API ---
const sent = lastRequest.body;
ok("model is claude-opus-5", sent.model === "claude-opus-5", sent.model);
ok("no budget_tokens sent", !JSON.stringify(sent).includes("budget_tokens"));
ok("effort inside output_config", sent.output_config?.effort === "high", JSON.stringify(sent.output_config?.effort));
ok("format inside output_config", sent.output_config?.format?.type === "json_schema");
ok("schema is strict", sent.output_config?.format?.schema?.additionalProperties === false);
ok("system prompt sent", typeof sent.system === "string" && sent.system.includes("עקרון הבית"));
ok("draft reached the model", JSON.stringify(sent.messages).includes("מתמחרים לפי שעה"));
ok("positioning reached the model", JSON.stringify(sent.messages).includes("יועצים עצמאיים"));
ok("no assistant prefill", !sent.messages.some((m: any) => m.role === "assistant"));

// --- rate limit (limit is 3/hr, same ip) ---
const ip = "3.3.3.3";
const codes: number[] = [];
for (let i = 0; i < 4; i++) codes.push((await handler(post({ draft: GOOD_DRAFT }, ORIGIN, ip))).status);
ok("rate limit trips on 4th request", codes.slice(0, 3).every((c) => c === 200) && codes[3] === 429, codes.join(","));

// --- missing key ---
delete process.env.ANTHROPIC_API_KEY;
const noKey = await handler(post({ draft: GOOD_DRAFT }, ORIGIN, "4.4.4.4"));
ok("missing API key returns 503", noKey.status === 503, (await noKey.clone().json()).error);

mock.close();
