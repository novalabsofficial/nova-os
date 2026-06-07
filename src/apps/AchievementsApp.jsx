// Achievements — v11.0 Phase D. Shows the badge catalog grouped by category with
// an unlocked / total progress bar. Unlocked badges are colored and stamped with
// the date earned; locked ones are dimmed, and "secret" badges stay hidden (???)
// until unlocked. Read-only — unlocking happens across the OS via lib/achievements.

import { useMemo } from "react";
import { FF, FFB } from "../ui/styles.js";
import { ACHIEVEMENTS, ACH_CATEGORIES, TOTAL_ACHIEVEMENTS } from "../lib/achievements.js";

const when = (ts) => new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

export function AchievementsApp({ AC = "#f59e0b", data }) {
  const unlocked = data?.achievements || {};
  const count = useMemo(() => ACHIEVEMENTS.filter(a => unlocked[a.id]).length, [unlocked]);
  const pct = Math.round((count / TOTAL_ACHIEVEMENTS) * 100);

  return (
    <div style={{ height: "100%", overflow: "auto", fontFamily: FF, color: "var(--nv-text)", background: "var(--nv-surface)" }}>
      {/* header / progress */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--nv-border)", position: "sticky", top: 0, background: "var(--nv-surface-solid)", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: AC, display: "grid", placeItems: "center", fontSize: 24, boxShadow: "0 8px 22px " + AC + "55" }}>🏆</div>
          <div>
            <div style={{ fontFamily: FFB, fontSize: 19, lineHeight: 1.1 }}>Achievements</div>
            <div style={{ fontSize: 13, color: "var(--nv-text-dim)" }}>{count} of {TOTAL_ACHIEVEMENTS} unlocked · {pct}%</div>
          </div>
        </div>
        <div style={{ marginTop: 12, height: 8, borderRadius: 999, background: "var(--nv-elevated)", overflow: "hidden" }}>
          <div style={{ width: pct + "%", height: "100%", background: `linear-gradient(90deg, ${AC}, ${AC}bb)`, borderRadius: 999, transition: "width .4s ease" }} />
        </div>
      </div>

      {/* categories */}
      <div style={{ padding: "12px 20px 26px", maxWidth: 920, margin: "0 auto" }}>
        {ACH_CATEGORIES.map(cat => {
          const list = ACHIEVEMENTS.filter(a => a.cat === cat);
          const got = list.filter(a => unlocked[a.id]).length;
          return (
            <div key={cat} style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: FFB, fontSize: 14 }}>{cat}</span>
                <span style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>{got}/{list.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {list.map(a => {
                  const at = unlocked[a.id];
                  const on = !!at;
                  const secretLocked = a.secret && !on;
                  return (
                    <div key={a.id} style={{
                      display: "flex", gap: 12, alignItems: "center", padding: "12px 13px", borderRadius: 13,
                      border: "1px solid " + (on ? "transparent" : "var(--nv-border)"),
                      background: on ? "var(--nv-surface-solid)" : "transparent",
                      boxShadow: on ? "inset 0 0 0 1.5px " + AC + "55" : "none",
                      opacity: on ? 1 : 0.62,
                    }}>
                      <div style={{
                        width: 42, height: 42, flexShrink: 0, borderRadius: 11, display: "grid", placeItems: "center", fontSize: 22,
                        background: on ? AC : "var(--nv-elevated)", filter: on ? "none" : "grayscale(1)",
                      }}>{secretLocked ? "❔" : a.icon}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: FFB, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{secretLocked ? "Secret badge" : a.title}</div>
                        <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)", lineHeight: 1.35 }}>{secretLocked ? "Keep exploring to reveal this one." : a.desc}</div>
                        {on && <div style={{ fontSize: 10.5, color: AC, fontFamily: FFB, marginTop: 3 }}>✓ Unlocked {when(at)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
