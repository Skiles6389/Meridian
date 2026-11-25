/*
 * The anchor sheet: every chase sprite with each of its anchor points marked and labelled, for
 * checking by eye that guns, pylons and dispensers sit on the art. Open the game with `#anchors`
 * on the end of its address to see it.
 */

import type { SilhouetteId } from "../game/types";
import { ANCHORS, type SpriteAnchors, type Xy } from "./anchors";
import { chaseArt, type ChaseView } from "./art";

const dot = (kind: string, label: string, [x, y]: Xy | [number, number, ...unknown[]]) => `<i class="dbg-dot dbg-${kind}" style="left:${x}%;top:${y}%"><b>${label}</b></i>`;

function dots(a: SpriteAnchors): string {
  const many = (kind: string, label: string, list: Xy[] | undefined) => (list ?? []).map((p, i) => dot(kind, list!.length > 1 ? `${label}${i + 1}` : label, p)).join("");
  return (
    dot("gun", "gun", a.gun) +
    a.pylons.map((p, i) => dot("stn", `${i + 1} ${p[3] === "tip" ? "tip" : p[2]}`, p)).join("") +
    many("flare", "flare", a.flares) +
    many("pod", "pod", a.pods) +
    many("tip", "wt", a.tips) +
    (a.chaff ? dot("chaff", "chaff", a.chaff) : "") +
    (a.belly ? dot("belly", "belly", a.belly) : "") +
    (a.nose ? dot("nose", "nose", a.nose) : "")
  );
}

function sheet(only: string | null): string {
  const items = Object.entries(ANCHORS)
    .filter(([name]) => !only || name.startsWith(only))
    .map(([name, a]) => {
      const cut = name.lastIndexOf("-");
      const art = chaseArt(name.slice(0, cut) as SilhouetteId, name.slice(cut + 1) as ChaseView);
      return `<figure class="dbg-item"><div class="dbg-sprite">${art}<div class="dbg-dots">${dots(a)}</div></div><figcaption>${name}</figcaption></figure>`;
    })
    .join("");
  return `<header><h1>Anchor points</h1><label><input type="checkbox" data-dbg="stores" checked /> weapons</label><label><input type="checkbox" data-dbg="dots" checked /> anchors</label><label><input type="checkbox" data-dbg="labels" checked /> labels</label><a href="#">Close</a></header><div class="dbg-grid${only ? " dbg-solo" : ""}">${items}</div>`;
}

let panel: HTMLElement | null = null;

function sync() {
  const match = /^#anchors(?:[=:/]([\w-]+))?$/.exec(location.hash);
  if (!match) {
    panel?.remove();
    panel = null;
    return;
  }
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "dbg-sheet";
    panel.addEventListener("change", (event) => {
      const box = event.target as HTMLInputElement;
      if (box.dataset.dbg) panel!.classList.toggle(`no-${box.dataset.dbg}`, !box.checked);
    });
    document.body.append(panel);
  }
  panel.innerHTML = sheet(match[1] ?? null);
}

/** Shows the anchor sheet whenever the address ends in `#anchors`, or `#anchors=f16` for one airframe. */
export function initAnchorSheet() {
  window.addEventListener("hashchange", sync);
  sync();
}
