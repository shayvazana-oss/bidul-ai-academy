import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "reelkit/frame";
import { Captions, ClipLayer, ease, font, Grade, Grain, Music, onWord, sceneById, SceneFrame, Sfx, springs, Vignette, Voiceover, wordFrame } from "reelkit/kit";
import type { VideoProps } from "reelkit/kit";

// Premium cinematic: deep navy grade, white type, one gold word per scene.
const C = {
  ink: "#F4F6FA",
  soft: "rgba(244,246,250,0.72)",
  gold: "#F5B83D",
  goldInk: "#241600",
  navy: "#0A0F1F",
  grade: "#1B3A6B",
};
const heebo = font("heebo");

const CLIP = {
  hall: "assets/broll/hall.mp4",
  network: "assets/broll/network.mp4",
  servers: "assets/broll/servers.mp4",
  team: "assets/broll/team.mp4",
};
const SFX = {
  whoosh: "assets/lib/quantum-motion-whooshes-flow-whoosh-soft-swipe/clip.mp3",
  boom: "assets/lib/cinematic-hits-hits-boom/clip.mp3",
  deep: "assets/lib/invention-impact-impact-cinematic-deep/clip.mp3",
  click: "assets/lib/youtube-picks-interface-mouse-click/clip.mp3",
};

type Scene = VideoProps["manifest"]["scenes"][number];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const line = (size: number, color: string = C.ink, weight = 900): React.CSSProperties => ({
  fontFamily: heebo,
  fontWeight: weight,
  fontSize: size,
  color,
  direction: "rtl",
  whiteSpace: "nowrap",
  lineHeight: 0.98,
  letterSpacing: -size * 0.02,
  textShadow: `0 ${size * 0.04}px ${size * 0.18}px rgba(0,0,0,0.55)`,
});

// Whole-word Hebrew entrance: in within 3 frames, settling from slightly larger and out of a short blur. No masks.
const Hit: React.FC<{ at: number; out?: number; from?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, out, from = 1.14, style, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - at, fps, config: { stiffness: 260, damping: 26 } });
  const o = interpolate(f, [at, at + 3], [0, 1], clamp);
  const x = out === undefined ? 0 : interpolate(f, [out, out + 6], [0, 1], { ...clamp, easing: ease.in });
  const blur = interpolate(f, [at, at + 5], [10, 0], clamp) + x * 12;
  return (
    <div style={{ opacity: o * (1 - x), transform: `scale(${(from + (1 - from) * p) * (1 - 0.04 * x)})`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined, ...style }}>
      {children}
    </div>
  );
};

// A gold rule that draws from the right (where Hebrew reading starts) under a word.
const Rule: React.FC<{ at: number; width: number; out?: number }> = ({ at, width, out }) => {
  const f = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  const p = spring({ frame: f - at, fps, config: springs.smooth });
  const x = out === undefined ? 0 : interpolate(f, [out, out + 6], [0, 1], clamp);
  return <div style={{ width, height: W * 0.012, background: C.gold, borderRadius: W, transform: `scaleX(${p})`, transformOrigin: "right center", opacity: 1 - x, boxShadow: `0 0 ${W * 0.03}px rgba(245,184,61,0.55)` }} />;
};

