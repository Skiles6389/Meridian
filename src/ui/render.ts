import { ACTS } from "../game/acts";
import { getCard } from "../game/cards";
import { cardCost, enemyPlan, forecastLoss, PLAYER } from "../game/combat";
import { getEncounter, getEnemy } from "../game/enemies";
import { getEvent } from "../game/events";
import { bestClear, difficultyName, highestUnlocked, MAX_THREAT, NORMAL, ROOKIE, ROOKIE_TEXT, THREAT_STEPS } from "../game/difficulty";
import { STATUS_BY_ID } from "../game/glossary";
import { HELP } from "../game/help";
import { JETS, JET_ORDER, unlockBlurb } from "../game/jets";
import { nodeById } from "../game/map";
import { getRelic } from "../game/relics";
import { choiceAvailable, reachable, removalCost, repairOf } from "../game/run";
import type { CardDef, Fighter, MapNode, NodeType, Plan, RunState, Status } from "../game/types";
import { spentStations } from "./loadout";
import { ACT_SCENE, CHASE_SCENE, SCENE_ART, cardArt, chaseArt, chaseAspect, eventArt, jetArt } from "./art";
import { allySpot, foeSpots, type CamShape, type Spot } from "./camera";
import { swayStyle } from "./flight";
import { icon, nodeIcon, relicIcon } from "./icons";
import type { AppState } from "./model";

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function viewport(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: 1280, h: 800 };
  return { w: window.innerWidth, h: window.innerHeight };
}

export function isCompact(): boolean {
  const { w, h } = viewport();
  return w <= 720 || h <= 560;
}

/** Phone layouts: "landscape" is a short, wide screen; "portrait" is a narrow one. */
export function phoneShape(): "portrait" | "landscape" | null {
  const { w, h } = viewport();
  if (h <= 560 && w > h) return "landscape";
  if (w <= 720 || h <= 560) return "portrait";
  return null;
}

/* ------------------------------------------------------------------ scene */

/** Which painted backdrop sits behind the current screen. */
export function sceneKey(app: AppState): string {
  if (app.view === "hangar" || app.view === "records" || app.view === "how") return "hangar";
  if (app.view === "title" || !app.run) return "title";
  const run = app.run;
  if (run.screen === "shop" || (run.screen === "remove" && run.remove?.next === "shop")) return "shop";
  if (run.screen === "map") return `chart-${run.act}`;
  if (run.screen === "combat" || app.frozen) return CHASE_SCENE[run.act];
  return ACT_SCENE[run.act];
}

/* ---------------------------------------------------------------- shared */

const KEYWORDS = ["Shield", "Plating", "Evasion", "Locked", "Lock", "Jam", "Burn", "Thrust", "Armor", "Suppress", "Static", "Exhaust", "Energy", "ALL", "Clog"];
const KW_RE = new RegExp(`\\b(${KEYWORDS.join("|")})\\b|(\\d+)`, "g");

function richText(text: string): string {
  return esc(text).replace(KW_RE, (match, word: string | undefined) => (word ? `<em class="kw">${match}</em>` : `<b>${match}</b>`));
}

function typeLabel(def: CardDef): string {
  if (def.type === "burden") return "Clog";
  return def.type[0].toUpperCase() + def.type.slice(1);
}

export function cardFace(def: CardDef, opts: { cost?: number; cls?: string; attrs?: string; tag?: string } = {}): string {
  const cost = opts.cost ?? def.cost;
  const cut = cost < def.cost;
  const tag = opts.tag ?? "div";
  return `
    <${tag} class="card type-${def.type} rar-${def.rarity} ${opts.cls ?? ""}" ${opts.attrs ?? ""}>
      <span class="card-frame">
        <span class="card-art"><img src="${cardArt(def.id)}" alt="" draggable="false" decoding="async" /></span>
        <span class="card-name ${def.name.length > 14 ? "long" : ""}"><span>${esc(def.name)}</span></span>
        <span class="card-type">${typeLabel(def)}</span>
        <span class="card-text"><span>${richText(def.text)}</span></span>
        <span class="card-gem" aria-hidden="true"></span>
      </span>
      <span class="card-cost ${cut ? "cut" : ""}"><span>${cost}</span></span>
    </${tag}>`;
}

function statusChip(id: string, value: number, extraCls = ""): string {
  const info = STATUS_BY_ID[id];
  if (!info || value <= 0) return "";
  return `<span class="st st-${id} ${extraCls}" title="${esc(`${info.name} ${value}: ${info.text}`)}">${icon(id)}<b>${value}</b></span>`;
}

function statusRow(status: Status): string {
  return `<div class="st-row">${[
    statusChip("evasion", status.evasion),
    statusChip("locked", status.locked),
    statusChip("jam", status.jam),
    statusChip("burn", status.burn),
    statusChip("thrust", status.thrust),
    statusChip("plating", status.plating ?? 0),
    statusChip("armor", status.armor),
    statusChip("suppress", status.suppress),
    statusChip("static", status.static),
  ].join("")}</div>`;
}

export function hpBar(who: number, hp: number, maxHp: number, shield: number, cls = ""): string {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return `
    <div class="bar ${shield > 0 ? "shielded" : ""} ${cls}" data-bar="${who}" data-max="${maxHp}">
      <div class="bar-track"><div class="bar-ghost" style="width:${pct}%"></div><div class="bar-fill" style="width:${pct}%"></div></div>
      <span class="bar-text">${Math.max(0, hp)}/${maxHp}</span>
      <div class="bar-shield" title="${esc(STATUS_BY_ID.shield.text)}">${icon("shield")}<b>${shield}</b></div>
    </div>`;
}

function btn(label: string, act: string, opts: { arg?: string; cls?: string; disabled?: boolean; title?: string } = {}): string {
  return `<button class="btn ${opts.cls ?? ""}" data-act="${act}" ${opts.arg !== undefined ? `data-arg="${esc(opts.arg)}"` : ""} ${opts.disabled ? "disabled" : ""} ${opts.title ? `title="${esc(opts.title)}"` : ""}><span>${label}</span></button>`;
}

/* ------------------------------------------------------------------- hud */

