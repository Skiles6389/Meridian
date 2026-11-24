import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/saira-stencil-one/latin-400.css";
import "./styles.css";
import { audioDebug, configureAudio, setAmbience, setMusic, sfx, unlockAudio, type Track } from "./audio";
import { getCard } from "./game/cards";
import { enemiesTakeLead, splitTurnEvents } from "./game/chase";
import { PLAYER, setCombatFxSink, type ActionResult, type CombatFx } from "./game/combat";
import { HELP } from "./game/help";
import { loadMeta, loadRun, saveMeta, saveRun } from "./game/meta";
import {
  abortRun,
  ackReward,
  buyShopCard,
  buyShopHeal,
  buyShopRelic,
  cancelRemoval,
  chooseEvent,
  chooseGamble,
  chooseIntermission,
  continueEvent,
  createRun,
  dismissNotice,
  endTurn,
  enterNode,
  leaveGamble,
  leaveShop,
  openRemoval,
  playCard,
  removeCard,
  takeRewardCard,
  takeRewardHeal,
  takeRewardRelic,
} from "./game/run";
import type { JetId, RunState } from "./game/types";
import { shotStyle } from "./ui/art";
import {
  aim,
  banner,
  chase,
  flipHand,
  handRects,
  initFx,
  playEvents,
  setBar,
  setSpeed,
  snapBars,
  throwCard,
  wait,
  wipe,
  type ShotStyle,
} from "./ui/fx";
import { highestUnlocked, ROOKIE } from "./game/difficulty";
import type { AppState } from "./ui/model";
import { isCompact, phoneShape, renderApp, sceneKey, screenName } from "./ui/render";
import { initScene, setScene } from "./ui/scene";

const meta = loadMeta();
configureAudio({ mute: meta.mute, music: meta.musicVol, sfx: meta.sfxVol });

const app: AppState = {
  view: "title",
  meta,
  run: loadRun(),
  jetPick: "kite",
  seedInput: "",
  modal: null,
  deckTab: "loadout",
  targetUid: null,
  toast: "",
  toastKind: "info",
  relicId: null,
  selectedNode: null,
  howPage: 0,
  returnView: "title",
  armed: null,
  showLog: false,
  frozen: null,
  pickArm: null,
};

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app");
initScene();
initFx(root);

for (const type of ["pointerdown", "pointerup", "touchend", "keydown"]) window.addEventListener(type, unlockAudio, { capture: true, passive: true });

function musicFor(app: AppState): Track {
  const run = app.frozen ?? app.run;
  if (app.view !== "run" || !run) return "title";
  if (run.screen === "victory" || run.screen === "defeat") return "title";
  if ((run.screen === "combat" || app.frozen) && run.combat?.enemies.some((enemy) => enemy.boss)) return "boss";
  return run.act >= 3 ? "act3" : run.act === 2 ? "act2" : "act1";
}

let lastGold: number | null = null;

function syncAudio() {
  setMusic(musicFor(app));
  setAmbience(app.view === "run" && (!!app.frozen || app.run?.screen === "combat"));
  const gold = app.view === "run" ? app.run?.gold ?? null : null;
  if (gold !== null && lastGold !== null && gold !== lastGold) sfx("gold");
  lastGold = gold;
}

let toastTimer = 0;
let lastScreen = "";
let busy = false;
let suppressClick = false;
let pointer = { x: 0, y: 0 };

function persist() {
  saveMeta(app.meta);
  saveRun(app.run);
}

function draw() {
  setScene(sceneKey(app));
  syncAudio();
  const scroller = root!.querySelector<HTMLElement>("[data-scroll]");
  const keepScroll = scroller ? scroller.scrollTop : null;
  root!.innerHTML = renderApp(app);
  const name = screenName(app);
  const entered = name !== lastScreen;
  lastScreen = name;
  const shell = root!.firstElementChild as HTMLElement | null;
  if (entered) shell?.classList.add("enter");
  const chart = root!.querySelector<HTMLElement>("[data-scroll=chart]");
  if (chart) {
    if (!entered && keepScroll !== null) chart.scrollTop = keepScroll;
    else {
      const focus = chart.querySelector<HTMLElement>(".node.current") ?? chart.querySelector<HTMLElement>(".node.reachable");
      chart.scrollTop = focus ? focus.offsetTop - chart.clientHeight * 0.6 : chart.scrollHeight;
    }
  }
  if (app.armed !== null) updateAim();
}

