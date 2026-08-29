/**
 * End-to-end: browser -> the real lab handler -> a stubbed Messages API.
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

const AUDIT_RESP = {
  items: [
    { id: "foundation-2", status: "כן", note: "כותרת ממוקדת" },
    { id: "foundation-3", status: "כן", note: "About נפתח בבעיה" },
    { id: "authority-2", status: "לא", note: "תחומי אחריות בלבד" },
    { id: "activity-0", status: "אין מידע", note: "היצוא לא כולל פעילות" },
  ],
  headline: { found: true, quote: "יועץ עסקי בכיר", critique: "תואר, בלי הלקוח ובלי הבעיה.", better: "עוזר לעסקים קטנים לצאת מכאוס תזרימי" },
  about: { found: true, critique: "נפתח בביוגרפיה במקום בבעיית הלקוח.", betterOpening: "רוב העסקים שמגיעים אליי מגלים את החור בתזרים מאוחר מדי." },
  experience: { critique: "התפקידים מתארים אחריות, לא תוצאות." },
  summary: "יש בסיס טוב. הצעד המשתלם עכשיו: להחליף את הכותרת.",
};

const WRITE_RESP = {
  post: "רוב היועצים מתמחרים לפי שעה.\n\nאצלי המעבר לפרויקטים לקח [פרק הזמן האמיתי].\n\nניסיתם?",
  missing: ["פרק הזמן האמיתי של המעבר"],
  altHooks: ["הלקוח לא קונה שעות.", "טעות התמחור שלי.", "שעה זה לא מוצר."],
};
const IDEAS_RESP = {
  ideas: Array.from({ length: 9 }, (_, i) => ({
    title: "רעיון מספר " + (i + 1),
    angle: "זווית שנשענת על המיצוב בלבד.",
    frameworkId: "common-mistake",
    question: "מה הלקוח באמת שואל?",
  })),
};

const WEEKLY_RESP = {
  reading: "המספרים יציבים לחשבון קטן — זה הנורמל, לא כישלון.",
  diagnosis: "צפיות עולות אבל שיחות לא זזות — הפרופיל לא ממיר.",
  experiment: "השבוע: שלוש תגובות ביום על אנשים מרשימת החלומות.",
};
const VOICE_RESP = {
  profile: "- משפטים קצרים, עד 10 מילים.\n- בלי סופרלטיבים.\n- סיום ישיר, בלי מוסר השכל.",
};

// --- stub Messages API (branches per requested schema) ---
const upstream = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const schema = raw.includes('"betterOpening"') ? "audit"
      : raw.includes('"altHooks"') ? "write"
      : raw.includes('"ideas"') ? "ideas"
      : raw.includes('"experiment"') ? "weekly"
      : raw.includes('"profile"') ? "voice"
      : "review";
    const payload = schema === "audit" ? AUDIT_RESP
      : schema === "write" ? WRITE_RESP
      : schema === "ideas" ? IDEAS_RESP
      : schema === "weekly" ? WEEKLY_RESP
      : schema === "voice" ? VOICE_RESP
      : REVIEW;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      id: "msg_e2e", type: "message", role: "assistant", model: "claude-opus-5",
      content: [{ type: "text", text: JSON.stringify(payload) }],
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

const { default: handler } = await import("../api/lab.ts");

// --- site + function on one origin ---
const site = http.createServer(async (req, res) => {
  if (req.url?.startsWith("/api/lab")) {
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
    html = html.replace('<meta name="lab-api" content="">', '<meta name="lab-api" content="/api/lab">');
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
ok("unconfigured: button is disabled, not dead", await page.locator("#aiRun").isDisabled());
const offCopy = (await page.textContent("#checker .airev-h p")) ?? "";
ok("unconfigured: copy is reader-facing", offCopy.includes("אינה פעילה") && offCopy.includes("עובדת כרגיל"), offCopy.slice(0, 50));
ok("unconfigured: no repo plumbing leaks to visitors", !offCopy.includes("api/lab.ts") && !offCopy.includes("docs/"));
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

// verdict/risk reach the class attribute only through a whitelist
ok("verdict class comes from the whitelist", ((await page.locator(".ai-badge").getAttribute("class")) ?? "").includes("v-עובד"));
ok("risk class comes from the whitelist", ((await page.locator(".ai-claim").first().getAttribute("class")) ?? "").includes("r-גבוה"));

// privacy copy must name the third-party hop and drop the absolute claim
const foot = (await page.textContent(".ai-foot")) ?? "";
ok("footnote names the Anthropic hop", foot.includes("Anthropic"), foot.slice(0, 60));
const formCopy = (await page.textContent("#checker .ssub")) ?? "";
ok("form-check copy no longer claims the draft never leaves", !formCopy.includes("לא נשלחת לשום מקום"));
ok("form-check copy scopes the promise to itself", formCopy.includes("רצה כולה בדפדפן"));

// editing the draft must invalidate a rendered review rather than silently disagree
await page.fill("#draft", DRAFT + "\n\nשורה חדשה שנוספה אחרי הניתוח.");
await page.waitForTimeout(300);
ok("stale review is flagged after an edit", (await page.locator(".ai-stale").count()) === 1);
ok("stale review is visually dimmed", await page.locator("#aiOut").evaluate((e) => parseFloat((e as HTMLElement).style.opacity) < 1));
await page.fill("#draft", DRAFT);
await page.waitForTimeout(300);
ok("stale flag clears when the draft is restored", (await page.locator(".ai-stale").count()) === 0);

// a guard rejection must not leave the previous review sitting above the error
await page.fill("#draft", "קצר");
await page.waitForTimeout(200);
await page.click("#aiRun");
await page.waitForTimeout(300);
ok("guard clears the stale review panel", !(await page.locator("#aiOut").evaluate((e) => e.classList.contains("on"))));
ok("guard shows its own message", ((await page.textContent("#aiStatus")) ?? "").includes("40 תווים"));
await page.fill("#draft", DRAFT);
await page.waitForTimeout(200);

// a review missing fields must not render as a clean bill of health
await page.route("**/api/lab", (r) =>
  r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ review: { verdict: "עובד", headline: "בדיקה", substance: {}, nextStep: "המשיכו" } }) }));
