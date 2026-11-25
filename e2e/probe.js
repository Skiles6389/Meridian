/*
 * Records what the effects canvas really puts on screen, without help from the game: every stroke,
 * fill and sprite drawn on `.fx-canvas` is logged in client (CSS pixel) coordinates, worked out from
 * the context's live transform, the canvas backing store and the canvas's on-screen box. A drawing
 * that is stretched or offset against the page shows up here exactly as it shows up to the player.
 *
 * Alongside each frame that draws something it notes where the jets' sprites, gun ports and weapon
 * stations are on screen at that moment, read from the DOM, and it notes each weapon station the
 * moment it is fired. It can also hold the page to a slow frame rate, the way a busy phone would.
 *
 * Loaded as an init script, so it works on the single-file build as well as the dev server.
 */
(() => {
  const probe = { on: false, frame: 0, minFrameMs: 0, ops: [], frames: {}, releases: [] };
  window.__probe = probe;

  /* ------------------------------------------------------------ frame clock */

  const raf = window.requestAnimationFrame.bind(window);
  let queue = [];
  let ids = 0;
  let waiting = false;
  let ran = -1e9;

  const pump = () => {
    if (waiting) return;
    waiting = true;
    raf(function tick(ts) {
      if (ts - ran < probe.minFrameMs - 1) {
        raf(tick);
        return;
      }
      waiting = false;
      ran = ts;
      probe.frame++;
      const run = queue;
      queue = [];
      for (const [, fn] of run) fn(ts);
    });
  };

  window.requestAnimationFrame = (fn) => {
    queue.push([++ids, fn]);
    pump();
    return ids;
  };
  window.cancelAnimationFrame = (id) => {
    queue = queue.filter((entry) => entry[0] !== id);
  };

  /* ---------------------------------------------------------------- the DOM */

  const mid = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height];
  };

  /** The painting of a unit that is showing: the same choice the game makes. */
  const spriteOf = (unit) => (unit.dataset.view === "front" ? unit.querySelector(".cj-front") : null) ?? unit.querySelector(".cj-rear") ?? unit.querySelector(".cj");

  /** The middle of the weapon hanging on a station, or of its bay door. */
  const stationPoint = (store) => {
    const nose = store.querySelector(".sn");
    const tail = store.querySelector(".st");
    if (nose && tail) {
      const a = mid(nose);
      const b = mid(tail);
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    return mid(store);
  };

  const station = (store) => ({ index: Number(store.dataset.st), kind: store.dataset.kind, at: stationPoint(store), box: box(store) });

  const snapshot = () => {
    const units = {};
    for (const unit of document.querySelectorAll("[data-who]")) {
      const cj = spriteOf(unit);
      if (!cj) continue;
      units[unit.dataset.who] = {
        sprite: cj.dataset.sprite,
        flip: cj.classList.contains("flip"),
        box: box(cj),
        w: cj.offsetWidth,
        h: cj.offsetHeight,
        guns: [...cj.querySelectorAll('.ap[data-ap="gun"]')].map(mid),
        flares: [...cj.querySelectorAll('.ap[data-ap="flare"]')].map(mid),
        stores: [...cj.querySelectorAll(".store")].map(station),
      };
    }
    const canvas = document.querySelector(".fx-canvas");
    return { t: performance.now(), units, canvas: canvas ? { box: box(canvas), width: canvas.width, height: canvas.height } : null, view: [window.innerWidth, window.innerHeight] };
  };
  probe.snapshot = snapshot;

  const note = () => {
    probe.frames[probe.frame] ??= snapshot();
  };

  new MutationObserver((records) => {
    if (!probe.on) return;
    for (const record of records) {
      const el = record.target;
      if (!(el instanceof Element) || !el.classList.contains("store")) continue;
      const before = (record.oldValue ?? "").split(/\s+/);
      const fired = ["spent", "open"].some((name) => el.classList.contains(name) && !before.includes(name));
      if (!fired) continue;
      const unit = el.closest("[data-who]");
      note();
      probe.releases.push({ frame: probe.frame, t: performance.now(), who: unit ? unit.dataset.who : null, ...station(el) });
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });

  /* ------------------------------------------------------------- the canvas */

  const P = CanvasRenderingContext2D.prototype;
  const paths = new WeakMap();
  const watched = (c) => probe.on && c.canvas && c.canvas.classList && c.canvas.classList.contains("fx-canvas");

  /** A point in the context's current user space, as it lands on the page. */
  const place = (c, x, y) => {
    const m = c.getTransform();
    const b = c.canvas.getBoundingClientRect();
    const dx = m.a * x + m.c * y + m.e;
    const dy = m.b * x + m.d * y + m.f;
    return [b.left + (dx * b.width) / c.canvas.width, b.top + (dy * b.height) / c.canvas.height];
  };

  const wrap = (name, record) => {
    const original = P[name];
    P[name] = function (...args) {
      if (watched(this)) record(this, args);
      return original.apply(this, args);
    };
  };

  const add = (c, x, y) => {
    let path = paths.get(c);
    if (!path) paths.set(c, (path = []));
    path.push(place(c, x, y));
  };

  wrap("beginPath", (c) => paths.set(c, []));
  wrap("moveTo", (c, [x, y]) => add(c, x, y));
  wrap("lineTo", (c, [x, y]) => add(c, x, y));
  wrap("quadraticCurveTo", (c, [, , x, y]) => add(c, x, y));
  wrap("bezierCurveTo", (c, [, , , , x, y]) => add(c, x, y));
  wrap("arc", (c, [x, y]) => add(c, x, y));
  wrap("ellipse", (c, [x, y]) => add(c, x, y));
  wrap("rect", (c, [x, y, w, h]) => {
    add(c, x, y);
    add(c, x + w, y + h);
  });

  const style = (v) => (typeof v === "string" ? v : "paint");
  const log = (c, op, extra) => {
    note();
    probe.ops.push({ frame: probe.frame, t: performance.now(), op, alpha: c.globalAlpha, ...extra });
  };

  wrap("stroke", (c) => log(c, "stroke", { style: style(c.strokeStyle), pts: (paths.get(c) ?? []).slice() }));
  wrap("fill", (c) => log(c, "fill", { style: style(c.fillStyle), pts: (paths.get(c) ?? []).slice() }));
  /** The colour of a sprite the effects made for themselves, read a little way out from its white-hot middle. */
  const tints = new WeakMap();
  const tintOf = (source) => {
    if (!(source instanceof HTMLCanvasElement)) return undefined;
    if (!tints.has(source)) {
      let tint;
      try {
        const [r, g, b] = source.getContext("2d").getImageData(Math.round(source.width * 0.61), source.height >> 1, 1, 1).data;
        tint = [r, g, b];
      } catch {
        tint = undefined;
      }
      tints.set(source, tint);
    }
    return tints.get(source);
  };

  wrap("drawImage", (c, args) => {
    const [x, y, w, h] = args.length >= 9 ? args.slice(5, 9) : args.slice(1, 5);
    if (w === undefined) return;
    const a = place(c, x, y);
    const b = place(c, x + w, y + h);
    log(c, "image", {
      from: args[0] instanceof HTMLImageElement ? "picture" : "canvas",
      tint: tintOf(args[0]),
      pts: [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]],
      size: Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.SQRT2,
    });
  });
})();