// The clip as the picture: muted, graded dark, a slow push and an optional punch on a word.
const Plate: React.FC<{ src: string; dim: number; punch?: number; blur?: number }> = ({ src, dim, punch, blur = 0 }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const push = interpolate(f, [0, durationInFrames], [1.02, 1.1], clamp);
  const k = punch === undefined ? 0 : spring({ frame: f - punch, fps, config: { stiffness: 180, damping: 18 } });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${push + 0.07 * k})`, filter: blur ? `blur(${blur}px)` : undefined }}>
        <ClipLayer src={src} muted dim={dim} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,8,18,0.55) 0%, rgba(5,8,18,0) 38%, rgba(5,8,18,0) 62%, rgba(5,8,18,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};

const Stack: React.FC<{ top: number; gap?: number; children: React.ReactNode }> = ({ top, gap = 0, children }) => {
  const { height: H } = useVideoConfig();
  return <div style={{ position: "absolute", left: 0, right: 0, top: H * top, display: "flex", flexDirection: "column", alignItems: "center", gap }}>{children}</div>;
};

// ---------- scenes ----------
const Hook: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const { width: W } = useVideoConfig();
  const team = onWord(s, "הצוות");
  return (
    <AbsoluteFill>
      <Plate src={urls[CLIP.hall]} dim={0.25} punch={team} />
      <Stack top={0.3} gap={W * 0.03}>
        <Hit at={0} out={team - 3}><div style={line(W * 0.07, C.soft, 700)}>קורס מדף נבנה</div></Hit>
        <Hit at={onWord(s, "לכולם")} out={team - 3}><div style={line(W * 0.25)}>לכולם.</div></Hit>
      </Stack>
      <Stack top={0.29} gap={W * 0.01}>
        <Hit at={team} from={1.2}><div style={line(W * 0.24, C.gold)}>הצוות</div></Hit>
        <Hit at={onWord(s, "שלכם")} from={1.2}><div style={line(W * 0.24, C.gold)}>שלכם</div></Hit>
        <Hit at={onWord(s, "לא")} from={1.06} style={{ marginTop: W * 0.02 }}><div style={line(W * 0.065, C.ink, 700)}>הוא לא כולם.</div></Hit>
      </Stack>
      <Sfx src={urls[SFX.boom]} at={wordFrame(s, "הצוות")} volume={0.3} />
    </AbsoluteFill>
  );
};

const Ai: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const { width: W } = useVideoConfig();
  const bina = onWord(s, "בבינה");
  return (
    <AbsoluteFill>
      <Plate src={urls[CLIP.network]} dim={0.3} punch={bina} />
      <Stack top={0.3} gap={W * 0.025}>
        <Hit at={onWord(s, "המחלקה")} out={bina - 3}><div style={line(W * 0.12)}>המחלקה העסקית</div></Hit>
        <Hit at={onWord(s, "היחידה")} out={bina - 3} from={1.06}><div style={line(W * 0.055, C.gold, 700)}>היחידה ללימודי חוץ</div></Hit>
      </Stack>
      <Stack top={0.28} gap={W * 0.015}>
        <Hit at={bina}><div style={line(W * 0.2)}>בינה</div></Hit>
        <Hit at={onWord(s, "מלאכותית")}><div style={line(W * 0.2)}>מלאכותית</div></Hit>
        <div style={{ marginTop: W * 0.03 }}><Rule at={onWord(s, "מלאכותית") + 4} width={W * 0.5} /></div>
      </Stack>
      <Sfx src={urls[SFX.deep]} at={wordFrame(s, "בבינה")} volume={0.25} />
    </AbsoluteFill>
  );
};

const Cyber: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const { width: W } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Plate src={urls[CLIP.servers]} dim={0.2} punch={0} />
      <Stack top={0.28} gap={W * 0.03}>
        <Hit at={onWord(s, "ובסייבר")} from={1.25}><div style={line(W * 0.27)}>סייבר</div></Hit>
        <Rule at={onWord(s, "ובסייבר") + 6} width={W * 0.42} />
        <div style={{ display: "flex", direction: "rtl", gap: W * 0.025, marginTop: W * 0.04 }}>
          <Hit at={onWord(s, "מאפס")}><div style={line(W * 0.085, C.gold)}>מאפס.</div></Hit>
          <Hit at={onWord(s, "לכל")}><div style={line(W * 0.085)}>לכל ארגון.</div></Hit>
        </div>
      </Stack>
    </AbsoluteFill>
  );
};

const Process: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const { width: W } = useVideoConfig();
  const a = 0, b = onWord(s, "סילבוס"), c = onWord(s, "ומרצים");
  const step = (n: string, at: number, out: number | undefined, body: React.ReactNode) => (
    <Stack top={0.135} gap={W * 0.015}>
      <Hit at={at} out={out} from={1.06}><div style={{ ...line(W * 0.06, C.gold, 800), direction: "ltr", letterSpacing: W * 0.004 }}>{n}</div></Hit>
      {body}
    </Stack>
  );
  return (
    <AbsoluteFill>
      <Plate src={urls[CLIP.team]} dim={0.15} />
      {step("01", a, b - 3, <Hit at={a} out={b - 3}><div style={line(W * 0.22)}>אבחון</div></Hit>)}
      {step("02", b, c - 3, (
        <>
          <Hit at={b} out={c - 3}><div style={line(W * 0.2)}>סילבוס</div></Hit>
          <Hit at={onWord(s, "הדאטה")} out={c - 3} from={1.06}><div style={line(W * 0.065, C.gold, 800)}>על הדאטה שלכם</div></Hit>
        </>
      ))}
      {step("03", c, undefined, (
        <>
          <Hit at={c}><div style={line(W * 0.15)}>מרצים</div></Hit>
          <Hit at={onWord(s, "מהתעשייה")}><div style={line(W * 0.15)}>מהתעשייה</div></Hit>
        </>
      ))}
      <Sfx src={urls[SFX.whoosh]} at={wordFrame(s, "סילבוס") - 3} volume={0.2} />
      <Sfx src={urls[SFX.whoosh]} at={wordFrame(s, "ומרצים") - 3} volume={0.2} />
    </AbsoluteFill>
  );
};

const Proof: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const { width: W } = useVideoConfig();
  const b = onWord(s, "הסמכה"), c = onWord(s, "אלפי");
  return (
    <AbsoluteFill>
      <Plate src={urls[CLIP.team]} dim={0.72} blur={18} />
      <Stack top={0.2}>
        <Hit at={0} out={b - 3} from={1.3}><div style={{ ...line(W * 0.55, C.gold), direction: "ltr", lineHeight: 0.9 }}>4</div></Hit>
        <Hit at={onWord(s, "קמפוסים")} out={b - 3}><div style={line(W * 0.13)}>קמפוסים</div></Hit>
      </Stack>
      <Stack top={0.3} gap={W * 0.01}>
        <Hit at={b} out={c - 3}><div style={line(W * 0.17)}>הסמכה</div></Hit>
        <Hit at={onWord(s, "ממשלתית")} out={c - 3}><div style={line(W * 0.17)}>ממשלתית</div></Hit>
      </Stack>
      <Stack top={0.29} gap={W * 0.015}>
        <Hit at={c} from={1.25}><div style={line(W * 0.26, C.gold)}>אלפי</div></Hit>
        <Hit at={onWord(s, "לומדים")}><div style={line(W * 0.1)}>לומדים בשנה</div></Hit>
      </Stack>
      <Sfx src={urls[SFX.deep]} at={wordFrame(s, "ארבעה")} volume={0.28} />
      <Sfx src={urls[SFX.whoosh]} at={wordFrame(s, "הסמכה") - 3} volume={0.18} />
      <Sfx src={urls[SFX.whoosh]} at={wordFrame(s, "אלפי") - 3} volume={0.18} />
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const pressF = wordFrame(s, "אבחון");
  const press = interpolate(f, [pressF - 2, pressF + 1, pressF + 7], [1, 0.93, 1], clamp);
  const ring = spring({ frame: f - pressF, fps, config: springs.smooth });
  const glow = 0.35 + 0.15 * Math.sin(f / 14);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(${W * 1.1}px ${H * 0.45}px at 50% 42%, #18264F 0%, ${C.navy} 70%)` }}>
      <div style={{ position: "absolute", left: W * 0.15, width: W * 0.7, height: W * 0.7, top: H * 0.25, borderRadius: "50%", background: `rgba(245,184,61,${glow * 0.25})`, filter: `blur(${W * 0.14}px)` }} />
      <Stack top={0.22} gap={W * 0.01}>
        <Hit at={onWord(s, "לצוות")}><div style={line(W * 0.15)}>לצוות</div></Hit>
        <Hit at={onWord(s, "שלכם")}><div style={line(W * 0.15, C.gold)}>שלכם?</div></Hit>
      </Stack>
      <Stack top={0.47}>
        <Hit at={onWord(s, "מתחילים")} from={1.1}>
          <div style={{ position: "relative", transform: `scale(${press})` }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: W, border: `${W * 0.004}px solid ${C.gold}`, transform: `scale(${1 + ring * 0.22})`, opacity: f >= pressF ? 1 - ring : 0 }} />
            <div style={{ background: C.gold, borderRadius: W, padding: `${W * 0.032}px ${W * 0.085}px`, boxShadow: `0 0 ${W * 0.07}px rgba(245,184,61,0.45)` }}>
              <div style={{ ...line(W * 0.06, C.goldInk, 900), textShadow: "none" }}>לקביעת פגישת אבחון</div>
            </div>
          </div>
        </Hit>
      </Stack>
      <Stack top={0.62} gap={W * 0.012}>
        <Hit at={onWord(s, "מתחילים") + 8} from={1.04}><div style={line(W * 0.068, C.ink, 900)}>היחידה ללימודי חוץ</div></Hit>
        <Hit at={onWord(s, "מתחילים") + 11} from={1.04}><div style={{ ...line(W * 0.042, C.gold, 700), letterSpacing: W * 0.003 }}>המחלקה העסקית</div></Hit>
      </Stack>
      <Sfx src={urls[SFX.click]} at={pressF - 1} volume={0.3} />
    </AbsoluteFill>
  );
};

