/**
 * Chase-camera framing for the battle stage. The player's jet sits low in the middle of the frame,
 * seen from behind; the enemies fly ahead of it. On the player's turn the camera sits close behind
 * the jet ("close"). On the enemy turn it pulls well back ("wide") into an external view of the
 * player's jet and the airspace around it, so the attackers can be seen breaking round onto its six.
 *
 * Every spot is in stage percentages: `x` and `y` place the centre of a foe's airframe (for the
 * player, `y` is the gap under the jet), and `s` is the airframe width in camera units, which the
 * stylesheet turns into pixels from the stage size.
 */

export type CamShot = "close" | "wide";
export type CamShape = "desk" | "portrait" | "landscape";

export interface Spot {
  x: number;
  y: number;
  s: number;
}

export interface Pt {
  x: number;
  y: number;
}

interface Formation {
  /** Centres for one, two, and three jets. */
  rows: [number, number][][];
  /** Width by formation size, and the boss width. */
  size: number[];
  boss: number;
}

interface Frame extends Formation {
  ally: Spot;
}

const FRAMES: Record<CamShape, Record<CamShot, Frame>> = {
  desk: {
    close: {
      rows: [[[50, 31]], [[33, 33], [67, 27]], [[19, 35], [50, 25], [81, 35]]],
      size: [24, 20, 16],
      boss: 30,
      ally: { x: 50, y: 9, s: 44 },
    },
    wide: {
      rows: [[[50, 27]], [[40, 28], [60, 25]], [[32, 29], [50, 24], [68, 29]]],
      size: [10, 9, 8],
      boss: 12,
      ally: { x: 50, y: 44, s: 11 },
    },
  },
  portrait: {
    close: {
      rows: [[[50, 27]], [[28, 30], [72, 22]], [[18, 31], [50, 19], [82, 31]]],
      size: [54, 42, 30],
      boss: 64,
      ally: { x: 50, y: -2, s: 82 },
    },
    wide: {
      rows: [[[50, 25]], [[33, 26], [67, 22]], [[21, 27], [50, 21], [79, 27]]],
      size: [24, 21, 18],
      boss: 30,
      ally: { x: 50, y: 45, s: 23 },
    },
  },
  landscape: {
    close: {
      rows: [[[50, 33]], [[33, 35], [67, 29]], [[21, 36], [50, 28], [79, 36]]],
      size: [27, 23, 19],
      boss: 32,
      ally: { x: 50, y: 1, s: 42 },
    },
    wide: {
      rows: [[[50, 24]], [[40, 25], [60, 22]], [[32, 26], [50, 21], [68, 26]]],
      size: [13, 12, 11],
      boss: 15,
      ally: { x: 50, y: 40, s: 14 },
    },
  },
};

/** Where attackers settle behind the player in the wide shot: lower in the frame and nearer the camera. */
const SIX: Record<CamShape, Formation> = {
  desk: { rows: [[[50, 77]], [[38, 75], [62, 80]], [[30, 76], [50, 81], [70, 76]]], size: [17, 15, 13], boss: 20 },
  portrait: { rows: [[[50, 78]], [[31, 76], [69, 81]], [[21, 77], [50, 82], [79, 77]]], size: [40, 33, 27], boss: 46 },
  landscape: { rows: [[[50, 80]], [[36, 78], [64, 82]], [[28, 79], [50, 83], [72, 79]]], size: [20, 18, 16], boss: 23 },
};

function place(formation: Formation, bosses: boolean[]): Spot[] {
  const n = Math.max(1, Math.min(bosses.length, formation.rows.length));
  const row = formation.rows[n - 1];
  return bosses.map((boss, index) => {
    const [x, y] = row[Math.min(index, row.length - 1)];
    return { x, y, s: boss ? formation.boss : formation.size[n - 1] };
  });
}

/** Where each foe flies for a formation of `bosses.length` (true marks a boss). */
export function foeSpots(bosses: boolean[], shape: CamShape, shot: CamShot): Spot[] {
  return place(FRAMES[shape][shot], bosses);
}

/** Where each attacker sits on the player's six in the wide shot, left to right. */
export function sixSpots(bosses: boolean[], shape: CamShape): Spot[] {
  return place(SIX[shape], bosses);
}

export function allySpot(shape: CamShape, shot: CamShot): Spot {
  return { ...FRAMES[shape][shot].ally };
}

/* ------------------------------------------------------------ flight paths */

export type Curve = [Pt, Pt, Pt, Pt];

