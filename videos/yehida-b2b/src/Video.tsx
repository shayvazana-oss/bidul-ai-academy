import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "reelkit/frame";
import { Captions, ease, font, Grade, Grain, Music, onWord, sceneById, SceneFrame, Sfx, springs, Vignette, Voiceover, wordFrame } from "reelkit/kit";
import type { VideoProps } from "reelkit/kit";

// House palette of the Yehida carousels: navy ground, brand blue, gold.
const C = {
  bg: "#0A0F1F",
  bg2: "#15214A",
  ink: "#F4F6FA",
  mut: "#97A3BC",
  blue: "#4C9BFF",
  gold: "#F5B83D",
  goldInk: "#2A1A00",
  red: "#FF5A5F",
  glassA: "rgba(255,255,255,0.085)",
  glassB: "rgba(255,255,255,0.025)",
  line: "rgba(255,255,255,0.14)",
};
const heebo = font("heebo");

const SFX = {
  whoosh: "assets/lib/sfx-ui-soft-whoosh/clip.mp3",
  impact: "assets/lib/sfx-ui-soft-impact/clip.mp3",
  click: "assets/lib/youtube-picks-interface-mouse-click/clip.mp3",
  chime: "assets/lib/sfx-ui-success-chime/clip.mp3",
  pop: "assets/lib/sfx-ui-bubble-pop/clip.mp3",
};
const ICON = {
  box: "assets/icons/box.png",
  check: "assets/icons/check.png",
  brain: "assets/icons/brain.png",
  shield: "assets/icons/shield.png",
  pin: "assets/icons/pin.png",
  cap: "assets/icons/cap.png",
  search: "assets/icons/search.png",
  page: "assets/icons/page.png",
  teacher: "assets/icons/teacher.png",
  trophy: "assets/icons/trophy.png",
  scroll: "assets/icons/scroll.png",
  shake: "assets/icons/shake.png",
};
const PHOTO = {
  desk: "assets/user/a-7f07093b-hero.webp",
  circuit: "assets/user/a-971a7bac-circuit.webp",
  lock: "assets/user/a-3805aaf6-grc.webp",
  training: "assets/user/a-a9270a45-lab4.webp",
  team: "assets/user/a-17626e1a-lab2.webp",
};

type Scene = VideoProps["manifest"]["scenes"][number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Hebrew text: one line, never wrapped by the renderer, right to left.
const he = (size: number, weight: number, color: string = C.ink): React.CSSProperties => ({
  fontFamily: heebo,
  fontSize: size,
  fontWeight: weight,
  color,
  direction: "rtl",
  whiteSpace: "nowrap",
  lineHeight: 1.1,
});

const glass = (w: number, radius = 0.04): React.CSSProperties => ({
  background: `linear-gradient(180deg, ${C.glassA}, ${C.glassB})`,
  border: `${Math.max(2, w * 0.0016)}px solid ${C.line}`,
  borderRadius: w * radius,
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 ${w * 0.022}px ${w * 0.055}px rgba(0,0,0,0.45)`,
});

// Whole-word entrance for Hebrew: opacity in 3 frames, a short rise and a scale settle. No masks.
const Pop: React.FC<{ at: number; exitAt?: number; rise?: number; from?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, exitAt, rise, from = 1.08, style, children }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: springs.snappy });
  const inO = interpolate(frame, [at, at + 3], [0, 1], clamp);
  const out = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 8], [0, 1], { ...clamp, easing: ease.in });
  const r = rise ?? height * 0.015;
  return (
    <div style={{ opacity: inO * (1 - out), transform: `translateY(${(1 - p) * r - out * r}px) scale(${from + (1 - from) * p})`, ...style }}>
      {children}
    </div>
  );
};

// A full-bleed photo with a slow push, darkened toward the navy ground.
const Photo: React.FC<{ src: string; dim: number; top?: number; height?: number; fadeBottom?: boolean; dir?: 1 | -1 }> = ({ src, dim, top = 0, height = 1, fadeBottom, dir = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], clamp);
  const scale = 1.06 + 0.06 * (dir === 1 ? t : 1 - t);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: `${top * 100}%`, height: `${height * 100}%`, overflow: "hidden" }}>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${(t - 0.5) * 2 * dir}%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `rgba(10,15,31,${dim})` }} />
      {fadeBottom ? <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(10,15,31,0) 35%, ${C.bg} 100%)` }} /> : null}
    </div>
  );
};