function hud(app: AppState): string {
  const run = app.run;
  if (!run) return "";
  const act = ACTS[run.act];
  const jet = JETS[run.jet];
  const relic = app.relicId ? getRelic(app.relicId) : null;
  const low = run.hp <= run.maxHp * 0.3;
  return `
    <header class="hud">
      <div class="hud-pilot">
        <div class="hud-portrait">${jetArt(jet.silhouette)}</div>
        <div class="hud-name"><b>${esc(jet.callsign)}</b><span>${esc(jet.code)} ${esc(jet.name)}</span></div>
      </div>
      <div class="hud-stat hud-hp ${low ? "low" : ""}" title="Airframe integrity">${icon("heart")}<b>${run.hp}<small>/${run.maxHp}</small></b></div>
      <div class="hud-stat hud-gold" title="Gold">${icon("coin")}<b>${run.gold}</b></div>
      <div class="hud-relics">
        ${run.relics
          .map((id) => {
            const def = getRelic(id);
            return `<button class="relic relic-${def.kind} ${app.relicId === id ? "on" : ""}" data-act="relic" data-arg="${esc(id)}" title="${esc(`${def.name}: ${def.text}`)}">${relicIcon(id)}</button>`;
          })
          .join("")}
      </div>
      <div class="hud-act"><span>Act ${run.act}</span><b>${esc(act.name)}</b></div>
      <div class="hud-btns">
        <button class="hud-btn" data-act="deck" title="Deck">${icon("deck")}<i>${run.deck.length}</i></button>
        <button class="hud-btn" data-act="how" title="How to fly">${icon("help")}</button>
        <button class="hud-btn" data-act="mute" title="${app.meta.mute ? "Audio off" : "Audio on"}">${icon(app.meta.mute ? "soundOff" : "soundOn")}</button>
        <button class="hud-btn" data-act="settings" title="Settings">${icon("gear")}</button>
      </div>
    </header>
    ${
      relic
        ? `<div class="relic-pop relic-${relic.kind}" data-act="close-modal"><div class="relic-medal">${relicIcon(relic.id)}</div><div><strong>${esc(relic.name)}</strong><p>${esc(relic.text)}</p></div></div>`
        : ""
    }
    ${run.notices[0] && run.screen !== "victory" && run.screen !== "defeat" ? `<button class="notice" data-act="notice"><span>${esc(run.notices[0])}</span><small>Tap to dismiss</small></button>` : ""}
  `;
}

/* ----------------------------------------------------------------- title */

/** Two swept wings meeting at a point: the squadron mark beside the title. No national or unit insignia. */
const LOGO_WINGS =
  `<svg class="logo-wings" viewBox="0 0 40 20" aria-hidden="true"><path d="M20 17L2 4h9l9 7 9-7h9Z" fill="#f0cd7d" stroke="#0a0f1c" stroke-width="2" stroke-linejoin="round"/><path d="M20 9l-5-5h10Z" fill="#d8412a" stroke="#0a0f1c" stroke-width="2" stroke-linejoin="round"/></svg>`;

function titleScreen(app: AppState): string {
  const go = (label: string, act: string, primary: boolean) =>
    `<button class="btn big ${primary ? "primary" : ""}" data-act="${act}"><span>${label}</span><i class="go" aria-hidden="true"></i></button>`;
  return `
    <section class="title-screen">
      <div class="title-copy">
        <div class="logo">
          <p class="logo-kicker">${LOGO_WINGS}<span>A fighter-jet deck sortie</span></p>
          <h1 class="logo-word" data-text="DOGFIGHT"><span class="logo-face">DOGFIGHT</span></h1>
          <p class="logo-tag"><span>Hold the corridor</span></p>
        </div>
        <nav class="title-menu">
          ${app.run ? go("Continue sortie", "continue", true) : ""}
          ${go("New sortie", "hangar", !app.run)}
          <div class="title-row">
            ${btn("Records", "records")}
            ${btn("How to fly", "how")}
            ${btn(`${icon("gear")}`, "settings", { cls: "square", title: "Settings" })}
          </div>
        </nav>
        <p class="fine">Real aircraft. Fictional squadrons and callsigns. Neutral markings only.</p>
      </div>
    </section>
  `;
}

/* ---------------------------------------------------------------- hangar */

function summarize(ids: string[]): { name: string; count: number; type: string }[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].map(([id, count]) => ({ name: getCard(id).name, count, type: getCard(id).type }));
}

function shortClear(level: number): string {
  return level <= ROOKIE ? "R" : level === NORMAL ? "N" : `T${level}`;
}

function clearLabel(level: number | null): string {
  if (level === null) return "No clear yet";
  return difficultyName(level);
}

function difficultyPicker(app: AppState): string {
  const level = app.meta.difficulty;
  const open = highestUnlocked(app.meta);
  const threat = level > NORMAL ? level : Math.max(1, open);
  const threatOpen = open >= 1;
  const mode = (label: string, arg: number, on: boolean, disabled = false, title = "") =>
    `<button class="diff-mode ${on ? "on" : ""}" data-act="difficulty" data-arg="${arg}" ${disabled ? "disabled" : ""} ${title ? `title="${esc(title)}"` : ""}>${label}</button>`;
  const notes =
    level === ROOKIE
      ? ROOKIE_TEXT
      : level === NORMAL
        ? ["The standard corridor, as tuned."]
        : THREAT_STEPS.slice(0, level).map((step, i) => `${i + 1}. ${step.name}: ${step.text}`);
  const best = bestClear(app.meta, app.jetPick);
  return `
    <div class="diff-picker" data-level="${level}">
      <div class="diff-head"><span>Difficulty</span><small>Best clear: <b>${esc(clearLabel(best))}</b></small></div>
      <div class="diff-modes">
        ${mode("Rookie", ROOKIE, level === ROOKIE)}
        ${mode("Normal", NORMAL, level === NORMAL)}
        ${mode(threatOpen ? `Threat ${threat}` : `${icon("suppress")} Threat`, threat, level > NORMAL, !threatOpen, threatOpen ? "" : "Win a sortie on Normal to open Threat Level 1.")}
      </div>
      ${
        level > NORMAL
          ? `<div class="diff-step">
              <button class="diff-arrow" data-act="difficulty" data-arg="${level - 1}" ${level <= 1 ? "disabled" : ""} aria-label="Lower Threat Level">‹</button>
              <div class="diff-pips">${Array.from({ length: MAX_THREAT }, (_, i) => `<i class="${i < level ? "on" : ""} ${i >= open ? "shut" : ""}"></i>`).join("")}</div>
              <button class="diff-arrow" data-act="difficulty" data-arg="${level + 1}" ${level >= open ? "disabled" : ""} aria-label="Raise Threat Level">›</button>
            </div>`
          : ""
      }
      <ul class="diff-notes">${notes.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
      ${level > NORMAL || !threatOpen ? `<p class="diff-hint">${threatOpen ? `Win at Threat ${open} to open the next level.` : "Win a sortie on Normal to open Threat Level 1."}</p>` : ""}
    </div>`;
}

