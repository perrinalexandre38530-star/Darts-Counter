import React from "react";

export default function StatsPage() {
  return (
    <section style={{ padding: 16 }}>
      <h2 style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Statistiques</h2>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        <Card title="Moyenne / 3 darts" value="—" hint="à venir" />
        <Card title="Darts lancées" value="—" hint="à venir" />
        <Card title="Legs gagnés" value="—" hint="à venir" />
        <Card title="Parties jouées" value="—" hint="à venir" />
      </div>
    </section>
  );
}

function Card({ title, value, hint }: { title: string; value: React.ReactNode; hint?: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#a1a1aa" }}>{title}</div>
      <div style={{ fontWeight: 800, fontSize: 24 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "#9ca3af" }}>{hint}</div>}
    </div>
  );
}
