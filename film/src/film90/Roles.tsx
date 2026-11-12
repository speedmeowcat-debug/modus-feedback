// Сцена «Каждый видит своё»: четыре роли и их область видимости (README → «Права доступа»).

import { Lock, ShieldCheck, User, UserCheck, Users } from "lucide-react";
import { At, C, Stage, cam0, camTrack, clamp, ev, lerp, mix, qa, sp, type CamKey } from "../film/lib";
import { R0, ROLES, R_CARDS, R_CARD_STAGGER, R_FOCUS, R_OUT, R_ROWS_DELAY, R_ROW_STAGGER, R_SUB, R_TITLE } from "./timeline90";

const ICONS = [User, UserCheck, Users, ShieldCheck];
const GAP = 430;
const cardX = (i: number) => (i - 1.5) * GAP;
const CARD_W = 390;
// Строки — обращения демо-набора со статусами ровно как в «Датасет.docx» (A-021 — новое обращение из ролика).
const ROWS = [
  { id: "A-021", tone: C.accent, soft: C.accentSoft, label: "Реализовано" },
  { id: "A-014", tone: C.warn, soft: C.warnSoft, label: "На рассмотрении" },
  { id: "A-009", tone: C.accent, soft: C.accentSoft, label: "В работе" },
  { id: "A-006", tone: C.warn, soft: C.warnSoft, label: "На рассмотрении" },
  { id: "A-003", tone: C.accent, soft: C.accentSoft, label: "В работе" },
  { id: "A-001", tone: C.muted, soft: C.sunken, label: "Новое" },
];

function Row({ r, open, locked }: { r: (typeof ROWS)[number]; open: number; locked: boolean }) {
  return (
    <div style={{ position: "relative", height: 40, borderRadius: 10, background: locked ? "transparent" : C.surface, border: `1.5px ${locked ? "dashed" : "solid"} ${C.line}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 12, overflow: "hidden" }}>
      {locked ? (
        <>
          <Lock size={18} color={C.faint} />
          <div style={{ height: 8, width: 150, borderRadius: 4, background: C.sunken }} />
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", opacity: open, transform: `translateX(${(1 - open) * -24}px)` }}>
          <span className="num" style={{ fontSize: 19, fontWeight: 600, color: C.ink }}>{r.id}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.sunken }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: r.tone, background: r.soft, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{r.label}</span>
        </div>
      )}
    </div>
  );
}

function RoleCard({ i, f }: { i: number; f: number }) {
  const role = ROLES[i]!;
  const Icon = ICONS[i]!;
  const fin = sp(f, R_CARDS + i * R_CARD_STAGGER, "snappy");
  const focus = R_FOCUS[i]!;
  const lit = clamp(sp(f, focus, "snappy") - sp(f, (R_FOCUS[i + 1] ?? R_OUT) , "smooth") * 0.6);
  const seen = f >= focus;
  return (
    <At x={cardX(i)} y={90} z={lerp(-700, 0, fin) + lit * 90} ry={(1 - fin) * -40} o={fin} s={1}>
      <div
        style={{
          width: CARD_W, padding: 30, borderRadius: 22, background: C.surface,
          border: `2px solid ${mix(C.line, C.accent, lit)}`,
          boxShadow: `0 ${18 + lit * 30}px ${50 + lit * 50}px rgba(27,29,28,${0.08 + lit * 0.12})`,
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: 18, background: mix(C.sunken, C.accentSoft, Math.max(lit, seen ? 0.6 : 0)), display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={34} color={seen ? C.accent : C.muted} />
        </div>
        <div {...(seen ? qa(`role-${i}`, 1) : {})} style={{ marginTop: 22, fontSize: 38, fontWeight: 600, color: C.ink, letterSpacing: "-0.01em" }}>{role.name}</div>
        <div {...(seen ? qa(`role-scope-${i}`, role.scope.split(" ").length) : {})} style={{ marginTop: 8, fontSize: 25, color: C.muted, minHeight: 64 }}>{role.scope}</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {ROWS.map((r, k) => (
            <Row key={k} r={r} locked={k >= role.rows} open={sp(f, focus + R_ROWS_DELAY + k * R_ROW_STAGGER, "snappy")} />
          ))}
        </div>
      </div>
    </At>
  );
}

export function Roles({ f }: { f: number }) {
  const keys: CamKey[] = [
    { at: R0, dur: 70, to: { s: 1.0, x: 0, y: 0, ry: 0 }, e: "outCubic" },
    ...R_FOCUS.map((at, i) => ({ at: at - 16, dur: 40, to: { x: cardX(i) * 0.5, y: 60, ry: (i - 1.5) * -2.2, s: 1.12 }, e: "inOutCubic" as const })),
    { at: R_OUT, dur: 4020 - R_OUT, to: { x: cardX(3), z: 1300, s: 1.5, ry: -6 }, e: "inCubic" },
  ];
  const cam = camTrack(f, { ...cam0, s: 0.74, y: 30, ry: 8 }, keys);
  const title = sp(f, R_TITLE, "heavy");
  const sub = sp(f, R_SUB, "smooth");
  const flashIn = 1 - ev(f, R0, 14, "outCubic");
  const flashOut = ev(f, 4020 - 16, 16, "inCubic");
  const titleOut = ev(f, R_FOCUS[0] - 20, 36);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.page, overflow: "hidden" }}>
      <Stage cam={{ ...cam, y: cam.y + (f - R0) * 0.03 }} perspective={2000}>
        <At x={-810} y={-470 - titleOut * 60} origin="topleft" o={1 - titleOut}>
          <div style={{ overflow: "hidden", paddingBottom: 6 }}>
            <div {...qa("roles-title", 3)} style={{ fontSize: 86, lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.02em", color: C.ink, transform: `translateY(${(1 - title) * 110}%)` }}>
              Каждый видит своё
            </div>
          </div>
          <div {...qa("roles-sub", 4)} style={{ marginTop: 14, fontSize: 34, color: C.muted, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)` }}>
            Права проверяются на сервере
          </div>
        </At>
        {ROLES.map((_, i) => <RoleCard key={i} i={i} f={f} />)}
      </Stage>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: Math.max(flashIn * 0.9, flashOut), pointerEvents: "none" }} />
    </div>
  );
}
