import { CARD_PRICES, cardsOfRarity, getCard, rewardPool } from "./cards";
import { performEndTurn, performPlayCard, startEncounter } from "./combat";
import type { ActionResult } from "./combat";
import { encounterPool } from "./enemies";
import { getEvent } from "./events";
import type { EventChoice } from "./events";
import { JETS } from "./jets";
import { generateMap, nodeById, reachableNodes } from "./map";
import { checkUnlocks } from "./meta";
import { curseRelics, gambleBuffs, getRelic, shopRelics } from "./relics";
import type { RelicKind } from "./relics";
import { RNG } from "./rng";
import type { ActId, CardInst, JetId, Meta, RewardState, RunState, ShopState } from "./types";

type Bias = "normal" | "good" | "rare";

function rngOf(run: RunState): RNG {
  const rng = new RNG(1);
  rng.state = run.rngState || 1;
  return rng;
}

function saveRng(run: RunState, rng: RNG) {
  run.rngState = rng.state;
}

function healTo(run: RunState, amount: number): number {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + Math.max(0, amount));
  return run.hp - before;
}

export function gainGold(run: RunState, meta: Meta, amount: number) {
  if (amount <= 0) return;
  run.gold += amount;
  run.tally.goldEarned += amount;
  if (!run.scratch) meta.stats.goldEarned += amount;
}

export function priced(run: RunState, base: number): number {
  const multiplier = run.relics.includes("depotStamp") ? 0.8 : 1;
  return Math.max(1, Math.floor(base * multiplier));
}

export function removalCost(run: RunState): number {
  return priced(run, 65 + run.removals * 20);
}

export function spareRelics(run: RunState): string[] {
  const starter = JETS[run.jet].relic;
  return run.relics.filter((id) => id !== starter);
}

function noteUnlocks(run: RunState, meta: Meta) {
  if (run.scratch) return;
  for (const id of checkUnlocks(meta)) {
    const jet = JETS[id];
    run.notices.push(`${jet.code} ${jet.name} unlocked. It will be in the hangar next sortie.`);
  }
}

function defeat(run: RunState, meta: Meta, reason = "Airframe lost.") {
  if (run.closed) return;
  run.closed = true;
  run.defeatReason = reason;
  run.screen = "defeat";
  if (run.hp < 0) run.hp = 0;
  if (run.scratch) return;
  meta.stats.losses += 1;
  meta.stats.deepest = Math.max(meta.stats.deepest, run.act);
  noteUnlocks(run, meta);
}

function winRun(run: RunState, meta: Meta) {
  if (run.closed) return;
  run.closed = true;
  run.screen = "victory";
  if (run.scratch) return;
  meta.stats.wins += 1;
  meta.stats.deepest = Math.max(meta.stats.deepest, 4);
  meta.stats.bestVictoryHp = Math.max(meta.stats.bestVictoryHp, run.hp);
  noteUnlocks(run, meta);
}

export function grantRelic(run: RunState, meta: Meta, id: string): string {
  const relic = getRelic(id);
  if (run.relics.includes(id)) {
    gainGold(run, meta, 25);
    return `${relic.name} is already installed. Scrapped for 25 gold.`;
  }
  run.relics.push(id);
  if (id === "auxTank") {
    run.maxHp += 8;
    run.hp += 8;
  } else if (id === "crackedCanopy") {
    run.maxHp += 12;
    run.hp += 12;
  } else if (id === "hauntedPump") {
    healTo(run, 10);
  }
  const prefix = relic.kind === "curse" ? "Cursed install" : "Installed";
  return `${prefix}: ${relic.name}. ${relic.text}`;
}