const Icon3D: React.FC<{ src: string; size: number; style?: React.CSSProperties }> = ({ src, size, style }) => (
  <Img src={src} style={{ width: size, height: size, filter: `drop-shadow(0 ${size * 0.06}px ${size * 0.08}px rgba(0,0,0,0.55))`, ...style }} />
);

// The navy ground with two slow glows (brand blue and a faint gold).
const Ground: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const a = Math.sin(frame / 90), b = Math.cos(frame / 120);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(${width * 1.2}px ${height * 0.5}px at 50% -6%, ${C.bg2} 0%, ${C.bg} 60%)` }}>
      <div style={{ position: "absolute", width: width * 0.9, height: width * 0.9, borderRadius: "50%", background: "rgba(47,111,235,0.30)", filter: `blur(${width * 0.12}px)`, left: -width * 0.35 + a * width * 0.05, top: height * 0.55 + b * height * 0.02 }} />
      <div style={{ position: "absolute", width: width * 0.6, height: width * 0.6, borderRadius: "50%", background: "rgba(245,184,61,0.10)", filter: `blur(${width * 0.12}px)`, right: -width * 0.2 + b * width * 0.04, top: height * 0.12 + a * height * 0.02 }} />
    </AbsoluteFill>
  );
};

// ---------- 1. Hook: a shelf of identical courses, one becomes yours ----------
const Hook: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const shelfAt = onWord(s, "מדף");
  const pickAt = onWord(s, "הצוות");
  const pick = spring({ frame: frame - pickAt, fps, config: springs.smooth });
  const cw = W * 0.2, ch = W * 0.28, gap = W * 0.025, chosen = 1;
  return (
    <AbsoluteFill>
      <Photo src={urls[PHOTO.desk]} dim={0.62} />
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.42 - ch / 2, display: "flex", justifyContent: "center", direction: "rtl", gap }}>
        {[0, 1, 2, 3].map((i) => {
          const isPick = i === chosen;
          const shift = (1.5 - i) * (cw + gap); // RTL: card 0 is rightmost
          const dimOthers = isPick ? 1 : interpolate(pick, [0, 1], [1, 0.28]);
          const t = isPick ? pick : 0;
          const border = isPick ? `rgba(245,184,61,${0.15 + 0.85 * t})` : C.line;
          return (
            <Pop key={i} at={shelfAt + i * 3} style={{ position: "relative", zIndex: isPick ? 2 : 1 }}>
              <div style={{
                ...glass(W, 0.03), width: cw, height: ch, opacity: dimOthers,
                background: isPick && t > 0.01 ? `linear-gradient(180deg, rgba(28,38,72,${0.35 + 0.65 * t}), rgba(14,20,40,${0.35 + 0.65 * t}))` : glass(W).background,
                border: `${W * 0.003}px solid ${border}`,
                boxShadow: isPick ? `0 0 ${W * 0.08 * t}px rgba(245,184,61,${0.45 * t}), 0 ${W * 0.02}px ${W * 0.05}px rgba(0,0,0,0.5)` : glass(W).boxShadow,
                transform: `translate(${-shift * t}px, ${-H * 0.07 * t}px) scale(${1 + 0.85 * t})`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: W * 0.018,
                position: "relative",
              }}>
                <div style={{ position: "relative", width: W * 0.1, height: W * 0.1 }}>
                  <Icon3D src={urls[ICON.box]} size={W * 0.1} style={{ position: "absolute", opacity: 1 - t }} />
                  <Icon3D src={urls[ICON.check]} size={W * 0.1} style={{ position: "absolute", opacity: t }} />
                </div>
                <div style={{ position: "relative", height: W * 0.04, width: "100%", display: "flex", justifyContent: "center" }}>
                  <div style={{ ...he(W * 0.034, 700, C.mut), position: "absolute", opacity: 1 - t }}>קורס מדף</div>
                  <div style={{ ...he(W * 0.03, 900, C.gold), position: "absolute", opacity: t }}>הצוות שלכם</div>
                </div>
              </div>
            </Pop>
          );
        })}
      </div>
      {/* the shelf itself */}
      <Pop at={shelfAt} style={{ position: "absolute", left: W * 0.06, right: W * 0.06, top: H * 0.42 + ch / 2 + W * 0.02 }}>
        <div style={{ height: W * 0.008, borderRadius: W, background: "rgba(255,255,255,0.18)", opacity: interpolate(pick, [0, 1], [1, 0.4]) }} />
      </Pop>
      <Sfx src={urls[SFX.whoosh]} at={Math.max(0, shelfAt - 2)} volume={0.2} />
      <Sfx src={urls[SFX.impact]} at={wordFrame(s, "הצוות") + 4} volume={0.25} />
    </AbsoluteFill>
  );
};

// ---------- 2. What: the department, AI and cyber ----------
const What: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const push = 1 + 0.03 * interpolate(frame, [0, durationInFrames], [0, 1], clamp);
  const card = (photo: string, icon: string, label: string, at: number) => (
    <Pop at={at} rise={H * 0.03} from={0.92}>
      <div style={{ ...glass(W, 0.04), width: W * 0.41, height: W * 0.74, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "58%", overflow: "hidden" }}>
          <Img src={urls[photo]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(10,15,31,0.15) 0%, rgba(10,15,31,0.9) 100%)` }} />
        </div>
        <Icon3D src={urls[icon]} size={W * 0.2} style={{ position: "absolute", left: "50%", top: "58%", transform: "translate(-50%, -62%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: W * 0.07, display: "flex", justifyContent: "center" }}>
          <div style={he(W * 0.052, 900)}>{label}</div>
        </div>
      </div>
    </Pop>
  );
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.1, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.015 }}>
        <Pop at={onWord(s, "המחלקה")}><div style={he(W * 0.085, 900)}>המחלקה העסקית</div></Pop>
        <Pop at={onWord(s, "היחידה")}><div style={he(W * 0.038, 500, C.mut)}>היחידה ללימודי חוץ</div></Pop>
      </div>
      <div style={{ position: "absolute", left: W * 0.06, right: W * 0.06, top: H * 0.265, display: "flex", justifyContent: "space-between", direction: "rtl" }}>
        {card(PHOTO.circuit, ICON.brain, "בינה מלאכותית", onWord(s, "בבינה"))}
        {card(PHOTO.lock, ICON.shield, "סייבר", onWord(s, "ובסייבר"))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.265 + W * 0.74 - W * 0.05, display: "flex", justifyContent: "center" }}>
        <Pop at={onWord(s, "מאפס")} from={1.25}>
          <div style={{ background: C.gold, borderRadius: W, padding: `${W * 0.012}px ${W * 0.06}px`, boxShadow: `0 0 ${W * 0.05}px rgba(245,184,61,0.5)` }}>
            <div style={he(W * 0.055, 900, C.goldInk)}>מאפס</div>
          </div>
        </Pop>
      </div>
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "בבינה")} volume={0.22} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "ובסייבר")} volume={0.22} />
      <Sfx src={urls[SFX.impact]} at={wordFrame(s, "מאפס")} volume={0.25} />
    </AbsoluteFill>
  );
};