function hangar(app: AppState): string {
  const picked = JETS[app.jetPick];
  const relic = getRelic(picked.relic);
  const unlocked = app.meta.unlocked[app.jetPick];
  const roster = JET_ORDER.map((id) => {
    const jet = JETS[id];
    const open = app.meta.unlocked[id];
    const selected = app.jetPick === id;
    return `
      <button class="roster-tile ${selected ? "on" : ""} ${open ? "" : "locked"}" data-act="pick-jet" data-arg="${id}" title="${esc(open ? `${jet.code} ${jet.name}` : unlockBlurb(id, app.meta.stats))}">
        <span class="roster-art">${jetArt(jet.silhouette)}</span>
        <span class="roster-code">${esc(jet.code)}</span>
        <span class="roster-name">${esc(jet.name)}</span>
        ${open ? "" : `<span class="roster-lock">Locked</span>`}
        ${open && bestClear(app.meta, id) !== null ? `<span class="roster-clear" title="Best clear: ${esc(clearLabel(bestClear(app.meta, id)))}">${esc(shortClear(bestClear(app.meta, id)!))}</span>` : ""}
      </button>`;
  }).join("");
  const hpPct = Math.round((picked.hp / 90) * 100);
  return `
    <section class="hangar-screen">
      <div class="screen-head">
        ${btn("Back", "title", { cls: "ghost" })}
        <div class="head-title"><p class="eyebrow">Hangar</p><h1>Choose an airframe</h1></div>
      </div>
      <div class="hangar-main">
        <div class="hangar-stage">
          <div class="hangar-jet ${unlocked ? "" : "locked"}">${jetArt(picked.silhouette, { cls: "showcase" })}<div class="hangar-floor"></div></div>
          <div class="hangar-plate">
            <span class="plate-code">${esc(picked.code)}</span>
            <span class="plate-name">${esc(picked.name)}</span>
            <span class="plate-role">${esc(picked.role)} · ${esc(picked.maker)}</span>
          </div>
        </div>
        <aside class="hangar-info panel">
          <p class="callsign">Callsign ${esc(picked.callsign)}</p>
          <p class="blurb">${esc(picked.blurb)}</p>
          <div class="spec"><span>Airframe</span><div class="spec-bar"><i style="width:${hpPct}%"></i></div><b>${picked.hp} HP</b></div>
          <div class="system-slot relic-starter"><div class="relic-medal">${relicIcon(relic.id)}</div><div><strong>${esc(relic.name)}</strong><p>${esc(relic.text)}</p></div></div>
          <p class="fine">${esc(picked.play)}</p>
          <div class="deck-chips">${summarize(picked.deck).map((row) => `<span class="deck-chip type-${row.type}">${row.count}× ${esc(row.name)}</span>`).join("")}</div>
          ${unlocked ? "" : `<p class="lock-note">${icon("suppress")} ${esc(unlockBlurb(app.jetPick, app.meta.stats))}</p>`}
          ${unlocked ? difficultyPicker(app) : ""}
          <div class="launch-row">
            <label class="seed">Seed <input data-act="seed" value="${esc(app.seedInput)}" inputmode="numeric" placeholder="random" /></label>
            ${btn("Launch", "launch", { cls: "primary big launch", disabled: !unlocked })}
          </div>
        </aside>
      </div>
      <div class="hangar-roster">${roster}</div>
    </section>
  `;
}

/* --------------------------------------------------------- records / how */

function records(app: AppState): string {
  const stats = app.meta.stats;
  const rows: [string, string][] = [
    ["Sorties", String(stats.runs)],
    ["Wins", String(stats.wins)],
    ["Losses", String(stats.losses)],
    ["Deepest", stats.deepest >= 4 ? "Won" : stats.deepest ? `Act ${stats.deepest}` : "—"],
    ["Battles", String(stats.battles)],
    ["Elites", String(stats.elites)],
    ["Bosses", String(stats.bosses)],
    ["Mysteries", String(stats.mysteries)],
    ["Gold stowed", String(stats.goldEarned)],
    ["Cards played", String(stats.cardsPlayed)],
    ["Best win HP", stats.bestVictoryHp ? String(stats.bestVictoryHp) : "—"],
  ];
  return `
    <section class="paper-screen">
      <div class="screen-head">
        ${btn("Back", "back", { cls: "ghost" })}
        <div class="head-title"><p class="eyebrow">Debrief locker</p><h1>Records</h1></div>
      </div>
      <div class="panel records-panel">
        <div class="stat-grid">
          ${rows.map(([label, value]) => `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}
        </div>
        <ul class="unlock-list">
          ${JET_ORDER.map((id) => {
            const jet = JETS[id];
            const on = app.meta.unlocked[id];
            return `<li class="${on ? "on" : ""}"><span class="unlock-art">${jetArt(jet.silhouette)}</span><strong>${esc(jet.code)} ${esc(jet.name)}</strong><span>${on ? `Best clear: ${esc(clearLabel(bestClear(app.meta, id)))}` : esc(unlockBlurb(id, stats))}</span></li>`;
          }).join("")}
        </ul>
      </div>
    </section>
  `;
}

function how(app: AppState): string {
  const page = HELP[app.howPage] ?? HELP[0];
  return `
    <section class="paper-screen">
      <div class="screen-head">
        ${btn("Close", "back", { cls: "ghost" })}
        <div class="head-title"><p class="eyebrow">Briefing ${app.howPage + 1} / ${HELP.length}</p><h1>${esc(page.title)}</h1></div>
      </div>
      <div class="panel how-panel">
        ${page.lines.map((line) => `<p>${richText(line)}</p>`).join("")}
        <div class="btn-row">
          ${btn("Back", "how-prev", { disabled: app.howPage === 0 })}
          ${btn(app.howPage === HELP.length - 1 ? "Done" : "Next", "how-next", { cls: "primary" })}
        </div>
      </div>
    </section>
  `;
}

/* ------------------------------------------------------------------- map */

export const NODE_NAME: Record<NodeType, string> = {
  battle: "Battle",
  elite: "Elite",
  shop: "Depot",
  mystery: "Mystery",
  gamble: "Gamble",
  boss: "Boss",
};

function nodeBlurb(node: MapNode): string {
  if (node.type === "battle") return "Hostile paint on the scope. A standard fight.";
  if (node.type === "elite") return "Heavy contact. Harder fight, better pay.";
  if (node.type === "shop") return "A field depot. Cards, relics, repair, removal.";
  if (node.type === "mystery") return "An unidentified return. You will have to choose.";
  if (node.type === "gamble") return "A yard toss. A useful relic, or a cursed one.";
  return "The corridor boss. Win to advance.";
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function jitter(id: string, salt: number, amount: number): number {
  return (((hash(id + salt) % 1000) / 1000) * 2 - 1) * amount;
}

const COASTS: Record<number, string> = {
  1: "M-10 210 C 60 190 90 250 150 236 S 240 170 300 196 S 380 260 420 236 M 520 0 C 540 80 600 120 640 110 S 760 140 800 120 M -10 820 C 80 760 120 860 220 830 S 340 760 420 800",
  2: "M 120 -10 C 140 120 90 220 150 330 S 260 470 220 600 S 140 760 200 900 S 260 1000 240 1100 M 560 -10 C 540 140 600 240 560 360 S 470 520 540 660 S 620 820 560 1100",
  3: "M -10 300 C 120 260 220 330 360 290 S 600 250 760 300 M -10 700 C 160 660 260 740 420 700 S 640 650 800 700",
};

function mapScreen(app: AppState): string {
  const run = app.run!;
  const { w: vw } = viewport();
  const compact = vw <= 720;
  const width = Math.round(Math.min(760, vw - (compact ? 16 : 320)));
  const rowGap = compact ? 128 : 146;
  const top = compact ? 150 : 170;
  const height = top + (run.map.rows - 1) * rowGap + (compact ? 150 : 150);
  const pad = compact ? 34 : 70;
  const pos = (node: MapNode) => {
    if (node.type === "boss") return { x: width / 2, y: top - 40 };
    return {
      x: pad + ((node.col + 0.5) / 7) * (width - pad * 2) + jitter(node.id, 1, compact ? 8 : 16),
      y: top + (run.map.rows - 1 - node.row) * rowGap + jitter(node.id, 2, 14),
    };
  };
  const open = new Set(reachable(run).map((node) => node.id));
  const routeIdx = new Map(run.route.map((id, index) => [id, index]));
  const current = run.nodeId ? nodeById(run.map, run.nodeId) : null;

  const curve = (a: { x: number; y: number }, b: { x: number; y: number }, key: string) => {
    const mx = (a.x + b.x) / 2 + jitter(key, 3, 18);
    const my = (a.y + b.y) / 2 + jitter(key, 4, 8);
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };

  const paths: string[] = [];
  const taken: string[] = [];
  for (const node of run.map.nodes) {
    const a = pos(node);
    const ri = routeIdx.get(node.id);
    for (const id of node.edges) {
      const next = nodeById(run.map, id);
      if (!next) continue;
      const b = pos(next);
      const d = curve(a, b, node.id + id);
      const wasTaken = ri !== undefined && run.route[ri + 1] === id;
      const live = current ? node.id === current.id && open.has(id) : false;
      if (wasTaken) taken.push(`<path class="ink-route" d="${d}"/>`);
      else paths.push(`<path class="ink-path ${live ? "live" : ""}" d="${d}"/>`);
    }
  }

  const bossDef = run.map.nodes.find((node) => node.type === "boss");
  let bossArt = "";
  if (bossDef?.encounterId) {
    try {
      const foe = getEnemy(getEncounter(bossDef.encounterId).foes[0].id);
      bossArt = jetArt(foe.silhouette, { flip: true, livery: foe.livery });
    } catch {
      bossArt = "";
    }
  }

  const nodes = run.map.nodes
    .map((node) => {
      const p = pos(node);
      const flags = [
        `n-${node.type}`,
        open.has(node.id) ? "reachable" : "",
        node.id === run.nodeId ? "current" : "",
        routeIdx.has(node.id) && node.id !== run.nodeId ? "past" : "",
        node.id === app.selectedNode ? "picked" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const inner =
        node.type === "boss"
          ? `<span class="seal">${bossArt}</span><span class="seal-label">Boss</span>`
          : `<span class="stamp">${nodeIcon(node.type)}</span>`;
      return `<button class="node ${flags}" data-act="select-node" data-arg="${esc(node.id)}" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;--row:${node.row}" title="${NODE_NAME[node.type]}">${inner}<span class="node-ring"></span><span class="node-x"></span></button>`;
    })
    .join("");

  const marker = current
    ? (() => {
        const p = pos(current);
        return `<div class="you-marker" style="left:${p.x}px;top:${p.y}px">${jetArt(JETS[run.jet].silhouette)}</div>`;
      })()
    : "";

  const selected = app.selectedNode ? nodeById(run.map, app.selectedNode) : null;
  const canFly = selected ? open.has(selected.id) : false;
  const legend = (["battle", "elite", "shop", "mystery", "gamble", "boss"] as NodeType[])
    .map((type) => `<li><span class="stamp legend-stamp">${nodeIcon(type)}</span>${NODE_NAME[type]}</li>`)
    .join("");

  return `
    <section class="map-screen">
      <div class="chart-scroll" data-scroll="chart">
        <div class="chart act-${run.act}" style="width:${width}px;height:${height}px;background-image:url('${SCENE_ART.chart ?? ""}')">
          <svg class="chart-ink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
            <g class="chart-coast" transform="scale(${(width / 760).toFixed(3)} ${(height / 1100).toFixed(3)})"><path d="${COASTS[run.act]}"/></g>
            <g class="compass" transform="translate(${width - (compact ? 46 : 74)} ${height - (compact ? 60 : 86)}) scale(${compact ? 0.6 : 1})">
              <circle r="34"/><circle r="26" class="thin"/>
              <path d="M0 -44 L7 0 L0 44 L-7 0Z" class="needle"/><path d="M-44 0 L0 6 L44 0 L0 -6Z" class="needle2"/>
              <text y="-50">N</text>
            </g>
            ${paths.join("")}
            ${taken.join("")}
          </svg>
          <div class="chart-cartouche"><span>Act ${run.act}</span><b>${esc(ACTS[run.act].name)}</b><small>Seed ${run.seed} · ${esc(difficultyName(run.difficulty ?? NORMAL))}</small></div>
          ${nodes}
          ${marker}
        </div>
      </div>
      <aside class="chart-legend">
        <p class="legend-head">Legend</p>
        <ul>${legend}</ul>
        <p class="legend-note">${esc(ACTS[run.act].blurb)}</p>
      </aside>
      <div class="brief-slip ${selected ? "has" : ""}">
        ${
          selected
            ? `<div class="slip-icon">${selected.type === "boss" ? icon("attack") : nodeIcon(selected.type)}</div>
               <div class="slip-copy"><p class="eyebrow">${esc(NODE_NAME[selected.type])}</p><p>${esc(nodeBlurb(selected))}</p></div>
               ${btn(canFly ? "Fly" : "Not on route", "fly", { arg: selected.id, cls: "primary", disabled: !canFly })}`
            : `<div class="slip-copy"><p class="eyebrow">Route</p><p>${run.nodeId ? "Pick a connected plot. The live lanes are inked darker." : "The whole corridor is on the chart. Pick a first plot at the bottom."}</p></div>`
        }
      </div>
    </section>
  `;
}

