/* Shared stage geometry and timing for the effects modules. */

import { PLAYER } from "../game/combat";

export type Pt = { x: number; y: number };

let root: HTMLElement;
let speed = 1;

export function initGeo(appRoot: HTMLElement) {
  root = appRoot;
}

export function appRoot(): HTMLElement {
  return root;
}

export const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Below 1 plays everything faster; set while the player taps to hurry an animation. */
export function setTimeScale(next: number) {
  speed = next;
}

export function timeScale(): number {
  return speed;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms * speed)));
}

export function unitEl(who: number): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-who="${who}"]`);
}

export function artEl(who: number): HTMLElement | null {
  return unitEl(who)?.querySelector<HTMLElement>(".unit-art") ?? null;
}

export function rectOf(who: number): DOMRect | null {
  return artEl(who)?.getBoundingClientRect() ?? null;
}

export function center(who: number): Pt | null {
  const r = rectOf(who);
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

/** A point on an airframe by fractions of its drawn box. */
export function anchor(who: number, fx: number, fy: number): Pt | null {
  const r = rectOf(who);
  return r ? { x: r.left + r.width * fx, y: r.top + r.height * fy } : null;
}

/**
 * Where shots leave an airframe. Every jet that fires is seen from behind, heading into the frame,
 * so fire leaves the spine just ahead of centre.
 */
export function muzzle(who: number): Pt | null {
  return anchor(who, 0.5, who === PLAYER ? 0.38 : 0.42);
}

/** How near the camera an airframe sits, from its drawn size: about 1 for the player's jet up close. */
export function depth(who: number): number {
  const w = rectOf(who)?.width ?? 0;
  const ref = Math.min(560, Math.max(260, window.innerWidth * 0.42));
  return Math.max(0.3, Math.min(1.5, w / ref || 0.6));
}

/** Rough on-screen size of an airframe, for scaling explosions to how far away it is. */
export function blastScale(who: number): number {
  return Math.max(0.45, Math.min(1.3, depth(who) * 1.15));
}

/** Centres of the lit exhausts on the player's jet, or a point at its tail. */
export function nozzles(who: number): Pt[] {
  const glows = [...(artEl(who)?.querySelectorAll<HTMLElement>(".cj-rear .cj-glow") ?? [])];
  const pts = glows.map((g) => {
    const r = g.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (pts.length) return pts;
  const tail = anchor(who, 0.5, 0.72);
  return tail ? [tail] : [];
}

export function livingFoes(): number[] {
  return [...root.querySelectorAll<HTMLElement>(".foe:not(.down):not(.crashing)")].map((el) => Number(el.dataset.who));
}

export function rectOfSel(selector: string): DOMRect | null {
  return root.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
}

export function midOf(r: DOMRect): Pt {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Overshoots its target a little and settles: for things that pop into place. */
export const easeBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
