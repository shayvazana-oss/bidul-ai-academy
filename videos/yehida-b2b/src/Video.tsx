import React from "react";
import { AbsoluteFill, Audio, interpolate, random, Sequence, spring, useCurrentFrame, useVideoConfig } from "reelkit/frame";
import { Captions, ClipLayer, ease, font, Grade, Grain, HudOverlay, sceneById, SceneFrame, Sfx, springs, Vignette } from "reelkit/kit";
import type { VideoProps } from "reelkit/kit";

// Narration word timings (ElevenLabs v4 take, measured with Scribe), in seconds from the start of the film.
const VO: { word: string; startSec: number; endSec: number }[] = [
  { word: "שלוש", startSec: 0.64, endSec: 1.02 },
  { word: "בלילה.", startSec: 1.04, endSec: 1.58 },
  { word: "מישהו", startSec: 2.1, endSec: 2.44 },
  { word: "כבר", startSec: 2.48, endSec: 2.66 },
  { word: "בתוך", startSec: 2.7, endSec: 2.98 },
  { word: "הרשת", startSec: 3.02, endSec: 3.4 },
  { word: "שלכם.", startSec: 3.44, endSec: 3.94 },
  { word: "והצוות...", startSec: 4.54, endSec: 5.32 },
  { word: "לא", startSec: 6.02, endSec: 6.12 },
  { word: "יודע.", startSec: 6.16, endSec: 6.48 },
  { word: "אלא", startSec: 7.06, endSec: 7.32 },
  { word: "אם", startSec: 7.34, endSec: 7.46 },
  { word: "הוא", startSec: 7.48, endSec: 7.58 },
  { word: "מוכן.", startSec: 7.62, endSec: 8.1 },
  { word: "המחלקה", startSec: 8.58, endSec: 9.06 },
  { word: "העסקית", startSec: 9.06, endSec: 9.54 },
  { word: "של", startSec: 9.6, endSec: 9.7 },
  { word: "היחידה", startSec: 9.72, endSec: 10.2 },
  { word: "ללימודי", startSec: 10.26, endSec: 10.76 },
  { word: "חוץ.", startSec: 10.82, endSec: 11.18 },
  { word: "הכשרות", startSec: 11.58, endSec: 12.06 },
  { word: "בינה", startSec: 12.1, endSec: 12.34 },
  { word: "מלאכותית", startSec: 12.4, endSec: 12.9 },
  { word: "וסייבר,", startSec: 12.96, endSec: 13.54 },
  { word: "שנבנות", startSec: 13.82, endSec: 14.24 },
  { word: "במיוחד", startSec: 14.28, endSec: 14.9 },
  { word: "לארגון", startSec: 14.96, endSec: 15.38 },
  { word: "שלכם.", startSec: 15.42, endSec: 15.9 },
  { word: "ארבעה", startSec: 16.34, endSec: 16.76 },
  { word: "קמפוסים.", startSec: 16.82, endSec: 17.4 },
  { word: "הסמכה", startSec: 17.72, endSec: 18.12 },
  { word: "ממשלתית.", startSec: 18.18, endSec: 18.8 },
  { word: "אלפי", startSec: 19.12, endSec: 19.6 },
  { word: "לומדים", startSec: 19.66, endSec: 20.0 },
  { word: "בשנה.", startSec: 20.04, endSec: 20.5 },
  { word: "הצוות", startSec: 20.98, endSec: 21.42 },
  { word: "שלכם.", startSec: 21.46, endSec: 21.94 },
  { word: "מוכן.", startSec: 22.24, endSec: 22.72 },
  { word: "קבעו", startSec: 23.1, endSec: 23.36 },
  { word: "פגישת", startSec: 23.4, endSec: 23.76 },
  { word: "אבחון.", startSec: 23.78, endSec: 24.22 },
];