/* ---------------------------------------------------------------- battle */

function intentHtml(plan: Plan): string {
  if (plan.kind === "down") return `<div class="intent intent-down" title="${esc(plan.title)}">${icon("down")}<b>${esc(plan.title)}</b></div>`;
  let figure = "";
  if (plan.damage > 0 && plan.hits > 1 && !plan.uneven) figure = `${plan.perHit}<small>×${plan.hits}</small>`;
  else if (plan.damage > 0) figure = String(plan.damage);
  const ico =
    plan.damage > 0 ? "attack" : plan.shield > 0 ? "shield" : plan.kind === "buff" ? "buff" : "debuff";
  const extras: string[] = [];
  if (plan.damage > 0 && plan.shield > 0) extras.push(`<span class="mini mini-shield">${icon("shield")}${plan.shield}</span>`);
  if (!plan.damage && plan.shield > 0) figure = String(plan.shield);
  for (const tag of plan.tags) {
    const [word, num] = tag.split(" ");
    const key = word.toLowerCase() === "lock" ? "locked" : word.toLowerCase();
    if (["burn", "locked", "jam", "static", "suppress", "thrust", "armor"].includes(key)) {
      extras.push(`<span class="mini mini-${key}">${icon(key)}${num && !num.startsWith("+") ? num : num ? num.slice(1) : ""}</span>`);
    }
  }
  const detail = [
    plan.damage > 0 ? (plan.hits > 1 && !plan.uneven ? `${plan.hits} hits of ${plan.perHit}` : `${plan.damage} damage`) : "",
    plan.shield > 0 ? `+${plan.shield} Shield` : "",
    ...plan.tags,
  ]
    .filter(Boolean)
    .join(", ");
  return `
    <div class="intent intent-${plan.kind} ${plan.damage >= 15 ? "heavy" : ""}" title="${esc(`Next: ${plan.title}${detail ? ` — ${detail}` : ""}`)}">
      <span class="intent-ico">${icon(ico)}</span>${figure ? `<b>${figure}</b>` : ""}${extras.join("")}
      <span class="intent-name">${esc(plan.title)}</span>
    </div>`;
}

export function camShape(): CamShape {
  return phoneShape() ?? "desk";
}

function spotVars(prefix: string, spot: Spot): string {
  return `--${prefix}x:${spot.x};--${prefix}y:${spot.y};--${prefix}s:${spot.s}`;
}