export function draftCards(run: RunState, rng: RNG, count: number, bias: Bias): string[] {
  const pool = rewardPool(run.jet);
  const weights =
    bias === "rare" ? { common: 25, uncommon: 40, rare: 35 } : bias === "good" ? { common: 40, uncommon: 42, rare: 18 } : { common: 58, uncommon: 32, rare: 10 };
  const picked: string[] = [];
  let guard = 0;
  while (picked.length < count && guard < 80) {
    guard += 1;
    const roll = rng.next() * (weights.common + weights.uncommon + weights.rare);
    const rarity = roll < weights.common ? "common" : roll < weights.common + weights.uncommon ? "uncommon" : "rare";
    let options = pool.filter((card) => card.rarity === rarity && !picked.includes(card.id));
    if (!options.length) options = pool.filter((card) => !picked.includes(card.id));
    if (!options.length) break;
    picked.push(rng.pick(options).id);
  }
  return picked;
}

function addCard(run: RunState, id: string): CardInst {
  run.uid += 1;
  const inst = { uid: run.uid, id };
  run.deck.push(inst);
  return inst;
}

function grantRandom(run: RunState, rng: RNG, rarity: "common" | "uncommon" | "rare"): string {
  const pool = cardsOfRarity(run.jet, rarity);
  const card = rng.pick(pool.length ? pool : rewardPool(run.jet));
  addCard(run, card.id);
  return card.name;
}

function unowned<T extends { id: string }>(run: RunState, list: T[]): T[] {
  return list.filter((relic) => !run.relics.includes(relic.id));
}

function pickRelic(rng: RNG, list: { id: string }[]): string | null {
  if (!list.length) return null;
  return rng.pick(list).id;
}

function winCombat(run: RunState, meta: Meta) {
  const combat = run.combat;
  if (!combat) return;
  const rng = rngOf(run);
  const mode = combat.rewardMode;
  let purse = mode === "boss" ? 64 + rng.int(12) : mode === "elite" ? 46 + rng.int(10) : 18 + run.act * 4 + rng.int(8);
  gainGold(run, meta, purse);
  if (run.relics.includes("wingmanChit")) {
    gainGold(run, meta, 12);
    purse += 12;
  }
  if (combat.bonusGold) gainGold(run, meta, combat.bonusGold);
  if (run.relics.includes("redundantLines")) healTo(run, 4);
  if (combat.bonusHealPct) healTo(run, Math.ceil(run.maxHp * combat.bonusHealPct));
  if (mode === "boss" && run.relics.includes("noseArt")) {
    run.maxHp += 4;
    run.hp += 4;
  }
  if (!run.scratch) {
    meta.stats.battles += 1;
    run.tally.battles += 1;
    meta.stats.deepest = Math.max(meta.stats.deepest, run.act);
    if (mode === "elite") {
      meta.stats.elites += 1;
      run.tally.elites += 1;
    }
    if (mode === "boss") {
      meta.stats.bosses += 1;
      run.tally.bosses += 1;
      if (run.act === 1) meta.stats.act1Bosses += 1;
    }
    noteUnlocks(run, meta);
  } else {
    run.tally.battles += 1;
  }

  const bias: Bias = mode === "boss" || run.act === 3 ? "rare" : mode === "elite" || run.act === 2 ? "good" : "normal";
  let cards: string[] | null = null;
  let relic: string | null = null;
  let heal = 0;
  if (mode === "boss") {
    cards = draftCards(run, rng, 3, "rare");
    relic = pickRelic(rng, unowned(run, shopRelics()));
    heal = Math.ceil(run.maxHp * 0.15);
  } else if (mode === "elite") {
    cards = draftCards(run, rng, 3, "good");
    if (rng.chance(0.65)) relic = pickRelic(rng, unowned(run, shopRelics()));
    else heal = Math.ceil(run.maxHp * 0.22);
  } else {
    const roll = rng.next();
    if (roll < 0.55) cards = draftCards(run, rng, 3, bias);
    else if (roll < 0.78) heal = Math.ceil(run.maxHp * 0.24);
    else if (roll < 0.92) relic = pickRelic(rng, unowned(run, shopRelics()));
    else gainGold(run, meta, 22);
  }
  if (!relic && mode === "boss") gainGold(run, meta, 30);

  const next = mode === "boss" ? (run.act === 3 ? "victory" : "intermission") : "map";
  const noteBits = [combat.bonusNote, combat.encounterName].filter(Boolean);
  const reward: RewardState = {
    purse,
    cards,
    relic,
    heal,
    cardTaken: false,
    relicTaken: false,
    healTaken: false,
    note: noteBits.join(" "),
    next,
  };
  run.reward = reward;
  run.combat = null;
  run.screen = "reward";
  saveRng(run, rng);
}

