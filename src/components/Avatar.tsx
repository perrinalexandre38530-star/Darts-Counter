import React from "react";

export function Avatar({ name, src, size = 70 }: { name: string; src?: string; size?: number }) {
  const initials = (name || "?")
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return src ? (
    <img
      src={src}
      alt={name}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        objectFit: "cover",
        border: "1px solid #333",
      }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "linear-gradient(180deg, #1a1a1d, #0e0e11)",
        border: "1px solid #333",
        display: "grid",
        placeItems: "center",
        fontSize: size < 28 ? 11 : 12,
        fontWeight: 800,
      }}
    >
      {initials}
    </div>
  );
}
