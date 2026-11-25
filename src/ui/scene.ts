import { jetArt, SCENE_ART } from "./art";
import { setFlight } from "./flight";

let host: HTMLElement;
let current = "";

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function particles(cls: string, count: number, seed: number): string {
  const r = rand(seed);
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `<i class="${cls}" style="--x:${(r() * 100).toFixed(1)}%;--y:${(r() * 100).toFixed(1)}%;--s:${(0.4 + r() * 1.1).toFixed(2)};--t:${(6 + r() * 10).toFixed(1)}s;--d:${(-r() * 16).toFixed(1)}s"></i>`;
  }
  return html;
}

function sky(name: string): string {
  const src = SCENE_ART[name];
  return src ? `<div class="sc-sky" style="background-image:url('${src}')"></div>` : "";
}

function fog(act: number): string {
  const src = SCENE_ART[`fog-act${act}`];
  if (!src) return "";
  return `<div class="sc-fog f1" style="background-image:url('${src}')"></div><div class="sc-fog f2" style="background-image:url('${src}')"></div>`;
}

function speedLines(count: number, seed: number): string {
  return `<div class="sc-speed">${particles("streak", count, seed)}</div>`;
}

/** A layer of painted cloud banks streaming past; each cloud gets its own height, size, pace and place in the cycle. */
function clouds(layer: string, art: string, count: number, seed: number): string {
  const src = SCENE_ART[art];
  if (!src) return "";
  const r = rand(seed);
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `<img class="t-cloud${r() < 0.5 ? " flip" : ""}" src="${src}" alt="" draggable="false" style="--y:${((i + r()) / count * 100).toFixed(1)}%;--w:${(0.7 + r() * 0.6).toFixed(2)};--t:${(0.8 + r() * 0.4).toFixed(2)};--d:${(-(i + r() * 0.6) / count).toFixed(3)}" />`;
  }
  return `<div class="t-clouds ${layer}">${html}</div>`;
}

/** Two jets crossing the far sky, one on the other's tail, each drawing a contrail. */
function flyby(cls: string, lead: Parameters<typeof jetArt>[0], chaser: Parameters<typeof jetArt>[0]): string {
  const jet = (id: Parameters<typeof jetArt>[0], role: string) => `<span class="fb-jet ${role}"><i class="fb-trail"></i>${jetArt(id)}</span>`;
  return `<div class="t-flyby ${cls}"><div class="fb-pair">${jet(chaser, "chaser")}${jet(lead, "lead")}</div></div>`;
}

/**
 * The title screen: key art of the dogfight, with its afterburner flickering, clouds streaming
 * past at two depths and pairs of jets crossing the far sky. Wide and tall screens get their own
 * painting; overlays are placed in percentages of the painting so they stay on it at any size.
 */
function titleScene(): string {
  const art = (cls: string, name: string, burn: [number, number]) =>
    `<div class="key ${cls}"><img src="${SCENE_ART[name] ?? ""}" alt="" draggable="false" decoding="async" /><i class="key-burn" style="left:${burn[0]}%;top:${burn[1]}%"></i></div>`;
  return (
    art("key-wide", "title-wide", [86.5, 72.5]) +
    art("key-tall", "title-tall", [19, 62.5]) +
    `<div class="key-fade"></div>` +
    clouds("far", "cloud-lit", 4, 41) +
    flyby("fb1", "typhoon", "f16") +
    flyby("fb2", "mig29", "f15e") +
    clouds("near", "cloud-dark", 3, 97) +
    speedLines(12, 17)
  );
}

/**
 * Behind a fight the world moves: the flight renderer draws into the slot, over the act's still
 * painting, which stays as the backdrop where WebGL is not available. Weather rides on top.
 */
function chaseScene(act: number): string {
  const extra =
    act === 1
      ? `<div class="sc-rain r1"></div><div class="sc-rain r2"></div><div class="sc-lightning"></div>`
      : act === 2
        ? `<div class="sc-embers">${particles("ember", 14, 7)}</div>`
        : `<div class="sc-stars">${particles("star", 30, 3)}</div>`;
  return `${sky(`chase-act${act}`)}<div class="sc-flight-slot"></div>${extra}`;
}

function build(key: string): string {
  if (key.startsWith("chase-act")) return chaseScene(Number(key.slice(9)) || 1);
  if (key === "title") return titleScene();
  if (key === "act1") {
    return `${sky("act1")}${fog(1)}<div class="sc-rain r1"></div><div class="sc-rain r2"></div><div class="sc-lightning"></div>${speedLines(14, 17)}`;
  }
  if (key === "act2") {
    return `${sky("act2")}${fog(2)}<div class="sc-haze"></div><div class="sc-embers">${particles("ember", 26, 7)}</div>${speedLines(14, 23)}`;
  }
  if (key === "act3") {
    return `${sky("act3")}<div class="sc-aurora a1"></div><div class="sc-aurora a2"></div>${fog(3)}<div class="sc-stars">${particles("star", 46, 3)}</div>${speedLines(14, 29)}`;
  }
  if (key === "hangar") {
    return `${sky("hangar")}<div class="sc-shafts"></div><div class="sc-dust">${particles("mote", 22, 11)}</div>`;
  }
  if (key === "shop") {
    return `${sky("shop")}<div class="sc-dust">${particles("mote", 18, 5)}</div>`;
  }
  if (key.startsWith("chart-")) {
    const act = Number(key.slice(6)) || 1;
    return `<div class="sc-sky dim" style="background-image:url('${SCENE_ART[`act${act}`] ?? ""}')"></div><div class="sc-desk"></div>`;
  }
  return sky("act1");
}

export function initScene() {
  host = document.createElement("div");
  host.id = "scene";
  host.setAttribute("aria-hidden", "true");
  document.body.prepend(host);
  let frame = 0;
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse" || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        host.style.setProperty("--px", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        host.style.setProperty("--py", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    },
    { passive: true },
  );
}

export function setScene(key: string) {
  if (key === current) return;
  const first = !current;
  current = key;
  const base = key.startsWith("chart-") ? "chart" : key.startsWith("chase-") ? `chase sc-${key}` : key;
  const layer = document.createElement("div");
  layer.className = `sc-layer sc-${base} ${key === "title" ? "sc-title" : ""}`;
  layer.innerHTML = `${build(key)}<div class="sc-vignette"></div>`;
  for (const old of host.querySelectorAll<HTMLElement>(".sc-layer")) {
    old.classList.remove("on");
    old.classList.add("off");
    window.setTimeout(() => old.remove(), 900);
  }
  host.appendChild(layer);
  setFlight(key.startsWith("chase-act") ? Number(key.slice(9)) : 0, layer.querySelector<HTMLElement>(".sc-flight-slot"));
  if (first) layer.classList.add("on");
  else requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("on")));
}
