import type { SilhouetteId } from "./types";

type Pt = [number, number];

interface Spec {
  body: number;
  nose: "needle" | "fine" | "blunt";
  wing: "delta" | "straight" | "crank" | "long" | "stub";
  tail: "single" | "twin" | "vee" | "none";
  canard?: boolean;
  pod?: boolean;
  antennas?: number;
  spine?: boolean;
  flying?: boolean;
  stretch?: number;
}

const SPECS: Record<SilhouetteId, Spec> = {
  kite: { body: 8, nose: "needle", wing: "delta", tail: "single", stretch: 1.05 },
  bulwark: { body: 15, nose: "blunt", wing: "straight", tail: "twin", pod: true, stretch: 0.96 },
  moth: { body: 9, nose: "fine", wing: "delta", tail: "none", flying: true },
  lattice: { body: 10, nose: "fine", wing: "crank", tail: "twin", canard: true, antennas: 3, pod: true },
  habicht: { body: 10, nose: "fine", wing: "crank", tail: "single" },
  kiebitz: { body: 8, nose: "fine", wing: "stub", tail: "single", stretch: 0.9 },
  dachs: { body: 12, nose: "blunt", wing: "long", tail: "twin", pod: true, stretch: 1.08 },
  luchs: { body: 14, nose: "blunt", wing: "straight", tail: "twin", stretch: 1 },
  rabe: { body: 9, nose: "needle", wing: "delta", tail: "single", canard: true },
  moorhau: { body: 16, nose: "blunt", wing: "long", tail: "twin", pod: true },
  falke: { body: 10, nose: "needle", wing: "delta", tail: "single", canard: true },
  nachtigall: { body: 11, nose: "fine", wing: "long", tail: "twin", antennas: 2, pod: true, stretch: 1.06 },
  bernstein: { body: 12, nose: "fine", wing: "crank", tail: "twin" },
  marder: { body: 9, nose: "needle", wing: "delta", tail: "twin", stretch: 0.98 },
  zwilling: { body: 10, nose: "fine", wing: "crank", tail: "twin" },
  hochbahn: { body: 15, nose: "blunt", wing: "crank", tail: "twin", canard: true, pod: true },
  spiegel: { body: 8, nose: "needle", wing: "delta", tail: "vee", flying: true },
  gewitter: { body: 11, nose: "fine", wing: "crank", tail: "twin", antennas: 4, spine: true },
  eisenwal: { body: 12, nose: "blunt", wing: "long", tail: "none", flying: true, stretch: 1.12 },
  schwarz: { body: 14, nose: "blunt", wing: "delta", tail: "twin", spine: true },
  weiss: { body: 8, nose: "needle", wing: "delta", tail: "vee", flying: true, canard: true },
  eule: { body: 12, nose: "fine", wing: "crank", tail: "twin", canard: true, spine: true, antennas: 2 },
  adler: { body: 16, nose: "blunt", wing: "long", tail: "twin", spine: true, pod: true, stretch: 1.05 },
  nebel: { body: 11, nose: "needle", wing: "crank", tail: "twin", antennas: 3, spine: true, canard: true, stretch: 1.1 },
};

function poly(pts: Pt[], fill: string): string {
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + " Z";
  return `<path d="${d}" fill="${fill}" stroke="#061016" stroke-width="1.15" stroke-linejoin="round"/>`;
}

function wing(style: Spec["wing"], x: number, yb: number): Pt[] {
  if (style === "delta") return [[x - 6, yb], [x + 52, yb - 1], [x + 8, 92], [x - 16, yb]];
  if (style === "straight") return [[x - 4, yb], [x + 34, yb], [x + 28, 93], [x - 8, 93], [x - 12, yb]];
  if (style === "crank") return [[x - 10, yb], [x + 46, yb + 1], [x + 18, 90], [x + 4, 74], [x - 16, yb]];
  if (style === "long") return [[x - 24, yb], [x + 58, yb], [x + 16, 94], [x - 28, 78]];
  return [[x, yb], [x + 22, yb], [x + 6, 80], [x - 6, yb]];
}

function farWing(style: Spec["wing"], x: number, yt: number): Pt[] {
  const lift = style === "stub" ? 14 : style === "long" ? 26 : 20;
  return [[x + 6, yt], [x + 36, yt], [x + 18, yt - lift]];
}