/** The foe the HUD tracks: the one the player marked, or else the lead live contact. */
function trackedUid(run: RunState, app: AppState): number | null {
  const living = run.combat!.enemies.filter((enemy) => enemy.hp > 0);
  return living.find((enemy) => enemy.uid === app.targetUid)?.uid ?? living[0]?.uid ?? null;
}

function foeHtml(run: RunState, enemy: Fighter, index: number, app: AppState, close: Spot, wide: Spot, tracked: boolean): string {
  const def = getEnemy(enemy.defId);
  let plan: Plan = { kind: "down", title: "Down", damage: 0, hits: 0, perHit: 0, uneven: false, shield: 0, tags: [] };
  if (enemy.hp > 0) {
    try {
      plan = enemyPlan(run, enemy);
    } catch {
      /* forecasting is cosmetic */
    }
  }
  const selected = app.targetUid === enemy.uid;
  const down = enemy.hp <= 0;
  const range = (0.8 + (62 - close.y) * 0.06 + index * 0.3).toFixed(1);
  const box = Math.min(chaseAspect(enemy.silhouette, "rear"), chaseAspect(enemy.silhouette, "front")).toFixed(3);
  return `
    <div class="foe ${selected ? "selected" : ""} ${tracked ? "tracked" : ""} ${down ? "down" : ""} ${enemy.boss ? "boss" : ""} ${enemy.elite ? "elite" : ""}" data-act="target" data-arg="${enemy.uid}" data-who="${enemy.uid}" style="--slot:${index};--box:${box};${spotVars("c", close)};${spotVars("w", wide)}">
      ${down ? "" : intentHtml(plan)}
      <div class="unit-art">
        ${chaseArt(enemy.silhouette, "rear", { livery: def.livery, spent: spentStations(enemy.uid) })}
        ${chaseArt(enemy.silhouette, "front", { livery: def.livery, spent: spentStations(enemy.uid) })}
        ${jetArt(enemy.silhouette, { livery: def.livery, cls: "side" })}
        <div class="reticle"><b>${selected ? "Lock" : "Tgt"}</b><small>${range} nm</small></div>
      </div>
      <div class="unit-hud">
        <div class="nameplate"><b>${esc(enemy.name)}</b><small>${esc(enemy.epithet)}</small></div>
        ${hpBar(enemy.uid, enemy.hp, enemy.maxHp, enemy.shield)}
        ${statusRow(enemy.status)}
      </div>
    </div>`;
}

interface Slot {
  x: number;
  y: number;
  r: number;
}

export interface HandLayout {
  slots: Slot[];
  cw: number;
  /** Card height in the hand; shorter than a full card when `mini`. */
  ch: number;
  /** Phone hands show name-and-art cards; the rules text lives in the tap preview. */
  mini: boolean;
  trayH: number | null;
  /** Width of the tap-to-preview card on phones. */
  pw: number;
}

const HAND_GAP = 4;

export function handLayout(n: number): HandLayout {
  const { w: vw, h: vh } = viewport();
  const shape = phoneShape();
  if (!shape) {
    const cw = vw < 1100 ? 150 : 170;
    const room = Math.min(980, vw - 440);
    const gap = n > 1 ? Math.min(cw * 0.8, (room - cw) / (n - 1)) : 0;
    const slots: Slot[] = [];
    for (let i = 0; i < n; i++) {
      const o = i - (n - 1) / 2;
      slots.push({ x: o * gap, y: Math.abs(o) ** 1.6 * 4, r: o * 3.6 * Math.min(1, 6 / Math.max(n, 1)) });
    }
    return { slots, cw, ch: Math.round(cw * 1.4), mini: false, trayH: null, pw: 0 };
  }
  const landscape = shape === "landscape";
  // Landscape keeps the energy and End turn clusters beside the hand instead of above it.
  const room = landscape ? vw - 2 * 128 : vw - 12;
  const fit = n > 0 ? (room - (n - 1) * HAND_GAP) / n : room;
  const cw = Math.round(Math.max(58, Math.min(landscape ? 80 : 104, fit)));
  const mini = cw < 96;
  const ch = Math.round(cw * (mini ? 1.32 : 1.4));
  const step = n > 1 ? Math.min(cw + HAND_GAP, (room - cw) / (n - 1)) : 0;
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const o = i - (n - 1) / 2;
    slots.push({ x: o * step, y: mini ? 0 : Math.abs(o) ** 1.6 * 2, r: mini ? 0 : o * 1.6 });
  }
  const trayH = landscape ? Math.max(ch + 12, 112) : ch + 88;
  const stageH = vh - 50 - trayH;
  const pw = landscape ? Math.min(190, vw * 0.3, (vh - 50 - 46) / 1.4) : Math.min(200, vw * 0.46, (stageH - 40) / 1.4);
  return { slots, cw, ch, mini, trayH, pw: Math.round(pw) };
}

function previewHint(run: RunState, index: number, playable: boolean, targetUid: number | null): string {
  const def = getCard(run.combat!.hand[index].id);
  if (!playable) return "Not enough energy";
  const living = run.combat!.enemies.filter((enemy) => enemy.hp > 0);
  if (def.target === "enemy" && living.length > 1) {
    return living.some((enemy) => enemy.uid === targetUid) ? "Tap to fire at the marked target, or tap another" : "Tap a target to fire";
  }
  return "Tap the card again to play";
}

const HUD_ALT: Record<number, number> = { 1: 6400, 2: 14200, 3: 38600 };

/** A light head-up display drawn over the chase view: gun cross, pitch ladder, speed and altitude. */
function camHud(run: RunState): string {
  const turn = run.combat!.turn;
  const alt = HUD_ALT[run.act] + ((turn * 370) % 900) - 450;
  const mach = (0.82 + ((turn * 7) % 9) / 100).toFixed(2);
  return `<div class="cam-hud" aria-hidden="true">
      <i class="hud-cross"></i>
      <i class="hud-ladder"></i>
      <span class="hud-tape spd"><small>M</small>${mach}</span>
      <span class="hud-tape alt"><small>ALT</small>${alt.toLocaleString("en-US").replace(",", " ")}</span>
    </div>`;
}

