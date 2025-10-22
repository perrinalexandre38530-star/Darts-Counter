import React from "react";

export function Avatar({ name, src, size = 70 }: { name: string; src?: string; size?: number }) {
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .map((x) => x[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          objectFit: "cover",
          border: "1px solid #333",
          background: "#111",
        }}
      />
    );
  }

  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "linear-gradient(180deg, #1a1a1d, #0e0e11)",
        border: "1px solid #333",
        display: "grid",
        placeItems: "center",
        fontSize: size < 28 ? 11 : 14,
        fontWeight: 800,
        color: "#e5e7eb",
      }}
    >
      {initials}
    </div>
  );
}

export default Avatar;