await page.click("#aiRun");
await page.waitForSelector("#aiOut.on", { timeout: 20000 });
const body = (await page.textContent("#aiOut")) ?? "";
ok("missing claimCheck does not fake a clean result", !body.includes("לא נמצאו הבטחות"), body.slice(0, 60));
ok("missing hasPoint asserts nothing about the post", !body.includes("אין כאן אמירה"));
ok("present fields still render", body.includes("המשיכו"));
await page.unroute("**/api/lab");

// mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
ok("no mobile horizontal overflow", !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)));
await page.setViewportSize({ width: 1380, height: 950 });
await page.locator("#checker .airev").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/claude-0/-home-user-bidul-ai-academy/17896887-5337-5994-9484-fe76adb2b018/scratchpad/v3-ai-review.png" });

// === 3. server error surfaces to the user ===
await page.route("**/api/lab", (r) =>
  r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "הגעתם למכסת הביקורות לשעה." }) }));
await page.click("#aiRun");
await page.waitForTimeout(700);
ok("server error message surfaced", ((await page.textContent("#aiStatus")) ?? "").includes("מכסת הביקורות"));
ok("error state styled as error", await page.locator("#aiStatus").evaluate((e) => e.classList.contains("err")));

// === 4. guided writer: template gaps become the interview, output is grounded ===
await page.unroute("**/api/lab");
await page.locator("#content").scrollIntoViewIfNeeded();
const writeBtn = page.locator('[data-write]').first();
ok("guided-write button exists when endpoint configured", (await page.locator("[data-write]").count()) === 12);
await writeBtn.click();
await page.waitForTimeout(500);
ok("writer opens", await page.locator("#writerBox").evaluate((e) => e.classList.contains("on")));
const qCount = await page.locator("#writerQs textarea").count();
ok("interview questions derived from template slots", qCount >= 4, `${qCount} questions`);
// no answers -> local guard
await page.click("#writerRun");
await page.waitForTimeout(300);
ok("writer requires at least one answer", ((await page.textContent("#writerStatus")) ?? "").includes("חומר אמיתי"));
// answer one and run
await page.locator("#writerQs textarea").first().fill("תמחור לפי שעה במקום לפי ערך");
await page.click("#writerRun");
await page.waitForSelector("#writerOut.on", { timeout: 20000 });
const wOut = (await page.textContent("#writerOut")) ?? "";
ok("writer renders the drafted post", wOut.includes("מתמחרים לפי שעה"));
ok("writer surfaces missing facts honestly", wOut.includes("פרק הזמן האמיתי"));
ok("writer renders 3 alt hooks", (await page.locator("#writerOut .ai-hook").count()) === 3);
// send to checker
await page.click("#writerToChecker");
await page.waitForTimeout(600);
ok("writer sends draft to checker", ((await page.inputValue("#draft")) ?? "").includes("מתמחרים לפי שעה"));
// save to drawer
await page.locator("#content").scrollIntoViewIfNeeded();
await page.click("#writerToDrawer");
await page.waitForTimeout(300);

