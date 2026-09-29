import type { Category } from "@/lib/types";

// Hand-drawn category art (48×48), one consistent style: flat shapes, brass/steel/clay vessels,
// readable at 36 px. Stand-in until per-dish illustrations exist (D11).
const HUE: Record<Category, string> = {
  breakfast: "#f6c343", roti_bread: "#d9a15b", rice: "#e9dcc6", dal: "#f2b134", sabzi: "#7cc36e",
  paneer: "#f08a4b", egg: "#ffd166", non_veg: "#ff7a59", snack: "#ff9f45", sweet: "#ff7aa2",
  dairy: "#cfe3ff", fruit: "#ffb347", beverage: "#c08457", condiment: "#9ccc65", nuts: "#c9974c", soup: "#ff8a3d",
  supplement: "#d6ad80", cereal: "#b98a5a", alcohol: "#e3a02f",
};

export const categoryHue = (cat: Category) => HUE[cat];

function Katori({ fill, children, heap }: { fill: string; children?: React.ReactNode; heap?: string }) {
  return (
    <>
      <ellipse cx="24" cy="41" rx="12" ry="2" fill="#000" opacity="0.18" />
      {heap && <path d="M11,23 C12,11 36,11 37,23 Z" fill={heap} />}
      <path d="M8,23 C8,34 15,40 24,40 C33,40 40,34 40,23 Z" fill="#b98535" />
      <path d="M8,23 C9,31 13,36 18,38.5 C13,34 10,29 10,23 Z" fill="#8a5d22" opacity="0.5" />
      <path d="M13,27 C14,32 17,35.5 21.5,37" stroke="#f6d796" strokeOpacity="0.7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="23" rx="16" ry="4.6" fill="#e8bd6a" />
      <ellipse cx="24" cy="23.4" rx="13.6" ry="3.5" fill={fill} />
      {children}
    </>
  );
}

const Steam = ({ x = 24, y = 12 }: { x?: number; y?: number }) => (
  <g style={{ stroke: "rgb(var(--ink) / 0.5)" }} strokeWidth="1.5" fill="none" strokeLinecap="round">
    <path d={`M${x - 4},${y} c-2,-3 2,-4 0,-7`} />
    <path d={`M${x + 3},${y - 1} c-2,-3 2,-4 0,-7`} />
  </g>
);

