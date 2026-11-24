import { SCENE_ART } from "./art";

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

function build(key: string): string {
  if (key === "title" || key === "act1") {
    return `${sky("act1")}${fog(1)}<div class="sc-rain r1"></div><div class="sc-rain r2"></div><div class="sc-lightning"></div>`;
  }
  if (key === "act2") {
    return `${sky("act2")}${fog(2)}<div class="sc-haze"></div><div class="sc-embers">${particles("ember", 26, 7)}</div>`;
  }
  if (key === "act3") {
    return `${sky("act3")}<div class="sc-aurora a1"></div><div class="sc-aurora a2"></div>${fog(3)}<div class="sc-stars">${particles("star", 46, 3)}</div>`;
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
  const base = key.startsWith("chart-") ? "chart" : key;
  const layer = document.createElement("div");
  layer.className = `sc-layer sc-${base} ${key === "title" ? "sc-title" : ""}`;
  layer.innerHTML = `${build(key)}<div class="sc-vignette"></div>`;
  for (const old of host.querySelectorAll<HTMLElement>(".sc-layer")) {
    old.classList.remove("on");
    old.classList.add("off");
    window.setTimeout(() => old.remove(), 900);
  }
  host.appendChild(layer);
  if (first) layer.classList.add("on");
  else requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("on")));
}