function settle(run: RunState, meta: Meta) {
  if (run.closed) return;
  if (run.scratch) return;
  if (run.hp <= 0 || run.combat?.outcome === "lost") {
    defeat(run, meta);
    return;
  }
  if (run.combat?.outcome === "won") winCombat(run, meta);
}

export function createRun(jet: JetId, seed: number, meta: Meta): RunState {
  const rng = new RNG(seed >>> 0 || 1);
  const spec = JETS[jet];
  const map = generateMap(1, rng);
  const run: RunState = {
    version: 1,
    seed: seed >>> 0 || 1,
    rngState: rng.state,
    uid: 0,
    jet,
    hp: spec.hp,
    maxHp: spec.hp,
    gold: 90,
    deck: [],
    relics: [spec.relic],
    act: 1,
    map,
    nodeId: null,
    route: [],
    screen: "map",
    combat: null,
    reward: null,
    shop: null,
    event: null,
    gamble: null,
    remove: null,
    removals: 0,
    notices: [],
    defeatReason: "",
    closed: false,
    scratch: false,
    tally: { battles: 0, elites: 0, bosses: 0, mysteries: 0, cardsPlayed: 0, goldEarned: 0 },
  };
  for (const id of spec.deck) addCard(run, id);
  meta.stats.runs += 1;
  meta.stats.deepest = Math.max(meta.stats.deepest, 1);
  return run;
}

export function reachable(run: RunState) {
  return reachableNodes(run.map, run.nodeId);
}

export function enterNode(run: RunState, meta: Meta, nodeId: string): ActionResult {
  if (run.closed || run.screen !== "map") return { ok: false, message: "You are not on the map." };
  const node = nodeById(run.map, nodeId);
  if (!node) return { ok: false, message: "Unknown plot." };
  if (!reachable(run).some((candidate) => candidate.id === node.id)) {
    return { ok: false, message: "That plot is not on your route." };
  }
  run.nodeId = node.id;
  run.route.push(node.id);
  if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
    startEncounter(run, node.encounterId);
    run.screen = "combat";
    settle(run, meta);
    return { ok: true };
  }
  if (node.type === "shop") {
    run.shop = buildShop(run);
    run.screen = "shop";
    return { ok: true };
  }
  if (node.type === "mystery") {
    run.event = { id: node.eventId, done: false, counted: false, result: "" };
    run.screen = "event";
    return { ok: true };
  }
  run.gamble = { done: false, result: "" };
  run.screen = "gamble";
  return { ok: true };
}

function buildShop(run: RunState): ShopState {
  const rng = rngOf(run);
  const bias: Bias = run.act === 1 ? "normal" : "good";
  const cards = draftCards(run, rng, 3, bias).map((id) => {
    const rarity = getCard(id).rarity;
    const base = rarity === "rare" ? CARD_PRICES.rare : rarity === "uncommon" ? CARD_PRICES.uncommon : CARD_PRICES.common;
    return { kind: "card" as const, id, price: priced(run, base), sold: false };
  });
  const relics = rng
    .shuffle(unowned(run, shopRelics()))
    .slice(0, 2)
    .map((relic) => ({ kind: "relic" as const, id: relic.id, price: priced(run, relic.price), sold: false }));
  saveRng(run, rng);
  return {
    cards,
    relics,
    healPrice: priced(run, 48),
    healAmount: Math.ceil(run.maxHp * 0.3),
    healSold: false,
  };
}