// === 5. drafts drawer ===
ok("draft saved to drawer", (await page.locator(".drow").count()) === 1);
const st0 = (await page.textContent(".drow .dstat")) ?? "";
await page.click(".drow .dstat");
await page.waitForTimeout(200);
const st1 = (await page.textContent(".drow .dstat")) ?? "";
ok("status cycles on click", st0.trim() === "טיוטה" && st1.trim() === "מוכן", `${st0.trim()} -> ${st1.trim()}`);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
ok("drawer persists after reload", (await page.locator(".drow").count()) === 1);
ok("status persists after reload", ((await page.textContent(".drow .dstat")) ?? "").trim() === "מוכן");
await page.fill("#draft", DRAFT);
await page.waitForTimeout(200);
await page.click("#drawerSave");
await page.waitForTimeout(200);
ok("save-from-checker adds a second draft", (await page.locator(".drow").count()) === 2);
await page.locator('.drow [data-act="del"]').first().click();
await page.waitForTimeout(200);
ok("delete removes a draft", (await page.locator(".drow").count()) === 1);

// === 6. ideas engine ===
await page.fill("#w-קהל", "יועצים עצמאיים");
await page.waitForTimeout(200);
await page.locator("#ideasBox").scrollIntoViewIfNeeded();
await page.fill("#ideasFocus", "תמחור");
await page.click("#ideasRun");
await page.waitForSelector(".idea", { timeout: 20000 });
ok("9 idea cards rendered", (await page.locator(".idea").count()) === 9);
ok("idea shows the client question", ((await page.textContent(".idea .iq")) ?? "").includes("באמת שואל"));
ok("idea maps to a framework", ((await page.textContent(".idea .tag")) ?? "").includes("הטעות הנפוצה"));
await page.locator("[data-ideawrite]").first().click();
await page.waitForTimeout(500);
ok("idea opens the writer with context", ((await page.textContent("#writerQs")) ?? "").includes("רעיון מספר 1"));

// === 7. ICS export wiring (no download assertion — jsdomless check of the blob path) ===
const icsOk = await page.evaluate(() => {
  let captured = "";
  const orig = URL.createObjectURL;
  (URL as any).createObjectURL = (b: Blob) => { captured = "blob-made"; return "blob:fake"; };
  const a = document.createElement("a");
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { captured += "+clicked:" + (this as HTMLAnchorElement).download; };
  (document.querySelector("#calIcs") as HTMLButtonElement).click();
  HTMLAnchorElement.prototype.click = origClick;
  (URL as any).createObjectURL = orig;
  return captured;
});
ok("ICS export builds and triggers a download", icsOk.includes("blob-made") && icsOk.includes("linkedin-lab-30days.ics"), icsOk);

