/**
 * Chase-camera framing for the battle stage. The player's jet sits low in the middle of the frame,
 * seen from behind; the enemies fly ahead of it. On the player's turn the camera sits close behind
 * the jet ("close"); on the enemy turn it pulls back and widens ("wide") so the attackers turning
 * in are easy to follow.
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

interface Frame {
  /** Foe centres for one, two, and three foes. */
  rows: [number, number][][];
  /** Foe width by formation size, and the boss width. */
  size: number[];
  boss: number;
  ally: Spot;
}

const FRAMES: Record<CamShape, Record<CamShot, Frame>> = {
  desk: {
    close: {
      rows: [[[50, 31]], [[33, 33], [67, 27]], [[19, 35], [50, 25], [81, 35]]],
      size: [24, 20, 16],
      boss: 30,
      ally: { x: 50, y: 3, s: 44 },
    },
    wide: {
      rows: [[[50, 36]], [[36, 38], [64, 33]], [[25, 40], [50, 31], [75, 40]]],
      size: [21, 17.5, 14],
      boss: 26,
      ally: { x: 50, y: 13, s: 25 },
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
      rows: [[[50, 31]], [[30, 34], [70, 27]], [[19, 34], [50, 24], [81, 34]]],
      size: [46, 37, 27],
      boss: 54,
      ally: { x: 50, y: 12, s: 50 },
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
      rows: [[[50, 36]], [[36, 38], [64, 32]], [[26, 38], [50, 31], [74, 38]]],
      size: [23, 20, 17],
      boss: 28,
      ally: { x: 50, y: 6, s: 28 },
    },
  },
};

/** Where each foe flies for a formation of `bosses.length` (true marks a boss). */
export function foeSpots(bosses: boolean[], shape: CamShape, shot: CamShot): Spot[] {
  const frame = FRAMES[shape][shot];
  const n = Math.max(1, Math.min(bosses.length, frame.rows.length));
  const row = frame.rows[n - 1];
  return bosses.map((boss, index) => {
    const [x, y] = row[Math.min(index, row.length - 1)];
    return { x, y, s: boss ? frame.boss : frame.size[n - 1] };
  });
}

export function allySpot(shape: CamShape, shot: CamShot): Spot {
  return { ...FRAMES[shape][shot].ally };
}

/** Front-quarter art is painted nose-left; foes left of centre are mirrored so they turn in toward the player. */
export function facesRight(spot: Spot): boolean {
  return spot.x < 50;
}
