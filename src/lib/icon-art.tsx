import { ImageResponse } from "next/og";

/** App icon: a brass katori on a turmeric→saffron tile. Rendered as PNG by next/og. */
export function iconResponse(size: number, { maskable = false } = {}) {
  const pad = maskable ? size * 0.2 : size * 0.12; // maskable icons need a safe zone
  const inner = size - pad * 2;
  return new ImageResponse(
    (
      <div
        style={{
          width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #f6c343, #ff8a3d)",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 100 100">
          <ellipse cx="50" cy="40" rx="38" ry="9" fill="#15100d" />
          <ellipse cx="50" cy="37" rx="30" ry="5" fill="#fff4e4" opacity="0.9" />
          <path d="M12,40 C13,66 30,80 50,80 C70,80 87,66 88,40 C76,50 24,50 12,40 Z" fill="#15100d" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