export function buyShopCard(run: RunState, index: number): ActionResult {
  const offer = run.shop?.cards[index];
  if (!offer || offer.sold) return { ok: false, message: "Already gone." };
  if (run.gold < offer.price) return { ok: false, message: "Not enough gold." };
  run.gold -= offer.price;
  offer.sold = true;
  addCard(run, offer.id);
  return { ok: true, message: `${getCard(offer.id).name} stowed.` };
}

export function buyShopRelic(run: RunState, meta: Meta, index: number): ActionResult {
  const offer = run.shop?.relics[index];
  if (!offer || offer.sold) return { ok: false, message: "Already gone." };
  if (run.gold < offer.price) return { ok: false, message: "Not enough gold." };
  run.gold -= offer.price;
  offer.sold = true;
  return { ok: true, message: grantRelic(run, meta, offer.id) };
}

export function buyShopHeal(run: RunState): ActionResult {
  const shop = run.shop;
  if (!shop || shop.healSold) return { ok: false, message: "The medic is done." };
  if (run.hp >= run.maxHp) return { ok: false, message: "You are already at full HP." };
  if (run.gold < shop.healPrice) return { ok: false, message: "Not enough gold." };
  run.gold -= shop.healPrice;
  shop.healSold = true;
  const gained = healTo(run, shop.healAmount);
  return { ok: true, message: `Field repair restores ${gained} HP.` };
}

export function openRemoval(run: RunState): ActionResult {
  if (!run.shop) return { ok: false, message: "No depot open." };
  if (run.deck.length <= 1) return { ok: false, message: "The deck cannot go empty." };
  run.remove = { price: removalCost(run), next: "shop", goldOnRemove: 0 };
  run.screen = "remove";
  return { ok: true };
}

export function cancelRemoval(run: RunState) {
  if (!run.remove) return;
  run.screen = run.remove.next;
  run.remove = null;
}

export function removeCard(run: RunState, meta: Meta, uid: number): ActionResult {
  const view = run.remove;
  if (!view) return { ok: false, message: "Nothing to remove." };
  if (run.deck.length <= 1) return { ok: false, message: "The deck cannot go empty." };
  if (view.price > run.gold) return { ok: false, message: "Not enough gold." };
  const index = run.deck.findIndex((card) => card.uid === uid);
  if (index < 0) return { ok: false, message: "That card is not in the deck." };
  const [card] = run.deck.splice(index, 1);
  if (view.price > 0) {
    run.gold -= view.price;
    run.removals += 1;
  }
  if (view.goldOnRemove) gainGold(run, meta, view.goldOnRemove);
  run.screen = view.next;
  run.remove = null;
  return { ok: true, message: `${getCard(card.id).name} pulled from the deck.` };
}

export function leaveShop(run: RunState) {
  run.shop = null;
  run.screen = "map";
}

export function playCard(run: RunState, meta: Meta, index: number, targetUid: number | null): ActionResult {
  const result = performPlayCard(run, index, targetUid);
  if (result.ok && !run.scratch) meta.stats.cardsPlayed += 1;
  settle(run, meta);
  return result;
}

export function endTurn(run: RunState, meta: Meta) {
  performEndTurn(run);
  settle(run, meta);
}

export function takeRewardCard(run: RunState, id: string): ActionResult {
  const reward = run.reward;
  if (!reward || reward.cardTaken || !reward.cards?.includes(id)) return { ok: false, message: "That card is not on offer." };
  reward.cardTaken = true;
  addCard(run, id);
  return { ok: true, message: `${getCard(id).name} added.` };
}

export function takeRewardRelic(run: RunState, meta: Meta): ActionResult {
  const reward = run.reward;
  if (!reward?.relic || reward.relicTaken) return { ok: false, message: "No package to install." };
  reward.relicTaken = true;
  return { ok: true, message: grantRelic(run, meta, reward.relic) };
}

export function takeRewardHeal(run: RunState): ActionResult {
  const reward = run.reward;
  if (!reward?.heal || reward.healTaken) return { ok: false, message: "No repairs waiting." };
  reward.healTaken = true;
  const gained = healTo(run, reward.heal);
  return { ok: true, message: `Repairs restore ${gained} HP.` };
}

