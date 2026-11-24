import { PLAYER, setCombatFxSink } from "../../src/game/combat";
import { getEncounter } from "../../src/game/enemies";
import { nodeById } from "../../src/game/map";
import { freshMeta } from "../../src/game/meta";
import { getRelic } from "../../src/game/relics";
import {
  ackReward,
  cancelRemoval,
  chooseEvent,
  chooseGamble,
  chooseIntermission,
  continueEvent,
  createRun,
  enterNode,
  leaveGamble,
  leaveShop,
  removeCard,
  takeRewardCard,
  takeRewardHeal,
  takeRewardRelic,
} from "../../src/game/run";
import type { JetId, RunScreen, RunState } from "../../src/game/types";
import { RNG } from "../../src/game/rng";
import type { Bot } from "./bots";

export interface FightRecord {
  act: number;
  kind: "battle" | "elite" | "boss";
  enc: string;
  /** Fights finished before this one, for survival baselines. */
  index: number;
  hpBefore: number;
  hpAfter: number;
  maxHp: number;
  turns: number;
  died: boolean;
  side: boolean;
}

export interface PickRecord {
  act: number;
  index: number;
  source: "reward" | "shop" | "event";
  offered: string[];
  taken: string | null;
  random: boolean;
}

export interface RelicRecord {
  id: string;
  act: number;
  index: number;
  source: "reward" | "shop" | "gamble" | "event" | "intermission";
}

export interface DecisionRecord {
  kind: "gamble" | "intermission" | "event";
  id: string;
  choice: string;
  act: number;
  index: number;
  random: boolean;
  hpDelta: number;
  goldDelta: number;
  result: string;
}

export interface Ledger {
  earned: number;
  spentCards: number;
  spentRelics: number;
  spentHeal: number;
  spentRemoval: number;
  spentEvents: number;
}

export interface HealLedger {
  reward: number;
  shop: number;
  event: number;
  intermission: number;
  combat: number;
  afterFight: number;
}

export interface RunRecord {
  jet: JetId;
  bot: string;
  seed: number;
  win: boolean;
  /** Act the run ended in. */
  act: number;
  death: { act: number; where: string; kind: string } | null;
  fights: FightRecord[];
  picks: PickRecord[];
  relics: RelicRecord[];
  decisions: DecisionRecord[];
  gold: Ledger;
  goldByAct: number[];
  heals: HealLedger;
  healsByAct: number[];
  removals: number;
  shops: { act: number; gold: number; spent: number; hp: number; maxHp: number }[];
  finalDeck: string[];
  finalRelics: string[];
  finalHp: number;
  maxHp: number;
  stalled: boolean;
}

export interface SimOptions {
  /** Chance that a draft, gamble, or intermission choice is made at random, to measure what choices are worth. */
  explore?: number;
}

const screenOf = (run: RunState): RunScreen => run.screen;

