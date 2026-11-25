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

function speedLines(count: number, seed: number): string {
  return `<div class="sc-speed">${particles("streak", count, seed)}</div>`;
}

/** Streaks fanning out from the vanishing point, for the forward rush of the chase camera. */
function rushLines(count: number, seed: number): string {
  const r = rand(seed);
  let html = "";
  for (let i = 0; i < count; i++) {
    const angle = r() * 360;
    html += `<i class="rush" style="--a:${angle.toFixed(1)}deg;--s:${(0.5 + r() * 0.9).toFixed(2)};--t:${(1.1 + r() * 1.4).toFixed(2)}s;--d:${(-r() * 3).toFixed(2)}s"></i>`;
  }
  return `<div class="sc-rush">${html}</div>`;
}

/** Cloud wisps that swell past the camera from the horizon. */
function wisps(count: number, seed: number): string {
  const r = rand(seed);
  let html = "";
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    html += `<i class="wisp" style="--x:${(side * (14 + r() * 30)).toFixed(1)}vw;--y:${(14 + r() * 26).toFixed(1)}vh;--s:${(0.7 + r() * 0.8).toFixed(2)};--t:${(5 + r() * 4).toFixed(1)}s;--d:${(-r() * 9).toFixed(1)}s"></i>`;
  }
  return `<div class="sc-wisps">${html}</div>`;
}

function chaseScene(act: number): string {
  const extra =
    act === 1
      ? `<div class="sc-rain r1"></div><div class="sc-rain r2"></div><div class="sc-lightning"></div>`
      : act === 2
        ? `<div class="sc-haze"></div><div class="sc-embers">${particles("ember", 22, 7)}</div>`
        : `<div class="sc-aurora a1"></div><div class="sc-stars">${particles("star", 40, 3)}</div>`;
  return `${sky(`chase-act${act}`)}<div class="sc-banks"><i class="bank far"></i><i class="bank near"></i></div>${extra}${wisps(act === 3 ? 4 : 7, 40 + act)}${rushLines(18, 50 + act)}`;
}

function build(key: string): string {
  if (key.startsWith("chase-act")) return chaseScene(Number(key.slice(9)) || 1);
  if (key === "title" || key === "act1") {
    return `${sky("act1")}${fog(1)}<div class="sc-rain r1"></div><div class="sc-rain r2"></div><div class="sc-lightning"></div>${speedLines(key === "title" ? 22 : 14, 17)}`;
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
  if (first) layer.classList.add("on");
  else requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("on")));
}