// ---------- palette and fonts ----------
const C = {
  ink: "#F4F6FA",
  red: "#FF2D3D",
  cyan: "#22D3FF",
  blue: "#3FA9FF",
  gold: "#F5B83D",
  goldInk: "#1E1300",
  black: "#04060B",
};
const heebo = font("heebo");
const mono = font("jetbrainsMono");
const orbit = font("orbitron");

const MEDIA = {
  soundtrack: "assets/ad/soundtrack.mp3",
  eye: "assets/ad/eye.mp4",
  hands: "assets/ad/hands.mp4",
  alarm: "assets/ad/alarm.mp4",
  chip: "assets/ad/chip.mp4",
  soc: "assets/ad/soc.mp4",
  hero: "assets/ad/hero.mp4",
  servers: "assets/broll/servers.mp4",
  network: "assets/broll/network.mp4",
  team: "assets/broll/team.mp4",
  hall: "assets/broll/hall.mp4",
};
const SFX = {
  glitch: "assets/lib/cinematic-glitches-glitch/clip.mp3",
  glitchAll: "assets/lib/cinematic-glitches-glitch-all-over/clip.mp3",
  alarm: "assets/lib/cinematic-alarms-and-beeps-alarm-message/clip.mp3",
  riser: "assets/lib/sfx-ui-riser-short/clip.mp3",
  drop: "assets/lib/sfx-ui-bass-drop/clip.mp3",
  impact: "assets/lib/cinematic-impacts-impact-bass/clip.mp3",
  boom: "assets/lib/cinematic-hits-hits-boom/clip.mp3",
  shutter: "assets/lib/sfx-ui-camera-shutter/clip.mp3",
  whoosh: "assets/lib/quantum-motion-whooshes-flow-whoosh-soft-swipe/clip.mp3",
};

type Scene = VideoProps["manifest"]["scenes"][number];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FPS = 30;

// Absolute frame where the nth occurrence of a spoken word starts.
const say = (word: string, nth = 1): number => {
  let n = 0;
  for (const w of VO) {
    if (w.word.replace(/[.,?!…]/g, "") === word) { n += 1; if (n === nth) return Math.round(w.startSec * FPS); }
  }
  throw new Error(`word not in narration: ${word}`);
};
// The words of one scene, in seconds from the scene's start, for the captions.
const wordsIn = (s: Scene) => VO.filter((w) => w.startSec * FPS >= s.startFrame - 2 && w.startSec * FPS < s.startFrame + s.durationFrames - 2)
  .map((w) => ({ word: w.word, startSec: w.startSec - s.startFrame / FPS, endSec: w.endSec - s.startFrame / FPS }));

const type = (size: number, color: string = C.ink, weight = 900): React.CSSProperties => ({
  fontFamily: heebo, fontWeight: weight, fontSize: size, color, direction: "rtl", whiteSpace: "nowrap",
  lineHeight: 0.95, letterSpacing: -size * 0.025,
});

// A whole Hebrew word that slams in with a short RGB-split glitch, then holds with a faint chromatic edge.
const Glitch: React.FC<{ at: number; out?: number; seed: number; split?: string; from?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, out, seed, split = C.cyan, from = 1.35, style, children }) => {
  const f = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  const t = f - at;
  if (t < 0) return null;
  const p = spring({ frame: t, fps, config: { stiffness: 420, damping: 28 } });
  const flicker = t < 4 ? [1, 0.25, 1, 0.6][t] : 1;
  const x = out === undefined ? 0 : interpolate(f, [out, out + 5], [0, 1], clamp);
  const amp = (t < 7 ? 1 - t / 7 : 0) + x;
  const jx = (random(`${seed}-${f}`) - 0.5) * W * 0.05 * amp;
  const d = W * (0.003 + 0.02 * amp);
  return (
    <div style={{
      opacity: flicker * (1 - x), transform: `translateX(${jx}px) scale(${from + (1 - from) * p})`,
      textShadow: `${d}px 0 ${C.red}, ${-d}px 0 ${split}, 0 ${W * 0.01}px ${W * 0.05}px rgba(0,0,0,0.6)`, ...style,
    }}>{children}</div>
  );
};