function toast(message: string, kind: "info" | "bad" = "info") {
  if (!message) return;
  app.toast = message;
  app.toastKind = kind;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (app.toast === message) {
      app.toast = "";
      root!.querySelector(".toast")?.remove();
    }
  }, 2400);
}

function finishTo(view: AppState["view"]) {
  app.run = null;
  app.view = view;
  app.modal = null;
  persist();
}

function seedValue(): number {
  const parsed = Number(app.seedInput.trim());
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

function launch() {
  const jet = app.jetPick;
  if (!app.meta.unlocked[jet]) {
    toast("That jet is still in the hangar lockup.", "bad");
    sfx("error");
    return;
  }
  app.run = createRun(jet, seedValue(), app.meta, app.meta.difficulty);
  app.view = "run";
  app.modal = null;
  app.selectedNode = null;
  app.targetUid = null;
  app.armed = null;
  sfx("play");
  persist();
}

function after(beforeScreen: string | undefined, beforeNotices: number) {
  const run = app.run;
  if (!run) return;
  if (run.notices.length > beforeNotices) sfx("unlock");
  if (run.screen === "victory" && beforeScreen !== "victory") sfx("win");
  else if (run.screen === "defeat" && beforeScreen !== "defeat") sfx("lose");
  if (run.combat && app.targetUid && !run.combat.enemies.some((enemy) => enemy.uid === app.targetUid && enemy.hp > 0)) {
    app.targetUid = null;
  }
}

/* ------------------------------------------------------------- combat */

function livingCount(run: RunState): number {
  return run.combat?.enemies.filter((enemy) => enemy.hp > 0).length ?? 0;
}

function needsTarget(index: number): boolean {
  const run = app.run;
  const inst = run?.combat?.hand[index];
  if (!run || !inst) return false;
  return getCard(inst.id).target === "enemy" && livingCount(run) > 1;
}

function targetAlive(uid: number | null): boolean {
  return uid !== null && !!app.run?.combat?.enemies.some((enemy) => enemy.uid === uid && enemy.hp > 0);
}

function cardSnapshot(index: number) {
  const slot = root!.querySelector<HTMLElement>(`.slot[data-slot="${index}"]`);
  const card = slot?.querySelector<HTMLElement>(".card");
  if (!slot || !card) return undefined;
  return { html: card.outerHTML, rect: card.getBoundingClientRect(), rot: Number.parseFloat(slot.style.getPropertyValue("--r")) || 0 };
}

function barsOf(run: RunState): Map<number, { hp: number; shield: number }> {
  const bars = new Map<number, { hp: number; shield: number }>();
  if (!run.combat) return bars;
  bars.set(-1, { hp: run.hp, shield: run.combat.player.shield });
  for (const enemy of run.combat.enemies) bars.set(enemy.uid, { hp: enemy.hp, shield: enemy.shield });
  return bars;
}

interface ActionOpts {
  shot: ShotStyle;
  thrown?: ReturnType<typeof cardSnapshot>;
  attack?: boolean;
  turn?: boolean;
  /** Unit the thrown card flies into, or null for the middle of the stage. */
  aimAt?: number | null;
  cardType?: string;
}

async function combatAction(perform: () => ActionResult | void, opts: ActionOpts) {
  const run = app.run;
  if (!run?.combat || busy) return;
  const pre = structuredClone(run);
  const beforeScreen = run.screen;
  const beforeNotices = run.notices.length;
  const rects = handRects();
  const events: CombatFx[] = [];
  setCombatFxSink((event) => events.push(event));
  let result: ActionResult | void;
  try {
    result = perform();
  } finally {
    setCombatFxSink(null);
  }
  if (result && !result.ok) {
    toast(result.message ?? "Can't do that.", "bad");
    sfx("error");
    draw();
    return;
  }
  busy = true;
  setSpeed(1);
  app.armed = null;
  aim(null, null, false);
  const ended = !run.combat || run.screen !== "combat";
  if (ended) app.frozen = pre;
  after(beforeScreen, beforeNotices);
  persist();
  draw();
  document.body.classList.add("busy");
  try {
    if (opts.thrown) throwCard(opts.thrown, !!opts.attack, opts.aimAt ?? null, opts.cardType ?? "attack");
    else if (!opts.turn) sfx("play");
    const hand = root!.querySelector<HTMLElement>(".hand");
    if (!ended && !opts.turn) flipHand(rects, false);
    if (opts.turn) hand?.classList.add("stowed");
    snapBars(barsOf(pre));
    const pendingDown = new Set<number>();
    for (const enemy of pre.combat!.enemies) {
      if (enemy.hp <= 0) continue;
      const unit = root!.querySelector<HTMLElement>(`.foe[data-who="${enemy.uid}"]`);
      if (unit?.classList.contains("down")) {
        unit.classList.remove("down");
        pendingDown.add(enemy.uid);
      }
    }
    if (opts.thrown) await wait(opts.attack ? 260 : 170);
    const ctx = { playerShot: opts.shot, bars: barsOf(pre), pendingDown };
    if (opts.turn) {
      const timeline = splitTurnEvents(events);
      if (enemiesTakeLead(timeline.enemy)) await Promise.all([banner("Enemy turn", "", "short enemy"), chase("enemy")]);
      await playEvents(timeline.enemy, ctx);
      if (timeline.player.length) await chase("player");
      await playEvents(timeline.player, ctx);
    } else {
      await playEvents(events, ctx);
    }
    if (ended) {
      const won = run.screen !== "defeat";
      await wait(250);
      if (won) sfx("win");
      await banner(won ? "Splash" : "Airframe lost", won ? (pre.combat!.rewardMode === "boss" ? "Corridor boss down" : "Contacts cleared") : run.defeatReason, won ? "win" : "loss");
      app.frozen = null;
      draw();
    } else {
      const final = barsOf(run);
      for (const [who, value] of final) setBar(who, value.hp, value.shield);
      for (const uid of pendingDown) root!.querySelector(`.foe[data-who="${uid}"]`)?.classList.add("down");
      if (opts.turn) {
        hand?.classList.remove("stowed");
        void banner(`Turn ${run.combat!.turn}`, "", "short");
        flipHand(new Map(), true);
      }
    }
  } finally {
    busy = false;
    document.body.classList.remove("busy");
    setSpeed(1);
  }
}

function play(index: number, uid: number | null) {
  const run = app.run;
  const inst = run?.combat?.hand[index];
  if (!run || !inst) return;
  const def = getCard(inst.id);
  if (def.target === "enemy" && uid !== null) app.targetUid = uid;
  const thrown = cardSnapshot(index);
  const single = run.combat?.enemies.find((enemy) => enemy.hp > 0)?.uid ?? null;
  const aimAt = def.target === "enemy" ? uid ?? (targetAlive(app.targetUid) ? app.targetUid : single) : def.target === "all" ? null : PLAYER;
  void combatAction(() => playCard(run, app.meta, index, uid), {
    shot: def.type === "attack" ? shotStyle(def.id) : "zap",
    thrown,
    attack: def.type === "attack",
    aimAt,
    cardType: def.type,
  });
}

function finishTurn() {
  const run = app.run;
  if (!run?.combat) return;
  app.armed = null;
  sfx("turn");
  void combatAction(() => endTurn(run, app.meta), { shot: "missile", turn: true });
}

function clickCard(index: number, touch: boolean) {
  const needs = needsTarget(index);
  if (touch) {
    if (app.armed !== index) {
      app.armed = index;
      sfx("click");
      draw();
      return;
    }
    if (needs) {
      if (targetAlive(app.targetUid)) play(index, app.targetUid);
      else toast("Tap an enemy to fire.", "info");
      return;
    }
    play(index, null);
    return;
  }
  if (needs) {
    app.armed = app.armed === index ? null : index;
    sfx("click");
    draw();
    return;
  }
  play(index, app.targetUid);
}

function previewPlay(index: number) {
  if (!needsTarget(index)) {
    play(index, null);
    return;
  }
  if (targetAlive(app.targetUid)) play(index, app.targetUid);
  else toast("Tap an enemy to fire.", "info");
}

/* ------------------------------------------------------------- hand UI */

function hoverHand(index: number | null) {
  const slots = root!.querySelectorAll<HTMLElement>(".hand .slot");
  const cw = Number.parseFloat(root!.querySelector<HTMLElement>(".battle")?.style.getPropertyValue("--cw") ?? "160") || 160;
  slots.forEach((slot, i) => {
    if (index === null) {
      slot.classList.remove("hover");
      slot.style.setProperty("--push", "0px");
      return;
    }
    const d = i - index;
    slot.classList.toggle("hover", d === 0);
    const push = d === 0 ? 0 : Math.sign(d) * Math.max(0, cw * 0.32 - (Math.abs(d) - 1) * cw * 0.1);
    slot.style.setProperty("--push", `${push.toFixed(1)}px`);
  });
}

function armedCardTop(): { x: number; y: number } | null {
  const card = root!.querySelector<HTMLElement>(".slot.armed .card, .slot.dragging .card");
  if (!card) return null;
  const r = card.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + 8 };
}

function foeAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const foe = el?.closest<HTMLElement>(".foe");
  return foe && !foe.classList.contains("down") ? foe : null;
}

function markTarget(foe: HTMLElement | null) {
  for (const el of root!.querySelectorAll(".foe.aimed")) if (el !== foe) el.classList.remove("aimed");
  foe?.classList.add("aimed");
}

function updateAim() {
  if (app.armed === null || !needsTarget(app.armed) || isCompact() || !pointer.x) {
    aim(null, null, false);
    return;
  }
  const foe = foeAt(pointer.x, pointer.y);
  markTarget(foe);
  aim(armedCardTop(), pointer, !!foe);
}

interface Drag {
  index: number;
  x: number;
  y: number;
  moved: boolean;
  targeting: boolean;
  slot: HTMLElement;
}
let drag: Drag | null = null;

root.addEventListener("pointerdown", (event) => {
  if (busy || event.button > 0) return;
  const card = (event.target as HTMLElement).closest<HTMLElement>(".hand .card");
  const slot = card?.closest<HTMLElement>(".slot");
  if (!card || !slot) return;
  drag = { index: Number(slot.dataset.slot), x: event.clientX, y: event.clientY, moved: false, targeting: false, slot };
});

window.addEventListener("pointermove", (event) => {
  pointer = { x: event.clientX, y: event.clientY };
  if (!drag) {
    if (app.armed !== null && event.pointerType === "mouse") updateAim();
    return;
  }
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 12) return;
    drag.moved = true;
    drag.targeting = needsTarget(drag.index);
    hoverHand(null);
    drag.slot.classList.add("dragging");
    root!.querySelector(".hand")?.classList.add("has-drag");
  }
  const card = drag.slot.querySelector<HTMLElement>(".card")!;
  if (drag.targeting) {
    card.style.translate = `${dx * 0.25}px ${Math.min(0, dy) * 0.25 - 40}px`;
    const foe = foeAt(event.clientX, event.clientY);
    markTarget(foe);
    aim(armedCardTop(), pointer, !!foe);
  } else {
    card.style.translate = `${dx}px ${dy}px`;
    const tray = root!.querySelector<HTMLElement>(".tray")?.getBoundingClientRect();
    drag.slot.classList.toggle("release", !!tray && event.clientY < tray.top - 10);
  }
});