function advanceAct(run: RunState, meta: Meta) {
  if (run.act >= 3) {
    winRun(run, meta);
    return;
  }
  run.act = (run.act + 1) as ActId;
  const rng = rngOf(run);
  run.map = generateMap(run.act, rng);
  saveRng(run, rng);
  run.nodeId = null;
  run.route = [];
  run.screen = "map";
  if (!run.scratch) meta.stats.deepest = Math.max(meta.stats.deepest, run.act);
}

export function ackReward(run: RunState, meta: Meta) {
  const reward = run.reward;
  if (!reward) return;
  const next = reward.next;
  run.reward = null;
  if (next === "intermission") run.screen = "intermission";
  else if (next === "victory") winRun(run, meta);
  else if (next === "advance") advanceAct(run, meta);
  else run.screen = "map";
}

export function chooseIntermission(run: RunState, meta: Meta, choice: "heal" | "relic" | "card") {
  if (run.screen !== "intermission" || run.closed) return;
  if (choice === "heal") {
    healTo(run, Math.ceil(run.maxHp * 0.4));
    advanceAct(run, meta);
    return;
  }
  if (choice === "relic") {
    const rng = rngOf(run);
    const pool = unowned(run, shopRelics());
    if (pool.length) grantRelic(run, meta, rng.pick(pool).id);
    else gainGold(run, meta, 40);
    saveRng(run, rng);
    advanceAct(run, meta);
    return;
  }
  const rng = rngOf(run);
  run.reward = {
    purse: 0,
    cards: draftCards(run, rng, 3, "good"),
    relic: null,
    heal: 0,
    cardTaken: false,
    relicTaken: false,
    healTaken: false,
    note: "Munitions crate from the hardstand. Take one, or leave it.",
    next: "advance",
  };
  saveRng(run, rng);
  run.screen = "reward";
}

export function chooseGamble(run: RunState, meta: Meta, take: boolean): ActionResult {
  if (!run.gamble || run.gamble.done) return { ok: false, message: "The yard is closed." };
  if (!take) {
    gainGold(run, meta, 15);
    run.gamble.done = true;
    run.gamble.result = "You leave the tag on the crate and pocket 15 gold.";
    return { ok: true };
  }
  const rng = rngOf(run);
  const cursed = rng.chance(0.45);
  const pool = unowned(run, cursed ? curseRelics() : gambleBuffs());
  if (!pool.length) {
    gainGold(run, meta, 25);
    run.gamble.result = "The crate is empty. The yard pays 25 gold to see you off.";
  } else {
    run.gamble.result = grantRelic(run, meta, rng.pick(pool).id);
  }
  run.gamble.done = true;
  saveRng(run, rng);
  return { ok: true };
}

export function leaveGamble(run: RunState) {
  run.gamble = null;
  run.screen = "map";
}

export function choiceAvailable(run: RunState, choice: EventChoice): { ok: boolean; reason: string } {
  if (choice.gold && run.gold < choice.gold) return { ok: false, reason: `Need ${choice.gold} gold` };
  if (choice.hpgt !== undefined && run.hp <= choice.hpgt) return { ok: false, reason: `Need more than ${choice.hpgt} HP` };
  if (choice.spareRelic && spareRelics(run).length === 0) return { ok: false, reason: "No spare relic" };
  return { ok: true, reason: "" };
}

function countMystery(run: RunState, meta: Meta) {
  if (!run.event || run.event.counted) return;
  run.event.counted = true;
  run.tally.mysteries += 1;
  if (!run.scratch) {
    meta.stats.mysteries += 1;
    noteUnlocks(run, meta);
  }
}

function finishEvent(run: RunState, text: string) {
  if (!run.event) return;
  run.event.done = true;
  run.event.result = text;
}

function chip(run: RunState, meta: Meta, amount: number) {
  run.hp = Math.max(0, run.hp - amount);
  if (run.hp <= 0) defeat(run, meta, "The airframe gave out.");
}

