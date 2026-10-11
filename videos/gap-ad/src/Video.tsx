import React from "react";
import { AbsoluteFill, Audio, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "reelkit/frame";
import { Captions, ease, font, Grain, sceneById, SceneFrame, Sfx, springs, Vignette } from "reelkit/kit";
import type { VideoProps } from "reelkit/kit";

// Narration word timings (ElevenLabs v4 take, measured with Scribe), in seconds from the start of the film.
const VO: { word: string; startSec: number; endSec: number }[] = [
  { word: "אותה", startSec: 1.38, endSec: 1.66 },
  { word: "משימה,", startSec: 1.70, endSec: 2.18 },
  { word: "אותו", startSec: 2.66, endSec: 2.92 },
  { word: "משרד,", startSec: 2.98, endSec: 3.48 },
  { word: "אותה", startSec: 3.98, endSec: 4.20 },
  { word: "משכורת.", startSec: 4.26, endSec: 4.90 },
  { word: "אחד", startSec: 5.56, endSec: 5.84 },
  { word: "מסיים", startSec: 5.88, endSec: 6.36 },
  { word: "בארבעים", startSec: 6.40, endSec: 6.92 },
  { word: "שניות,", startSec: 7.02, endSec: 7.46 },
  { word: "השני", startSec: 8.12, endSec: 8.76 },
  { word: "עדיין", startSec: 9.20, endSec: 9.66 },
  { word: "גולל.", startSec: 9.70, endSec: 10.10 },
  { word: "ההבדל", startSec: 10.74, endSec: 11.36 },
  { word: "הוא", startSec: 11.38, endSec: 11.54 },
  { word: "לא", startSec: 11.56, endSec: 11.72 },
  { word: "כישרון,", startSec: 11.76, endSec: 12.30 },
  { word: "זה", startSec: 12.80, endSec: 12.92 },
  { word: "ידע,", startSec: 13.00, endSec: 13.32 },
  { word: "והפער", startSec: 13.90, endSec: 14.32 },
  { word: "הזה", startSec: 14.36, endSec: 14.62 },
  { word: "כבר", startSec: 14.68, endSec: 14.90 },
  { word: "קיים", startSec: 14.94, endSec: 15.22 },
  { word: "אצלכם", startSec: 15.24, endSec: 15.66 },
  { word: "בארגון.", startSec: 15.70, endSec: 16.24 },
  { word: "השאלה", startSec: 16.80, endSec: 17.30 },
  { word: "היא", startSec: 17.30, endSec: 17.40 },
  { word: "רק", startSec: 17.46, endSec: 17.76 },
  { word: "בכמה", startSec: 18.20, endSec: 18.56 },
  { word: "צוותים.", startSec: 18.62, endSec: 19.12 },
  { word: "המחלקה", startSec: 19.70, endSec: 20.18 },
  { word: "העסקית", startSec: 20.20, endSec: 20.70 },
  { word: "של", startSec: 20.76, endSec: 20.86 },
  { word: "היחידה", startSec: 20.88, endSec: 21.34 },
  { word: "ללימודי", startSec: 21.40, endSec: 21.86 },
  { word: "חוץ.", startSec: 21.92, endSec: 22.28 },
  { word: "סוגרים", startSec: 22.74, endSec: 23.14 },
  { word: "פערי", startSec: 23.18, endSec: 23.56 },
  { word: "ידע", startSec: 23.64, endSec: 23.92 },
  { word: "בבינה", startSec: 23.98, endSec: 24.34 },
  { word: "מלאכותית", startSec: 24.38, endSec: 24.96 },
  { word: "ובסייבר,", startSec: 25.00, endSec: 25.70 },
  { word: "בהתאמה", startSec: 26.04, endSec: 26.56 },
  { word: "לארגון", startSec: 26.62, endSec: 27.08 },
  { word: "שלכם.", startSec: 27.12, endSec: 27.60 },
  { word: "קבעו", startSec: 28.04, endSec: 28.30 },
  { word: "פגישת", startSec: 28.36, endSec: 28.72 },
  { word: "אבחון.", startSec: 28.74, endSec: 29.20 },
];

const C = {
  bg: "#0A0F1F",
  bg2: "#141C36",
  ink: "#F4F6FA",
  mut: "#8E9AB5",
  dim: "#4E5874",
  blue: "#4C9BFF",
  gold: "#F5B83D",
  goldInk: "#1E1300",
  red: "#FF4D5E",
  green: "#3DDC97",
  line: "rgba(255,255,255,0.12)",
};
const heebo = font("heebo");
const mono = font("jetbrainsMono");

const SND = {
  track: "assets/gap/soundtrack.mp3",
  chime: "assets/lib/sfx-ui-success-chime/clip.mp3",
  click: "assets/lib/youtube-picks-interface-mouse-click/clip.mp3",
  whoosh: "assets/lib/sfx-ui-soft-whoosh/clip.mp3",
  thud: "assets/lib/sfx-ui-soft-impact/clip.mp3",
  pop: "assets/lib/sfx-ui-bubble-pop/clip.mp3",
  deep: "assets/lib/invention-impact-impact-cinematic-deep/clip.mp3",
};

type Scene = VideoProps["manifest"]["scenes"][number];
const FPS = 30;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Absolute frame where the nth occurrence of a spoken word starts.
const say = (word: string, nth = 1): number => {
  let n = 0;
  for (const w of VO) {
    if (w.word.replace(/[.,?!…]/g, "") === word) { n += 1; if (n === nth) return Math.round(w.startSec * FPS); }
  }
  throw new Error(`word not in narration: ${word}`);
};
const wordsIn = (s: Scene) => VO.filter((w) => w.startSec * FPS >= s.startFrame - 2 && w.startSec * FPS < s.startFrame + s.durationFrames - 2)
  .map((w) => ({ word: w.word, startSec: w.startSec - s.startFrame / FPS, endSec: w.endSec - s.startFrame / FPS }));

const T = (size: number, color: string = C.ink, weight = 900): React.CSSProperties => ({
  fontFamily: heebo, fontWeight: weight, fontSize: size, color, direction: "rtl", whiteSpace: "nowrap", lineHeight: 1.0, letterSpacing: -size * 0.02,
});

// Whole-word entrance: in within 3 frames, a short rise and a settle from slightly larger.
const In: React.FC<{ at: number; out?: number; from?: number; rise?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, out, from = 1.08, rise, style, children }) => {
  const f = useCurrentFrame();
  const { fps, height: H } = useVideoConfig();
  if (f < at) return null;
  const p = spring({ frame: f - at, fps, config: springs.snappy });
  const o = interpolate(f, [at, at + 3], [0, 1], clamp);
  const x = out === undefined ? 0 : interpolate(f, [out, out + 7], [0, 1], { ...clamp, easing: ease.in });
  const r = rise ?? H * 0.012;
  return <div style={{ opacity: o * (1 - x), transform: `translateY(${(1 - p) * r - x * r}px) scale(${from + (1 - from) * p})`, ...style }}>{children}</div>;
};