// The clip as the picture: muted, pushed in slowly, punched on a hit, tinted toward the act's colour.
const Plate: React.FC<{ src: string; dim?: number; tint?: string; tintOpacity?: number; punches?: number[]; blur?: number; zoom?: number }> = ({ src, dim = 0.25, tint, tintOpacity = 0.35, punches = [], blur = 0, zoom = 0.1 }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const push = interpolate(f, [0, durationInFrames], [1.04, 1.04 + zoom], clamp);
  const k = punches.reduce((a, at) => a + (f >= at ? spring({ frame: f - at, fps, config: { stiffness: 300, damping: 14 } }) * Math.exp(-(f - at) / 10) : 0), 0);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: C.black }}>
      <AbsoluteFill style={{ transform: `scale(${push + 0.12 * k})`, filter: blur ? `blur(${blur}px)` : undefined }}>
        <ClipLayer src={src} muted dim={dim} />
      </AbsoluteFill>
      {tint ? <AbsoluteFill style={{ background: tint, mixBlendMode: "color", opacity: tintOpacity }} /> : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,6,11,0.6) 0%, rgba(4,6,11,0) 30%, rgba(4,6,11,0) 60%, rgba(4,6,11,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};

// Red alarm light washing over the frame edges.
const Alarm: React.FC<{ period?: number }> = ({ period = 16 }) => {
  const f = useCurrentFrame();
  const a = 0.25 + 0.35 * Math.max(0, Math.sin((f / period) * Math.PI * 2));
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(255,45,61,0) 45%, rgba(255,45,61,${a}) 100%)`, mixBlendMode: "screen" }} />;
};

const Flash: React.FC<{ at: number; color?: string; frames?: number }> = ({ at, color = "#fff", frames = 6 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + 1, at + frames], [0, 0.95, 0], clamp);
  return o > 0 ? <AbsoluteFill style={{ background: color, opacity: o }} /> : null;
};

// Big Latin ghost word behind the Hebrew, outlined.
const Ghost: React.FC<{ text: string; color: string; at: number }> = ({ text, color, at }) => {
  const f = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const o = interpolate(f, [at, at + 4], [0, 0.55], clamp);
  const s = interpolate(f, [at, at + 40], [1.15, 1], { ...clamp, easing: ease.out });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: orbit, fontWeight: 900, fontSize: W * (text.length > 3 ? 0.3 : 0.62), color: "transparent", WebkitTextStroke: `${W * 0.004}px ${color}`, opacity: o, transform: `scale(${s})`, letterSpacing: W * 0.01, direction: "ltr" }}>{text}</div>
    </AbsoluteFill>
  );
};

// Lines of a breach log streaming in (Latin, monospace).
const Log: React.FC<{ lines: string[]; at: number; every?: number }> = ({ lines, at, every = 5 }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: W * 0.08, top: H * 0.6, direction: "ltr", fontFamily: mono, fontSize: W * 0.03, lineHeight: 1.5 }}>
      {lines.map((l, i) => (f >= at + i * every ? <div key={i} style={{ color: i === lines.length - 1 ? C.red : "rgba(244,246,250,0.85)", textShadow: "0 0 8px rgba(255,45,61,0.6)" }}>{l}</div> : null))}
    </div>
  );
};

const Center: React.FC<{ top: number; gap?: number; children: React.ReactNode }> = ({ top, gap = 0, children }) => {
  const { height: H } = useVideoConfig();
  return <div style={{ position: "absolute", left: 0, right: 0, top: H * top, display: "flex", flexDirection: "column", alignItems: "center", gap }}>{children}</div>;
};

const Caps: React.FC<{ s: Scene; hl: string }> = ({ s, hl }) => (
  <Captions words={wordsIn(s)} group="phrase" mode="highlight" highlight={hl} face={heebo} rtl bottom={0.1} />
);

export const Video: React.FC<VideoProps> = ({ manifest, urls }) => {
  const { width: W } = useVideoConfig();
  const S = (id: string) => sceneById(manifest, id) as Scene;
  const sc = ["alert", "breach", "team", "unless", "drop", "ai", "cyber", "custom", "campuses", "gov", "learners", "ready", "cta"].map(S);
  const [alert, breach, team, unless, drop, ai, cyber, custom, campuses, gov, learners, ready, cta] = sc;
  const L = (s: Scene, abs: number) => abs - s.startFrame; // scene-local frame
  const dropF = drop.startFrame;
  const press = say("אבחון");
  return (
    <AbsoluteFill style={{ background: C.black }}>
      {/* ACT 1: the breach */}
      <SceneFrame from={alert.startFrame} durationInFrames={alert.durationFrames} enter="cut" exit="cut">
        <Plate src={urls[MEDIA.eye]} dim={0.15} tint={C.red} tintOpacity={0.45} zoom={0.18} />
        <Alarm />
        <Center top={0.2} gap={W * 0.02}>
          <Glitch at={2} seed={1}><div style={{ ...type(W * 0.2, C.red), fontFamily: mono, direction: "ltr", letterSpacing: W * 0.004 }}>03:00</div></Glitch>
          <Glitch at={L(alert, say("שלוש")) } seed={2}><div style={type(W * 0.11)}>שלוש בלילה.</div></Glitch>
        </Center>
        <Caps s={alert} hl={C.red} />
      </SceneFrame>

      <SceneFrame from={breach.startFrame} durationInFrames={breach.durationFrames} enter="cut" exit="cut">
        <Plate src={urls[MEDIA.hands]} dim={0.2} tint={C.red} tintOpacity={0.3} punches={[L(breach, say("הרשת"))]} />
        <Alarm period={12} />
        <Center top={0.18} gap={W * 0.01}>
          <Glitch at={L(breach, say("מישהו"))} seed={3} from={1.15}><div style={type(W * 0.075, C.ink, 700)}>מישהו כבר</div></Glitch>
          <Glitch at={L(breach, say("בתוך"))} seed={4}><div style={type(W * 0.15)}>בתוך הרשת</div></Glitch>
          <Glitch at={L(breach, say("שלכם"))} seed={5}><div style={type(W * 0.15, C.red)}>שלכם.</div></Glitch>
        </Center>
        <Log at={6} lines={["> login 03:00:07  user=svc_backup", "> privilege escalation ... OK", "> copying /finance/* ...", "!! BREACH DETECTED"]} every={14} />
        <Caps s={breach} hl={C.red} />
      </SceneFrame>

      <SceneFrame from={team.startFrame} durationInFrames={team.durationFrames} enter="cut" exit="cut">
        <Plate src={urls[MEDIA.alarm]} dim={0.15} tint={C.red} tintOpacity={0.35} punches={[L(team, say("יודע"))]} />
        <Alarm period={10} />
        <Center top={0.22} gap={W * 0.02}>
          <Glitch at={L(team, say("והצוות"))} seed={6} from={1.1}><div style={type(W * 0.16)}>והצוות...</div></Glitch>
          <Glitch at={L(team, say("לא"))} seed={7}><div style={type(W * 0.16, C.red)}>לא יודע.</div></Glitch>
        </Center>
        <Caps s={team} hl={C.red} />
      </SceneFrame>

      <SceneFrame from={unless.startFrame} durationInFrames={unless.durationFrames} enter="cut" exit="flash">
        <Plate src={urls[MEDIA.eye]} dim={0.75} blur={6} zoom={0.3} />
        <Center top={0.3} gap={W * 0.02}>
          <Glitch at={L(unless, say("אלא"))} seed={8} from={1.08} out={L(unless, say("מוכן")) - 2}><div style={type(W * 0.1, C.ink, 700)}>אלא אם הוא</div></Glitch>
        </Center>
        <Center top={0.3}>
          <Glitch at={L(unless, say("מוכן"))} seed={9} from={1.6} split={C.gold}><div style={type(W * 0.3, C.ink)}>מוכן.</div></Glitch>
        </Center>
      </SceneFrame>

      {/* ACT 2: the drop */}
      <SceneFrame from={drop.startFrame} durationInFrames={drop.durationFrames} enter="flash" exit="rgb-whip">
        <Plate src={urls[MEDIA.soc]} dim={0.1} punches={[0]} zoom={0.08} />
        <Center top={0.13} gap={W * 0.015}>
          <Glitch at={L(drop, say("המחלקה"))} seed={10} split={C.gold} from={1.2}><div style={type(W * 0.11)}>המחלקה העסקית</div></Glitch>
          <Glitch at={L(drop, say("היחידה"))} seed={11} split={C.blue} from={1.1}><div style={type(W * 0.07, C.gold, 800)}>היחידה ללימודי חוץ</div></Glitch>
        </Center>
        <Flash at={0} frames={8} />
        <Caps s={drop} hl={C.gold} />
      </SceneFrame>

      <SceneFrame from={ai.startFrame} durationInFrames={ai.durationFrames} enter="rgb-whip" exit="cut">
        <Plate src={urls[MEDIA.chip]} dim={0.2} punches={[L(ai, say("בינה"))]} zoom={0.15} />
        <Ghost text="AI" color={C.gold} at={L(ai, say("בינה")) - 2} />
        <Center top={0.36} gap={W * 0.005}>
          <Glitch at={L(ai, say("בינה"))} seed={12} split={C.gold}><div style={type(W * 0.18)}>בינה</div></Glitch>
          <Glitch at={L(ai, say("מלאכותית"))} seed={13} split={C.gold}><div style={type(W * 0.18)}>מלאכותית</div></Glitch>
        </Center>
        <Caps s={ai} hl={C.gold} />
      </SceneFrame>

      <SceneFrame from={cyber.startFrame} durationInFrames={cyber.durationFrames} enter="cut" exit="cut">
        <Plate src={urls[MEDIA.servers]} dim={0.15} punches={[1]} zoom={0.2} />
        <Ghost text="CYBER" color={C.blue} at={0} />
        <Center top={0.38}>
          <Glitch at={0} seed={14} from={1.5}><div style={type(W * 0.3)}>סייבר</div></Glitch>
        </Center>
        <Caps s={cyber} hl={C.gold} />
      </SceneFrame>

      <SceneFrame from={custom.startFrame} durationInFrames={custom.durationFrames} enter="cut" exit="cut">
        <Plate src={urls[MEDIA.network]} dim={0.2} zoom={0.15} punches={[L(custom, say("לארגון"))]} />
        <Center top={0.26} gap={W * 0.01}>
          <Glitch at={L(custom, say("שנבנות"))} seed={15} from={1.1}><div style={type(W * 0.085, C.ink, 700)}>נבנות במיוחד</div></Glitch>
          <Glitch at={L(custom, say("לארגון"))} seed={16} split={C.gold}><div style={type(W * 0.17)}>לארגון</div></Glitch>
          <Glitch at={L(custom, say("שלכם", 2))} seed={17} split={C.blue}><div style={type(W * 0.17, C.gold)}>שלכם.</div></Glitch>
        </Center>
        <Caps s={custom} hl={C.gold} />
      </SceneFrame>

      <SceneFrame from={campuses.startFrame} durationInFrames={campuses.durationFrames} enter="cut" exit="rgb-whip">
        <Plate src={urls[MEDIA.hall]} dim={0.55} blur={4} punches={[L(campuses, say("ארבעה"))]} />
        <Center top={0.2}>
          <Glitch at={L(campuses, say("ארבעה"))} seed={18} from={1.7} split={C.blue}><div style={{ ...type(W * 0.62, C.gold), fontFamily: orbit, direction: "ltr", lineHeight: 0.9 }}>4</div></Glitch>
          <Glitch at={L(campuses, say("קמפוסים"))} seed={19}><div style={type(W * 0.14)}>קמפוסים</div></Glitch>
        </Center>
        <Caps s={campuses} hl={C.gold} />
      </SceneFrame>

      <SceneFrame from={gov.startFrame} durationInFrames={gov.durationFrames} enter="rgb-whip" exit="rgb-whip">
        <Plate src={urls[MEDIA.team]} dim={0.55} blur={4} punches={[L(gov, say("הסמכה"))]} />
        <Center top={0.3} gap={W * 0.01}>
          <Glitch at={L(gov, say("הסמכה"))} seed={20}><div style={type(W * 0.19)}>הסמכה</div></Glitch>
          <Glitch at={L(gov, say("ממשלתית"))} seed={21} split={C.gold}><div style={type(W * 0.19, C.gold)}>ממשלתית</div></Glitch>
        </Center>
        <Caps s={gov} hl={C.gold} />
      </SceneFrame>

      <SceneFrame from={learners.startFrame} durationInFrames={learners.durationFrames} enter="rgb-whip" exit="cut">
        <Plate src={urls[MEDIA.soc]} dim={0.6} blur={5} punches={[L(learners, say("אלפי"))]} />
        <Center top={0.26} gap={W * 0.01}>
          <Glitch at={L(learners, say("אלפי"))} seed={22} from={1.6} split={C.blue}><div style={type(W * 0.3, C.gold)}>אלפי</div></Glitch>
          <Glitch at={L(learners, say("לומדים"))} seed={23}><div style={type(W * 0.12)}>לומדים בשנה</div></Glitch>
        </Center>
        <Caps s={learners} hl={C.gold} />
      </SceneFrame>

      <SceneFrame from={ready.startFrame} durationInFrames={ready.durationFrames} enter="cut" exit="flash">
        <Plate src={urls[MEDIA.hero]} dim={0.1} zoom={0.12} punches={[L(ready, say("מוכן", 2))]} />
        <Center top={0.12} gap={W * 0.01}>
          <Glitch at={L(ready, say("הצוות"))} seed={24} from={1.15}><div style={type(W * 0.12)}>הצוות שלכם.</div></Glitch>
        </Center>
        <Center top={0.56}>
          <Glitch at={L(ready, say("מוכן", 2))} seed={25} from={1.7} split={C.blue}><div style={type(W * 0.3, C.gold)}>מוכן.</div></Glitch>
        </Center>
        <Caps s={ready} hl={C.gold} />
      </SceneFrame>

      <SceneFrame from={cta.startFrame} durationInFrames={cta.durationFrames} enter="flash" exit="cut">
        <Plate src={urls[MEDIA.network]} dim={0.82} blur={3} zoom={0.06} />
        <Center top={0.2} gap={W * 0.01}>
          <Glitch at={4} seed={26} from={1.2} split={C.gold}><div style={type(W * 0.12)}>הצוות שלכם</div></Glitch>
          <Glitch at={8} seed={27} from={1.2} split={C.blue}><div style={type(W * 0.12, C.gold)}>מוכן?</div></Glitch>
        </Center>
        <Center top={0.47}>
          <CtaButton at={L(cta, say("קבעו"))} press={L(cta, press)} />
        </Center>
        <Center top={0.64} gap={W * 0.01}>
          <Glitch at={L(cta, say("קבעו")) + 10} seed={28} from={1.05}><div style={type(W * 0.07, C.ink, 900)}>היחידה ללימודי חוץ</div></Glitch>
          <Glitch at={L(cta, say("קבעו")) + 14} seed={29} from={1.05}><div style={{ ...type(W * 0.045, C.gold, 700), letterSpacing: W * 0.004 }}>המחלקה העסקית</div></Glitch>
        </Center>
        <Caps s={cta} hl={C.gold} />
      </SceneFrame>

      {/* HUD per act */}
      <Sequence from={0} durationInFrames={dropF}>
        <HudOverlay labels={["SECURITY ALERT", "NODE-07", "THREAT: HIGH", "LIVE"]} hero={C.red} font={mono} />
      </Sequence>
      <Sequence from={dropF} durationInFrames={cta.startFrame - dropF}>
        <HudOverlay labels={["YEHIDA // B2B", "AI + CYBER", "TRAINING", "ONLINE"]} hero={C.gold} font={mono} />
      </Sequence>

      {/* sound: premixed voice + music, effects on the hits */}
      <Audio src={urls[MEDIA.soundtrack]} />
      <Sfx src={urls[SFX.glitchAll]} at={0} volume={0.35} />
      <Sfx src={urls[SFX.alarm]} at={6} volume={0.18} />
      <Sfx src={urls[SFX.glitch]} at={breach.startFrame - 1} volume={0.3} />
      <Sfx src={urls[SFX.glitch]} at={team.startFrame - 1} volume={0.3} />
      <Sfx src={urls[SFX.glitch]} at={unless.startFrame - 1} volume={0.3} />
      <Sfx src={urls[SFX.riser]} at={dropF - 60} volume={0.35} />
      <Sfx src={urls[SFX.drop]} at={dropF - 1} volume={0.5} />
      <Sfx src={urls[SFX.impact]} at={dropF - 1} volume={0.45} />
      <Sfx src={urls[SFX.whoosh]} at={ai.startFrame - 4} volume={0.3} />
      <Sfx src={urls[SFX.glitch]} at={cyber.startFrame - 1} volume={0.3} />
      <Sfx src={urls[SFX.whoosh]} at={custom.startFrame - 4} volume={0.25} />
      <Sfx src={urls[SFX.impact]} at={say("ארבעה")} volume={0.35} />
      <Sfx src={urls[SFX.impact]} at={say("הסמכה")} volume={0.3} />
      <Sfx src={urls[SFX.impact]} at={say("אלפי")} volume={0.35} />
      <Sfx src={urls[SFX.boom]} at={say("מוכן", 2)} volume={0.4} />
      <Sfx src={urls[SFX.shutter]} at={press - 1} volume={0.35} />

      <Grade color={C.blue} strength={0.12} />
      <Grain blend="overlay" />
      <Vignette strength={0.5} />
    </AbsoluteFill>
  );
};

// The call to action: a gold pill that lands, then presses.
const CtaButton: React.FC<{ at: number; press: number }> = ({ at, press }) => {
  const f = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  if (f < at) return null;
  const p = spring({ frame: f - at, fps, config: { stiffness: 300, damping: 20 } });
  const k = interpolate(f, [press - 2, press + 1, press + 7], [1, 0.92, 1], clamp);
  const ring = spring({ frame: f - press, fps, config: springs.smooth });
  const glow = 0.45 + 0.2 * Math.sin(f / 6);
  return (
    <div style={{ position: "relative", transform: `scale(${(0.7 + 0.3 * p) * k})`, opacity: Math.min(1, (f - at) / 3) }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: W, border: `${W * 0.005}px solid ${C.gold}`, transform: `scale(${1 + ring * 0.3})`, opacity: f >= press ? 1 - ring : 0 }} />
      <div style={{ background: C.gold, borderRadius: W, padding: `${W * 0.035}px ${W * 0.09}px`, boxShadow: `0 0 ${W * 0.09}px rgba(245,184,61,${glow})` }}>
        <div style={{ ...type(W * 0.065, C.goldInk, 900) }}>קבעו פגישת אבחון</div>
      </div>
    </div>
  );
};