function openGift(run: RunState, rng: RNG, bias: Bias, note: string) {
  run.reward = {
    purse: 0,
    cards: draftCards(run, rng, 3, bias),
    relic: null,
    heal: 0,
    cardTaken: false,
    relicTaken: false,
    healTaken: false,
    note,
    next: "map",
  };
  run.event = null;
  run.screen = "reward";
}

export function chooseEvent(run: RunState, meta: Meta, choiceId: string): ActionResult {
  const view = run.event;
  if (!view || view.done) return { ok: false, message: "Nothing to decide." };
  const event = getEvent(view.id);
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) return { ok: false, message: "Unknown choice." };
  const gate = choiceAvailable(run, choice);
  if (!gate.ok) return { ok: false, message: gate.reason };
  countMystery(run, meta);
  const rng = rngOf(run);

  if (view.id === "pallet" && choiceId === "open") {
    const pool = unowned(run, shopRelics());
    const line = pool.length ? grantRelic(run, meta, rng.pick(pool).id) : "The pallet was packing foam. Nothing to install.";
    finishEvent(run, line);
  } else if (view.id === "pallet" && choiceId === "strip") {
    gainGold(run, meta, 45);
    finishEvent(run, "You strip the mounts and stow 45 gold.");
  } else if (view.id === "pallet" && choiceId === "leave") {
    const gained = healTo(run, 8);
    finishEvent(run, `You watch it drift and catch your breath. Heal ${gained}.`);
  } else if (view.id === "mayday" && choiceId === "escort") {
    const encounter = rng.pick(encounterPool(run.act, "battle"));
    saveRng(run, rng);
    startEncounter(run, encounter.id, { side: true, bonusGold: 45, bonusNote: "The transport wires a bonus." });
    run.event = null;
    run.screen = "combat";
    settle(run, meta);
    return { ok: true };
  } else if (view.id === "mayday" && choiceId === "share") {
    chip(run, meta, 8);
    gainGold(run, meta, 55);
    finishEvent(run, "You bleed off a fuel cell. -8 HP, +55 gold.");
  } else if (view.id === "mayday" && choiceId === "dark") {
    finishEvent(run, "You leave the frequency alone.");
  } else if (view.id === "hardstand" && choiceId === "repair") {
    const gained = healTo(run, Math.ceil(run.maxHp * 0.3));
    finishEvent(run, `The chest has what you need. Heal ${gained}.`);
  } else if (view.id === "hardstand" && choiceId === "refit") {
    saveRng(run, rng);
    run.event = null;
    run.remove = { price: 0, next: "map", goldOnRemove: 0 };
    run.screen = "remove";
    return { ok: true, message: "Pull a card." };
  } else if (view.id === "hardstand" && choiceId === "patch") {
    const gained = healTo(run, 10);
    gainGold(run, meta, 20);
    finishEvent(run, `A quick patch. Heal ${gained}, +20 gold.`);
  } else if (view.id === "crate" && choiceId === "pay45") {
    run.gold -= 45;
    openGift(run, rng, "good", "The good tape. Choose one card.");
    saveRng(run, rng);
    return { ok: true };
  } else if (view.id === "crate" && choiceId === "pay30") {
    run.gold -= 30;
    const name = grantRandom(run, rng, "common");
    finishEvent(run, `${name} was loose in the straw. Added to the deck.`);
  } else if (view.id === "crate" && choiceId === "walk") {
    finishEvent(run, "You leave the tape where it is.");
  } else if (view.id === "shear" && choiceId === "punch") {
    chip(run, meta, 8);
    const name = grantRandom(run, rng, "common");
    finishEvent(run, `The shear takes 8 HP and throws you ${name}.`);
  } else if (view.id === "shear" && choiceId === "divert") {
    finishEvent(run, "You add the ten minutes and stay in clear air.");
  } else if (view.id === "shear" && choiceId === "edge") {
    run.maxHp += 3;
    chip(run, meta, 10);
    finishEvent(run, "The edge writes 3 max HP into the airframe and takes 10 back.");
  } else if (view.id === "controller" && choiceId === "picture") {
    openGift(run, rng, run.act === 3 ? "rare" : "good", "The picture resolves into three cards.");
    saveRng(run, rng);
    return { ok: true };
  } else if (view.id === "controller" && choiceId === "tape") {
    saveRng(run, rng);
    run.event = null;
    run.remove = { price: 0, next: "map", goldOnRemove: 30 };
    run.screen = "remove";
    return { ok: true, message: "Hand over a card. 30 gold follows." };
  } else if (view.id === "controller" && choiceId === "signoff") {
    const gained = healTo(run, 6);
    finishEvent(run, `You sign off. Heal ${gained}.`);
  } else if (view.id === "linegang" && choiceId === "pay") {
    run.gold -= 35;
    const gained = healTo(run, 14);
    finishEvent(run, `The seam is closed. Heal ${gained}.`);
  } else if (view.id === "linegang" && choiceId === "bleed") {
    chip(run, meta, 7);
    finishEvent(run, "You fly it wet. -7 HP.");
  } else if (view.id === "linegang" && choiceId === "jury") {
    const pool = spareRelics(run);
    const lost = rng.pick(pool);
    run.relics = run.relics.filter((id) => id !== lost);
    const gained = healTo(run, 18);
    finishEvent(run, `${getRelic(lost).name} is cannibalized. Heal ${gained}.`);
  } else if (view.id === "channel" && choiceId === "accept") {
    const cursed = rng.chance(0.5);
    const pool = unowned(run, cursed ? curseRelics() : gambleBuffs());
    const line = pool.length ? grantRelic(run, meta, rng.pick(pool).id) : "The can is empty.";
    finishEvent(run, line);
  } else if (view.id === "channel" && choiceId === "decline") {
    const gained = healTo(run, 10);
    finishEvent(run, `You clear the channel. Heal ${gained}.`);
  } else if (view.id === "bingo" && choiceId === "bet") {
    run.gold -= 30;
    if (rng.chance(0.5)) {
      gainGold(run, meta, 80);
      finishEvent(run, "The timer pays. +80 gold.");
    } else {
      chip(run, meta, 6);
      finishEvent(run, "The timer eats the bet. -30 gold, -6 HP.");
    }
  } else if (view.id === "bingo" && choiceId === "tower") {
    gainGold(run, meta, 22);
    finishEvent(run, "The tower drawer holds 22 gold.");
  } else if (view.id === "bingo" && choiceId === "taxi") {
    finishEvent(run, "You keep taxiing.");
  } else if (view.id === "wingman" && choiceId === "memorial") {
    if (run.relics.includes("memorialTag")) {
      run.maxHp += 4;
      const gained = healTo(run, 10);
      finishEvent(run, `The tag is already on the rail. +4 max HP, heal ${gained}.`);
    } else {
      finishEvent(run, grantRelic(run, meta, "memorialTag"));
    }
  } else if (view.id === "wingman" && choiceId === "scavenge") {
    gainGold(run, meta, 70);
    finishEvent(run, "The kit is worth 70 gold. You do not look at the name tape.");
  } else if (view.id === "wingman" && choiceId === "rescue") {
    const encounter = rng.pick(encounterPool(run.act, "elite"));
    saveRng(run, rng);
    startEncounter(run, encounter.id, {
      rewardMode: "battle",
      side: true,
      bonusGold: 30,
      bonusHealPct: 0.25,
      bonusNote: "The beacon goes quiet. You keep the promise.",
    });
    run.event = null;
    run.screen = "combat";
    settle(run, meta);
    return { ok: true };
  } else {
    finishEvent(run, "You move on.");
  }

  saveRng(run, rng);
  return { ok: true };
}

export function continueEvent(run: RunState) {
  run.event = null;
  run.screen = "map";
}

export function abortRun(run: RunState, meta: Meta) {
  defeat(run, meta, "Sortie aborted.");
}

export function dismissNotice(run: RunState) {
  run.notices.shift();
}

export function relicKind(id: string): RelicKind {
  return getRelic(id).kind;
}