export function cubic(c: Curve, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

export function cubicTangent(c: Curve, t: number): Pt {
  const u = 1 - t;
  return {
    x: 3 * u * u * (c[1].x - c[0].x) + 6 * u * t * (c[2].x - c[1].x) + 3 * t * t * (c[3].x - c[2].x),
    y: 3 * u * u * (c[1].y - c[0].y) + 6 * u * t * (c[2].y - c[1].y) + 3 * t * t * (c[3].y - c[2].y),
  };
}

/** Stage x, in percent, of a point `off` percent beyond the edge on `side` (-1 left, 1 right). */
export function offstage(side: number, off: number): number {
  return side < 0 ? -off : 100 + off;
}

/**
 * The swap onto the player's six, in two legs with a beat off-screen between them. First the foe
 * breaks out to `side` and dives toward the camera until it is `off` percent past the edge of the
 * stage; then it comes back in low from that side and reverses up onto the six, heading the same
 * way as the player. `aspect` is the stage's width over height.
 */
export function swapIn(from: Pt, six: Pt, side: number, off: number, aspect = 16 / 9): [Curve, Curve] {
  const edge = offstage(side, off);
  // On a very wide, short stage the last leg needs less sideways run to arrive tail-on.
  const tail = 12 * Math.min(1, 16 / 9 / aspect);
  return [
    [from, { x: from.x + side * 16, y: from.y - 5 }, { x: edge - side * 6, y: from.y + 8 }, { x: edge, y: from.y + 30 }],
    [{ x: edge, y: six.y + 8 }, { x: six.x + side * 34, y: six.y + 20 }, { x: six.x + side * tail, y: six.y + 26 }, six],
  ];
}

/**
 * The swap back: from the six the foe pulls ahead past the player and peels off the `side` edge,
 * then comes back in from that side and turns away from the camera into its slot ahead.
 */
export function swapOut(six: Pt, slot: Pt, side: number, off: number, aspect = 16 / 9): [Curve, Curve] {
  const edge = offstage(side, off);
  const tail = 5 * Math.min(1, 16 / 9 / aspect);
  return [
    [six, { x: six.x + side * 3, y: six.y - 30 }, { x: edge - side * 22, y: slot.y + 24 }, { x: edge, y: slot.y + 16 }],
    [{ x: edge, y: slot.y + 9 }, { x: slot.x + side * 30, y: slot.y + 12 }, { x: slot.x + side * tail, y: slot.y + 16 }, slot],
  ];
}

/**
 * Airframe size along a path, from how low it sits in the frame: nearer the camera is lower and
 * bigger. Interpolates between the two ends and keeps a little overshoot for the sweep past.
 */
export function sizeAlong(a: Spot, b: Spot, y: number): number {
  if (Math.abs(b.y - a.y) < 0.01) return a.s;
  const s = a.s + ((b.s - a.s) * (y - a.y)) / (b.y - a.y);
  const lo = Math.min(a.s, b.s) * 0.85;
  const hi = Math.max(a.s, b.s) * 1.25;
  return Math.max(lo, Math.min(hi, s));
}

export type FlightView = "rear" | "side" | "front";

/**
 * Which painting to show for a heading in screen space (y grows down the screen, toward the
 * camera). Climbing up the frame is flying away from the camera, so it shows the rear view; diving
 * down it is coming at the camera, the front quarter; anything flatter is the side view. Keeping
 * the previous view until the heading is well past the threshold stops the art flickering.
 */
export function flightView(dx: number, dy: number, prev?: FlightView): FlightView {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return prev ?? "rear";
  const vy = dy / len;
  const enter = 0.55;
  const stay = 0.38;
  if (vy < -(prev === "rear" ? stay : enter)) return "rear";
  if (vy > (prev === "front" ? stay : enter)) return "front";
  if (prev === "rear" && vy < -0.2) return "rear";
  if (prev === "front" && vy > 0.2) return "front";
  return "side";
}

/** Rotation in degrees for a view and heading: bank into the turn, or pitch along the path in profile. */
export function attitude(view: FlightView, dx: number, dy: number): number {
  const len = Math.hypot(dx, dy) || 1;
  const vx = dx / len;
  if (view === "rear") return vx * 34;
  if (view === "front") return vx * 22;
  const pitch = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
  const clamped = Math.max(-38, Math.min(38, pitch));
  return dx >= 0 ? clamped : -clamped;
}

/**
 * Whether a view's painting must be mirrored for the heading: side views are painted nose-right
 * and front quarters nose-left.
 */
export function mirrored(view: FlightView, dx: number): boolean {
  if (view === "side") return dx < 0;
  if (view === "front") return dx > 0;
  return false;
}