// === 7b. RTL fixer + preview + new form checks ===
const RTL_DRAFT = `Excel הרג לכם את היום?

יש דרך אחרת לנהל את הנתונים.

LinkedIn הוא המקום שבו לקוחות בודקים אתכם.

מה דעתכם?`;
await page.fill("#draft", RTL_DRAFT);
await page.waitForTimeout(300);
const rtlFlag = (await page.textContent("#dRtl")) ?? "";
ok("RTL flip counter detects Latin-first Hebrew lines", rtlFlag.includes("2"), rtlFlag.trim());
const rtlCheck = await page.evaluate(() => [...document.querySelectorAll("#dChecks .ck b")].map((x) => x.textContent).join("|"));
ok("form check flags flipping lines as bad", rtlCheck.includes("שיתהפכו"), rtlCheck.slice(0, 80));
// the copy-with-fix button must inject RLM exactly on the flipping lines
const fixed = await page.evaluate(async () => {
  let captured = "";
  (navigator.clipboard as any).writeText = (t: string) => { captured = t; return Promise.resolve(); };
  (document.querySelector("#copyFixed") as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r, 200));
  return captured;
});
const fixedLines = fixed.split("\n");
ok("RLM injected on Latin-first Hebrew lines", fixedLines[0].startsWith("‏") && fixedLines[4].startsWith("‏"), JSON.stringify(fixedLines[0].slice(0, 8)));
ok("RLM NOT injected on Hebrew-first lines", !fixedLines[2].startsWith("‏"));
// the round trip that used to fail: paste the FIXED text back — the flag must clear
await page.fill("#draft", fixed);
await page.waitForTimeout(300);
ok("fixed text no longer counts as a problem", ((await page.textContent("#dRtl")) ?? "").trim() === "");
ok("fixed text passes the RTL form check", !(await page.evaluate(() => [...document.querySelectorAll("#dChecks .ck b")].map((x) => x.textContent).join("|"))).includes("שיתהפכו"));
// non-ASCII strong-L starts (Cyrillic) genuinely flip and must now be caught
await page.fill("#draft", "Яндекс שינתה את הכללים.\n\nעוד שורה עברית רגילה כאן.\n\nמה דעתכם?");
await page.waitForTimeout(300);
ok("Cyrillic-first Hebrew line detected", ((await page.textContent("#dRtl")) ?? "").includes("1"));
// Arabic-first lines are already RTL and must NOT be flagged
await page.fill("#draft", "العربية מילה בעברית בשורה הזו.\n\nעוד שורה עברית.\n\nמה דעתכם?");
await page.waitForTimeout(300);
ok("Arabic-first line not falsely flagged", ((await page.textContent("#dRtl")) ?? "").trim() === "");
ok("fix is idempotent", (await page.evaluate((f) => {
  const w = window as any;
  return f;
}, fixed)) === fixed.replace(/‏‏/g, "‏"));
// preview shows see-more cut and switches device
const LONG = "שורת פתיחה. " + "עוד משפט שממשיך את הפוסט הזה למקום מעניין. ".repeat(10);
await page.fill("#draft", LONG);
await page.waitForTimeout(300);
ok("preview shows see-more marker on long drafts", ((await page.textContent("#pvText")) ?? "").includes("…עוד"));
const lenDesk = ((await page.textContent("#pvText")) ?? "").length;
await page.click('.pvt[data-cut="140"]');
await page.waitForTimeout(200);
const lenMob = ((await page.textContent("#pvText")) ?? "").length;
ok("mobile preview cuts earlier than desktop", lenMob < lenDesk, `${lenMob} < ${lenDesk}`);
await page.click('.pvt[data-cut="210"]');
// unicode-bold warning
await page.fill("#draft", "שורת פתיחה עם 𝗕𝗼𝗹𝗱 מזויף בפנים.\n\nעוד תוכן אמיתי כלשהו כאן.\n\nמה דעתכם?");
await page.waitForTimeout(300);
ok("unicode-bold flagged", (await page.evaluate(() => [...document.querySelectorAll("#dChecks .ck b")].map((x) => x.textContent).join("|"))).includes("יוניקוד"));
// hashtag advice updated to post-2024 reality
await page.fill("#draft", "שורת פתיחה חדה.\n\nתוכן אמיתי עם אמירה.\n\nמה דעתכם?\n\n#אחד #שתיים #שלוש #ארבע");
await page.waitForTimeout(300);
ok("hashtag warning reflects deprecation", (await page.evaluate(() => [...document.querySelectorAll("#dChecks .ck span span, #dChecks .ck span")].map((x) => x.textContent).join("|"))).includes("ביטלה מעקב"));

