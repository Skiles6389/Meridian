import { getCard } from "../../src/game/cards";
import { cardCost, forecastLoss, livingEnemies, performEndTurn, performPlayCard, scratchCopy } from "../../src/game/combat";
import { getEvent } from "../../src/game/events";
import { nodeById } from "../../src/game/map";
import { getRelic } from "../../src/game/relics";
import {
  buyShopCard,
  buyShopHeal,
  buyShopRelic,
  choiceAvailable,
  endTurn,
  openRemoval,
  playCard,
  reachable,
  removalCost,
  removeCard,
} from "../../src/game/run";
import type { Fighter, MapNode, Meta, RunState } from "../../src/game/types";
import { cardRating, cardRole, RELIC_VALUE } from "./values";

export interface Bot {
  name: "greedy" | "smart";
  /** Plays the current fight to the end, or until the turn guard trips. */
  fight(run: RunState, meta: Meta): void;
  chooseNode(run: RunState): MapNode;
  /** Which offered card to add, or null to skip. */
  draftPick(run: RunState, offered: string[]): string | null;
  shop(run: RunState, meta: Meta): void;
  eventChoice(run: RunState): string;
  gamble(run: RunState): boolean;
  intermission(run: RunState): "heal" | "relic" | "card";
  /** Card uid to strip from the deck, or null to keep everything. */
  removeTarget(run: RunState): number | null;
}

export const TURN_GUARD = 40;

const curses = (run: RunState) => run.relics.filter((id) => getRelic(id).kind === "curse").length;
const pct = (run: RunState) => run.hp / run.maxHp;

/* ------------------------------------------------------------------ fights */

interface Action {
  index: number;
  target: number | null;
}

