"use client";

import { APP_NAME, TAGLINE } from "./app";
import { alpha, saveBlob, tokens, wrap } from "./wrappedShare";

// Share cards for Akhada results (D49): a finished challenge or a duel. Drawn on the device like Weekly Wrapped
// (live theme tokens + app fonts), 1080 × 1920. Only what the result is about: no calories or body weight.

export type ResultCard = {
  kicker: string;          // "Challenge result" | "Weekly duel"
  emoji: string;
  headline: string;        // "Champion" | "2nd of 5" | "Won the duel"
  title: string;           // challenge title | "vs @bunty"
  big: string;             // "105 kg" | "7 days" | "540 – 480"
  sub: string;             // dates, or "best 6 days of effort"
  people?: { emoji: string; name: string; value: string; me?: boolean }[]; // podium / the two duellists
  tone: "win" | "done" | "plain";
};

export async function drawResultCard(r: ResultCard): Promise<Blob> {
  const t = tokens();
  await Promise.all([document.fonts.load(`600 96px ${t.display}`), document.fonts.load(`700 40px ${t.sans}`)]).catch(() => {});
  const W = 1080, H = 1920, X = 96;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  c.fillStyle = t.bg;
  c.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, rad: number, color: string, a: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color); g.addColorStop(1, "transparent");
    c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); c.globalAlpha = 1;
  };
  const accent = r.tone === "win" ? t.turmeric : r.tone === "done" ? t.leaf : t.jamun;
  glow(W - 120, 220, 680, accent, 0.3);
  glow(80, H - 300, 700, t.jamun, 0.2);

  c.fillStyle = t.muted;
  c.font = `800 30px ${t.sans}`;
  c.letterSpacing = "8px";
  c.fillText(`AKHADA · ${r.kicker.toUpperCase()}`, X, 190);
  c.letterSpacing = "0px";

  c.font = `200px ${t.sans}`;
  c.fillText(r.emoji, X - 10, 470);
  c.fillStyle = accent;
  c.font = `600 120px ${t.display}`;
  const head = wrap(c, r.headline, W - X * 2, 2);
  head.forEach((l, i) => c.fillText(l, X, 640 + i * 126));
  let y = 640 + (head.length - 1) * 126 + 90;
  c.fillStyle = t.text;
  c.font = `600 52px ${t.sans}`;
  for (const l of wrap(c, r.title, W - X * 2, 2)) { c.fillText(l, X, y); y += 64; }

  y += 70;
  c.fillStyle = t.text;
  c.font = `600 150px ${t.display}`;
  c.fillText(r.big, X, y + 110);
  c.fillStyle = t.muted;
  c.font = `500 38px ${t.sans}`;
  c.fillText(r.sub, X, y + 180);
  y += 260;

  for (const p of (r.people ?? []).slice(0, 4)) {
    c.beginPath();
    c.roundRect(X, y, W - X * 2, 120, 36);
    c.fillStyle = p.me ? alpha(t.ink, 0.1) : t.surface;
    c.fill();
    c.font = `64px ${t.sans}`;
    c.fillText(p.emoji, X + 30, y + 84);
    c.fillStyle = t.text;
    c.font = `${p.me ? 800 : 600} 44px ${t.sans}`;
    c.fillText(wrap(c, p.name, 560, 1)[0], X + 130, y + 76);
    c.textAlign = "right";
    c.font = `600 52px ${t.display}`;
    c.fillText(p.value, W - X - 36, y + 80);
    c.textAlign = "left";
    y += 140;
  }

  c.fillStyle = t.turmeric;
  c.font = `600 64px ${t.display}`;
  c.fillText(APP_NAME, X, H - 150);
  c.fillStyle = t.muted;
  c.font = `500 34px ${t.sans}`;
  c.fillText(TAGLINE, X, H - 96);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("canvas export failed"))), "image/png"));
}

/** Share sheet with the image on phones, else download. */
export async function shareResult(blob: Blob, filename: string, text: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${APP_NAME} · Akhada`, text });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  saveBlob(blob, filename);
  return "saved";
}