// === 7c. auto-audit from the user's own export ===
await page.evaluate(() => { localStorage.removeItem("lab-audit"); });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
ok("auto-audit box present", (await page.locator("#autoAudit").count()) === 1);
// guard: no material
await page.click("#audRun");
await page.waitForTimeout(300);
ok("audit requires material before calling API", ((await page.textContent("#audStatus")) ?? "").includes("200 תווים"));
// paste path
await page.fill("#audText", "שי כהן. יועץ עסקי בכיר. עשר שנות ניסיון בליווי עסקים. ".repeat(8));
await page.click("#audRun");
await page.waitForSelector("#audOut.on", { timeout: 20000 });
ok("summary rendered", ((await page.textContent("#audOut")) ?? "").includes("להחליף את הכותרת"));
ok("headline critique with rewrite", ((await page.textContent("#audOut")) ?? "").includes("כאוס תזרימי"));
ok("about rewrite rendered", ((await page.textContent("#audOut")) ?? "").includes("החור בתזרים"));
// items applied to the checklist
const marked = await page.evaluate(`(() => ({
  f2done: document.querySelector('.aitem[data-k="foundation-2"]').classList.contains("done"),
  f2mark: document.querySelector('.aitem[data-k="foundation-2"] .amark').textContent,
  a2mark: document.querySelector('.aitem[data-k="authority-2"] .amark').textContent,
  act0mark: document.querySelector('.aitem[data-k="activity-0"] .amark').textContent,
  score: document.querySelector("#scoreVal").textContent,
}))()`) as any;
ok("'כן' items auto-checked", marked.f2done === true && marked.f2mark === "זוהה במסמך");
ok("score updated from auto-check", Number(marked.score) > 0, `score ${marked.score}`);
ok("'לא' item marked missing, not checked", marked.a2mark === "חסר לפי המסמך");
ok("no-info item marked manual", marked.act0mark === "לבדיקה ידנית");
// pdf path: attach a file and confirm it is accepted + request carries pdf
const tinyPdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF");
await page.setInputFiles("#audFile", { name: "Profile.pdf", mimeType: "application/pdf", buffer: tinyPdf });
await page.waitForTimeout(400);
ok("pdf accepted into dropzone", ((await page.textContent("#audFileName")) ?? "").includes("Profile.pdf ✓"));
let sawPdf = false;
await page.route("**/api/lab", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  sawPdf = typeof body?.profile?.pdf === "string" && body.profile.pdf.length > 10;
  await route.fallback();
});
await page.click("#audRun");
await page.waitForSelector("#audOut.on", { timeout: 20000 });
ok("pdf reaches the API as base64", sawPdf);
await page.unroute("**/api/lab");
// reset clears the marks
await page.click("#auditReset");
await page.waitForTimeout(200);
ok("reset clears audit marks", (await page.locator(".aitem .amark").count()) === 0);

// === 7b. growth features: market toggle, checker rules, dream list, carousel, voice, weekly ===
await page.goto("http://127.0.0.1:8787/lab?connected", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);