const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// A dark app window with a title bar.
const Window: React.FC<{ title: string; width: number; height: number; accent: string; children: React.ReactNode }> = ({ title, width, height, accent, children }) => {
  const { width: W } = useVideoConfig();
  return (
    <div style={{ width, height, borderRadius: W * 0.028, background: "linear-gradient(180deg, #121A33, #0D1428)", border: `${W * 0.002}px solid ${C.line}`, boxShadow: `0 ${W * 0.02}px ${W * 0.06}px rgba(0,0,0,0.55)`, overflow: "hidden", position: "relative" }}>
      <div style={{ height: W * 0.06, display: "flex", alignItems: "center", gap: W * 0.012, padding: `0 ${W * 0.025}px`, borderBottom: `${W * 0.002}px solid ${C.line}`, direction: "ltr" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: W * 0.014, height: W * 0.014, borderRadius: "50%", background: c, opacity: 0.8 }} />)}
        <div style={{ fontFamily: mono, fontSize: W * 0.022, color: C.mut, marginLeft: W * 0.015 }}>{title}</div>
        <div style={{ flex: 1 }} />
        <div style={{ width: W * 0.02, height: W * 0.02, borderRadius: "50%", background: accent, opacity: 0.9 }} />
      </div>
      {children}
    </div>
  );
};