const ART: Record<Category, React.ReactNode> = {
  dal: (
    <Katori fill="#f2b134">
      <circle cx="18" cy="22.6" r="1" fill="#c0392b" />
      <circle cx="28" cy="24" r="0.9" fill="#c0392b" />
      <circle cx="23" cy="23.2" r="1" fill="#4f9a3a" />
      <circle cx="31" cy="22.6" r="0.8" fill="#4f9a3a" />
    </Katori>
  ),
  rice: (
    <Katori fill="#f7f1e6" heap="#f7f1e6">
      <g stroke="#e0d4bf" strokeWidth="1.1" strokeLinecap="round">
        <path d="M18,17 l2,-1" /><path d="M25,15 l2,1" /><path d="M29,19 l2,-1" /><path d="M21,20 l1.5,1" /><path d="M16,21 l2,0" />
      </g>
    </Katori>
  ),
  sabzi: (
    <Katori fill="#6baa3c" heap="#6baa3c">
      <rect x="16" y="16" width="4" height="4" rx="1.2" fill="#e9c46a" transform="rotate(15 18 18)" />
      <rect x="25" y="14" width="4" height="4" rx="1.2" fill="#e9c46a" transform="rotate(-10 27 16)" />
      <circle cx="30" cy="20" r="1.6" fill="#8fd16b" />
      <circle cx="21" cy="20.5" r="1.3" fill="#e76f51" />
    </Katori>
  ),
  paneer: (
    <Katori fill="#e36e2a">
      <rect x="15.5" y="20" width="4" height="3.6" rx="0.8" fill="#fff6e6" transform="rotate(-8 17.5 22)" />
      <rect x="22" y="21" width="4" height="3.6" rx="0.8" fill="#fff6e6" transform="rotate(10 24 23)" />
      <rect x="28.5" y="19.8" width="4" height="3.6" rx="0.8" fill="#fff6e6" />
      <circle cx="20.5" cy="24.4" r="0.8" fill="#4f9a3a" />
    </Katori>
  ),
  soup: (
    <>
      <Katori fill="#e4572e"><circle cx="26" cy="23" r="1" fill="#fff6e6" opacity="0.8" /></Katori>
      <Steam y={17} />
    </>
  ),
  condiment: (
    <g transform="translate(5 6) scale(0.8)">
      <Katori fill="#7cb342">
        <path d="M30,20 L44,8" stroke="#c9ced3" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="29" cy="21.5" rx="3.2" ry="1.6" fill="#c9ced3" />
      </Katori>
    </g>
  ),
  roti_bread: (
    <>
      <ellipse cx="24" cy="40" rx="15" ry="2.4" fill="#000" opacity="0.18" />
      <ellipse cx="24" cy="31" rx="17" ry="8" fill="#c98a45" />
      <ellipse cx="24" cy="27" rx="17" ry="8" fill="#e8b46c" />
      <ellipse cx="24" cy="26.2" rx="15" ry="6.6" fill="#efc27f" />
      <g fill="#9a5b2a" opacity="0.65">
        <ellipse cx="17" cy="25" rx="2" ry="1.1" /><ellipse cx="27" cy="23" rx="1.6" ry="0.9" />
        <ellipse cx="30" cy="28.5" rx="2.2" ry="1.1" /><ellipse cx="21" cy="29.5" rx="1.3" ry="0.8" /><circle cx="24" cy="26" r="0.7" />
      </g>
    </>
  ),
  breakfast: (
    <>
      <ellipse cx="24" cy="40.5" rx="17" ry="2.2" fill="#000" opacity="0.18" />
      <ellipse cx="24" cy="32" rx="20" ry="8" fill="#9aa3ab" />
      <ellipse cx="24" cy="31" rx="20" ry="7.4" fill="#d5dade" />
      <ellipse cx="24" cy="31" rx="15" ry="5.2" fill="#c3c9cf" />
      <path d="M11,30 C11,21 23,21 23,30 Z" fill="#fbf7ef" />
      <path d="M25,30 C25,21 37,21 37,30 Z" fill="#f4ede0" />
      <ellipse cx="17" cy="30" rx="6" ry="1.6" fill="#e9e0cf" />
      <ellipse cx="31" cy="30" rx="6" ry="1.6" fill="#e2d8c4" />
      <circle cx="24" cy="34.3" r="2.4" fill="#7cb342" />
    </>
  ),
  egg: (
    <>
      <ellipse cx="24" cy="40" rx="13" ry="2.2" fill="#000" opacity="0.15" />
      <path d="M9,26 C7,17 17,12 24,14 C33,11 42,18 39,27 C37,35 25,38 17,35 C12,33 10,30 9,26 Z" fill="#fffdf6" />
      <path d="M12,30 C15,34 22,36 29,34" stroke="#efe6d4" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <circle cx="24.5" cy="24" r="6" fill="#f7b500" />
      <circle cx="22.6" cy="22.2" r="1.6" fill="#ffe08a" />
    </>
  ),
  non_veg: (
    <>
      <ellipse cx="24" cy="41" rx="13" ry="2" fill="#000" opacity="0.15" />
      <g stroke="#c9b28c" strokeWidth="1">
        <circle cx="36.5" cy="38.6" r="2.8" fill="#f3e7d3" />
        <circle cx="38.8" cy="35.8" r="2.8" fill="#f3e7d3" />
      </g>
      <path d="M27,27 L36,36" stroke="#c9b28c" strokeWidth="5.6" strokeLinecap="round" />
      <path d="M27,27 L36,36" stroke="#f3e7d3" strokeWidth="3.8" strokeLinecap="round" />
      <ellipse cx="20" cy="21" rx="12" ry="9" fill="#b5542b" transform="rotate(-38 20 21)" />
      <ellipse cx="18" cy="18.5" rx="7" ry="4" fill="#d97a45" transform="rotate(-38 18 18.5)" />
      <circle cx="15.5" cy="16.5" r="1.3" fill="#f2a36b" />
    </>
  ),
  snack: (
    <>
      <ellipse cx="24" cy="41" rx="14" ry="2" fill="#000" opacity="0.18" />
      <path d="M24,8 C25.5,8 26.5,9 27,10 L39.5,35 C40.5,37 39.5,39 37,39 L11,39 C8.5,39 7.5,37 8.5,35 L21,10 C21.5,9 22.5,8 24,8 Z" fill="#d99a3e" />
      <path d="M24,9 L24,38" stroke="#b77826" strokeWidth="1.2" opacity="0.55" />
      <path d="M24,9 L8.8,36 C9,37.5 10,39 11,39 L24,39 Z" fill="#e8ae55" />
      <g fill="#b77826" opacity="0.6"><circle cx="12" cy="37" r="0.7" /><circle cx="16" cy="37.4" r="0.7" /><circle cx="32" cy="37.4" r="0.7" /><circle cx="36" cy="37" r="0.7" /></g>
    </>
  ),
  sweet: (
    <>
      <ellipse cx="24" cy="41" rx="15" ry="2" fill="#000" opacity="0.18" />
      {[[16, 31], [32, 31], [24, 20]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="7.6" fill="#f0a030" />
          <path d={`M${x - 7.4},${y + 1} A7.6,7.6 0 0 0 ${x + 7.4},${y + 1}`} fill="#d9861c" />
          <circle cx={x - 2.5} cy={y - 2.5} r="1.1" fill="#ffd27a" />
          <circle cx={x + 2} cy={y - 1} r="0.8" fill="#ffd27a" />
          <circle cx={x} cy={y + 2.5} r="0.8" fill="#ffd27a" />
        </g>
      ))}
    </>
  ),
  dairy: (
    <>
      <ellipse cx="24" cy="41.5" rx="10" ry="1.8" fill="#000" opacity="0.18" />
      <path d="M14,9 L34,9 L31.5,40 L16.5,40 Z" fill="#e8f0f7" opacity="0.5" />
      <path d="M14.8,15 L33.2,15 L31.5,40 L16.5,40 Z" fill="#fbf8f2" />
      <ellipse cx="24" cy="15" rx="9.2" ry="1.6" fill="#ffffff" />
      <path d="M14,9 L34,9 L31.5,40 L16.5,40 Z" fill="none" stroke="#b9c4ce" strokeWidth="1.2" />
      <path d="M18,18 L19,36" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  fruit: (
    <>
      <ellipse cx="24" cy="41" rx="12" ry="2" fill="#000" opacity="0.18" />
      <path d="M13,28 C11,18 19,11 28,12 C37,13 40,23 36,31 C32,39 17,40 13,28 Z" fill="#f6b93b" />
      <path d="M13,28 C12,22 14,18 17,16 C15,22 17,30 24,36 C18,36 14,33 13,28 Z" fill="#f08a3c" opacity="0.6" />
      <path d="M28,12 C30,7 35,6 39,7 C37,11 33,13 28,12 Z" fill="#4f9a3a" />
      <circle cx="31" cy="19" r="1.8" fill="#fff3c4" opacity="0.7" />
    </>
  ),
  beverage: (
    <>
      <ellipse cx="24" cy="41" rx="11" ry="2" fill="#000" opacity="0.2" />
      <path d="M12,18 L36,18 L32.5,38.5 C32,40 16,40 15.5,38.5 Z" fill="#b5652f" />
      <path d="M12,18 L16,18 L18.5,39.5 C17,39.4 15.8,39.1 15.5,38.5 Z" fill="#8e4a1f" opacity="0.6" />
      <path d="M14,24 L34,24" stroke="#9a5424" strokeWidth="1" opacity="0.6" />
      <ellipse cx="24" cy="18" rx="12" ry="3.4" fill="#8e4a1f" />
      <ellipse cx="24" cy="18.2" rx="10.2" ry="2.5" fill="#c98b55" />
      <Steam y={13} />
    </>
  ),
  cereal: (
    <>
      <ellipse cx="24" cy="41" rx="13" ry="2" fill="#000" opacity="0.2" />
      <path d="M8,24 C8,34 15,40 24,40 C33,40 40,34 40,24 Z" fill="#f4f1ea" />
      <path d="M8,24 C9,32 13,37 18,39 C13,35 10,30 10,24 Z" fill="#d9d3c6" />
      <ellipse cx="24" cy="24" rx="16" ry="4.6" fill="#fbfaf6" />
      <path d="M11,24 C12,15 36,15 37,24 Z" fill="#c9965e" />
      <g fill="#a8733e">
        <ellipse cx="17" cy="20" rx="2.4" ry="1.3" transform="rotate(-20 17 20)" /><ellipse cx="25" cy="17" rx="2.2" ry="1.2" transform="rotate(15 25 17)" />
        <ellipse cx="30" cy="21" rx="2.4" ry="1.3" transform="rotate(25 30 21)" /><ellipse cx="21" cy="22" rx="2" ry="1.1" />
      </g>
      <circle cx="28" cy="18.5" r="1.4" fill="#b3263a" /><circle cx="19" cy="17.5" r="1.3" fill="#b3263a" />
      <rect x="22.5" y="20.5" width="3" height="2.2" rx="0.5" fill="#4a2c1d" /><rect x="32" y="19" width="2.6" height="2" rx="0.5" fill="#4a2c1d" />
      <ellipse cx="24" cy="24.2" rx="13.6" ry="2.2" fill="#fbfaf6" opacity="0.85" />
    </>
  ),
  supplement: (
    <>
      <ellipse cx="24" cy="42" rx="10" ry="1.8" fill="#000" opacity="0.2" />
      <rect x="17" y="5" width="14" height="4" rx="1.5" fill="#1f2933" />
      <path d="M15,11 C15,9.5 16,9 17,9 L31,9 C32,9 33,9.5 33,11 L33,14 L15,14 Z" fill="#2f3b45" />
      <rect x="14" y="14" width="20" height="27" rx="4" fill="#e6edf2" opacity="0.9" />
      <rect x="15.5" y="22" width="17" height="17.5" rx="3" fill="#d6ad80" />
      <rect x="15.5" y="22" width="17" height="3" rx="1.5" fill="#e8c9a3" />
      <g stroke="#9fb0bd" strokeWidth="1" strokeLinecap="round"><path d="M29,18 h3" /><path d="M29,26 h3" /><path d="M29,34 h3" /></g>
      <path d="M17.5,16 L17.5,37" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
    </>
  ),
  // D53: a frothy beer mug stands for all alcohol (beer, wine, spirits) until per-drink art exists
  alcohol: (
    <>
      <ellipse cx="22" cy="42" rx="12" ry="1.9" fill="#000" opacity="0.2" />
      <path d="M31,19 h4.5 a4.5,4.5 0 0 1 4.5,4.5 v6 a4.5,4.5 0 0 1 -4.5,4.5 h-4.5" fill="none" stroke="#d9e4ea" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <rect x="11" y="14" width="21" height="27" rx="3.5" fill="#d9e4ea" opacity="0.55" />
      <rect x="12.5" y="17" width="18" height="22.5" rx="2.5" fill="#e3a02f" />
      <path d="M15.5,20 L15.5,37" stroke="#f7d27a" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
      <g fill="#fff3d1" opacity="0.9"><circle cx="21" cy="30" r="0.9" /><circle cx="25" cy="25" r="0.7" /><circle cx="27" cy="33" r="0.8" /><circle cx="23" cy="36" r="0.6" /></g>
      <g fill="#fffaf0">
        <circle cx="14" cy="15.5" r="3.6" /><circle cx="19.5" cy="13" r="4.4" /><circle cx="25.5" cy="13.5" r="4.2" /><circle cx="30" cy="16" r="3.4" />
        <rect x="11" y="15" width="21" height="4" rx="2" />
      </g>
      <path d="M13,20.5 c1,2 2,2.5 3,0.5" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  nuts: (
    <>
      <ellipse cx="24" cy="40.5" rx="14" ry="2" fill="#000" opacity="0.18" />
      {[[16, 27, -25], [31, 27, 30], [24, 19, 5]].map(([x, y, r]) => (
        <g key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0,-10 C6,-7 7,3 0,10 C-7,3 -6,-7 0,-10 Z" fill="#b0703a" />
          <path d="M0,-8 C1,-3 1,3 0,8" stroke="#8a5428" strokeWidth="1" fill="none" opacity="0.7" />
          <path d="M-2.5,-5 C-3.5,-1 -3,2 -1.5,5" stroke="#d6995f" strokeWidth="1" fill="none" opacity="0.8" strokeLinecap="round" />
        </g>
      ))}
    </>
  ),
};

/** `bare` drops the tile: just the art, e.g. sitting on a thali. */
export function FoodIcon({ cat, size = 44, bare = false }: { cat: Category; size?: number; bare?: boolean }) {
  const hue = HUE[cat];
  if (bare)
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="drop-shadow-[0_3px_3px_rgb(0_0_0/0.3)]">
        {ART[cat]}
      </svg>
    );
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 20%, ${hue}38, ${hue}10 72%)`,
        boxShadow: `inset 0 0 0 1px ${hue}2e`,
      }}
    >
      <svg viewBox="0 0 48 48" width={size * 0.86} height={size * 0.86} aria-hidden>
        {ART[cat]}
      </svg>
    </div>
  );
}