// language-strategy toggle: switch, note updates, choice survives reload
await page.click('.mbtn[data-m="mix"]');
ok("market toggle updates the note", ((await page.textContent("#langNote")) ?? "").includes("קהל מעורב"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
ok("market choice survives reload", await page.locator('.mbtn[data-m="mix"]').evaluate((e) => e.classList.contains("on")));

// checker: AI-fingerprint patterns flagged
await page.fill("#draft", "זה לא כישלון. זה שיעור — חשוב.\n\nראיתי את זה — שוב ושוב — אצל לקוחות.\n\nבעולם שבו כולם כותבים אותו דבר — צריך לבלוט.\n\nמה דעתכם?");
await page.waitForTimeout(250);
let checksTxt = (await page.textContent("#dChecks")) ?? "";
ok("AI-fingerprint draft flagged", checksTxt.includes("טביעות אצבע של AI") && checksTxt.includes("זה לא X"));
ok("generic question ending downgraded", checksTxt.includes("שאלה גנרית בסוף"));

// checker: engagement bait flagged
await page.fill("#draft", "כתבתי מדריך שלם על טעויות שכר נפוצות אצל עסקים קטנים.\n\nתגיבו \"רוצה\" ואשלח לכם אותו בפרטי.");
await page.waitForTimeout(250);
checksTxt = (await page.textContent("#dChecks")) ?? "";
ok("comment-gate bait flagged", checksTxt.includes("פיתיון מעורבות"));

// checker: a clean human draft passes the new checks
await page.fill("#draft", DRAFT);
await page.waitForTimeout(250);
checksTxt = (await page.textContent("#dChecks")) ?? "";
ok("clean draft passes AI-fingerprint check", checksTxt.includes("בלי טביעות אצבע של AI") && !checksTxt.includes("פיתיון"));

// dream-25 list: add, cycle stage, touch, persist, delete
await page.fill("#dr-name", "דנה כהן · אקמי");
await page.fill("#dr-why", "מגייסים עכשיו צוות כספים");
await page.click("#dreamAdd");
ok("dream row added", ((await page.textContent("#dreamRows")) ?? "").includes("דנה כהן"));
await page.click('#dreamRows [data-act="stage"]');
ok("dream stage cycles", ((await page.textContent('#dreamRows [data-act="stage"]')) ?? "").includes("מחוברים"));
await page.click('#dreamRows [data-act="touch"]');
ok("dream touch stamps today", ((await page.textContent("#dreamRows")) ?? "").includes("היום"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const dreamAfter = (await page.textContent("#dreamRows")) ?? "";
ok("dream list survives reload", dreamAfter.includes("דנה כהן") && dreamAfter.includes("מחוברים") && dreamAfter.includes("היום"));
await page.click('#dreamRows [data-act="del"]');
ok("dream row deleted", !(((await page.textContent("#dreamRows")) ?? "").includes("דנה כהן")));

// carousel builder: paragraphs become editable slides, print button appears
await page.fill("#carSrc", "הפתיח הגדול\n\nגוף ראשון עם רעיון אחד\n\nגוף שני עם רעיון אחד\n\nסיום והזמנה רכה");
await page.click("#carBuild");
ok("carousel builds one slide per block", (await page.locator("#carSlides .carslide").count()) === 4);
ok("first slide styled as hook", await page.locator("#carSlides .carslide").first().evaluate((e) => e.classList.contains("c-first")));
ok("last slide styled as closer", await page.locator("#carSlides .carslide").last().evaluate((e) => e.classList.contains("c-last")));
ok("slides are editable", (await page.locator('#carSlides .carslide[contenteditable="true"]').count()) === 4);
ok("print button revealed", await page.locator("#carPrintBtn").isVisible());

// voice profile: distill via mocked API, stored, threaded into review
const myPost = "אני רואה את זה כל שבוע אצל לקוחות. טעות קטנה בתלוש, ואף אחד לא שם לב עד הביקורת. ".repeat(4);
await page.fill("#voiceSrc", myPost + "\n---\n" + myPost);
await page.click("#voiceRun");
await page.waitForSelector("#voiceOut:not([style*='display: none'])", { timeout: 15000 });
ok("voice profile rendered and stored", ((await page.textContent("#voiceOut")) ?? "").includes("משפטים קצרים"));
let sawVoice = "";
await page.route("**/api/lab", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  if (body.mode === "review") sawVoice = body.voice ?? "";
  await route.fallback();
});
await page.fill("#draft", DRAFT);
await page.click("#aiRun");
await page.waitForSelector("#aiOut.on", { timeout: 15000 });
ok("stored voice rides along with the review call", sawVoice.includes("משפטים קצרים"));
await page.unroute("**/api/lab");
await page.click("#voiceClear");
ok("voice profile clears", await page.locator("#voiceOut").evaluate((e) => (e as HTMLElement).style.display === "none"));

// corrupt localStorage must not kill the page script
await page.evaluate("localStorage.setItem('lab-dream','\"junk\"');localStorage.setItem('lab-track','{\"a\":1}')");
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
await page.fill("#dr-name", "בדיקת שרידות");
await page.click("#dreamAdd");
ok("corrupt lab-dream/lab-track survived: dream list still works", ((await page.textContent("#dreamRows")) ?? "").includes("בדיקת שרידות"));
await page.fill("#carSrc", "אחד\n\nשניים");
await page.click("#carBuild");
ok("corrupt storage survived: carousel still builds", (await page.locator("#carSlides .carslide").count()) === 2);
await page.evaluate("localStorage.removeItem('lab-dream');localStorage.removeItem('lab-track')");
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);

// contrastive regex: narrative pronoun negation is NOT flagged
await page.fill("#draft", "אתמול ישבתי מול לקוח ותיק.\n\nהוא לא ענה, הוא רק חייך ואמר שאין לו זמן לזה עכשיו.\n\nשבוע אחרי זה הוא התקשר בעצמו וביקש שנתחיל מיד, כי הביקורת הגיעה.\n\nמה גרם לשינוי? מספר אחד בדוח שהוא לא הצליח להסביר לרואה החשבון שלו.");
await page.waitForTimeout(250);
checksTxt = (await page.textContent("#dChecks")) ?? "";
ok("narrative 'הוא לא... הוא' not branded as AI template", checksTxt.includes("בלי טביעות אצבע של AI"));

// weekly reading: needs tracker data, then renders the three sections
await page.fill("#t-views", "120");
await page.fill("#t-convos", "1");
await page.click("#trackAdd");
await page.click("#weeklyRun");
await page.waitForSelector("#weeklyOut.on", { timeout: 15000 });
const wkTxt = (await page.textContent("#weeklyOut")) ?? "";
ok("weekly reading renders all three sections", wkTxt.includes("מה המספרים אומרים") && wkTxt.includes("האבחנה") && wkTxt.includes("הניסוי לשבוע הבא"));
ok("weekly reading carries the mock verdict", wkTxt.includes("הפרופיל לא ממיר"));

// === 8. unconfigured page hides AI-only entry points ===
await page.goto("http://127.0.0.1:8787/lab", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
ok("unconfigured: ideas box hidden", await page.locator("#ideasBox").evaluate((e) => (e as HTMLElement).style.display === "none"));
ok("unconfigured: no guided-write buttons, AI-prompt fallback instead", (await page.locator("[data-write]").count()) === 0 && (await page.locator("[data-ai]").count()) === 12);
ok("unconfigured: drawer still works", (await page.locator("#drawerBox").count()) === 1);
ok("unconfigured: weekly + voice buttons disabled honestly",
  await page.locator("#weeklyRun").isDisabled() && await page.locator("#voiceRun").isDisabled() &&
  (((await page.textContent("#voiceRun")) ?? "").includes("לא זמין")));

console.log("JS errors:", errors.length ? errors : "none");
await browser.close();
site.close();
upstream.close();
