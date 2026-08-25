/**
 * End-to-end: browser -> the real review-post handler -> a stubbed Messages API.
 * Serves linkedin-lab.html and the function from one origin so the page's fetch
 * exercises the same path it will in production.
 */
import http from "node:http";
import fs from "node:fs";
import { chromium } from "playwright";

const PAGE = "/home/user/bidul-ai-academy/linkedin-lab.html";
const DRAFT = `רוב היועצים מתמחרים לפי שעה. וזו טעות.

הלקוח לא קונה שעות, הוא קונה תוצאה. ראיתי את זה אצל עשרות לקוחות.

המעבר לתמחור לפי פרויקט הכפיל לי את ההכנסות תוך חודש, וזה יעבוד לכל אחד.

ניסיתם לעבור לתמחור כזה?`;

const REVIEW = {
  verdict: "עובד",
  headline: "האמירה חדה, אבל שתי הבטחות בפוסט יפילו אתכם בשאלה הראשונה.",
  substance: { hasPoint: true, note: "הטענה שתמחור לפי שעה מזיק ליועץ היא עמדה שאפשר לחלוק עליה." },
  claimCheck: [
    { claim: "הכפיל לי את ההכנסות תוך חודש", risk: "גבוה", why: "מספר בלי בסיס שאי אפשר להראות.", fix: "תארו מה השתנה בפועל בלי להתחייב למכפיל." },
    { claim: "וזה יעבוד לכל אחד", risk: "בינוני", why: "הכללה שסותרת את הניסיון שלכם עצמכם.", fix: "כתבו למי זה מתאים ולמי לא." },
  ],
  specificity: [{ vague: "ראיתי את זה אצל עשרות לקוחות", better: "ציינו ענף אחד ומקרה אחד קונקרטי" }],
  audienceFit: "מדבר ליועצים עצמאיים, אבל לא אומר באיזה שלב בעסק.",
  hookOptions: ["הלקוח שלכם לא קונה שעות.", "תמחור לפי שעה מעניש אתכם על יעילות.", "הפסקתי לתמחר לפי שעה. לא הכול היה טוב."],
  cuts: ["וזה יעבוד לכל אחד"],
  nextStep: "החליפו את המכפיל בתיאור קונקרטי של מה שהשתנה.",
};

// --- stub Messages API ---
const upstream = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      id: "msg_e2e", type: "message", role: "assistant", model: "claude-opus-5",
      content: [{ type: "text", text: JSON.stringify(REVIEW) }],
      stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1200, output_tokens: 600 },
    }));
  });
});
await new Promise<void>((r) => upstream.listen(0, r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(upstream.address() as any).port}`;
process.env.ANTHROPIC_API_KEY = "sk-ant-e2e";
process.env.ALLOWED_ORIGINS = "http://127.0.0.1:8787";
process.env.RATE_LIMIT_PER_HOUR = "50";

const { default: handler } = await import("../api/review-post.ts");

// --- site + function on one origin ---
const site = http.createServer(async (req, res) => {
  if (req.url?.startsWith("/api/review-post")) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://127.0.0.1:8787${req.url}`, {
      method: req.method,
      headers: req.headers as any,
      body: req.method === "POST" ? Buffer.concat(chunks).toString() : undefined,
    });
    const out = await handler(request);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  let html = fs.readFileSync(PAGE, "utf8");
  if (req.url?.includes("connected")) {
    html = html.replace('<meta name="lab-api" content="">', '<meta name="lab-api" content="/api/review-post">');
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise<void>((r) => site.listen(8787, r));

const ok = (label: string, cond: boolean, extra = "") =>
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1380, height: 950 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));

// === 1. endpoint NOT configured — must degrade gracefully ===
await page.goto("http://127.0.0.1:8787/lab", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.fill("#draft", DRAFT);
await page.waitForTimeout(300);
const localScore = await page.textContent("#dScore");
ok("local form checker still scores without API", localScore !== "—", `score ${localScore}`);
await page.click("#aiRun");
await page.waitForTimeout(400);
const notWired = (await page.textContent("#aiStatus")) ?? "";
ok("unconfigured endpoint explains itself", notWired.includes("לא מחוברת"), notWired.slice(0, 45));
ok("unconfigured shows no results panel", !(await page.locator("#aiOut").evaluate((e) => e.classList.contains("on"))));

// === 2. endpoint configured — full round trip ===
await page.goto("http://127.0.0.1:8787/lab?connected", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
// positioning from station 2 must reach the API
await page.fill("#w-קהל", "יועצים עצמאיים");
await page.fill("#w-תחום", "ייעוץ תמחור");
await page.fill("#draft", DRAFT);
await page.waitForTimeout(300);

const short = await page.evaluate(async () => {
  const el = document.querySelector("#draft") as HTMLTextAreaElement;
  const keep = el.value;
  el.value = "קצר";
  el.dispatchEvent(new Event("input"));
  (document.querySelector("#aiRun") as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r, 300));
  const msg = document.querySelector("#aiStatus")?.textContent ?? "";
  el.value = keep;
  el.dispatchEvent(new Event("input"));
  return msg;
});
ok("client blocks too-short drafts before calling API", short.includes("40 תווים"), short.slice(0, 40));

await page.click("#aiRun");
await page.waitForSelector("#aiOut.on", { timeout: 20000 });
ok("results panel opens", await page.locator("#aiOut").evaluate((e) => e.classList.contains("on")));
ok("verdict badge rendered", (await page.textContent(".ai-badge"))?.trim() === "עובד");
ok("headline rendered", ((await page.textContent(".ai-headline")) ?? "").includes("שתי הבטחות"));
ok("both claim cards rendered", (await page.locator(".ai-claim").count()) === 2);
ok("high-risk claim styled distinctly", (await page.locator(".ai-claim.r-\\gבוה, .ai-claim").first().getAttribute("class"))?.includes("r-"));
ok("claim fix shown", ((await page.textContent(".ai-claim .f")) ?? "").includes("בלי להתחייב"));
ok("generic->concrete swap rendered", (await page.locator(".ai-swap").count()) === 1);
ok("3 hook options rendered", (await page.locator(".ai-hook").count()) === 3);
ok("cuts rendered", (await page.locator(".ai-list li").count()) === 1);
ok("next step rendered", ((await page.textContent(".ai-next")) ?? "").includes("מכפיל"));
ok("spinner cleared after success", await page.locator("#aiStatus").evaluate((e) => (e as HTMLElement).style.display === "none"));
ok("button re-enabled", !(await page.locator("#aiRun").isDisabled()));

const hookCopy = await page.locator(".ai-hook .copybtn").first().getAttribute("data-copy");
ok("hook copy button carries the text", (hookCopy ?? "").includes("לא קונה שעות"));

// mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
ok("no mobile horizontal overflow", !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)));
await page.setViewportSize({ width: 1380, height: 950 });
await page.locator(".airev").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/claude-0/-home-user-bidul-ai-academy/17896887-5337-5994-9484-fe76adb2b018/scratchpad/v3-ai-review.png" });

// === 3. server error surfaces to the user ===
await page.route("**/api/review-post", (r) =>
  r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "הגעתם למכסת הביקורות לשעה." }) }));
await page.click("#aiRun");
await page.waitForTimeout(700);
ok("server error message surfaced", ((await page.textContent("#aiStatus")) ?? "").includes("מכסת הביקורות"));
ok("error state styled as error", await page.locator("#aiStatus").evaluate((e) => e.classList.contains("err")));

console.log("JS errors:", errors.length ? errors : "none");
await browser.close();
site.close();
upstream.close();
