"use client";

import { bestStreak, weekLabel, type FoodDot, type WrappedWeek } from "./wrapped";
import { APP_NAME, TAGLINE } from "./app";

// The Weekly Wrapped share image (engagement.md): drawn on a canvas on the device, so nothing leaves the phone
// until the user shares it. 1080 × 1920 (story format). Colours are the live theme tokens and fonts are the app's
// own, so it looks like Prana in whichever theme is on. Habits only: never kcal eaten or body weight.

const W = 1080;
const H = 1920;

type Tile = { big: string; small: string; tone: string };

function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    bg: v("--color-bg"), surface: v("--color-surface"), surface2: v("--color-surface-2"), text: v("--color-text"),
    muted: v("--color-muted"), faint: v("--color-faint"), turmeric: v("--color-turmeric"), saffron: v("--color-saffron"),
    leaf: v("--color-leaf"), jamun: v("--color-jamun"), brass: v("--color-brass"), chilli: v("--color-chilli"), sky: v("--color-sky"),
    ink: v("--ink"),
    display: v("--font-fraunces") || "Georgia, serif",
    sans: v("--font-manrope") || "system-ui, sans-serif",
  };
}

/** Up to four habit tiles, the most impressive first. */
export function shareTiles(w: WrappedWeek, t: ReturnType<typeof tokens>): Tile[] {
  const out: Tile[] = [];
  out.push({ big: `${w.food.onTarget}/7`, small: "days on target", tone: t.leaf });
  const streak = bestStreak(w);
  if (streak) out.push({ big: `${streak.n}`, small: `day ${streak.label} streak`, tone: t.saffron });
  if (w.training && w.training.workoutDays > 0) out.push({ big: `${w.training.workoutDays}`, small: w.training.workoutDays === 1 ? "workout day" : "workout days", tone: t.jamun });
  if (w.prs.length) out.push({ big: `${w.prs.length}`, small: w.prs.length === 1 ? "personal record" : "personal records", tone: t.turmeric });
  if (w.food.protein.days) out.push({ big: `${w.food.protein.days}`, small: "protein goal days", tone: t.chilli });
  if (w.food.top[0]) out.push({ big: `×${w.food.top[0].count}`, small: w.food.top[0].name, tone: t.brass });
  if (w.food.chai) out.push({ big: `${w.food.chai}`, small: "cups of chai", tone: t.brass });
  if (w.food.water.days) out.push({ big: `${w.food.water.days}`, small: "days of 8 glasses", tone: t.sky });
  if (w.food.logged) out.push({ big: `${w.food.logged}/7`, small: "days logged", tone: t.turmeric });
  return out.slice(0, 4);
}

const alpha = (ink: string, a: number) => `rgb(${ink} / ${a})`;

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Wraps `text` to `maxW`, at most `maxLines` lines (last one gets "…"). Returns the lines. */
function wrap(c: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width <= maxW) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last && c.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    cut[maxLines - 1] = `${last}…`;
    return cut;
  }
  return lines;
}

/** Draws the share card. `name` = the user's first name, if signed in. */
export async function drawShareCard(w: WrappedWeek, name: string | null): Promise<Blob> {
  const t = tokens();
  // make sure the web fonts are ready before measuring text on the canvas
  await Promise.all([document.fonts.load(`600 96px ${t.display}`), document.fonts.load(`600 40px ${t.sans}`), document.fonts.load(`800 40px ${t.sans}`)]).catch(() => {});
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;

  // background + spice glows
  c.fillStyle = t.bg;
  c.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string, a: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    c.globalAlpha = a;
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.globalAlpha = 1;
  };
  glow(W - 80, 160, 620, t.saffron, 0.28);
  glow(60, H - 260, 700, t.jamun, 0.22);

  const X = 96;
  // header
  c.fillStyle = t.muted;
  c.font = `800 30px ${t.sans}`;
  c.letterSpacing = "8px";
  c.fillText("WEEKLY WRAPPED", X, 190);
  c.letterSpacing = "0px";
  c.fillStyle = t.text;
  c.font = `600 44px ${t.sans}`;
  c.fillText(`${name ? `${name}'s week` : "My week"} · ${weekLabel(w.from)}`, X, 256);

  // persona
  c.font = `160px ${t.sans}`;
  c.fillText(w.persona.emoji, X - 8, 500);
  c.fillStyle = t.text;
  c.font = `600 112px ${t.display}`;
  const title = wrap(c, w.persona.title, W - X * 2, 2);
  title.forEach((l, i) => c.fillText(l, X, 650 + i * 118));
  let y = 650 + (title.length - 1) * 118 + 80;
  c.fillStyle = t.muted;
  c.font = `500 42px ${t.sans}`;
  for (const l of wrap(c, w.persona.line, W - X * 2, 2)) {
    c.fillText(l, X, y);
    y += 58;
  }

  // the week as seven dots
  y += 40;
  const gap = (W - X * 2) / 7;
  const letters = ["M", "T", "W", "T", "F", "S", "S"];
  const dotColor = (d: FoodDot) => (d === "on" ? t.leaf : d === "logged" ? t.turmeric : d === "skip" ? t.brass : alpha(t.ink, 0.12));
  w.food.dots.forEach((d, i) => {
    const cx = X + gap * i + gap / 2;
    c.beginPath();
    c.arc(cx, y + 40, 34, 0, Math.PI * 2);
    c.fillStyle = dotColor(d);
    c.globalAlpha = d === "logged" ? 0.55 : 1;
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = t.faint;
    c.font = `700 28px ${t.sans}`;
    c.textAlign = "center";
    c.fillText(letters[i], cx, y + 130);
    c.textAlign = "left";
  });
  y += 190;

  // 2 × 2 tiles
  const tiles = shareTiles(w, t);
  const tw = (W - X * 2 - 32) / 2;
  const th = 250;
  tiles.forEach((tile, i) => {
    const tx = X + (i % 2) * (tw + 32);
    const ty = y + Math.floor(i / 2) * (th + 32);
    roundRect(c, tx, ty, tw, th, 44);
    c.fillStyle = t.surface;
    c.fill();
    c.strokeStyle = alpha(t.ink, 0.1);
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = tile.tone;
    c.font = `600 104px ${t.display}`;
    c.fillText(tile.big, tx + 40, ty + 130);
    c.fillStyle = t.muted;
    c.font = `600 34px ${t.sans}`;
    wrap(c, tile.small, tw - 80, 2).forEach((l, j) => c.fillText(l, tx + 40, ty + 188 + j * 42));
  });

  // footer
  c.fillStyle = t.turmeric;
  c.font = `600 64px ${t.display}`;
  c.fillText(APP_NAME, X, H - 150);
  c.fillStyle = t.muted;
  c.font = `500 34px ${t.sans}`;
  c.fillText(TAGLINE, X, H - 96);

  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), "image/png"));
}

/** Share sheet with the image where the browser can share files (phones), else download it. */
export async function shareOrSave(blob: Blob, w: WrappedWeek): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], `prana-wrapped-${w.from}.png`, { type: "image/png" });
  const text = `My week on ${APP_NAME}: ${w.persona.title}. ${TAGLINE}`;
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${APP_NAME} · Weekly Wrapped`, text });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // share failed (e.g. not allowed without a fresh tap): fall through to download
    }
  }
  saveBlob(blob, file.name);
  return "saved";
}

export function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