// Left: reading a long PDF by hand. Rows scroll forever, the page counter crawls.
const ManualUI: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const f = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const rowH = W * 0.032;
  const scroll = (f * 2.2) % (rowH * 2);
  const page = 3 + Math.floor(f / 75);
  const rows = Array.from({ length: 34 }, (_, i) => 0.45 + 0.5 * random(`row${i}`));
  return (
    <Window title="report_Q3.pdf" width={width} height={height} accent={C.red}>
      <div style={{ position: "absolute", top: W * 0.07, left: W * 0.03, right: W * 0.045, bottom: W * 0.06, overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-scroll}px)`, display: "flex", flexDirection: "column", gap: rowH * 0.6, alignItems: "flex-end" }}>
          {rows.map((w, i) => (
            <div key={i} style={{ width: `${w * 100}%`, height: rowH * 0.42, borderRadius: W, background: i % 9 === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.11)" }} />
          ))}
        </div>
      </div>
      {/* scrollbar on the left, as in an RTL reader */}
      <div style={{ position: "absolute", left: W * 0.012, top: W * 0.08, bottom: W * 0.07, width: W * 0.008, borderRadius: W, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: `${(page / 40) * 100}%`, height: "6%", borderRadius: W, background: "rgba(255,255,255,0.35)" }} />
      </div>
      <div style={{ position: "absolute", bottom: W * 0.018, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ ...T(W * 0.026, C.mut, 500) }}>{`עמוד ${page} מתוך 40`}</div>
      </div>
    </Window>
  );
};

// Right: the same task done with an assistant. A request is typed, sent, and a summary streams in.
const AiUI: React.FC<{ width: number; height: number; typeAt: number; sendAt: number; doneAt: number }> = ({ width, height, typeAt, sendAt, doneAt }) => {
  const f = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const ask = "סכם את הדוח ב-5 נקודות להנהלה";
  const n = Math.max(0, Math.min(ask.length, Math.floor((f - typeAt) / 1.4)));
  const typed = ask.slice(0, n);
  const caret = f < sendAt && Math.floor(f / 8) % 2 === 0;
  const items = ["הכנסות: צמיחה ברבעון", "עלויות: חריגה בשני סעיפים", "לקוחות: שלושה חדשים", "סיכונים: ספק מרכזי", "המלצה: לאשר תקציב"];
  const done = f >= doneAt;
  return (
    <Window title="AI Assistant" width={width} height={height} accent={done ? C.green : C.blue}>
      <div style={{ position: "absolute", top: W * 0.085, left: W * 0.025, right: W * 0.025 }}>
        <div style={{ background: "rgba(76,155,255,0.12)", border: `${W * 0.002}px solid rgba(76,155,255,0.45)`, borderRadius: W * 0.02, padding: `${W * 0.018}px ${W * 0.02}px`, display: "flex", direction: "rtl", alignItems: "center", minHeight: W * 0.06 }}>
          <div style={{ ...T(W * 0.026, C.ink, 600), whiteSpace: "normal", lineHeight: 1.3 }}>{typed}<span style={{ opacity: caret ? 1 : 0, color: C.blue }}>|</span></div>
        </div>
        <div style={{ marginTop: W * 0.025, display: "flex", flexDirection: "column", gap: W * 0.016 }}>
          {items.map((t, i) => {
            const at = sendAt + 8 + i * 9;
            if (f < at) return null;
            const o = interpolate(f, [at, at + 4], [0, 1], clamp);
            return (
              <div key={i} style={{ display: "flex", direction: "rtl", alignItems: "center", gap: W * 0.012, opacity: o }}>
                <div style={{ width: W * 0.012, height: W * 0.012, borderRadius: "50%", background: C.gold, flex: "none" }} />
                <div style={{ ...T(W * 0.024, C.ink, 500), whiteSpace: "normal", lineHeight: 1.25 }}>{t}</div>
              </div>
            );
          })}
        </div>
      </div>
      {done ? (
        <div style={{ position: "absolute", bottom: W * 0.03, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <In at={doneAt} from={1.3}>
            <div style={{ background: C.green, borderRadius: W, padding: `${W * 0.01}px ${W * 0.03}px` }}>
              <div style={{ ...T(W * 0.03, "#04140C", 800) }}>✓ הושלם</div>
            </div>
          </In>
        </div>
      ) : null}
    </Window>
  );
};

// ---------- RACE ----------
const Race: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const doneAt = say("מסיים");
  const pushAt = say("השני");
  const colW = W * 0.455, gapW = W * 0.02, top = H * 0.27, winH = H * 0.5;
  // Both clocks start together; the right one stops at 00:40, the left one keeps running and speeds up.
  const rightSec = interpolate(f, [12, doneAt], [0, 40], clamp);
  const leftSec = f < doneAt ? rightSec : 40 + Math.pow((f - doneAt) / fps, 2.2) * 60;
  const push = spring({ frame: f - pushAt, fps, config: { stiffness: 90, damping: 20 } });
  const dimRight = interpolate(push, [0, 1], [1, 0.25]);
  const header = (label: string, t: string, color: string, at: number) => (
    <In at={at}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.006 }}>
        <div style={T(W * 0.034, label === "עדיין גולל..." ? C.red : C.mut, label === "עדיין גולל..." ? 900 : 700)}>{label}</div>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: W * 0.085, color, letterSpacing: W * 0.002 }}>{t}</div>
      </div>
    </In>
  );
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + 0.32 * push})`, transformOrigin: "22% 52%" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.07, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.012 }}>
        <In at={0}><div style={T(W * 0.032, C.gold, 700)}>המשימה</div></In>
        <In at={4}><div style={T(W * 0.046, C.ink, 800)}>לסכם דוח של 40 עמודים להנהלה</div></In>
      </div>
      {/* right column: with AI */}
      <div style={{ position: "absolute", right: W * 0.035, top: H * 0.15, width: colW, display: "flex", flexDirection: "column", alignItems: "center", gap: H * 0.02, opacity: dimRight }}>
        {header("עובד א׳", mmss(rightSec), f >= doneAt ? C.green : C.ink, 6)}
        <In at={10} from={0.96}><AiUI width={colW} height={winH} typeAt={16} sendAt={16 + 44} doneAt={doneAt} /></In>
      </div>
      {/* left column: by hand */}
      <div style={{ position: "absolute", left: W * 0.035, top: H * 0.15, width: colW, display: "flex", flexDirection: "column", alignItems: "center", gap: H * 0.02 }}>
        {header(f >= say("עדיין") ? "עדיין גולל..." : "עובד ב׳", mmss(leftSec), f >= doneAt ? C.red : C.ink, 6)}
        <In at={10} from={0.96}><ManualUI width={colW} height={winH} /></In>
      </div>
      {/* the divider: the gap, still a hairline */}
      <div style={{ position: "absolute", left: W / 2 - gapW * 0.05, width: gapW * 0.1 + 2, top: top - H * 0.12, height: winH + H * 0.14, background: `linear-gradient(180deg, rgba(245,184,61,0), ${C.gold}, rgba(245,184,61,0))`, opacity: 0.6 }} />
    </AbsoluteFill>
  );
};

