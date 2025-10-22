// src/components/NeonDartBoxes.tsx
import React, { useEffect } from "react";
import type { Dart } from "../x01";

export function NeonDartBoxes({ darts }: { darts: Array<Dart | null> }) {
  // Injecte l'animation une seule fois
  useEffect(() => {
    const id = "dc-neon-box-style";
    if (!document.getElementById(id)) {
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
    }
  }, []);

  const boxBase: React.CSSProperties = {
    width: 54,
    height: 54,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.08)",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 18,
    letterSpacing: 0.3,
    background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
    color: "#eee",
  };

  function boxStyle(d: Dart | null): React.CSSProperties {
    if (!d) return boxBase;
    if (d.value === 0) return boxBase;

    // Couleurs selon multiplicateur
    if (d.value === 25) {
      // BULL : vert néon
      return {
        ...boxBase,
        color: "#0ff39b",
        border: "1px solid rgba(0, 255, 170, .35)",
        animation: "neonGlow 1.6s ease-in-out infinite",
      };
    }
    if (d.mult === 2) {
      // DOUBLE : bleu néon
      return {
        ...boxBase,
        color: "#91cbff",
        border: "1px solid rgba(145,203,255,.35)",
        animation: "neonGlow 1.6s ease-in-out infinite",
      };
    }
    if (d.mult === 3) {
      // TRIPLE : rose néon
      return {
        ...boxBase,
        color: "#ffb3e1",
        border: "1px solid rgba(255,179,225,.35)",
        animation: "neonGlow 1.6s ease-in-out infinite",
      };
    }
    // SIMPLE (par défaut)
    return {
      ...boxBase,
      color: "var(--c-primary)",
      border: "1px solid rgba(245,158,11,.35)",
      animation: "neonGlow 1.6s ease-in-out infinite",
    };
  }

  function label(d: Dart | null) {
    if (!d) return "—";
    if (d.value === 0) return "0";
    if (d.value === 25) return "BULL";
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