function battle(app: AppState): string {
  const frozen = !!app.frozen;
  const run = app.frozen ?? app.run!;
  const combat = run.combat!;
  const living = combat.enemies.filter((enemy) => enemy.hp > 0);
  const shape = camShape();
  const bosses = combat.enemies.map((enemy) => enemy.boss !== "");
  const closeSpots = foeSpots(bosses, shape, "close");
  const wideSpots = foeSpots(bosses, shape, "wide");
  const tracked = trackedUid(run, app);
  const foes = combat.enemies.map((enemy, index) => foeHtml(run, enemy, index, app, closeSpots[index], wideSpots[index], enemy.uid === tracked)).join("");
  const layout = handLayout(combat.hand.length);
  const hand = frozen
    ? ""
    : combat.hand
        .map((inst, index) => {
          const def = getCard(inst.id);
          const cost = cardCost(run, def);
          const playable = combat.outcome === "fight" && combat.energy >= cost;
          const slot = layout.slots[index];
          return `<div class="slot ${app.armed === index ? "armed" : ""}" data-slot="${index}" data-uid="${inst.uid}" style="--x:${slot.x.toFixed(1)}px;--y:${slot.y.toFixed(1)}px;--r:${slot.r.toFixed(2)}deg;--z:${index + 1}">
            ${cardFace(def, {
              cost,
              tag: "button",
              cls: playable ? "playable" : "unplayable",
              attrs: `data-act="play" data-arg="${index}" data-card="${esc(inst.id)}" data-target="${def.target}" data-key="${index + 1}"`,
            })}
          </div>`;
        })
        .join("");
  let incoming = 0;
  if (!frozen) {
    try {
      incoming = forecastLoss(run);
    } catch {
      incoming = 0;
    }
  }
  const jet = JETS[run.jet];
  const powers = combat.powers
    .map((id) => `<span class="power" title="${esc(`${getCard(id).name}: ${getCard(id).text}`)}">${icon("energy")}${esc(getCard(id).name)}</span>`)
    .join("");
  const orbMax = Math.max(combat.maxEnergy, 1);
  const anyPlayable = !frozen && combat.hand.some((inst) => combat.energy >= cardCost(run, getCard(inst.id)));
  const needsTarget = app.armed !== null && combat.hand[app.armed] && getCard(combat.hand[app.armed].id).target === "enemy" && living.length > 1;
  let preview = "";
  if (!frozen && layout.pw && app.armed !== null && combat.hand[app.armed]) {
    const def = getCard(combat.hand[app.armed].id);
    const cost = cardCost(run, def);
    const playable = combat.outcome === "fight" && combat.energy >= cost;
    preview = `<div class="card-preview" style="--pw:${layout.pw}px">
      ${cardFace(def, { cost, tag: "button", cls: playable ? "playable" : "unplayable", attrs: `data-act="preview-play" data-arg="${app.armed}"` })}
      <p class="preview-hint">${previewHint(run, app.armed, playable, app.targetUid)}</p>
    </div>`;
  }
  const vars = `--cw:${layout.cw}px;--ch:${layout.ch}px${layout.trayH ? `;--tray-h:${layout.trayH}px` : ""}`;
  return `
    <section class="battle n${combat.enemies.length} cam-${app.cam} ${frozen ? "frozen" : ""} ${needsTarget ? "aiming" : ""}" style="${vars}">
      <div class="stage">
        ${camHud(run)}
        <div class="contact-tag"><span>${esc(combat.encounterName)}</span><b>Turn ${combat.turn}</b></div>
        <div class="foes">${foes}</div>
        <div class="ally" data-who="-1" style="${spotVars("c", allySpot(shape, "close"))};${spotVars("w", allySpot(shape, "wide"))}">
          <div class="unit-art" style="${swayStyle()}">${chaseArt(jet.silhouette, "rear", { cls: "player", spent: spentStations(PLAYER) })}</div>
        </div>
        <div class="pilot">
          <div class="nameplate"><b>${esc(jet.callsign)}</b><small>${esc(jet.code)} ${esc(jet.name)}</small></div>
          ${hpBar(-1, run.hp, run.maxHp, combat.player.shield, "player")}
          ${statusRow(combat.player.status)}
          ${powers ? `<div class="power-row">${powers}</div>` : ""}
        </div>
        <div class="threat-tag">Bandits inbound</div>
      </div>
      <div class="tray">
        <div class="tray-left">
          <div class="energy-orb ${combat.energy === 0 ? "empty" : ""}" title="Energy">
            <div class="orb-ring"></div><div class="orb-core"></div><div class="orb-swirl"></div>
            <span class="orb-num">${combat.energy}<small>/${orbMax}</small></span>
          </div>
          <button class="pile pile-draw" data-act="deck-draw" title="Draw pile">${icon("deck")}<i>${combat.draw.length}</i></button>
        </div>
        <div class="hand ${layout.mini ? "mini" : ""}">${hand || (frozen ? "" : `<p class="empty-hand">No cards in hand.</p>`)}</div>
        <div class="tray-right">
          <button class="end-turn ${anyPlayable ? "" : "ready"}" data-act="end-turn" ${frozen ? "disabled" : ""}>
            <span>End turn</span>
            <small class="${incoming > 0 ? "warn" : ""}">${incoming > 0 ? `Incoming ${incoming}` : "Clean exchange"}</small>
          </button>
          <div class="pile-row">
            <button class="pile pile-discard" data-act="deck-discard" title="Discard pile">${icon("discard")}<i>${combat.discard.length + combat.played.length}</i></button>
            <button class="pile pile-exhaust" data-act="deck-exhaust" title="Exhausted">${icon("exhaust")}<i>${combat.exhaustPile.length}</i></button>
          </div>
        </div>
      </div>
      <button class="log-toggle ${app.showLog ? "on" : ""}" data-act="toggle-log" title="Combat log">${icon("log")}</button>
      ${app.showLog ? `<div class="log-panel" aria-live="polite">${combat.log.slice(-14).map((line) => `<p>${esc(line)}</p>`).join("")}</div>` : ""}
      ${needsTarget && !preview ? `<div class="aim-hint">Choose a target</div>` : ""}
      ${preview}
    </section>
  `;
}

/* ---------------------------------------------------------------- reward */

function reward(app: AppState): string {
  const run = app.run!;
  const state = run.reward!;
  const relic = state.relic ? getRelic(state.relic) : null;
  const cards = (state.cards ?? [])
    .map((id) =>
      cardFace(getCard(id), {
        tag: "button",
        cls: `pick ${state.cardTaken ? "spent" : ""} ${app.pickArm === `take-card:${id}` ? "pick-armed" : ""}`,
        attrs: `data-act="take-card" data-arg="${esc(id)}" data-hint="Tap again to take" ${state.cardTaken ? "disabled" : ""}`,
      }),
    )
    .join("");
  const rows: string[] = [];
  if (state.purse) rows.push(`<div class="loot done">${icon("coin")}<span>${state.purse} gold stowed</span><em>Collected</em></div>`);
  if (relic) {
    rows.push(`<button class="loot relic-${relic.kind} ${state.relicTaken ? "done" : ""}" data-act="take-relic" ${state.relicTaken ? "disabled" : ""}>
      <span class="relic-medal">${relicIcon(relic.id)}</span><span><b>${esc(relic.name)}</b><small>${esc(relic.text)}</small></span><em>${state.relicTaken ? "Installed" : "Install"}</em></button>`);
  }
  if (state.heal) {
    rows.push(`<button class="loot ${state.healTaken ? "done" : ""}" data-act="take-heal" ${state.healTaken ? "disabled" : ""}>
      ${icon("heart")}<span><b>Field repairs</b><small>Restore ${state.heal} HP</small></span><em>${state.healTaken ? "Repaired" : "Accept"}</em></button>`);
  }
  const boss = state.next === "intermission" || state.next === "victory";
  return `
    <section class="reward-screen">
      <div class="panel ornate reward-panel">
        <div class="ribbon ${boss ? "gold" : ""}"><span>${boss ? "Corridor boss down" : state.purse ? "Splash one" : "A find on the plot"}</span></div>
        ${state.note ? `<p class="reward-note">${esc(state.note)}</p>` : ""}
        <div class="loot-list">${rows.join("")}</div>
        ${
          cards
            ? `<p class="pick-head">${state.cardTaken ? "Card added to the deck" : "Add one card to your deck"}</p><div class="pick-row">${cards}</div>`
            : ""
        }
        <div class="btn-row center">
          ${btn(state.next === "victory" ? "Finish debrief" : state.next === "map" ? (cards && !state.cardTaken ? "Skip and return to the chart" : "Return to the chart") : "Continue", "ack-reward", { cls: "primary big" })}
        </div>
      </div>
    </section>
  `;
}