export const Video: React.FC<VideoProps> = ({ manifest, urls }) => {
  const hook = sceneById(manifest, "hook");
  const ai = sceneById(manifest, "ai");
  const cyber = sceneById(manifest, "cyber");
  const process = sceneById(manifest, "process");
  const proof = sceneById(manifest, "proof");
  const cta = sceneById(manifest, "cta");
  const voice = (s: Scene) => (
    <>
      <Captions words={s.words} group={manifest.captions} mode="highlight" highlight={C.gold} face={heebo} rtl bottom={0.11} />
      {s.voiceoverKey ? <Voiceover src={urls[s.voiceoverKey]} /> : null}
    </>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <SceneFrame from={hook.startFrame} durationInFrames={hook.durationFrames} enter="cut" exit="zoom-through"><Hook s={hook} urls={urls} />{voice(hook)}</SceneFrame>
      <SceneFrame from={ai.startFrame} durationInFrames={ai.durationFrames} enter="zoom-through" exit="whip-left" transitionFrames={6}><Ai s={ai} urls={urls} />{voice(ai)}</SceneFrame>
      <SceneFrame from={cyber.startFrame} durationInFrames={cyber.durationFrames} enter="whip-left" exit="blur" transitionFrames={6}><Cyber s={cyber} urls={urls} />{voice(cyber)}</SceneFrame>
      <SceneFrame from={process.startFrame} durationInFrames={process.durationFrames} enter="blur" exit="zoom-through" transitionFrames={6}><Process s={process} urls={urls} />{voice(process)}</SceneFrame>
      <SceneFrame from={proof.startFrame} durationInFrames={proof.durationFrames} enter="zoom-through" exit="fade"><Proof s={proof} urls={urls} />{voice(proof)}</SceneFrame>
      <SceneFrame from={cta.startFrame} durationInFrames={cta.durationFrames} enter="fade" exit="cut"><Cta s={cta} urls={urls} />{voice(cta)}</SceneFrame>
      <Sfx src={urls[SFX.whoosh]} at={ai.startFrame - 6} volume={0.22} />
      <Sfx src={urls[SFX.whoosh]} at={cyber.startFrame - 5} volume={0.22} />
      <Sfx src={urls[SFX.whoosh]} at={process.startFrame - 5} volume={0.2} />
      <Sfx src={urls[SFX.whoosh]} at={proof.startFrame - 6} volume={0.2} />
      {manifest.music ? <Music src={urls[manifest.music.key]} /> : null}
      <Grade color={C.grade} strength={0.22} />
      <Grain blend="overlay" />
      <Vignette strength={0.45} />
    </AbsoluteFill>
  );
};