// ---------- GAP ----------
const Gap: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const L = (abs: number) => abs - s.startFrame;
  const open = spring({ frame: f - 2, fps, config: { stiffness: 60, damping: 18 } });
  const gapW = W * (0.02 + 0.66 * open);
  const knowAt = L(say("ידע"));
  const gapAt = L(say("והפער"));
  const glow = 0.5 + 0.2 * Math.sin(f / 6);
  return (
    <AbsoluteFill>
      {/* the two halves pushed apart */}
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: (W - gapW) / 2, background: `linear-gradient(90deg, #0D1530, ${C.bg2})`, borderLeft: `${W * 0.004}px solid ${C.gold}` }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: (W - gapW) / 2, background: `linear-gradient(270deg, #0D1530, ${C.bg2})`, borderRight: `${W * 0.004}px solid ${C.gold}` }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: (W - gapW) / 2, width: gapW, background: `radial-gradient(ellipse at center, rgba(245,184,61,${0.12 * glow}) 0%, rgba(0,0,0,0) 70%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.3, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.02 }}>
        <In at={L(say("ההבדל"))} out={knowAt - 2}><div style={T(W * 0.06, C.mut, 700)}>ההבדל הוא</div></In>
        <In at={L(say("לא"))} out={knowAt - 2}><div style={T(W * 0.13, C.ink)}>לא כישרון.</div></In>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.3, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.02 }}>
        <In at={L(say("זה"))} from={1.3}><div style={{ ...T(W * 0.2, C.gold), textShadow: `0 0 ${W * 0.06}px rgba(245,184,61,0.45)` }}>זה ידע.</div></In>
      </div>
      {/* the gap, measured */}
      <In at={gapAt} style={{ position: "absolute", left: (W - gapW) / 2, width: gapW, top: H * 0.56 }}>
        <div style={{ position: "relative", height: W * 0.06 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: W * 0.004, background: C.gold }} />
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: W * 0.004, background: C.gold }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: W * 0.004, background: C.gold }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: W * 0.02 }}><div style={T(W * 0.07, C.gold, 900)}>פער ידע</div></div>
      </In>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.7, display: "flex", justifyContent: "center" }}>
        <In at={L(say("אצלכם"))}><div style={T(W * 0.06, C.ink, 800)}>כבר קיים אצלכם.</div></In>
      </div>
    </AbsoluteFill>
  );
};

// A small team card with its own gap. open (0..1) is how wide the gap is; gold when closed.
const TeamTile: React.FC<{ size: number; gap: number; label: string }> = ({ size, gap, label }) => {
  const { width: W } = useVideoConfig();
  const g = size * 0.36 * gap;
  const col = gap > 0.05 ? C.red : C.gold;
  return (
    <div style={{ width: size, height: size * 0.8, borderRadius: W * 0.02, background: "rgba(255,255,255,0.04)", border: `${W * 0.002}px solid ${gap > 0.05 ? "rgba(255,77,94,0.5)" : "rgba(245,184,61,0.6)"}`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: size * 0.1, right: size * 0.08, ...T(W * 0.022, C.mut, 600) }}>{label}</div>
      <div style={{ position: "absolute", bottom: size * 0.12, right: size * 0.08, width: (size * 0.84 - g) / 2, height: size * 0.36, borderRadius: W * 0.01, background: "rgba(76,155,255,0.35)" }} />
      <div style={{ position: "absolute", bottom: size * 0.12, left: size * 0.08, width: (size * 0.84 - g) / 2, height: size * 0.36, borderRadius: W * 0.01, background: "rgba(76,155,255,0.18)" }} />
      <div style={{ position: "absolute", bottom: size * 0.1, left: size / 2 - Math.max(W * 0.002, g / 2), width: Math.max(W * 0.004, g), height: size * 0.4, background: col, opacity: gap > 0.05 ? 0.35 : 0.9 }} />
    </div>
  );
};

const TEAMS = ["מכירות", "שירות", "כספים", "IT", "שיווק", "תפעול", "משאבי אנוש", "רכש", "פיתוח", "לוגיסטיקה", "הנהלה", "אבטחה"];
const HAS_GAP = [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1];

const Grid: React.FC<{ appearAt: number; closeAt?: number; dim?: number }> = ({ appearAt, closeAt, dim = 1 }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const size = W * 0.27;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.3, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: W * 0.025, padding: `0 ${W * 0.06}px`, direction: "rtl", opacity: dim }}>
      {TEAMS.map((t, i) => {
        const at = appearAt + i * 2;
        const p = spring({ frame: f - at, fps, config: springs.snappy });
        const ci = HAS_GAP.slice(0, i).reduce((a, b) => a + b, 0);
        const closeP = closeAt === undefined ? 0 : spring({ frame: f - (closeAt + ci * 4), fps, config: { stiffness: 220, damping: 22 } });
        const gap = HAS_GAP[i] ? 1 - closeP : 0;
        return (
          <div key={t} style={{ opacity: f < at ? 0 : Math.min(1, (f - at) / 3), transform: `scale(${0.85 + 0.15 * p})` }}>
            <TeamTile size={size} gap={gap} label={t} />
          </div>
        );
      })}
    </div>
  );
};

const Teams: React.FC<{ s: Scene }> = ({ s }) => {
  const { width: W, height: H } = useVideoConfig();
  const L = (abs: number) => abs - s.startFrame;
  return (
    <AbsoluteFill>
      <Grid appearAt={2} />
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.1, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.01 }}>
        <In at={L(say("השאלה"))}><div style={T(W * 0.055, C.mut, 700)}>השאלה היא רק</div></In>
        <In at={L(say("בכמה"))} from={1.25}><div style={T(W * 0.12, C.ink)}>בכמה צוותים?</div></In>
      </div>
    </AbsoluteFill>
  );
};

const Close: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const L = (abs: number) => abs - s.startFrame;
  const closeAt = L(say("סוגרים"));
  const swap = closeAt - 3;
  const pill = (t: string, at: number) => (
    <In at={at} from={1.15}>
      <div style={{ border: `${W * 0.003}px solid ${C.gold}`, borderRadius: W, padding: `${W * 0.012}px ${W * 0.04}px`, background: "rgba(245,184,61,0.08)" }}>
        <div style={T(W * 0.045, C.ink, 800)}>{t}</div>
      </div>
    </In>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${H * 0.12}px) scale(0.86)` }}>
        <Grid appearAt={-30} closeAt={closeAt} dim={interpolate(f, [0, 10], [0.6, 0.85], clamp)} />
      </div>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,15,31,0.95) 0%, rgba(10,15,31,0.75) 32%, rgba(10,15,31,0.1) 55%, rgba(10,15,31,0) 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.09, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.012 }}>
        <In at={L(say("המחלקה"))} out={swap}><div style={T(W * 0.12, C.ink)}>המחלקה העסקית</div></In>
        <In at={L(say("היחידה"))} out={swap}><div style={T(W * 0.06, C.gold, 800)}>היחידה ללימודי חוץ</div></In>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.09, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.02 }}>
        <In at={closeAt}><div style={T(W * 0.11, C.ink)}>סוגרים <span style={{ color: C.gold }}>פערי ידע</span></div></In>
        <div style={{ display: "flex", gap: W * 0.025, direction: "rtl" }}>
          {pill("בינה מלאכותית", L(say("בבינה")))}
          {pill("סייבר", L(say("ובסייבר")))}
        </div>
        <In at={L(say("בהתאמה"))}><div style={T(W * 0.055, C.mut, 700)}>בהתאמה לארגון שלכם.</div></In>
      </div>
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const L = (abs: number) => abs - s.startFrame;
  const press = L(say("אבחון"));
  const k = interpolate(f, [press - 2, press + 1, press + 7], [1, 0.93, 1], clamp);
  const ring = spring({ frame: f - press, fps, config: springs.smooth });
  const line = spring({ frame: f - 2, fps, config: springs.smooth });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(${W}px ${H * 0.4}px at 50% 45%, #18264F 0%, ${C.bg} 70%)` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.25, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.012 }}>
        <In at={0}><div style={T(W * 0.08, C.ink, 900)}>היחידה ללימודי חוץ</div></In>
        <In at={3}><div style={{ ...T(W * 0.048, C.gold, 700), letterSpacing: W * 0.004 }}>המחלקה העסקית</div></In>
        <div style={{ width: W * 0.5 * line, height: W * 0.006, background: C.gold, borderRadius: W, marginTop: W * 0.03, boxShadow: `0 0 ${W * 0.03}px rgba(245,184,61,0.6)` }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.5, display: "flex", justifyContent: "center" }}>
        <In at={Math.max(0, L(say("קבעו")))} from={1.12}>
          <div style={{ position: "relative", transform: `scale(${k})` }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: W, border: `${W * 0.005}px solid ${C.gold}`, transform: `scale(${1 + ring * 0.25})`, opacity: f >= press ? 1 - ring : 0 }} />
            <div style={{ background: C.gold, borderRadius: W, padding: `${W * 0.035}px ${W * 0.09}px`, boxShadow: `0 0 ${W * 0.08}px rgba(245,184,61,0.45)` }}>
              <div style={T(W * 0.065, C.goldInk, 900)}>קבעו פגישת אבחון</div>
            </div>
          </div>
        </In>
      </div>
    </AbsoluteFill>
  );
};