// ---------- 3. Trust: three facts ----------
const Trust: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const { width: W, height: H } = useVideoConfig();
  const row = (icon: string, at: number, content: React.ReactNode) => (
    <Pop at={at} rise={H * 0.02} from={0.95}>
      <div style={{ ...glass(W, 0.035), width: W * 0.86, height: W * 0.22, display: "flex", alignItems: "center", direction: "rtl", gap: W * 0.04, padding: `0 ${W * 0.05}px`, boxSizing: "border-box" }}>
        <Icon3D src={urls[icon]} size={W * 0.14} />
        {content}
      </div>
    </Pop>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: H * 0.26, gap: W * 0.045 }}>
      {row(ICON.pin, onWord(s, "ארבעה"), (
        <div style={{ display: "flex", alignItems: "baseline", gap: W * 0.03, direction: "rtl" }}>
          <div style={{ ...he(W * 0.15, 900, C.gold), direction: "ltr", lineHeight: 1 }}>4</div>
          <div style={he(W * 0.07, 800)}>קמפוסים</div>
        </div>
      ))}
      {row(ICON.check, onWord(s, "הסמכה"), <div style={he(W * 0.07, 800)}>הסמכה ממשלתית</div>)}
      {row(ICON.cap, onWord(s, "ואלפי"), (
        <div style={{ display: "flex", alignItems: "baseline", gap: W * 0.022, direction: "rtl" }}>
          <div style={he(W * 0.07, 900, C.gold)}>אלפי</div>
          <div style={he(W * 0.06, 800)}>לומדים בשנה</div>
        </div>
      ))}
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "ארבעה") + 2} volume={0.22} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "הסמכה")} volume={0.22} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "ואלפי")} volume={0.22} />
    </AbsoluteFill>
  );
};

