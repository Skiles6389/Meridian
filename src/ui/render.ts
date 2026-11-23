import { ACTS } from "../game/acts";
import { getCard } from "../game/cards";
import { cardCost, enemyPlan, forecastLoss } from "../game/combat";
import { getEvent } from "../game/events";
import { STATUS_BY_ID } from "../game/glossary";
import { HELP } from "../game/help";
import { JETS, JET_ORDER, unlockBlurb } from "../game/jets";
import { nodeById } from "../game/map";
import { getRelic } from "../game/relics";
import { choiceAvailable, reachable, removalCost } from "../game/run";
import { jetSvg } from "../game/silhouettes";
import type { CardInst, MapNode, NodeType, RunState, Status } from "../game/types";
import type { AppState } from "./model";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function chip(id: string, value: number): string {
  const info = STATUS_BY_ID[id];
  if (!info || value <= 0) return "";
  return `<span class="chip" title="${esc(info.text)}">${esc(info.name)} ${value}</span>`;
}

function statusRow(status: Status, shield = 0): string {
  const html = [
    shield > 0 ? `<span class="chip shield" title="${esc(STATUS_BY_ID.shield.text)}">Shield ${shield}</span>` : "",
    chip("evasion", status.evasion),
    chip("locked", status.locked),
    chip("jam", status.jam),
    chip("burn", status.burn),
    chip("thrust", status.thrust),
    chip("armor", status.armor),
    chip("suppress", status.suppress),
    chip("static", status.static),
  ].join("");
  return html ? `<div class="chips">${html}</div>` : "";
}

function hud(app: AppState): string {
  const run = app.run;
  if (!run) return "";
  const act = ACTS[run.act];
  const jet = JETS[run.jet];
  const pct = Math.max(0, Math.min(100, (run.hp / run.maxHp) * 100));
  const relic = app.relicId ? getRelic(app.relicId) : null;
  return `
    <header class="hud">
      <button class="brand-mini" data-act="how" title="How to fly">MERIDIAN</button>
      <div class="hud-act">
        <span>Act ${run.act}</span>
        <strong>${esc(act.name)}</strong>
      </div>
      <div class="hp" title="${esc(jet.callsign)}">
        <div class="hp-fill" style="width:${pct}%"></div>
        <span>${run.hp}/${run.maxHp}</span>
      </div>
      <div class="gold">◈ ${run.gold}</div>
      <button class="icon-btn" data-act="deck" title="Deck">Deck ${run.deck.length}</button>
      <button class="icon-btn" data-act="mute">${app.meta.mute ? "Audio off" : "Audio on"}</button>
      <button class="icon-btn" data-act="save-quit">Save</button>
    </header>
    <div class="relic-row">
      ${run.relics
        .map((id) => {
          const def = getRelic(id);
          return `<button class="relic ${def.kind}" data-act="relic" data-arg="${esc(id)}">${esc(def.name)}</button>`;
        })
        .join("")}
    </div>
    ${
      relic
        ? `<div class="relic-pop"><strong>${esc(relic.name)}</strong><p>${esc(relic.text)}</p></div>`
        : ""
    }
    ${run.notices[0] ? `<button class="notice" data-act="notice">${esc(run.notices[0])}</button>` : ""}
  `;
}

function titleScreen(app: AppState): string {
  const jet = jetSvg("kite", "#3ee0c5");
  return `
    <section class="title-screen">
      <div class="sky" aria-hidden="true">
        <div class="radar"></div>
        <div class="flyer">${jet}</div>
      </div>
      <div class="title-copy">
        <p class="eyebrow">Provisional wing · sortie deck</p>
        <h1>MERIDIAN</h1>
        <p class="tag">Hold the corridor.</p>
        <div class="btn-col">
          ${app.run ? `<button class="btn primary" data-act="continue">Continue sortie</button>` : ""}
          <button class="btn ${app.run ? "" : "primary"}" data-act="hangar">New sortie</button>
          <button class="btn" data-act="records">Records</button>
          <button class="btn" data-act="how">How to fly</button>
          <button class="btn ghost" data-act="mute">${app.meta.mute ? "Audio off" : "Audio on"}</button>
        </div>
        <p class="fine">Three fictional corridors. One airframe. No historical markings.</p>
      </div>
    </section>
  `;
}