window.addEventListener("pointerup", (event) => {
  const current = drag;
  drag = null;
  if (!current?.moved) return;
  suppressClick = true;
  window.setTimeout(() => (suppressClick = false), 50);
  aim(null, null, false);
  if (current.targeting) {
    const foe = foeAt(event.clientX, event.clientY);
    if (foe) play(current.index, Number(foe.dataset.who));
    else draw();
    return;
  }
  const tray = root!.querySelector<HTMLElement>(".tray")?.getBoundingClientRect();
  if (tray && event.clientY < tray.top - 10) {
    const single = app.run?.combat?.enemies.find((enemy) => enemy.hp > 0);
    play(current.index, targetAlive(app.targetUid) ? app.targetUid : single?.uid ?? null);
  } else draw();
});

window.addEventListener("pointercancel", () => {
  if (drag?.moved) draw();
  drag = null;
  aim(null, null, false);
});

root.addEventListener("pointerover", (event) => {
  if (event.pointerType !== "mouse" || drag || busy) return;
  const slot = (event.target as HTMLElement).closest<HTMLElement>(".hand .slot");
  if (slot) hoverHand(Number(slot.dataset.slot));
});
root.addEventListener("pointerout", (event) => {
  if (event.pointerType !== "mouse") return;
  const to = event.relatedTarget as HTMLElement | null;
  if (!to?.closest(".hand")) hoverHand(null);
});