/* ------------------------------------------------------------------ shop */

function shop(app: AppState): string {
  const run = app.run!;
  const state = run.shop!;
  const cards = state.cards
    .map((offer, index) => {
      const def = getCard(offer.id);
      const poor = run.gold < offer.price;
      return `
        <div class="ware ${offer.sold ? "sold" : ""}">
          ${cardFace(def, { tag: "button", cls: `buy ${app.pickArm === `buy-card:${index}` ? "pick-armed" : ""}`, attrs: `data-act="buy-card" data-arg="${index}" data-hint="Tap again to buy" ${offer.sold || poor ? "disabled" : ""}` })}
          <span class="price ${poor && !offer.sold ? "poor" : ""}">${offer.sold ? "Sold" : `${icon("coin")}${offer.price}`}</span>
        </div>`;
    })
    .join("");
  const relics = state.relics
    .map((offer, index) => {
      const def = getRelic(offer.id);
      const poor = run.gold < offer.price;
      return `
        <button class="shelf-item relic-${def.kind} ${offer.sold ? "sold" : ""}" data-act="buy-relic" data-arg="${index}" ${offer.sold || poor ? "disabled" : ""}>
          <span class="relic-medal">${relicIcon(def.id)}</span>
          <span class="shelf-copy"><b>${esc(def.name)}</b><small>${esc(def.text)}</small></span>
          <span class="price ${poor && !offer.sold ? "poor" : ""}">${offer.sold ? "Installed" : `${icon("coin")}${offer.price}`}</span>
        </button>`;
    })
    .join("");
  const healDisabled = state.healSold || run.hp >= run.maxHp || run.gold < state.healPrice;
  const removeCost = removalCost(run);
  return `
    <section class="shop-screen">
      <div class="shop-sign"><span>Field Depot</span><small>Quartermaster's table · ${icon("coin")} ${run.gold} on hand</small></div>
      <div class="shop-table">${cards}</div>
      <div class="shop-lower">
        <div class="shelf panel">${relics || `<p class="fine">No new packages on the shelf.</p>`}</div>
        <div class="services">
          <button class="service" data-act="buy-heal" ${healDisabled ? "disabled" : ""}>
            ${icon("heart")}<span><b>${state.healSold ? "Repaired" : `Repair +${state.healAmount} HP`}</b><small>${run.hp >= run.maxHp ? "Airframe is whole" : "Patch the airframe"}</small></span>
            <span class="price ${run.gold < state.healPrice ? "poor" : ""}">${icon("coin")}${state.healPrice}</span>
          </button>
          <button class="service" data-act="open-remove">
            ${icon("discard")}<span><b>Remove a card</b><small>Lighten the deck</small></span>
            <span class="price ${run.gold < removeCost ? "poor" : ""}">${icon("coin")}${removeCost}</span>
          </button>
        </div>
      </div>
      <div class="btn-row center">${btn("Back to the chart", "leave-shop", { cls: "big" })}</div>
    </section>
  `;
}

/* ---------------------------------------------------------------- events */

function storyScreen(opts: { art: string; kicker: string; title: string; story: string; body: string }): string {
  return `
    <section class="event-screen">
      <div class="panel ornate event-card">
        <div class="event-art"><img src="${opts.art}" alt="" decoding="async" /></div>
        <div class="event-body">
          <p class="eyebrow">${esc(opts.kicker)}</p>
          <h1>${esc(opts.title)}</h1>
          <p class="story">${esc(opts.story)}</p>
          ${opts.body}
        </div>
      </div>
    </section>
  `;
}

function eventScreen(app: AppState): string {
  const run = app.run!;
  const view = run.event!;
  const event = getEvent(view.id);
  if (view.done) {
    return storyScreen({
      art: eventArt(view.id),
      kicker: "Mystery",
      title: event.title,
      story: view.result,
      body: `<div class="btn-row">${btn("Back to the chart", "event-continue", { cls: "primary big" })}</div>`,
    });
  }
  const choices = event.choices
    .map((choice) => {
      const gate = choiceAvailable(run, choice);
      return `<button class="choice" data-act="event" data-arg="${esc(choice.id)}" ${gate.ok ? "" : "disabled"}><b>${esc(choice.label)}</b><span>${esc(gate.ok ? choice.detail : gate.reason)}</span></button>`;
    })
    .join("");
  return storyScreen({ art: eventArt(view.id), kicker: "Mystery", title: event.title, story: event.body, body: `<div class="choices">${choices}</div>` });
}

function gamble(app: AppState): string {
  const view = app.run!.gamble!;
  if (view.done) {
    return storyScreen({
      art: eventArt("gamble"),
      kicker: "Yard toss",
      title: "The tag comes up",
      story: view.result,
      body: `<div class="btn-row">${btn("Back to the chart", "leave-gamble", { cls: "primary big" })}</div>`,
    });
  }
  return storyScreen({
    art: eventArt("gamble"),
    kicker: "Yard toss",
    title: "Pull a maintenance tag",
    story:
      "The yard chief flips a sealed tag onto the crate. Take it and you install whatever is inside: a working package, or a cursed one. Walk away and they press 15 gold into your glove.",
    body: `<div class="choices">
      <button class="choice" data-act="gamble" data-arg="take"><b>Pull the tag</b><span>A useful relic, or a cursed one.</span></button>
      <button class="choice" data-act="gamble" data-arg="walk"><b>Walk away</b><span>Stow 15 gold.</span></button>
    </div>`,
  });
}

function removal(app: AppState): string {
  const run = app.run!;
  const view = run.remove!;
  const cards = run.deck
    .map((card) => cardFace(getCard(card.id), { tag: "button", cls: "pick small", attrs: `data-act="remove-card" data-arg="${card.uid}"` }))
    .join("");
  return `
    <section class="deck-screen">
      <div class="panel ornate deck-panel">
        <div class="ribbon"><span>${view.price ? `Remove a card · ${view.price} gold` : "Free removal"}</span></div>
        <p class="pick-head">Pick the card to pull from the deck.</p>
        <div class="card-grid">${cards}</div>
        <div class="btn-row center">${btn("Cancel", "cancel-remove", { cls: "ghost" })}</div>
      </div>
    </section>
  `;
}

function intermission(app: AppState): string {
  return storyScreen({
    art: eventArt("intermission"),
    kicker: "Corridor clear",
    title: "The next airspace is already painting you",
    story: "You get one hardstand choice before the new chart. HP will not tick up on its own.",
    body: `<div class="choices">
      <button class="choice" data-act="intermission" data-arg="heal"><b>Field repair</b><span>Heal ${repairOf(app.run!, 0.4)} HP (40% of max HP${app.run!.difficulty ? `, ${difficultyName(app.run!.difficulty)}` : ""}).</span></button>
      <button class="choice" data-act="intermission" data-arg="relic"><b>Depot crate</b><span>Install a random useful relic.</span></button>
      <button class="choice" data-act="intermission" data-arg="card"><b>Munitions</b><span>Choose 1 of 3 cards.</span></button>
    </div>`,
  });
}

