// src/components/NeonDartBoxes.tsx
import React, { useEffect } from "react";
import type { Dart } from "../x01";

export function NeonDartBoxes({ darts }: { darts: Array<Dart | null> }) {
  useEffect(() => {
    const id = "dc-neon-box-style";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes neonGlow {
        0%   { box-shadow: 0 0 0 rgba(245,158,11,0.0); }
        50%  { box-shadow: 0 0 16px 4px rgba(245,158,11,.55); }
        100% { box-shadow: 0 0 0 rgba(245,158,11,0.0); }
      }
    `;
    document.head.appendChild(s);
  }, []);

  const boxStyle = (has?: Dart | null): React.CSSProperties => ({
    width: 64,
    height: 48,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.10)",
    background: has
      ? "radial-gradient(120px 60px at 50% -20%, rgba(245,158,11,.35), rgba(245,158,11,.08))"
      : "linear-gradient(180deg, rgba(18,18,22,.55), rgba(10,10,12,.72))",
    color: has ? "#fbbf24" : "#d1d5db",
    fontWeight: 800,
    letterSpacing: 0.6,
    animation: has ? "neonGlow 1.2s ease-in-out" : undefined,
  });

  function label(d?: Dart | null): string {
    if (!d) return "—";
    if (d.value === 0) return "0";
    if (d.value === 25) return d.mult === 2 ? "DBULL" : "BULL";
    const prefix = d.mult === 2 ? "D" : d.mult === 3 ? "T" : "S";
    return `${prefix}${d.value}`;
  }

  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={boxStyle(darts[0])}>{label(darts[0])}</div>
      <div style={boxStyle(darts[1])}>{label(darts[1])}</div>
      <div style={boxStyle(darts[2])}>{label(darts[2])}</div>
    </div>
  );
}

export default NeonDartBoxes;