/* ------------------------------------------------------------- clicks */

function onClick(event: MouseEvent) {
  if (suppressClick) return;
  if (busy) {
    setSpeed(0.35);
    return;
  }
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
  if (!target) {
    if (app.armed !== null || app.pickArm !== null) {
      app.armed = null;
      app.pickArm = null;
      aim(null, null, false);
      draw();
    }
    return;
  }
  const act = target.dataset.act ?? "";
  const arg = target.dataset.arg ?? "";
  if (act === "stop" || act === "seed") return;
  unlockAudio();
  const touch = (event as PointerEvent).pointerType === "touch" || (event as PointerEvent).pointerType === "pen";

  if (act === "play" && app.run) {
    clickCard(Number(arg), touch);
    return;
  }
  if (act === "preview-play" && app.run) {
    previewPlay(Number(arg));
    return;
  }
  if (act === "target" && app.run?.combat) {
    const uid = Number(arg);
    if (app.armed !== null && needsTarget(app.armed) && targetAlive(uid)) {
      play(app.armed, uid);
      return;
    }
    app.targetUid = uid;
    sfx("click");
    draw();
    return;
  }
  if (act === "end-turn" && app.run) {
    finishTurn();
    return;
  }

  if ((act === "take-card" || act === "buy-card") && touch && phoneShape()) {
    const key = `${act}:${arg}`;
    if (app.pickArm !== key) {
      app.pickArm = key;
      sfx("click");
      draw();
      return;
    }
  }
  app.pickArm = null;

  const beforeScreen = app.run?.screen;
  const beforeNotices = app.run?.notices.length ?? 0;
  const beforeView = app.view;

  if (act === "mute") {
    toggleMute();
  } else if (act === "settings") {
    app.modal = "settings";
    sfx("click");
  } else if (act === "title") {
    app.view = "title";
    app.modal = null;
  } else if (act === "how") {
    app.modal = null;
    if (app.view !== "how") app.returnView = app.view === "run" ? "run" : "title";
    app.view = "how";
    app.howPage = 0;
  } else if (act === "how-prev") {
    app.howPage = Math.max(0, app.howPage - 1);
  } else if (act === "how-next") {
    if (app.howPage >= HELP.length - 1) app.view = app.returnView === "run" && app.run ? "run" : "title";
    else app.howPage += 1;
  } else if (act === "back") {
    app.view = app.returnView === "run" && app.run ? "run" : "title";
  } else if (act === "hangar") {
    app.view = "hangar";
  } else if (act === "records") {
    if (app.view !== "records") app.returnView = app.view === "run" ? "run" : "title";
    app.view = "records";
  } else if (act === "continue") {
    if (app.run) app.view = "run";
  } else if (act === "pick-jet") {
    app.jetPick = arg as JetId;
    sfx("click");
  } else if (act === "difficulty") {
    const level = Math.max(ROOKIE, Math.min(highestUnlocked(app.meta), Number(arg)));
    if (Number.isFinite(level)) app.meta.difficulty = level;
    sfx("click");
    persist();
  } else if (act === "launch") {
    if (app.run && !app.run.closed) app.modal = "confirm-new";
    else launch();
  } else if (act === "launch-confirm") {
    if (app.run && !app.run.closed) abortRun(app.run, app.meta);
    launch();
  } else if (act === "save-quit") {
    app.modal = "abort";
  } else if (act === "quit-confirm") {
    app.view = "title";
    app.modal = null;
  } else if (act === "close-modal") {
    app.modal = null;
    app.relicId = null;
  } else if (act === "deck" || act === "deck-draw" || act === "deck-discard" || act === "deck-exhaust") {
    app.modal = "deck";
    app.deckTab = act === "deck-discard" ? "discard" : act === "deck-exhaust" ? "exhaust" : act === "deck-draw" ? "draw" : "loadout";
  } else if (act === "tab") {
    if (arg === "loadout" || arg === "draw" || arg === "discard" || arg === "exhaust") app.deckTab = arg;
  } else if (act === "relic") {
    app.relicId = app.relicId === arg ? null : arg;
  } else if (act === "notice") {
    if (app.run) dismissNotice(app.run);
  } else if (act === "toggle-log") {
    app.showLog = !app.showLog;
  } else if (act === "select-node") {
    app.selectedNode = arg;
    sfx("click");
  } else if (act === "fly" && app.run) {
    const result = enterNode(app.run, app.meta, arg);
    if (!result.ok) toast(result.message ?? "Can't fly there.", "bad");
    else {
      app.selectedNode = null;
      app.targetUid = null;
      app.armed = null;
      sfx("turn");
    }
  } else if (act === "take-card" && app.run) {
    const result = takeRewardCard(app.run, arg);
    if (!result.ok) toast(result.message ?? "No.", "bad");
    else {
      toast(result.message ?? "");
      sfx("play");
    }
  } else if (act === "take-relic" && app.run) {
    const result = takeRewardRelic(app.run, app.meta);
    toast(result.message ?? "", result.ok ? "info" : "bad");
    sfx(result.ok ? "unlock" : "error");
  } else if (act === "take-heal" && app.run) {
    const result = takeRewardHeal(app.run);
    toast(result.message ?? "", result.ok ? "info" : "bad");
    sfx(result.ok ? "heal" : "error");
  } else if (act === "ack-reward" && app.run) {
    ackReward(app.run, app.meta);
    sfx("click");
  } else if (act === "buy-card" && app.run) {
    const result = buyShopCard(app.run, Number(arg));
    toast(result.message ?? "", result.ok ? "info" : "bad");
    sfx(result.ok ? "play" : "error");
  } else if (act === "buy-relic" && app.run) {
    const result = buyShopRelic(app.run, app.meta, Number(arg));
    toast(result.message ?? "", result.ok ? "info" : "bad");
    sfx(result.ok ? "unlock" : "error");
  } else if (act === "buy-heal" && app.run) {
    const result = buyShopHeal(app.run);
    toast(result.message ?? "", result.ok ? "info" : "bad");
    sfx(result.ok ? "heal" : "error");
  } else if (act === "open-remove" && app.run) {
    const result = openRemoval(app.run);
    if (!result.ok) toast(result.message ?? "Can't.", "bad");
  } else if (act === "remove-card" && app.run) {
    const result = removeCard(app.run, app.meta, Number(arg));
    toast(result.message ?? "", result.ok ? "info" : "bad");
  } else if (act === "cancel-remove" && app.run) {
    cancelRemoval(app.run);
  } else if (act === "leave-shop" && app.run) {
    leaveShop(app.run);
  } else if (act === "event" && app.run) {
    const result = chooseEvent(app.run, app.meta, arg);
    if (!result.ok) toast(result.message ?? "Can't.", "bad");
  } else if (act === "event-continue" && app.run) {
    continueEvent(app.run);
  } else if (act === "gamble" && app.run) {
    chooseGamble(app.run, app.meta, arg === "take");
  } else if (act === "leave-gamble" && app.run) {
    leaveGamble(app.run);
  } else if (act === "intermission" && app.run && (arg === "heal" || arg === "relic" || arg === "card")) {
    chooseIntermission(app.run, app.meta, arg);
    sfx("heal");
  } else if (act === "finish") {
    finishTo(beforeScreen === "victory" ? "hangar" : "title");
    draw();
    return;
  }

  after(beforeScreen, beforeNotices);
  persist();
  const intoFight = app.view === "run" && app.run?.screen === "combat" && (beforeScreen !== "combat" || beforeView !== "run");
  draw();
  if (intoFight) void enterFight(beforeScreen === "map");
}