export function simulateRun(jet: JetId, seed: number, bot: Bot, options: SimOptions = {}): RunRecord {
  const meta = freshMeta();
  meta.unlocked = { kite: true, bulwark: true, moth: true, lattice: true };
  const run = createRun(jet, seed, meta);
  const coin = new RNG((seed * 2654435761) >>> 0 || 7);
  const explore = options.explore ?? 0;
  const rec: RunRecord = {
    jet,
    bot: bot.name,
    seed,
    win: false,
    act: 1,
    death: null,
    fights: [],
    picks: [],
    relics: [],
    decisions: [],
    gold: { earned: 0, spentCards: 0, spentRelics: 0, spentHeal: 0, spentRemoval: 0, spentEvents: 0 },
    goldByAct: [0, 0, 0],
    heals: { reward: 0, shop: 0, event: 0, intermission: 0, combat: 0, afterFight: 0 },
    healsByAct: [0, 0, 0],
    removals: 0,
    shops: [],
    finalDeck: [],
    finalRelics: [],
    finalHp: 0,
    maxHp: run.maxHp,
    stalled: false,
  };
  let combatHeal = 0;
  let turns = 0;
  setCombatFxSink((event) => {
    if (event.t === "heal" && event.who === PLAYER) combatHeal += event.amount;
    else if (event.t === "turn") turns = event.n;
  });
  const healed = (key: keyof HealLedger, amount: number) => {
    if (amount <= 0) return;
    rec.heals[key] += amount;
    rec.healsByAct[run.act - 1] += amount;
  };
  const noteRelics = (before: string[], source: RelicRecord["source"]) => {
    for (const id of run.relics) if (!before.includes(id)) rec.relics.push({ id, act: run.act, index: rec.fights.length, source });
  };
  let lastEarned = 0;
  const syncGold = () => {
    const delta = run.tally.goldEarned - lastEarned;
    rec.goldByAct[run.act - 1] += delta;
    lastEarned = run.tally.goldEarned;
  };

  const fight = (side: boolean) => {
    const combat = run.combat!;
    const enc = getEncounter(combat.encounterId);
    const hpBefore = run.hp;
    combatHeal = 0;
    turns = run.combat?.turn ?? 0;
    const record: FightRecord = {
      act: run.act,
      kind: combat.rewardMode,
      enc: enc.id,
      index: rec.fights.length,
      hpBefore,
      hpAfter: 0,
      maxHp: run.maxHp,
      turns: 0,
      died: false,
      side,
    };
    bot.fight(run, meta);
    record.turns = turns;
    if (run.screen === "combat") {
      rec.stalled = true;
      run.hp = 0;
      run.screen = "defeat";
      run.closed = true;
    }
    record.died = run.screen === "defeat";
    healed("combat", combatHeal);
    rec.fights.push(record);
    if (record.died) {
      record.hpAfter = 0;
      rec.death = { act: run.act, where: enc.id, kind: record.kind };
    }
    return record;
  };

  let guard = 0;
  let pendingFight: FightRecord | null = null;
  let hpAtCombatEnd = 0;
  while (!run.closed && guard++ < 400) {
    syncGold();
    if (run.screen === "map") {
      const node = bot.chooseNode(run);
      enterNode(run, meta, node.id);
      if (screenOf(run) === "combat") {
        pendingFight = fight(false);
        hpAtCombatEnd = run.hp;
      }
    } else if (run.screen === "combat") {
      pendingFight = fight(true);
      hpAtCombatEnd = run.hp;
    } else if (run.screen === "reward" && run.reward) {
      const reward = run.reward;
      if (pendingFight) {
        pendingFight.hpAfter = hpAtCombatEnd;
        healed("afterFight", run.hp - hpAtCombatEnd);
        pendingFight = null;
      }
      if (reward.relic && !reward.relicTaken) {
        const before = [...run.relics];
        takeRewardRelic(run, meta);
        noteRelics(before, "reward");
      }
      if (reward.heal && !reward.healTaken) {
        const before = run.hp;
        takeRewardHeal(run);
        healed(reward.next === "advance" ? "intermission" : "reward", run.hp - before);
      }
      if (reward.cards && !reward.cardTaken) {
        const random = coin.next() < explore;
        const taken = random ? coin.pick(reward.cards) : bot.draftPick(run, reward.cards);
        rec.picks.push({ act: run.act, index: rec.fights.length, source: reward.purse === 0 && reward.next === "map" ? "event" : "reward", offered: [...reward.cards], taken, random });
        if (taken) takeRewardCard(run, taken);
      }
      ackReward(run, meta);
    } else if (run.screen === "shop" && run.shop) {
      const shop = run.shop;
      const gold = run.gold;
      const hp = run.hp;
      const relics = [...run.relics];
      const removals = run.removals;
      bot.shop(run, meta);
      if (screenOf(run) === "remove") cancelRemoval(run);
      const cardSpend = shop.cards.filter((offer) => offer.sold).reduce((sum, offer) => sum + offer.price, 0);
      const relicSpend = shop.relics.filter((offer) => offer.sold).reduce((sum, offer) => sum + offer.price, 0);
      const healSpend = shop.healSold ? shop.healPrice : 0;
      rec.gold.spentCards += cardSpend;
      rec.gold.spentRelics += relicSpend;
      rec.gold.spentHeal += healSpend;
      rec.gold.spentRemoval += Math.max(0, gold - run.gold - cardSpend - relicSpend - healSpend);
      rec.removals += run.removals - removals;
      rec.shops.push({ act: run.act, gold, spent: gold - run.gold, hp, maxHp: run.maxHp });
      healed("shop", run.hp - hp);
      noteRelics(relics, "shop");
      const bought = shop.cards.filter((offer) => offer.sold).map((offer) => offer.id);
      rec.picks.push({ act: run.act, index: rec.fights.length, source: "shop", offered: shop.cards.map((offer) => offer.id), taken: bought[0] ?? null, random: false });
      leaveShop(run);
    } else if (run.screen === "event" && run.event) {
      if (run.event.done) {
        continueEvent(run);
        continue;
      }
      const id = run.event.id;
      const hp = run.hp;
      const gold = run.gold;
      const earned = run.tally.goldEarned;
      const relics = [...run.relics];
      const choice = bot.eventChoice(run);
      chooseEvent(run, meta, choice);
      const goldDelta = run.gold - gold;
      rec.gold.spentEvents += Math.max(0, gold + (run.tally.goldEarned - earned) - run.gold);
      noteRelics(relics, "event");
      if (screenOf(run) !== "combat") healed("event", run.hp - hp);
      rec.decisions.push({ kind: "event", id, choice, act: run.act, index: rec.fights.length, random: false, hpDelta: run.hp - hp, goldDelta, result: "" });
      if (run.screen === "event" && run.closed) break;
    } else if (run.screen === "gamble" && run.gamble) {
      if (run.gamble.done) {
        leaveGamble(run);
        continue;
      }
      const random = coin.next() < explore;
      const take = random ? coin.chance(0.5) : bot.gamble(run);
      const relics = [...run.relics];
      const hp = run.hp;
      const gold = run.gold;
      chooseGamble(run, meta, take);
      noteRelics(relics, "gamble");
      const got = run.relics.find((relic) => !relics.includes(relic)) ?? "";
      rec.decisions.push({
        kind: "gamble",
        id: "gamble",
        choice: take ? "take" : "leave",
        act: run.act,
        index: rec.fights.length,
        random,
        hpDelta: run.hp - hp,
        goldDelta: run.gold - gold,
        result: got ? `${getRelic(got).kind}:${got}` : take ? "empty" : "gold",
      });
    } else if (run.screen === "remove" && run.remove) {
      const target = bot.removeTarget(run);
      if (target !== null && (run.remove.price === 0 || run.gold >= run.remove.price)) removeCard(run, meta, target);
      else cancelRemoval(run);
    } else if (run.screen === "intermission") {
      const random = coin.next() < explore;
      const choice = random ? coin.pick(["heal", "relic", "card"] as const) : bot.intermission(run);
      const relics = [...run.relics];
      const hp = run.hp;
      const act = run.act;
      chooseIntermission(run, meta, choice);
      if (choice === "heal") {
        rec.heals.intermission += run.hp - hp;
        rec.healsByAct[act - 1] += run.hp - hp;
      }
      noteRelics(relics, "intermission");
      rec.decisions.push({ kind: "intermission", id: "intermission", choice, act, index: rec.fights.length, random, hpDelta: run.hp - hp, goldDelta: 0, result: "" });
    } else break;
  }
  syncGold();
  setCombatFxSink(null);
  if (!run.closed && !rec.death) {
    rec.stalled = true;
    const node = run.nodeId ? nodeById(run.map, run.nodeId) : null;
    rec.death = { act: run.act, where: node?.type ?? "stall", kind: "stall" };
  }
  if (run.screen === "defeat" && !rec.death) {
    const node = run.nodeId ? nodeById(run.map, run.nodeId) : null;
    rec.death = { act: run.act, where: node?.type === "mystery" ? `event:${run.event?.id ?? "?"}` : (node?.type ?? "?"), kind: "event" };
  }
  rec.win = run.screen === "victory";
  rec.act = run.act;
  rec.gold.earned = run.tally.goldEarned;
  rec.finalDeck = run.deck.map((card) => card.id);
  rec.finalRelics = [...run.relics];
  rec.finalHp = run.hp;
  rec.maxHp = run.maxHp;
  return rec;
}