function hangar(app: AppState): string {
  const cards = JET_ORDER.map((id) => {
    const jet = JETS[id];
    const unlocked = app.meta.unlocked[id];
    const selected = app.jetPick === id;
    return `
      <button class="jet-card ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-act="pick-jet" data-arg="${id}" ${unlocked ? "" : "disabled"}>
        <div class="jet-art">${jetSvg(jet.silhouette, jet.accent)}</div>
        <div class="jet-copy">
          <p class="eyebrow">${esc(jet.code)} · ${esc(jet.role)}</p>
          <h2>${esc(jet.name)}</h2>
          <p>${esc(jet.blurb)}</p>
          <p class="fine">${esc(jet.play)}</p>
          <p class="fine">HP ${jet.hp} · ${esc(getRelic(jet.relic).name)}</p>
          ${unlocked ? "" : `<p class="lock-note">${esc(unlockBlurb(id, app.meta.stats.mysteries))}</p>`}
        </div>
      </button>
    `;
  }).join("");
  const picked = JETS[app.jetPick];
  const deck = summarize(picked.deck);
  return `
    <section class="hangar">
      <div class="section-head">
        <div>
          <p class="eyebrow">Hangar</p>
          <h1>Choose an airframe</h1>
        </div>
        <button class="btn ghost" data-act="title">Back</button>
      </div>
      <div class="jet-grid">${cards}</div>
      <div class="launch-bar">
        <div>
          <strong>${esc(picked.callsign)}</strong>
          <p class="fine">Starting deck: ${esc(deck)}</p>
          <label class="seed">Seed <input data-act="seed" value="${esc(app.seedInput)}" inputmode="numeric" placeholder="random" /></label>
        </div>
        <button class="btn primary" data-act="launch" ${app.meta.unlocked[app.jetPick] ? "" : "disabled"}>Launch</button>
      </div>
    </section>
  `;
}