export const Video: React.FC<VideoProps> = ({ manifest, urls }) => {
  const S = (id: string) => sceneById(manifest, id) as Scene;
  const race = S("race"), gap = S("gap"), teams = S("teams"), close = S("close"), cta = S("cta");
  const caps = (s: Scene) => <Captions words={wordsIn(s)} group="phrase" mode="highlight" highlight={C.gold} face={heebo} rtl bottom={0.07} />;
  const doneAt = say("מסיים");
  const typeTicks = Array.from({ length: 16 }, (_, i) => 16 + i * 3);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <SceneFrame from={race.startFrame} durationInFrames={race.durationFrames} enter="cut" exit="zoom-through" transitionFrames={8} origin={{ x: 0.5, y: 0.5 }}>
        <Race s={race} />{caps(race)}
      </SceneFrame>
      <SceneFrame from={gap.startFrame} durationInFrames={gap.durationFrames} enter="zoom-through" exit="zoom-out" transitionFrames={8}>
        <Gap s={gap} />{caps(gap)}
      </SceneFrame>
      <SceneFrame from={teams.startFrame} durationInFrames={teams.durationFrames} enter="zoom-out" exit="fade" transitionFrames={6}>
        <Teams s={teams} />{caps(teams)}
      </SceneFrame>
      <SceneFrame from={close.startFrame} durationInFrames={close.durationFrames} enter="fade" exit="fade" transitionFrames={8}>
        <Close s={close} />{caps(close)}
      </SceneFrame>
      <SceneFrame from={cta.startFrame} durationInFrames={cta.durationFrames} enter="fade" exit="cut">
        <Cta s={cta} />{caps(cta)}
      </SceneFrame>

      <Audio src={urls[SND.track]} />
      {typeTicks.map((t) => <Sfx key={`k${t}`} src={urls[SND.click]} at={t} volume={0.12} />)}
      <Sfx src={urls[SND.click]} at={60} volume={0.3} />
      <Sfx src={urls[SND.chime]} at={doneAt} volume={0.35} />
      <Sfx src={urls[SND.whoosh]} at={say("השני") - 2} volume={0.3} />
      <Sfx src={urls[SND.whoosh]} at={gap.startFrame - 6} volume={0.4} />
      <Sfx src={urls[SND.deep]} at={say("זה")} volume={0.35} />
      <Sfx src={urls[SND.thud]} at={say("והפער")} volume={0.3} />
      <Sfx src={urls[SND.whoosh]} at={teams.startFrame - 6} volume={0.35} />
      {TEAMS.map((_, i) => (i % 3 === 0 ? <Sfx key={`p${i}`} src={urls[SND.pop]} at={teams.startFrame + 2 + i * 2} volume={0.18} /> : null))}
      <Sfx src={urls[SND.thud]} at={say("בכמה")} volume={0.3} />
      {HAS_GAP.filter(Boolean).map((_, i) => <Sfx key={`c${i}`} src={urls[SND.click]} at={say("סוגרים") + 3 + i * 4} volume={0.22} />)}
      <Sfx src={urls[SND.chime]} at={say("סוגרים") + 36} volume={0.25} />
      <Sfx src={urls[SND.click]} at={say("אבחון") - 1} volume={0.35} />

      <Grain blend="overlay" />
      <Vignette strength={0.35} />
    </AbsoluteFill>
  );
};