function ending(app: AppState): string {
  const run = app.run!;
  const won = run.screen === "victory";
  const jet = JETS[run.jet];
  return `
    <section class="ending-screen ${won ? "win" : "loss"}">
      <div class="panel ornate end-panel">
        <div class="ribbon ${won ? "gold" : "red"}"><span>${won ? "Corridor held" : "Sortie over"}</span></div>
        <h1>${won ? "You held the corridor." : esc(run.defeatReason || "Airframe lost.")}</h1>
        <div class="end-art ${won ? "" : "lost"}">${jetArt(jet.silhouette)}</div>
        <p class="end-line">${esc(jet.callsign)} · Act ${run.act} · ${icon("heart")} ${run.hp}/${run.maxHp} · ${icon("coin")} ${run.gold}</p>
        <p class="fine">${esc(difficultyName(run.difficulty ?? NORMAL))} · Fights ${run.tally.battles} · Elites ${run.tally.elites} · Bosses ${run.tally.bosses} · Seed ${run.seed}</p>
        <div class="end-relics">${run.relics.map((id) => `<span class="relic relic-${getRelic(id).kind}" title="${esc(getRelic(id).name)}">${relicIcon(id)}</span>`).join("")}</div>
        ${run.notices.map((note) => `<p class="notice static">${esc(note)}</p>`).join("")}
        <div class="btn-row center">
          ${btn(won ? "Hangar" : "Title", "finish", { cls: "primary big" })}
          ${btn("Records", "records")}
        </div>
      </div>
    </section>
  `;
}

/* ---------------------------------------------------------------- modals */

const TYPE_ORDER: Record<string, number> = { attack: 0, maneuver: 1, system: 2, burden: 3 };

function deckModal(app: AppState): string {
  const run = app.run!;
  const tab = app.deckTab;
  let ids: string[] = [];
  let title = "Loadout";
  if (!run.combat || tab === "loadout") ids = run.deck.map((card) => card.id);
  else if (tab === "draw") {
    ids = run.combat.draw.map((card) => card.id);
    title = "Draw pile";
  } else if (tab === "discard") {
    ids = [...run.combat.played, ...run.combat.discard].map((card) => card.id);
    title = "Discard pile";
  } else {
    ids = run.combat.exhaustPile.map((card) => card.id);
    title = "Exhausted";
  }
  const sorted = [...ids].sort((a, b) => {
    const da = getCard(a);
    const db = getCard(b);
    return TYPE_ORDER[da.type] - TYPE_ORDER[db.type] || da.cost - db.cost || da.name.localeCompare(db.name);
  });
  const tabs = run.combat
    ? `<div class="tabs">${(["loadout", "draw", "discard", "exhaust"] as const)
        .map((key) => `<button class="tab ${tab === key ? "on" : ""}" data-act="tab" data-arg="${key}">${key === "loadout" ? "Loadout" : key === "draw" ? "Draw" : key === "discard" ? "Discard" : "Exhaust"}</button>`)
        .join("")}</div>`
    : "";
  return `
    <div class="modal" data-act="close-modal">
      <div class="modal-card panel ornate deck-modal" data-act="stop">
        <div class="modal-head"><h2>${title} <small>${sorted.length} cards</small></h2>${btn("Close", "close-modal", { cls: "ghost" })}</div>
        ${tabs}
        <div class="card-grid">${sorted.map((id) => cardFace(getCard(id), { cls: "small" })).join("") || `<p class="fine">Empty.</p>`}</div>
      </div>
    </div>`;
}

function slider(key: "music" | "sfx", label: string, value: number): string {
  const pct = Math.round(value * 100);
  return `<label class="slider"><span>${label}</span><input type="range" min="0" max="100" step="5" value="${pct}" data-vol="${key}" aria-label="${label} volume" /><b data-vol-label="${key}">${pct}%</b></label>`;
}

function settingsModal(app: AppState): string {
  const meta = app.meta;
  const inRun = app.view === "run" && !!app.run && !app.run.closed;
  return `
    <div class="modal" data-act="close-modal">
      <div class="modal-card panel ornate settings-modal" data-act="stop">
        <div class="modal-head"><h2>Settings</h2>${btn("Close", "close-modal", { cls: "ghost" })}</div>
        <div class="settings-body">
          ${slider("music", "Music", meta.musicVol)}
          ${slider("sfx", "Effects", meta.sfxVol)}
          <button class="toggle ${meta.mute ? "on" : ""}" data-act="mute" aria-pressed="${meta.mute}">
            ${icon(meta.mute ? "soundOff" : "soundOn")}<span>Mute all sound</span><i>${meta.mute ? "On" : "Off"}</i>
          </button>
          <p class="fine">Every sound and song is synthesized live in the browser. Press M to mute.</p>
        </div>
        <div class="btn-row center">
          ${btn("How to fly", "how", { cls: "ghost" })}
          ${inRun ? btn("Save and step out", "save-quit", { cls: "danger" }) : ""}
        </div>
      </div>
    </div>`;
}

function confirmModal(title: string, body: string, yes: string, act: string): string {
  return `
    <div class="modal">
      <div class="modal-card panel ornate confirm">
        <h2>${esc(title)}</h2>
        <p>${esc(body)}</p>
        <div class="btn-row center">
          ${btn(esc(yes), act, { cls: "danger" })}
          ${btn("Cancel", "close-modal", { cls: "ghost" })}
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ root */

function runScreen(app: AppState): string {
  const run = app.run!;
  let body = "";
  if (app.frozen?.combat) body = battle(app);
  else if (run.screen === "map") body = mapScreen(app);
  else if (run.screen === "combat" && run.combat) body = battle(app);
  else if (run.screen === "reward" && run.reward) body = reward(app);
  else if (run.screen === "shop" && run.shop) body = shop(app);
  else if (run.screen === "event" && run.event) body = eventScreen(app);
  else if (run.screen === "gamble" && run.gamble) body = gamble(app);
  else if (run.screen === "remove" && run.remove) body = removal(app);
  else if (run.screen === "intermission") body = intermission(app);
  else if (run.screen === "victory" || run.screen === "defeat") body = ending(app);
  else body = mapScreen(app);
  return `${hud(app)}<div class="screen-body">${body}</div>`;
}

export function screenName(app: AppState): string {
  if (app.view === "run" && app.run) return app.frozen ? "combat" : app.run.screen;
  return app.view;
}

export function renderApp(app: AppState): string {
  let screen = "";
  if (app.view === "title") screen = titleScreen(app);
  else if (app.view === "hangar") screen = hangar(app);
  else if (app.view === "records") screen = records(app);
  else if (app.view === "how") screen = how(app);
  else if (app.run) screen = runScreen(app);
  else screen = titleScreen(app);
  const toast = app.toast ? `<div class="toast ${app.toastKind}">${esc(app.toast)}</div>` : "";
  let modal = "";
  if (app.modal === "deck" && app.run) modal = deckModal(app);
  else if (app.modal === "settings") modal = settingsModal(app);
  else if (app.modal === "abort") modal = confirmModal("Save and step out?", "The sortie stays in this browser.", "To title", "quit-confirm");
  else if (app.modal === "confirm-new") {
    modal = confirmModal("Scrap the current sortie?", "The airframe in progress will be marked as a loss.", "Scrap and launch", "launch-confirm");
  }
  return `<div class="shell" data-screen="${esc(screenName(app))}">${toast}${screen}${modal}</div>`;
}