async function enterFight(fromMap: boolean) {
  const combat = app.run?.combat;
  if (!combat) return;
  if (fromMap) wipe();
  flipHand(new Map(), true);
  const boss = combat.enemies.find((enemy) => enemy.boss);
  if (boss && combat.turn === 1) {
    busy = true;
    try {
      await wait(300);
      sfx("boss");
      await banner(boss.name, boss.epithet, "boss");
    } finally {
      busy = false;
    }
  } else if (combat.rewardMode === "elite" && combat.turn === 1) void banner("Elite contact", combat.encounterName, "short elite");
}

root.addEventListener("click", onClick);
function toggleMute() {
  app.meta.mute = !app.meta.mute;
  configureAudio({ mute: app.meta.mute });
  sfx("click");
}

root.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement | null;
  if (target?.dataset.act === "seed") app.seedInput = target.value;
  const key = target?.dataset.vol;
  if (key === "music" || key === "sfx") {
    const value = Number(target!.value) / 100;
    if (key === "music") app.meta.musicVol = value;
    else app.meta.sfxVol = value;
    configureAudio({ [key]: value });
    const label = root!.querySelector(`[data-vol-label="${key}"]`);
    if (label) label.textContent = `${Math.round(value * 100)}%`;
  }
});
root.addEventListener("change", (event) => {
  const key = (event.target as HTMLInputElement | null)?.dataset.vol;
  if (!key) return;
  saveMeta(app.meta);
  if (key === "sfx") sfx("hit");
});

window.addEventListener("keydown", (event) => {
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (event.key === "m" || event.key === "M") {
    toggleMute();
    persist();
    if (app.modal === "settings") draw();
    return;
  }
  if (event.key === "Escape") {
    app.modal = null;
    app.relicId = null;
    app.armed = null;
    aim(null, null, false);
    draw();
    return;
  }
  if (busy || !app.run || app.view !== "run" || app.run.screen !== "combat" || app.modal) return;
  if (tag === "BUTTON" && (event.key === "Enter" || event.key === " ")) return;
  if (event.key === "e" || event.key === "E" || event.key === "Enter") {
    finishTurn();
    return;
  }
  if (/^[1-9]$/.test(event.key)) {
    const index = Number(event.key) - 1;
    if (!app.run.combat?.hand[index]) return;
    if (needsTarget(index) && !targetAlive(app.targetUid)) {
      app.armed = index;
      draw();
      return;
    }
    play(index, app.targetUid);
  }
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!busy && !drag) draw();
  }, 140);
});

if (import.meta.env.DEV) (window as unknown as { __dogfight: unknown }).__dogfight = { app, draw, persist };
(window as unknown as { __dogfightAudio: unknown }).__dogfightAudio = audioDebug;

draw();
