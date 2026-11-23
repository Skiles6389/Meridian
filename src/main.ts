import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/rajdhani/latin-700.css";
import "./styles.css";
import { setMuted, sfx, unlockAudio } from "./audio";
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
import type { JetId } from "./game/types";
import type { AppState } from "./ui/model";
import { renderApp } from "./ui/render";

const meta = loadMeta();
setMuted(meta.mute);

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
  shake: false,
  relicId: null,
  selectedNode: null,
  howPage: 0,
  returnView: "title",
};

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app");

let toastTimer = 0;

function persist() {
  saveMeta(app.meta);
  saveRun(app.run);
}

function draw() {
  root!.innerHTML = renderApp(app);
}

function toast(message: string, kind: "info" | "bad" = "info") {
  app.toast = message;
  app.toastKind = kind;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (app.toast === message) {
      app.toast = "";
      draw();
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
  app.run = createRun(jet, seedValue(), app.meta);
  app.view = "run";
  app.modal = null;
  app.selectedNode = null;
  app.targetUid = null;
  sfx("play");
  persist();
}

function after(beforeScreen: string | undefined, beforeHp: number, beforeNotices: number) {
  const run = app.run;
  if (!run) return;
  if (run.notices.length > beforeNotices) sfx("unlock");
  if (run.screen === "victory" && beforeScreen !== "victory") sfx("win");
  else if (run.screen === "defeat" && beforeScreen !== "defeat") sfx("lose");
  else if (run.hp < beforeHp) {
    app.shake = true;
    sfx("hurt");
    window.setTimeout(() => {
      app.shake = false;
      draw();
    }, 280);
  }
  if (run.combat && app.targetUid && !run.combat.enemies.some((enemy) => enemy.uid === app.targetUid && enemy.hp > 0)) {
    app.targetUid = null;
  }
}

function onClick(event: Event) {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
  if (!target) return;
  const act = target.dataset.act ?? "";
  const arg = target.dataset.arg ?? "";
  if (act === "stop" || act === "seed") return;
  unlockAudio();
  const beforeScreen = app.run?.screen;
  const beforeHp = app.run?.hp ?? 0;
  const beforeNotices = app.run?.notices.length ?? 0;

  if (act === "mute") {
    app.meta.mute = !app.meta.mute;
    setMuted(app.meta.mute);
    sfx("click");
  } else if (act === "title") {
    app.view = "title";
    app.modal = null;
  } else if (act === "how") {
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
    if (app.meta.unlocked[arg as JetId]) app.jetPick = arg as JetId;
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
  } else if (act === "deck" || act === "deck-discard" || act === "deck-exhaust") {
    app.modal = "deck";
    app.deckTab = act === "deck-discard" ? "discard" : act === "deck-exhaust" ? "exhaust" : "loadout";
  } else if (act === "tab") {
    if (arg === "loadout" || arg === "draw" || arg === "discard" || arg === "exhaust") app.deckTab = arg;
  } else if (act === "relic") {
    app.relicId = app.relicId === arg ? null : arg;
  } else if (act === "notice") {
    if (app.run) dismissNotice(app.run);
  } else if (act === "select-node") {
    app.selectedNode = arg;
  } else if (act === "fly" && app.run) {
    const result = enterNode(app.run, app.meta, arg);
    if (!result.ok) toast(result.message ?? "Can't fly there.", "bad");
    else {
      app.selectedNode = null;
      sfx("turn");
    }
  } else if (act === "target") {
    app.targetUid = Number(arg);
    sfx("click");
  } else if (act === "play" && app.run) {
    const result = playCard(app.run, app.meta, Number(arg), app.targetUid);
    if (!result.ok) {
      toast(result.message ?? "Can't play that.", "bad");
      sfx("error");
    } else sfx("play");
  } else if (act === "end-turn" && app.run) {
    endTurn(app.run, app.meta);
    sfx("turn");
  } else if (act === "take-card" && app.run) {
    const result = takeRewardCard(app.run, arg);
    if (!result.ok) toast(result.message ?? "No.", "bad");
    else sfx("play");
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

  after(beforeScreen, beforeHp, beforeNotices);
  persist();
  draw();
}

root.addEventListener("click", onClick);
root.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement | null;
  if (target?.dataset.act === "seed") app.seedInput = target.value;
});
window.addEventListener("keydown", (event) => {
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (event.key === "Escape") {
    app.modal = null;
    app.relicId = null;
    draw();
    return;
  }
  if (!app.run || app.view !== "run" || app.run.screen !== "combat" || app.modal) return;
  if (tag === "BUTTON" && (event.key === "Enter" || event.key === " ")) return;
  if (event.key === "e" || event.key === "E" || event.key === "Enter") {
    const beforeHp = app.run.hp;
    const beforeScreen = app.run.screen;
    const beforeNotices = app.run.notices.length;
    endTurn(app.run, app.meta);
    sfx("turn");
    after(beforeScreen, beforeHp, beforeNotices);
    persist();
    draw();
  }
  if (/^[1-9]$/.test(event.key)) {
    const beforeHp = app.run.hp;
    const beforeScreen = app.run.screen;
    const beforeNotices = app.run.notices.length;
    const result = playCard(app.run, app.meta, Number(event.key) - 1, app.targetUid);
    if (!result.ok) {
      toast(result.message ?? "Can't play that.", "bad");
      sfx("error");
    } else sfx("play");
    after(beforeScreen, beforeHp, beforeNotices);
    persist();
    draw();
  }
});

draw();