export function jetSvg(id: SilhouetteId, accent: string, flip = false): string {
  const spec = SPECS[id];
  const stretch = spec.stretch ?? 1;
  const y = 50;
  const bh = spec.body;
  const noseX = spec.nose === "blunt" ? 186 : spec.nose === "fine" ? 204 : 214;
  const tailX = 34;
  const parts: string[] = [];

  if (spec.flying) {
    const nose = spec.nose === "blunt" ? 190 : 214;
    const bodyPts: Pt[] = [
      [nose, y],
      [150, y - 8],
      [78, 16],
      [46, 30],
      [58, y],
      [46, 70],
      [78, 84],
      [150, y + 8],
    ];
    parts.push(poly(bodyPts, "#d5dee6"));
    parts.push(poly([[150, y - 6], [120, y - 4], [132, y - 16], [158, y - 8]], "#eef3f7"));
    parts.push(`<path d="M168 ${y - 4} Q182 ${y - 10} 196 ${y}" fill="${accent}" opacity="0.9"/>`);
  } else {
    const upper: Pt[] = [
      [tailX, y - bh * 0.72],
      [78, y - bh * 0.95],
      [132, y - bh],
      [noseX - 28, y - bh * 0.42],
      [noseX, y],
    ];
    const lower: Pt[] = [
      [noseX - 28, y + bh * 0.42],
      [132, y + bh],
      [78, y + bh * 0.95],
      [tailX, y + bh * 0.72],
    ];
    parts.push(poly([...upper, ...lower], "#d5dee6"));
    parts.push(poly(wing(spec.wing, 104, y + bh * 0.55), "#b7c3ce"));
    parts.push(poly(farWing(spec.wing, 112, y - bh * 0.72), "#c5d0da"));

    if (spec.tail === "single") {
      parts.push(poly([[tailX + 6, y - bh * 0.4], [tailX + 28, y - bh * 0.2], [tailX + 16, 14], [tailX - 2, 16]], accent));
    } else if (spec.tail === "twin") {
      parts.push(poly([[tailX + 2, y - 2], [tailX + 14, y - 4], [tailX + 10, 12], [tailX, 16]], accent));
      parts.push(poly([[tailX + 16, y - bh * 0.2], [tailX + 30, y - 2], [tailX + 24, 18], [tailX + 12, 16]], "#9aa8b5"));
    } else if (spec.tail === "vee") {
      parts.push(poly([[tailX + 10, y], [tailX + 28, y - 2], [tailX + 8, 18]], accent));
    }

    if (spec.canard) {
      parts.push(poly([[noseX - 46, y + 2], [noseX - 24, y + 4], [noseX - 36, y + 16]], "#c5d0da"));
    }
    if (spec.pod) {
      parts.push(poly([[96, y + bh * 0.3], [132, y + bh * 0.35], [128, y + bh * 0.35 + 10], [100, y + bh * 0.3 + 9]], "#8e9eac"));
    }
    const canopyX = noseX - 48;
    parts.push(
      `<ellipse cx="${canopyX}" cy="${y - bh * 0.35}" rx="16" ry="${Math.max(4, bh * 0.28)}" fill="${accent}" opacity="0.85"/>`,
    );
    parts.push(`<circle cx="${tailX - 6}" cy="${y}" r="3.2" fill="#f0b429" opacity="0.85"/>`);
  }

  if (spec.spine) {
    parts.push(poly([[120, 42], [126, 42], [124, 24], [118, 28]], accent));
  }
  const antennas = spec.antennas ?? 0;
  for (let i = 0; i < antennas; i++) {
    const x = 92 + i * 10;
    parts.push(`<rect x="${x}" y="${28 - (i % 2) * 4}" width="2" height="${12 + (i % 3) * 3}" fill="${accent}"/>`);
  }

  // Neutral marking: ring and chevron. No cross, no historical roundel.
  parts.push(`<circle cx="92" cy="50" r="6.5" fill="none" stroke="${accent}" stroke-width="1.6"/>`);
  parts.push(`<circle cx="92" cy="50" r="2" fill="${accent}"/>`);
  parts.push(poly([[108, 46], [120, 50], [108, 54], [112, 50]], accent));

  const inner = parts.join("");
  const transform = flip ? `transform="translate(240,0) scale(-1,1)"` : "";
  const scale = stretch === 1 ? "" : `transform="translate(120,50) scale(${stretch},1) translate(-120,-50)"`;
  return `<svg class="jet-svg" viewBox="0 0 240 100" role="img" aria-hidden="true"><g ${scale}><g ${transform}>${inner}</g></g></svg>`;
}