// A step headline that sits under the tracker.
const StepTitle: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const { width: W, height: H } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.185, display: "flex", justifyContent: "center", gap: W * 0.025, direction: "rtl" }}>
      <Pop at={at}>{children}</Pop>
    </div>
  );
};

// ---------- 4. Diagnose: find the gaps ----------
const Diagnose: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const team = onWord(s, "הצוות");
  const gapF = wordFrame(s, "הפערים");
  const fills = [0.82, 0.66, 0.28];
  const rowH = W * 0.15, rowGap = W * 0.045, top = H * 0.3, padTop = W * 0.06;
  const rowY = (i: number) => top + padTop + i * (rowH + rowGap) + rowH / 2;
  const lensY = interpolate(frame, [team, team + 12, gapF - 14, gapF - 2], [rowY(0), rowY(0), rowY(2), rowY(2)], { ...clamp, easing: ease.inOut });
  const lensO = interpolate(frame, [team, team + 4], [0, 1], clamp);
  const gapOn = spring({ frame: frame - (gapF - 3), fps, config: springs.snappy });
  return (
    <AbsoluteFill>
      <StepTitle at={onWord(s, "אבחון")}><div style={he(W * 0.09, 900)}>אבחון צרכים</div></StepTitle>
      <Pop at={onWord(s, "פגישת")} from={0.96} style={{ position: "absolute", left: W * 0.07, right: W * 0.07, top }}>
        <div style={{ ...glass(W, 0.04), padding: `${padTop}px ${W * 0.06}px`, display: "flex", flexDirection: "column", gap: rowGap, boxSizing: "border-box" }}>
          {fills.map((f, i) => {
            const grow = interpolate(frame, [team + i * 4, team + i * 4 + 18], [0, f], { ...clamp, easing: ease.out });
            const isGap = i === 2;
            return (
              <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: W * 0.04, direction: "rtl" }}>
                <div style={{ width: W * 0.16, height: W * 0.035, borderRadius: W, background: "rgba(255,255,255,0.22)" }} />
                {/* meters fill left to right, as every progress bar does */}
                <div style={{ flex: 1, height: W * 0.05, borderRadius: W, background: "rgba(255,255,255,0.08)", position: "relative", direction: "ltr", border: isGap ? `${W * 0.003}px solid rgba(245,184,61,${gapOn})` : "none" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${grow * 100}%`, borderRadius: W, background: C.blue }} />
                  {isGap ? (
                    <div style={{ position: "absolute", left: `${f * 100}%`, top: 0, bottom: 0, width: `${(0.88 - f) * 100 * gapOn}%`, borderRadius: W, background: "repeating-linear-gradient(90deg, rgba(245,184,61,0.85) 0 10px, rgba(245,184,61,0.25) 10px 20px)" }} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Pop>
      <div style={{ position: "absolute", left: W * 0.5, top: lensY - W * 0.13, opacity: lensO, transform: `rotate(${interpolate(frame, [team, gapF], [-8, 6], clamp)}deg)` }}>
        <Icon3D src={urls[ICON.search]} size={W * 0.26} />
      </div>
      <div style={{ position: "absolute", left: W * 0.1, top: rowY(2) + rowH * 0.55, opacity: interpolate(gapOn, [0, 1], [0, 1]), transform: `scale(${0.8 + 0.2 * gapOn})` }}>
        <div style={{ background: C.gold, borderRadius: W, padding: `${W * 0.006}px ${W * 0.035}px` }}>
          <div style={he(W * 0.042, 900, C.goldInk)}>פער</div>
        </div>
      </div>
      <Sfx src={urls[SFX.whoosh]} at={team} volume={0.16} />
      <Sfx src={urls[SFX.impact]} at={gapF} volume={0.25} />
    </AbsoluteFill>
  );
};

// ---------- 5. Syllabus: written on your tools, processes and data ----------
const Syllabus: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const strikeF = wordFrame(s, "מהאינטרנט");
  const strike = interpolate(frame, [strikeF - 2, strikeF + 8], [0, 1], { ...clamp, easing: ease.out });
  const line = (text: string, at: number, icon: React.ReactNode, color: string = C.ink) => (
    <Pop at={at} rise={H * 0.012}>
      <div style={{ display: "flex", alignItems: "center", gap: W * 0.035, direction: "rtl", height: W * 0.12 }}>
        {icon}
        <div style={he(W * 0.06, 800, color)}>{text}</div>
      </div>
    </Pop>
  );
  return (
    <AbsoluteFill>
      <StepTitle at={onWord(s, "סילבוס")}><div style={he(W * 0.09, 900)}>סילבוס <span style={{ color: C.gold }}>מותאם</span></div></StepTitle>
      <Pop at={onWord(s, "סילבוס")} from={0.96} style={{ position: "absolute", left: W * 0.1, right: W * 0.1, top: H * 0.3 }}>
        <div style={{ ...glass(W, 0.04), height: W * 0.78, padding: `${W * 0.13}px ${W * 0.07}px 0`, boxSizing: "border-box", position: "relative" }}>
          <Icon3D src={urls[ICON.page]} size={W * 0.17} style={{ position: "absolute", right: -W * 0.03, top: -W * 0.08, transform: "rotate(8deg)" }} />
          {line("הכלים שלכם", onWord(s, "הכלים"), <Icon3D src={urls[ICON.check]} size={W * 0.075} />)}
          {line("התהליכים שלכם", onWord(s, "התהליכים"), <Icon3D src={urls[ICON.check]} size={W * 0.075} />)}
          {line("הדאטה שלכם", onWord(s, "והדאטה"), <Icon3D src={urls[ICON.check]} size={W * 0.075} />)}
          <div style={{ height: W * 0.03 }} />
          <div style={{ opacity: interpolate(strike, [0, 1], [1, 0.55]) }}>
            {line("דוגמאות כלליות", onWord(s, "דוגמאות"), (
              <div style={{ width: W * 0.075, height: W * 0.075, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: W * 0.05, height: W * 0.05, borderRadius: "50%", border: `${W * 0.005}px solid ${C.mut}` }} />
              </div>
            ), C.mut)}
          </div>
          {/* the strike draws from the right, where the line is first read */}
          <div style={{ position: "absolute", right: W * 0.06, top: W * 0.13 + 3 * W * 0.12 + W * 0.03 + W * 0.06, height: W * 0.008, width: `${strike * 74}%`, background: C.red, borderRadius: W }} />
        </div>
      </Pop>
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "הכלים")} volume={0.2} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "התהליכים")} volume={0.2} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "והדאטה")} volume={0.2} />
      <Sfx src={urls[SFX.whoosh]} at={strikeF - 2} volume={0.18} />
    </AbsoluteFill>
  );
};

// ---------- 6. Deliver: industry lecturers, three places ----------
const Deliver: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const { width: W, height: H } = useVideoConfig();
  const pill = (text: string, at: number) => (
    <Pop at={at} from={1.15}>
      <div style={{ ...glass(W, 0.06), borderRadius: W, padding: `${W * 0.02}px ${W * 0.05}px`, border: `${W * 0.003}px solid rgba(245,184,61,0.55)` }}>
        <div style={he(W * 0.05, 800)}>{text}</div>
      </div>
    </Pop>
  );
  return (
    <AbsoluteFill>
      <Photo src={urls[PHOTO.training]} dim={0.3} top={0} height={0.52} fadeBottom dir={-1} />
      <div style={{ position: "absolute", right: W * 0.08, top: H * 0.36 }}>
        <Pop at={onWord(s, "מרצים")} from={0.85}><Icon3D src={urls[ICON.teacher]} size={W * 0.27} /></Pop>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.52, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.01 }}>
        <Pop at={onWord(s, "שלישי")}><div style={he(W * 0.11, 900)}>הדרכה</div></Pop>
        <Pop at={onWord(s, "מהתעשייה")}><div style={he(W * 0.05, 700, C.gold)}>מרצים מהתעשייה</div></Pop>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.665, display: "flex", justifyContent: "center", gap: W * 0.03, direction: "rtl" }}>
        {pill("אצלכם", onWord(s, "אצלכם"))}
        {pill("בקמפוס", onWord(s, "בקמפוס"))}
        {pill("אונליין", onWord(s, "אונליין"))}
      </div>
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "מרצים")} volume={0.2} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "אצלכם")} volume={0.2} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "בקמפוס")} volume={0.2} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "אונליין")} volume={0.2} />
    </AbsoluteFill>
  );
};

// ---------- 7. Result: not another deck, an output and a certificate ----------
const Result: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const deckF = wordFrame(s, "מצגת");
  const fall = interpolate(frame, [deckF + 4, deckF + 18], [0, 1], { ...clamp, easing: ease.in });
  const outputF = onWord(s, "תוצר");
  return (
    <AbsoluteFill>
      <Photo src={urls[PHOTO.team]} dim={0.8} />
      {/* "not another deck": a grey slide that drops out */}
      <StepTitle at={onWord(s, "לא")}>
        <div style={{ opacity: interpolate(frame, [outputF - 8, outputF], [1, 0], clamp) }}><div style={he(W * 0.09, 900)}>לא עוד מצגת</div></div>
      </StepTitle>
      <Pop at={onWord(s, "לא")} from={0.95} style={{ position: "absolute", left: W * 0.2, right: W * 0.2, top: H * 0.3, opacity: 1 - fall, transform: `translateY(${fall * H * 0.25}px) rotate(${fall * 14}deg)` }}>
        <div style={{ ...glass(W, 0.03), height: W * 0.42, padding: W * 0.05, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: W * 0.03, alignItems: "flex-end" }}>
          <div style={{ width: "70%", height: W * 0.04, borderRadius: W, background: "rgba(255,255,255,0.3)" }} />
          {[0.9, 0.75, 0.82].map((w, i) => <div key={i} style={{ width: `${w * 100}%`, height: W * 0.025, borderRadius: W, background: "rgba(255,255,255,0.14)" }} />)}
        </div>
      </Pop>
      {/* the result */}
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.185, display: "flex", justifyContent: "center", gap: W * 0.025, direction: "rtl" }}>
        <Pop at={outputF}><div style={he(W * 0.09, 900)}>תוצר</div></Pop>
        <Pop at={onWord(s, "ותעודה")}><div style={he(W * 0.09, 900, C.gold)}>ותעודה</div></Pop>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.3, display: "flex", justifyContent: "center", gap: W * 0.06, direction: "rtl" }}>
        <Pop at={outputF} from={0.8}><Icon3D src={urls[ICON.trophy]} size={W * 0.34} /></Pop>
        <Pop at={onWord(s, "ותעודה")} from={0.8}><Icon3D src={urls[ICON.scroll]} size={W * 0.34} /></Pop>
      </div>
      <Sfx src={urls[SFX.whoosh]} at={deckF + 4} volume={0.18} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "תוצר")} volume={0.22} />
      <Sfx src={urls[SFX.pop]} at={wordFrame(s, "ותעודה")} volume={0.22} />
    </AbsoluteFill>
  );
};

// ---------- 8. CTA: the gold card returns, book a diagnosis ----------
const Cta: React.FC<{ s: Scene; urls: VideoProps["urls"] }> = ({ s, urls }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const pressF = wordFrame(s, "אבחון");
  const press = interpolate(frame, [pressF - 2, pressF + 1, pressF + 7], [1, 0.93, 1], clamp);
  const ring = spring({ frame: frame - pressF, fps, config: springs.smooth });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.13, display: "flex", justifyContent: "center" }}>
        <Pop at={0} from={0.9}>
          <div style={{ ...glass(W, 0.05), width: W * 0.66, height: W * 0.56, border: `${W * 0.004}px solid ${C.gold}`, boxShadow: `0 0 ${W * 0.09}px rgba(245,184,61,0.4), 0 ${W * 0.02}px ${W * 0.05}px rgba(0,0,0,0.5)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: W * 0.03 }}>
            <Icon3D src={urls[ICON.shake]} size={W * 0.24} />
            <Pop at={onWord(s, "לצוות")}><div style={he(W * 0.075, 900)}>לצוות שלכם?</div></Pop>
          </div>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.5, display: "flex", justifyContent: "center" }}>
        <Pop at={onWord(s, "מתחילים")} from={1.12}>
          <div style={{ position: "relative", transform: `scale(${press})` }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: W, border: `${W * 0.004}px solid ${C.gold}`, transform: `scale(${1 + ring * 0.25})`, opacity: frame >= pressF ? 1 - ring : 0 }} />
            <div style={{ background: C.gold, borderRadius: W, padding: `${W * 0.03}px ${W * 0.08}px`, boxShadow: `0 ${W * 0.015}px ${W * 0.04}px rgba(0,0,0,0.45)` }}>
              <div style={he(W * 0.058, 900, C.goldInk)}>לקביעת פגישת אבחון</div>
            </div>
          </div>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.63, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.008 }}>
        <Pop at={4}><div style={he(W * 0.062, 900)}>היחידה ללימודי חוץ</div></Pop>
        <Pop at={7}><div style={he(W * 0.04, 700, C.gold)}>המחלקה העסקית</div></Pop>
      </div>
      <Sfx src={urls[SFX.whoosh]} at={0} volume={0.18} />
      <Sfx src={urls[SFX.click]} at={pressF - 1} volume={0.3} />
    </AbsoluteFill>
  );
};