function actions(state: RunState): Action[] {
  const combat = state.combat!;
  const living = livingEnemies(state);
  const seen = new Set<string>();
  const out: Action[] = [];
  combat.hand.forEach((inst, index) => {
    const def = getCard(inst.id);
    if (cardCost(state, def) > combat.energy) return;
    const targets = def.target === "enemy" ? living.map((enemy) => enemy.uid) : [null];
    for (const target of targets) {
      const key = `${inst.id}:${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ index, target });
    }
  });
  return out;
}

function threat(enemy: Fighter): number {
  const moves = enemy.phases.length ? enemy.phases[Math.min(enemy.phase, enemy.phases.length) - 1] : enemy.moves;
  if (!moves.length) return 0;
  return moves.reduce((sum, move) => sum + (move.damage + enemy.status.thrust + enemy.bonusDamage) * move.hits, 0) / moves.length;
}

const POWER_WORTH: Record<string, number> = {
  hotStart: 9,
  countermeasures: 5,
  trimAuthority: 6,
  siegeRadar: 4,
  anvilProtocol: 8,
  patience: 4,
  ghostDoctrine: 7,
  lowObservable: 6,
  predictiveTrack: 3,
  ecmWing: 8,
};

export interface Weights {
  hp: number;
  enemyHp: number;
  kill: number;
}

const WIN = 1e5;
const LOSS = -1e6;

/** Scores a mid-turn state by ending the turn in a sandbox and looking at the board that comes back. */
function evaluate(state: RunState, w: Weights, bonus: number): number {
  const combat = state.combat!;
  if (combat.outcome === "won") return WIN + state.hp * 20;
  if (state.hp <= 0 || combat.outcome === "lost") return LOSS;
  const next = scratchCopy(state);
  performEndTurn(next);
  const after = next.combat!;
  if (after.outcome === "won") return WIN + next.hp * 20;
  let score = 0;
  if (next.hp <= 0 || after.outcome === "lost") score += LOSS / 2;
  else score += w.hp * next.hp;
  const urgency = 1 + Math.max(0, after.turn - 6) * 0.2;
  for (const enemy of after.enemies) {
    if (enemy.hp <= 0) {
      score += w.kill + threat(enemy) * 1.5;
      continue;
    }
    score -= urgency * (w.enemyHp * enemy.hp + 0.5 * enemy.shield);
    score += enemy.status.locked * 2.5 + (enemy.status.burn * (enemy.status.burn + 1)) / 2;
  }
  const status = after.player.status;
  score += status.evasion * 3 + status.thrust * 4 + status.armor * 4 - status.burn * 2;
  for (const power of after.powers) score += POWER_WORTH[power] ?? 3;
  return score + bonus;
}

interface Node {
  state: RunState;
  seq: Action[];
  score: number;
  open: boolean;
}

/**
 * Beam search over one turn's plays. A play that draws cards ends the line, scored with a
 * flat bonus per card drawn, so the bot never plans around cards it has not seen yet.
 */
function planTurn(run: RunState, w: Weights, beam: number): Action[] {
  const root = scratchCopy(run);
  let best: Node = { state: root, seq: [], score: evaluate(root, w, 0), open: true };
  let frontier: Node[] = [best];
  for (let depth = 0; depth < 14 && frontier.length; depth++) {
    const children: Node[] = [];
    for (const node of frontier) {
      if (!node.open) continue;
      for (const action of actions(node.state)) {
        const state = scratchCopy(node.state);
        const before = state.combat!.hand.length;
        if (!performPlayCard(state, action.index, action.target).ok) continue;
        const combat = state.combat!;
        const drawn = combat.hand.length - (before - 1);
        const bonus = drawn > 0 ? drawn * (combat.energy > 0 ? 4.5 : 1.5) : 0;
        const open = drawn <= 0 && combat.outcome === "fight" && state.hp > 0;
        children.push({ state, seq: [...node.seq, action], score: evaluate(state, w, bonus), open });
      }
    }
    if (!children.length) break;
    children.sort((a, b) => b.score - a.score);
    if (children[0].score > best.score) best = children[0];
    frontier = children.filter((child) => child.open).slice(0, beam);
  }
  return best.seq;
}

function enemyShield(run: RunState): number {
  return run.combat?.enemies.reduce((sum, enemy) => sum + (enemy.hp > 0 ? enemy.shield : 0), 0) ?? 0;
}

function enemyHp(run: RunState): number {
  return run.combat?.enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0) ?? 0;
}

/** One play at a time: the single card that looks best right now. */
function greedyFight(run: RunState, meta: Meta) {
  let plays = 0;
  while (run.screen === "combat" && run.combat?.outcome === "fight" && run.combat.turn <= TURN_GUARD && plays++ < 600) {
    const passIncoming = forecastLoss(run);
    let best = { score: -passIncoming * 3, action: null as Action | null };
    for (const action of actions(run)) {
      const clone = scratchCopy(run);
      const beforeEnemies = enemyHp(clone);
      const beforeHp = clone.hp;
      if (!performPlayCard(clone, action.index, action.target).ok || !clone.combat) continue;
      const dealt = beforeEnemies - enemyHp(clone);
      const stripped = enemyShield(run) - enemyShield(clone);
      const lost = beforeHp - clone.hp;
      const incoming = clone.combat.outcome === "fight" ? forecastLoss(clone) : 0;
      const urgency = 1 + Math.max(0, run.combat.turn - 8) * 0.25;
      let score = (dealt * 2 + Math.max(0, stripped)) * urgency + (passIncoming - incoming) * 2.4 - lost * 8;
      if (passIncoming >= beforeHp && incoming < clone.hp) score += 120;
      if (clone.combat.outcome === "won") score += 500;
      if (clone.hp <= 0) score = -99999;
      if (score > best.score) best = { score, action };
    }
    if (!best.action) endTurn(run, meta);
    else playCard(run, meta, best.action.index, best.action.target);
  }
}

function smartFight(run: RunState, meta: Meta, w: Weights, beam: number) {
  let plans = 0;
  while (run.screen === "combat" && run.combat?.outcome === "fight" && run.combat.turn <= TURN_GUARD && plans++ < 400) {
    const plan = planTurn(run, w, beam);
    if (!plan.length) {
      endTurn(run, meta);
      continue;
    }
    for (const action of plan) {
      const before = run.combat!.hand.length;
      playCard(run, meta, action.index, action.target);
      if (run.screen !== "combat" || !run.combat || run.combat.outcome !== "fight") break;
      if (run.combat.hand.length > before - 1) break;
    }
  }
}

/* ------------------------------------------------------------- run choices */

function worstCard(run: RunState): number | null {
  if (run.deck.length <= 5) return null;
  const burden = run.deck.find((card) => getCard(card.id).type === "burden");
  if (burden) return burden.uid;
  const ranked = [...run.deck].sort((a, b) => cardRating(a.id) - cardRating(b.id));
  const worst = ranked[0];
  return worst && cardRating(worst.id) < 0 ? worst.uid : null;
}

function deckNeeds(run: RunState) {
  let damage = 0;
  let defense = 0;
  for (const card of run.deck) {
    const role = cardRole(card.id);
    if (role === "damage") damage += 1;
    else if (role === "defense") defense += 1;
  }
  return { damage, defense, size: run.deck.length };
}

/** Rating of a card for this particular deck, or -Infinity if it should not be added. */
function fitScore(run: RunState, id: string): number {
  const def = getCard(id);
  let score = cardRating(id);
  const needs = deckNeeds(run);
  const role = cardRole(id);
  if (role === "damage" && needs.damage < needs.size * 0.4) score += 2.5;
  if (role === "defense" && needs.defense < needs.size * 0.3) score += 2;
  const sameCount = run.deck.filter((card) => card.id === id).length;
  if (def.effects.some((effect) => effect.k === "power")) score -= sameCount * 6;
  else score -= sameCount * 0.8;
  if (def.cost >= 3) score -= 2;
  return score;
}

function smartPick(run: RunState, offered: string[]): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const id of offered) {
    const score = fitScore(run, id);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  const bar = 0.5 + Math.max(0, run.deck.length - 14) * 0.35;
  return bestScore >= bar ? best : null;
}

function greedyPick(_run: RunState, offered: string[]): string | null {
  return [...offered].sort((a, b) => getCard(b).cost - getCard(a).cost || cardRating(b) - cardRating(a))[0] ?? null;
}

const EXPECTED_HIT: Record<number, { battle: number; elite: number; boss: number }> = {
  1: { battle: 9, elite: 18, boss: 28 },
  2: { battle: 13, elite: 24, boss: 34 },
  3: { battle: 16, elite: 28, boss: 40 },
};

/** Scores every path to the boss with a crude HP and gold projection and steps onto the best one. */
function smartNode(run: RunState): MapNode {
  const options = reachable(run);
  if (options.length === 1) return options[0];
  const hits = EXPECTED_HIT[run.act];
  const walk = (node: MapNode, hp: number, gold: number): number => {
    let value = 0;
    let nextHp = hp;
    let nextGold = gold;
    const frac = hp / run.maxHp;
    if (node.type === "battle") {
      nextHp -= hits.battle;
      nextGold += 22 + run.act * 4;
      value += 10;
    } else if (node.type === "elite") {
      nextHp -= hits.elite;
      nextGold += 50;
      value += frac > 0.7 ? 20 : frac > 0.5 ? 4 : -25;
    } else if (node.type === "shop") {
      const healed = gold >= 48 ? Math.min(run.maxHp - hp, Math.ceil(run.maxHp * 0.3)) : 0;
      nextHp += healed;
      value += (gold >= 90 ? 12 : gold >= 50 ? 6 : 1) + healed * 0.5;
      nextGold = Math.max(0, gold - 90);
    } else if (node.type === "mystery") {
      nextHp += frac < 0.6 ? 8 : 0;
      value += 8;
    } else if (node.type === "gamble") {
      value += frac > 0.6 ? 4 : 1;
      nextGold += 10;
    } else if (node.type === "boss") {
      const margin = nextHp - hits.boss;
      value += margin < 0 ? margin * 3 : Math.min(margin, 20);
    }
    if (nextHp <= run.maxHp * 0.2) value -= 30;
    nextHp = Math.min(run.maxHp, nextHp);
    let tail = 0;
    let first = true;
    for (const id of node.edges) {
      const next = nodeById(run.map, id);
      if (!next) continue;
      const score = walk(next, nextHp, nextGold);
      if (first || score > tail) tail = score;
      first = false;
    }
    return value + tail;
  };
  let best = options[0];
  let bestScore = -Infinity;
  for (const option of options) {
    const score = walk(option, run.hp, run.gold);
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }
  return best;
}

function greedyNode(run: RunState): MapNode {
  const options = reachable(run);
  const find = (type: MapNode["type"]) => options.find((node) => node.type === type);
  if (pct(run) < 0.72 && find("shop")) return find("shop")!;
  if (pct(run) < 0.5 && find("mystery")) return find("mystery")!;
  if (pct(run) > 0.88 && run.act > 1 && find("elite")) return find("elite")!;
  return find("battle") ?? find("shop") ?? find("mystery") ?? find("gamble") ?? find("boss") ?? find("elite") ?? options[0];
}

function eventPreference(run: RunState, smart: boolean): string[] {
  const id = run.event!.id;
  const hp = pct(run);
  const low = hp < 0.5;
  switch (id) {
    case "pallet":
      return low && smart ? ["leave", "open"] : ["open", "strip"];
    case "mayday":
      return hp > (smart ? 0.7 : 0.85) ? ["escort", "dark"] : smart && hp > 0.5 ? ["share", "dark"] : ["dark"];
    case "hardstand":
      return hp < 0.75 ? ["repair", "patch"] : ["refit", "patch"];
    case "crate":
      return run.gold >= 45 ? ["pay45", "walk"] : ["walk"];
    case "shear":
      return hp > 0.7 ? ["punch", "divert"] : ["divert"];
    case "controller":
      return smart && worstCard(run) !== null && run.deck.length > 13 ? ["tape", "picture"] : ["picture", "signoff"];
    case "linegang":
      return run.gold >= 35 && (hp < 0.9 || !smart) ? ["pay", "bleed"] : hp > 0.5 ? ["bleed", "pay"] : ["pay", "jury", "bleed"];
    case "channel":
      return hp > 0.6 && curses(run) < (smart ? 1 : 2) ? ["accept", "decline"] : ["decline"];
    case "bingo":
      return smart && run.gold >= 30 && hp > 0.5 ? ["bet", "tower"] : ["tower"];
    case "wingman":
      if (smart && hp > 0.8) return ["rescue", "scavenge"];
      return run.relics.includes("memorialTag") ? ["scavenge"] : ["memorial", "scavenge"];
    default:
      return [];
  }
}

function firstAvailable(run: RunState, order: string[]): string {
  const event = getEvent(run.event!.id);
  for (const id of [...order, ...event.choices.map((choice) => choice.id)]) {
    const choice = event.choices.find((candidate) => candidate.id === id);
    if (choice && choiceAvailable(run, choice).ok) return id;
  }
  return event.choices[event.choices.length - 1].id;
}

function greedyShop(run: RunState, meta: Meta) {
  const shop = run.shop!;
  if (run.hp < run.maxHp * 0.62 && run.gold >= shop.healPrice) buyShopHeal(run);
  const relic = shop.relics.findIndex((offer) => !offer.sold && run.gold >= offer.price + 30);
  if (relic >= 0) buyShopRelic(run, meta, relic);
  const ranked = shop.cards
    .map((offer, index) => ({ offer, index, rarity: getCard(offer.id).rarity }))
    .filter((row) => !row.offer.sold && run.gold >= row.offer.price + 15)
    .sort((a, b) => (a.rarity === b.rarity ? 0 : a.rarity === "rare" ? -1 : 1));
  if (ranked[0]) buyShopCard(run, ranked[0].index);
}

function smartShop(run: RunState, meta: Meta) {
  const shop = run.shop!;
  const bossNext = reachable(run).some((node) => node.type === "boss");
  const heal = () => {
    if (!shop.healSold && run.gold >= shop.healPrice && run.hp < run.maxHp - shop.healAmount * 0.6) buyShopHeal(run);
  };
  if (pct(run) < (bossNext ? 0.75 : 0.55)) heal();
  const relics = shop.relics
    .map((offer, index) => ({ offer, index, value: RELIC_VALUE[offer.id] ?? 2 }))
    .filter((row) => !row.offer.sold && row.value >= 4)
    .sort((a, b) => b.value - a.value);
  for (const row of relics) if (run.gold >= row.offer.price) buyShopRelic(run, meta, row.index);
  const cards = shop.cards
    .map((offer, index) => ({ offer, index, score: fitScore(run, offer.id) }))
    .filter((row) => !row.offer.sold && row.score >= 2)
    .sort((a, b) => b.score - a.score);
  for (const row of cards) if (run.gold >= row.offer.price) buyShopCard(run, row.index);
  const target = worstCard(run);
  if (target !== null && run.gold >= removalCost(run) && openRemoval(run).ok) removeCard(run, meta, target);
  if (pct(run) < 0.8) heal();
}

export function makeBot(kind: "greedy" | "smart", w: Weights = { hp: 1.6, enemyHp: 1, kill: 10 }, beam = 5): Bot {
  const smart = kind === "smart";
  return {
    name: kind,
    fight: (run, meta) => (smart ? smartFight(run, meta, w, beam) : greedyFight(run, meta)),
    chooseNode: (run) => (smart ? smartNode(run) : greedyNode(run)),
    draftPick: (run, offered) => (smart ? smartPick(run, offered) : greedyPick(run, offered)),
    shop: (run, meta) => (smart ? smartShop(run, meta) : greedyShop(run, meta)),
    eventChoice: (run) => firstAvailable(run, eventPreference(run, smart)),
    gamble: (run) => (smart ? pct(run) > 0.55 && curses(run) === 0 : pct(run) > 0.62 && curses(run) < 2),
    intermission: (run) => (pct(run) < (smart ? 0.6 : 0.82) ? "heal" : "relic"),
    removeTarget: (run) => worstCard(run),
  };
}