function summarize(ids: string[]): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].map(([id, count]) => `${count}× ${getCard(id).name}`).join(", ");
}

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
    <section class="records">
      <div class="section-head">
        <div>
          <p class="eyebrow">Debrief locker</p>
          <h1>Records</h1>
        </div>
        <button class="btn ghost" data-act="back">Back</button>
      </div>
      <div class="stat-grid">
        ${rows.map(([label, value]) => `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}
      </div>
      <ul class="unlock-list">
        ${JET_ORDER.map((id) => {
          const jet = JETS[id];
          const on = app.meta.unlocked[id];
          return `<li class="${on ? "on" : ""}"><strong>${esc(jet.code)} ${esc(jet.name)}</strong><span>${on ? "Unlocked" : esc(unlockBlurb(id, stats.mysteries))}</span></li>`;
        }).join("")}
      </ul>
    </section>
  `;
}

function how(app: AppState): string {
  const page = HELP[app.howPage] ?? HELP[0];
  return `
    <section class="how">
      <div class="section-head">
        <div>
          <p class="eyebrow">Briefing ${app.howPage + 1} / ${HELP.length}</p>
          <h1>${esc(page.title)}</h1>
        </div>
        <button class="btn ghost" data-act="back">Close</button>
      </div>
      <div class="how-body">
        ${page.lines.map((line) => `<p>${esc(line)}</p>`).join("")}
      </div>
      <div class="btn-row">
        <button class="btn" data-act="how-prev" ${app.howPage === 0 ? "disabled" : ""}>Back</button>
        <button class="btn primary" data-act="how-next">${app.howPage === HELP.length - 1 ? "Done" : "Next"}</button>
      </div>
    </section>
  `;
}

const NODE_NAME: Record<NodeType, string> = {
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

function mapScreen(app: AppState): string {
  const run = app.run!;
  const width = 760;
  const rowGap = 108;
  const height = 48 + (run.map.rows - 1) * rowGap + 48;
  const pos = (node: MapNode) => ({
    x: ((node.col + 0.5) / 7) * width,
    y: 36 + (run.map.rows - 1 - node.row) * rowGap,
  });
  const open = new Set(reachable(run).map((node) => node.id));
  const route = new Set(run.route);
  const lines: string[] = [];
  for (let i = 0; i < run.route.length - 1; i++) {
    const from = nodeById(run.map, run.route[i]);
    const to = nodeById(run.map, run.route[i + 1]);
    if (!from || !to) continue;
    const a = pos(from);
    const b = pos(to);
    lines.push(`<line class="route-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`);
  }
  const faint: string[] = [];
  for (const node of run.map.nodes) {
    const a = pos(node);
    const routeIndex = run.route.indexOf(node.id);
    for (const id of node.edges) {
      const next = nodeById(run.map, id);
      if (!next) continue;
      const b = pos(next);
      const taken = routeIndex >= 0 && run.route[routeIndex + 1] === id;
      if (taken) continue;
      faint.push(`<line class="map-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`);
    }
  }
  lines.unshift(...faint);
  const circles = run.map.nodes
    .map((node) => {
      const p = pos(node);
      const flags = [
        node.type,
        open.has(node.id) ? "reachable" : "",
        node.id === run.nodeId ? "current" : "",
        route.has(node.id) && node.id !== run.nodeId ? "past" : "",
        node.id === app.selectedNode ? "picked" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <g class="map-node ${flags}" data-act="select-node" data-arg="${esc(node.id)}" transform="translate(${p.x} ${p.y})">
          <circle class="face" r="22" />
          <circle class="hit" r="36" />
          <text class="node-label" y="46">${esc(NODE_NAME[node.type])}</text>
        </g>
      `;
    })
    .join("");
  const selected = app.selectedNode ? nodeById(run.map, app.selectedNode) : null;
  const canFly = selected ? open.has(selected.id) : false;
  return `
    <section class="map-screen">
      <p class="act-blurb">${esc(ACTS[run.act].blurb)} Seed ${run.seed}.</p>
      <div class="map-scroll">
        <svg class="map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Corridor map">
          ${lines.join("")}
          ${circles}
        </svg>
      </div>
      <div class="node-panel">
        ${
          selected
            ? `<div><p class="eyebrow">${esc(NODE_NAME[selected.type])}</p><h2>${esc(nodeBlurb(selected))}</h2></div>
               <button class="btn primary" data-act="fly" data-arg="${esc(selected.id)}" ${canFly ? "" : "disabled"}>${canFly ? "Fly" : "Not on this route"}</button>`
            : `<div><p class="eyebrow">Route</p><h2>${run.nodeId ? "Pick a connected plot." : "The whole corridor is on the scope. Pick a first plot."}</h2></div>`
        }
      </div>
    </section>
  `;
}

function intentHtml(plan: ReturnType<typeof enemyPlan>): string {
  if (plan.kind === "down") return `<div class="intent down"><span>Next</span><strong>${esc(plan.title)}</strong></div>`;
  let figure = "—";
  if (plan.damage > 0 && plan.hits > 1 && !plan.uneven) figure = `${plan.hits}×${plan.perHit}`;
  else if (plan.damage > 0) figure = String(plan.damage);
  else if (plan.shield > 0) figure = `+${plan.shield}`;
  const extra = [
    plan.damage > 0 && plan.shield > 0 ? `Shield +${plan.shield}` : "",
    ...plan.tags,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <div class="intent ${plan.kind}">
      <span>Next · ${esc(plan.title)}</span>
      <strong>${esc(figure)}</strong>
      ${extra ? `<em>${esc(extra)}</em>` : ""}
    </div>
  `;
}

function battle(app: AppState): string {
  const run = app.run!;
  const combat = run.combat!;
  const foes = combat.enemies
    .map((enemy) => {
          const plan = enemyPlan(run, enemy);
      const pct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
      const selected = app.targetUid === enemy.uid;
      return `
        <button class="foe ${selected ? "selected" : ""} ${enemy.hp <= 0 ? "down" : ""}" data-act="target" data-arg="${enemy.uid}">
          <div class="foe-art">${jetSvg(enemy.silhouette, enemy.accent, true)}</div>
          <div class="foe-copy">
            <p class="eyebrow">${esc(enemy.epithet)}</p>
            <h2>${esc(enemy.name)}</h2>
            <div class="hp enemy-hp"><div class="hp-fill" style="width:${pct}%"></div><span>${Math.max(0, enemy.hp)}/${enemy.maxHp}</span></div>
            ${statusRow(enemy.status, enemy.shield)}
            ${enemy.hp > 0 ? intentHtml(plan) : `<div class="intent down"><strong>Down</strong></div>`}
          </div>
        </button>
      `;
    })
    .join("");
  const hand = combat.hand
    .map((card, index) => cardHtml(run, card, index))
    .join("");
  let incoming = 0;
  try {
    incoming = forecastLoss(run);
  } catch {
    incoming = 0;
  }
  const log = combat.log.slice(-6);
  const powers = combat.powers
    .map((id) => `<span class="chip" title="${esc(getCard(id).text)}">${esc(getCard(id).name)}</span>`)
    .join("");
  return `
    <section class="battle">
      <p class="eyebrow contact">${esc(combat.encounterName)} · Turn ${combat.turn}</p>
      <div class="foe-row">${foes}</div>
      <div class="pilot-row">
        <div class="pilot-art">${jetSvg(JETS[run.jet].silhouette, JETS[run.jet].accent)}</div>
        <div>
          <strong>${esc(JETS[run.jet].callsign)}</strong>
          ${statusRow(combat.player.status, combat.player.shield)}
          ${powers ? `<div class="chips">${powers}</div>` : ""}
        </div>
      </div>
      <div class="log" aria-live="polite">${log.map((line) => `<p>${esc(line)}</p>`).join("")}</div>
      <div class="resource-row">
        <div class="energy" title="Energy">${Array.from({ length: Math.max(combat.maxEnergy, combat.energy) }, (_, i) => `<i class="${i < combat.energy ? "on" : ""}"></i>`).join("")}</div>
        <button class="icon-btn" data-act="deck">Draw ${combat.draw.length}</button>
        <button class="icon-btn" data-act="deck-discard">Discard ${combat.discard.length + combat.played.length}</button>
        <button class="icon-btn" data-act="deck-exhaust">Exhaust ${combat.exhaustPile.length}</button>
      </div>
      <div class="hand-wrap">
        <div class="hand">${hand || `<p class="empty-hand">No cards in hand.</p>`}</div>
        <button class="btn end-turn" data-act="end-turn">End turn<span>${incoming > 0 ? `You would take ${incoming}` : "Clean exchange"}</span></button>
      </div>
    </section>
  `;
}

function cardHtml(run: RunState, inst: CardInst, index: number | null): string {
  const def = getCard(inst.id);
  const combat = run.combat;
  const cost = combat ? cardCost(run, def) : def.cost;
  const playable = !!combat && combat.outcome === "fight" && combat.energy >= cost && index !== null;
  const cut = cost < def.cost;
  const attrs = index === null ? "" : `data-act="play" data-arg="${index}"`;
  return `
    <button class="card ${def.type} ${playable ? "playable" : "dim"}" ${attrs}>
      <div class="card-top">
        <span>${esc(def.type === "burden" ? "clog" : def.type)}</span>
        <b class="cost ${cut ? "cut" : ""}">${cost}</b>
      </div>
      <h3>${esc(def.name)}</h3>
      <p>${esc(def.text)}</p>
      <small>${esc(def.rarity)}</small>
    </button>
  `;
}

function reward(app: AppState): string {
  return rewardClean(app.run!);
}

function rewardClean(run: RunState): string {
  const rewardState = run.reward!;
  const relic = rewardState.relic ? getRelic(rewardState.relic) : null;
  const cards = (rewardState.cards ?? [])
    .map((id) => {
      const def = getCard(id);
      return `
        <button class="card ${def.type}" data-act="take-card" data-arg="${esc(id)}" ${rewardState.cardTaken ? "disabled" : ""}>
          <div class="card-top"><span>${esc(def.type)}</span><b class="cost">${def.cost}</b></div>
          <h3>${esc(def.name)}</h3>
          <p>${esc(def.text)}</p>
          <small>${rewardState.cardTaken ? "passed" : "take this"}</small>
        </button>
      `;
    })
    .join("");
  return `
    <section class="reward">
      <p class="eyebrow">After-action</p>
      <h1>${rewardState.purse ? `Purse +${rewardState.purse} gold, already stowed.` : "A find on the plot."}</h1>
      ${rewardState.note ? `<p class="fine">${esc(rewardState.note)}</p>` : ""}
      ${cards ? `<div class="hand">${cards}</div>` : ""}
      <div class="btn-col">
        ${
          relic
            ? `<button class="btn" data-act="take-relic" ${rewardState.relicTaken ? "disabled" : ""}>${rewardState.relicTaken ? "Installed" : "Install"} ${esc(relic.name)}</button>
               <p class="fine">${esc(relic.text)}</p>`
            : ""
        }
        ${
          rewardState.heal
            ? `<button class="btn" data-act="take-heal" ${rewardState.healTaken ? "disabled" : ""}>${rewardState.healTaken ? "Repaired" : `Accept repairs +${rewardState.heal} HP`}</button>`
            : ""
        }
        <button class="btn primary" data-act="ack-reward">${rewardState.next === "victory" ? "Finish debrief" : rewardState.next === "intermission" || rewardState.next === "advance" ? "Continue" : "Return to the corridor"}</button>
      </div>
    </section>
  `;
}

function shop(app: AppState): string {
  const run = app.run!;
  const shopState = run.shop!;
  const cards = shopState.cards
    .map((offer, index) => {
      const def = getCard(offer.id);
      return `
        <button class="card ${def.type}" data-act="buy-card" data-arg="${index}" ${offer.sold || run.gold < offer.price ? "disabled" : ""}>
          <div class="card-top"><span>${offer.sold ? "sold" : `${offer.price} gold`}</span><b class="cost">${def.cost}</b></div>
          <h3>${esc(def.name)}</h3>
          <p>${esc(def.text)}</p>
        </button>
      `;
    })
    .join("");
  const relics = shopState.relics
    .map((offer, index) => {
      const def = getRelic(offer.id);
      return `
        <button class="shop-relic" data-act="buy-relic" data-arg="${index}" ${offer.sold || run.gold < offer.price ? "disabled" : ""}>
          <strong>${esc(def.name)}</strong>
          <span>${offer.sold ? "Installed" : `${offer.price} gold`}</span>
          <p>${esc(def.text)}</p>
        </button>
      `;
    })
    .join("");
  return `
    <section class="shop">
      <div class="section-head">
        <div>
          <p class="eyebrow">Field depot</p>
          <h1>Buy, repair, or lighten the jet</h1>
        </div>
        <button class="btn ghost" data-act="leave-shop">Leave</button>
      </div>
      <div class="hand">${cards}</div>
      <div class="relic-shop">${relics || `<p class="fine">No new packages on the shelf.</p>`}</div>
      <div class="btn-row">
        <button class="btn" data-act="buy-heal" ${shopState.healSold || run.hp >= run.maxHp || run.gold < shopState.healPrice ? "disabled" : ""}>
          Repair +${shopState.healAmount} · ${shopState.healPrice} gold
        </button>
        <button class="btn" data-act="open-remove">Remove a card · ${removalCost(run)} gold</button>
      </div>
    </section>
  `;
}

function eventScreen(app: AppState): string {
  const run = app.run!;
  const view = run.event!;
  const event = getEvent(view.id);
  if (view.done) {
    return `
      <section class="event">
        <p class="eyebrow">Mystery</p>
        <h1>${esc(event.title)}</h1>
        <p class="story">${esc(view.result)}</p>
        <button class="btn primary" data-act="event-continue">Back to the corridor</button>
      </section>
    `;
  }
  const choices = event.choices
    .map((choice) => {
      const gate = choiceAvailable(run, choice);
      return `
        <button class="choice" data-act="event" data-arg="${esc(choice.id)}" ${gate.ok ? "" : "disabled"}>
          <strong>${esc(choice.label)}</strong>
          <span>${esc(gate.ok ? choice.detail : gate.reason)}</span>
        </button>
      `;
    })
    .join("");
  return `
    <section class="event">
      <p class="eyebrow">Mystery</p>
      <h1>${esc(event.title)}</h1>
      <p class="story">${esc(event.body)}</p>
      <div class="choice-list">${choices}</div>
    </section>
  `;
}

function gamble(app: AppState): string {
  const view = app.run!.gamble!;
  if (view.done) {
    return `
      <section class="event">
        <p class="eyebrow">Yard toss</p>
        <h1>The tag comes up</h1>
        <p class="story">${esc(view.result)}</p>
        <button class="btn primary" data-act="leave-gamble">Back to the corridor</button>
      </section>
    `;
  }
  return `
    <section class="event">
      <p class="eyebrow">Yard toss</p>
      <h1>Pull a maintenance tag</h1>
      <p class="story">The yard chief flips a sealed tag onto the crate. Take it and you install whatever is inside: a working package, or a cursed one. Walk away and they press 15 gold into your glove.</p>
      <div class="btn-row">
        <button class="btn primary" data-act="gamble" data-arg="take">Pull the tag</button>
        <button class="btn" data-act="gamble" data-arg="walk">Walk · +15 gold</button>
      </div>
    </section>
  `;
}

function removal(app: AppState): string {
  const run = app.run!;
  const view = run.remove!;
  const cards = run.deck
    .map((card) => {
      const def = getCard(card.id);
      return `<button class="mini-card" data-act="remove-card" data-arg="${card.uid}"><strong>${esc(def.name)}</strong><span>${esc(def.type)} · ${def.cost}</span></button>`;
    })
    .join("");
  return `
    <section class="event">
      <p class="eyebrow">${view.price ? `Removal · ${view.price} gold` : "Free removal"}</p>
      <h1>Pull one card</h1>
      <div class="mini-list">${cards}</div>
      <button class="btn ghost" data-act="cancel-remove">Cancel</button>
    </section>
  `;
}

function intermission(): string {
  return `
    <section class="event">
      <p class="eyebrow">Corridor clear</p>
      <h1>The next airspace is already painting you</h1>
      <p class="story">You get one hardstand choice before the new map. HP will not tick up on its own.</p>
      <div class="choice-list">
        <button class="choice" data-act="intermission" data-arg="heal"><strong>Field repair</strong><span>Heal 40% of max HP.</span></button>
        <button class="choice" data-act="intermission" data-arg="relic"><strong>Depot crate</strong><span>Install a random useful relic.</span></button>
        <button class="choice" data-act="intermission" data-arg="card"><strong>Munitions</strong><span>Choose 1 of 3 cards.</span></button>
      </div>
    </section>
  `;
}

function ending(app: AppState): string {
  const run = app.run!;
  const won = run.screen === "victory";
  const jet = JETS[run.jet];
  return `
    <section class="endcard ${won ? "win" : "loss"}">
      <p class="eyebrow">${won ? "Corridor held" : "Sortie over"}</p>
      <h1>${won ? "You held Meridian." : esc(run.defeatReason || "Airframe lost.")}</h1>
      <div class="end-art">${jetSvg(jet.silhouette, jet.accent)}</div>
      <p>${esc(jet.callsign)} · Act ${run.act} · HP ${run.hp}/${run.maxHp} · ◈ ${run.gold}</p>
      <p class="fine">Fights ${run.tally.battles} · Elites ${run.tally.elites} · Bosses ${run.tally.bosses} · Seed ${run.seed}</p>
      <div class="relic-row static">
        ${run.relics.map((id) => `<span class="relic ${getRelic(id).kind}">${esc(getRelic(id).name)}</span>`).join("")}
      </div>
      ${run.notices.map((note) => `<p class="notice static">${esc(note)}</p>`).join("")}
      <div class="btn-row">
        <button class="btn primary" data-act="finish">${won ? "Hangar" : "Title"}</button>
        <button class="btn" data-act="records">Records</button>
      </div>
    </section>
  `;
}

function deckModal(app: AppState): string {
  const run = app.run!;
  const tab = app.deckTab;
  let rows: { name: string; detail: string }[] = [];
  if (!run.combat || tab === "loadout") {
    rows = run.deck.map((card) => {
      const def = getCard(card.id);
      return { name: def.name, detail: `${def.type} · ${def.cost} · ${def.text}` };
    });
  } else if (tab === "draw") {
    rows = run.combat.draw.map((card) => ({ name: getCard(card.id).name, detail: "Draw pile" }));
  } else if (tab === "discard") {
    rows = [...run.combat.played, ...run.combat.discard].map((card) => ({ name: getCard(card.id).name, detail: "Discard" }));
  } else {
    rows = run.combat.exhaustPile.map((card) => ({ name: getCard(card.id).name, detail: "Exhausted" }));
  }
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  const unique = [...counts.entries()].map(([name, count]) => {
    const detail = rows.find((row) => row.name === name)?.detail ?? "";
    return `<li><strong>${count}× ${esc(name)}</strong><span>${esc(detail)}</span></li>`;
  });
  return `
    <div class="modal" data-act="close-modal">
      <div class="modal-card" data-act="stop">
        <div class="section-head">
          <h2>${run.combat ? "Piles" : "Loadout"}</h2>
          <button class="btn ghost" data-act="close-modal">Close</button>
        </div>
        ${
          run.combat
            ? `<div class="btn-row">
                <button class="btn ${tab === "loadout" ? "primary" : ""}" data-act="tab" data-arg="loadout">Loadout</button>
                <button class="btn ${tab === "draw" ? "primary" : ""}" data-act="tab" data-arg="draw">Draw</button>
                <button class="btn ${tab === "discard" ? "primary" : ""}" data-act="tab" data-arg="discard">Discard</button>
                <button class="btn ${tab === "exhaust" ? "primary" : ""}" data-act="tab" data-arg="exhaust">Exhaust</button>
              </div>`
            : ""
        }
        <ul class="pile-list">${unique.join("") || "<li>Empty.</li>"}</ul>
      </div>
    </div>
  `;
}

function confirmModal(title: string, body: string, yes: string, act: string): string {
  return `
    <div class="modal">
      <div class="modal-card">
        <h2>${esc(title)}</h2>
        <p>${esc(body)}</p>
        <div class="btn-row">
          <button class="btn danger" data-act="${act}">${esc(yes)}</button>
          <button class="btn ghost" data-act="close-modal">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function runScreen(app: AppState): string {
  const run = app.run!;
  let body = "";
  if (run.screen === "map") body = mapScreen(app);
  else if (run.screen === "combat" && run.combat) body = battle(app);
  else if (run.screen === "reward" && run.reward) body = reward(app);
  else if (run.screen === "shop" && run.shop) body = shop(app);
  else if (run.screen === "event" && run.event) body = eventScreen(app);
  else if (run.screen === "gamble" && run.gamble) body = gamble(app);
  else if (run.screen === "remove" && run.remove) body = removal(app);
  else if (run.screen === "intermission") body = intermission();
  else if (run.screen === "victory" || run.screen === "defeat") body = ending(app);
  else body = mapScreen(app);
  return `${hud(app)}<div class="screen-body">${body}</div>`;
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
  else if (app.modal === "abort") modal = confirmModal("Save and step out?", "The sortie stays in this browser.", "To title", "quit-confirm");
  else if (app.modal === "confirm-new") {
    modal = confirmModal("Scrap the current sortie?", "The airframe in progress will be marked as a loss.", "Scrap and launch", "launch-confirm");
  }
  const screenName = app.view === "run" && app.run ? app.run.screen : app.view;
  return `<div class="shell ${app.shake ? "shake" : ""}" data-screen="${esc(screenName)}">${toast}${screen}${modal}</div>`;
}