// ---------- The step tracker: one element that lives across the four step scenes ----------
const Tracker: React.FC<{ from: number; to: number; marks: number[] }> = ({ from, to, marks }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  if (frame < from - 1 || frame > to + 1) return null;
  const vis = interpolate(frame, [from, from + 8, to - 10, to], [0, 1, 1, 0], clamp);
  const labels = ["אבחון", "סילבוס", "הדרכה", "תוצר"];
  const xs = [0.8, 0.6, 0.4, 0.2].map((x) => x * W); // step 1 on the right
  const y = H * 0.105, d = W * 0.085;
  const lit = marks.map((m) => spring({ frame: frame - (m - 3), fps, config: springs.snappy }));
  return (
    <AbsoluteFill style={{ opacity: vis, pointerEvents: "none" }}>
      {[0, 1, 2].map((i) => {
        const fill = interpolate(frame, [marks[i + 1] - 12, marks[i + 1]], [0, 1], { ...clamp, easing: ease.inOut });
        const x1 = xs[i] - d / 2, x2 = xs[i + 1] + d / 2;
        return (
          <div key={i} style={{ position: "absolute", left: x2, width: x1 - x2, top: y - W * 0.003, height: W * 0.006, background: "rgba(255,255,255,0.15)", borderRadius: W }}>
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: C.gold, borderRadius: W }} />
          </div>
        );
      })}
      {xs.map((x, i) => {
        const l = lit[i];
        const current = frame >= marks[i] - 3 && (i === 3 || frame < marks[i + 1] - 3);
        const sc = 1 + 0.12 * l * (current ? 1 : 0) + 0.15 * Math.max(0, Math.sin(Math.min(1, Math.max(0, (frame - marks[i] + 3) / 10)) * Math.PI)) * (frame >= marks[i] - 3 ? 1 : 0);
        return (
          <div key={i} style={{ position: "absolute", left: x - d / 2, top: y - d / 2, width: d, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: d, height: d, borderRadius: "50%", transform: `scale(${sc})`, background: l > 0.01 ? `rgba(245,184,61,${l})` : "rgba(255,255,255,0.06)", border: `${W * 0.003}px solid ${l > 0.5 ? C.gold : C.line}`, boxShadow: current ? `0 0 ${W * 0.04}px rgba(245,184,61,0.6)` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: heebo, fontWeight: 900, fontSize: W * 0.036, color: l > 0.5 ? C.goldInk : C.mut, direction: "ltr" }}>{`0${i + 1}`}</div>
            </div>
            <div style={{ ...he(W * 0.03, current ? 800 : 500, current ? C.ink : C.mut), marginTop: W * 0.018 }}>{labels[i]}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Video: React.FC<VideoProps> = ({ manifest, urls }) => {
  const hook = sceneById(manifest, "hook");
  const what = sceneById(manifest, "what");
  const trust = sceneById(manifest, "trust");
  const diagnose = sceneById(manifest, "diagnose");
  const syllabus = sceneById(manifest, "syllabus");
  const deliver = sceneById(manifest, "deliver");
  const result = sceneById(manifest, "result");
  const cta = sceneById(manifest, "cta");
  const marks = [
    wordFrame(diagnose, "ראשון", { absolute: true }),
    wordFrame(syllabus, "שני", { absolute: true }),
    wordFrame(deliver, "שלישי", { absolute: true }),
    result.startFrame + 4,
  ];
  const voice = (s: typeof hook) => (
    <>
      <Captions words={s.words} group={manifest.captions} mode="highlight" highlight={C.gold} face={heebo} rtl bottom={0.14} />
      {s.voiceoverKey ? <Voiceover src={urls[s.voiceoverKey]} /> : null}
    </>
  );
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Ground />
      <SceneFrame from={hook.startFrame} durationInFrames={hook.durationFrames}><Hook s={hook} urls={urls} />{voice(hook)}</SceneFrame>
      <SceneFrame from={what.startFrame} durationInFrames={what.durationFrames}><What s={what} urls={urls} />{voice(what)}</SceneFrame>
      <SceneFrame from={trust.startFrame} durationInFrames={trust.durationFrames}><Trust s={trust} urls={urls} />{voice(trust)}</SceneFrame>
      <SceneFrame from={diagnose.startFrame} durationInFrames={diagnose.durationFrames}><Diagnose s={diagnose} urls={urls} />{voice(diagnose)}</SceneFrame>
      <SceneFrame from={syllabus.startFrame} durationInFrames={syllabus.durationFrames}><Syllabus s={syllabus} urls={urls} />{voice(syllabus)}</SceneFrame>
      <SceneFrame from={deliver.startFrame} durationInFrames={deliver.durationFrames}><Deliver s={deliver} urls={urls} />{voice(deliver)}</SceneFrame>
      <SceneFrame from={result.startFrame} durationInFrames={result.durationFrames}><Result s={result} urls={urls} />{voice(result)}</SceneFrame>
      <SceneFrame from={cta.startFrame} durationInFrames={cta.durationFrames}><Cta s={cta} urls={urls} />{voice(cta)}</SceneFrame>
      <Tracker from={diagnose.startFrame} to={result.startFrame + result.durationFrames} marks={marks} />
      <Sfx src={urls[SFX.chime]} at={marks[3]} volume={0.25} />
      {manifest.music ? <Music src={urls[manifest.music.key]} /> : null}
      <Grade color={C.blue} strength={0.12} />
      <Grain blend="overlay" />
      <Vignette />
    </AbsoluteFill>
  );
};
