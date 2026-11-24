import { describe, expect, it } from "vitest";
import { forecastLoss, startEncounter } from "../src/game/combat";
import { getEvent } from "../src/game/events";
import { getRelic } from "../src/game/relics";
import { freshMeta } from "../src/game/meta";
import { reachable } from "../src/game/run";
import {
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
  endTurn,
  enterNode,
  leaveGamble,
  leaveShop,
  playCard,
  removeCard,
  takeRewardCard,
  takeRewardHeal,
  takeRewardRelic,
} from "../src/game/run";
import type { JetId, MapNode, Meta, RunState } from "../src/game/types";
import { getCard as cardDef } from "../src/game/cards";

function enemyHp(run: RunState): number {
  return run.combat?.enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0) ?? 0;
}

function fight(run: RunState, meta: Meta) {
  let guard = 0;
  while (run.screen === "combat" && run.combat && run.combat.outcome === "fight" && guard++ < 36) {
    const living = run.combat.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.uid);
    const targets = living.length ? living : [null];
    const passIncoming = forecastLoss(run);
    let best = { score: -passIncoming * 3, index: -1, target: null as number | null };
    for (let index = 0; index < run.combat.hand.length; index++) {
      for (const target of targets) {
        const clone = structuredClone(run);
        clone.scratch = true;
        const beforeEnemies = enemyHp(clone);
        const beforeHp = clone.hp;
        const result = playCard(clone, meta, index, target);
        if (!result.ok || !clone.combat) continue;
        const dealt = beforeEnemies - enemyHp(clone);
        const lost = beforeHp - clone.hp;
        let incoming = 0;
        if (clone.combat.outcome === "fight") incoming = forecastLoss(clone);
        let score = dealt * 2 + (passIncoming - incoming) * 2.4 - lost * 8;
        if (passIncoming >= beforeHp && incoming < clone.hp) score += 120;
        if (clone.combat.outcome === "won") score += 500;
        if (clone.hp <= 0) score = -99999;
        if (score > best.score) best = { score, index, target };
      }
    }
    if (best.index < 0) endTurn(run, meta);
    else playCard(run, meta, best.index, best.target);
  }
}

function chooseNode(run: RunState): MapNode {
  const options = reachable(run);
  const pct = run.hp / run.maxHp;
  const find = (type: MapNode["type"]) => options.find((node) => node.type === type);
  if (pct < 0.72 && find("shop")) return find("shop")!;
  if (pct < 0.5 && find("mystery")) return find("mystery")!;
  if (pct > 0.88 && run.act > 1 && find("elite")) return find("elite")!;
  return find("battle") ?? find("shop") ?? find("mystery") ?? find("gamble") ?? find("boss") ?? find("elite") ?? options[0];
}

function pickEvent(run: RunState): string {
  const id = run.event?.id;
  const pct = run.hp / run.maxHp;
  if (id === "pallet") return "open";
  if (id === "mayday") return pct > 0.85 ? "escort" : "dark";
  if (id === "hardstand") return pct < 0.75 ? "repair" : "refit";
  if (id === "crate") return run.gold >= 45 ? "pay45" : "walk";
  if (id === "shear") return pct > 0.7 ? "punch" : "divert";
  if (id === "controller") return "picture";
  if (id === "linegang") return run.gold >= 35 ? "pay" : pct > 0.5 ? "bleed" : "pay";
  if (id === "channel") return pct > 0.6 ? "accept" : "decline";
  if (id === "bingo") return "tower";
  if (id === "wingman") return run.relics.includes("memorialTag") ? "scavenge" : "memorial";
  return "divert";
}

function shop(run: RunState, meta: Meta) {
  const state = run.shop;
  if (!state) return;
  if (run.hp < run.maxHp * 0.62 && run.gold >= state.healPrice) buyShopHeal(run);
  const relic = state.relics.findIndex((offer) => !offer.sold && run.gold >= offer.price + 30);
  if (relic >= 0) buyShopRelic(run, meta, relic);
  const ranked = state.cards
    .map((offer, index) => ({ offer, index, rarity: cardDef(offer.id).rarity }))
    .filter((row) => !row.offer.sold && run.gold >= row.offer.price + 15)
    .sort((a, b) => (a.rarity === b.rarity ? 0 : a.rarity === "rare" ? -1 : 1));
  if (ranked[0]) buyShopCard(run, ranked[0].index);
  leaveShop(run);
}

function auto(run: RunState, meta: Meta) {
  let guard = 0;
  while (!run.closed && guard++ < 250) {
    if (run.screen === "map") {
      const node = chooseNode(run);
      if (!node) break;
      enterNode(run, meta, node.id);
    } else if (run.screen === "combat") fight(run, meta);
    else if (run.screen === "reward" && run.reward) {
      if (run.reward.relic && !run.reward.relicTaken) takeRewardRelic(run, meta);
      if (run.reward.heal && !run.reward.healTaken) takeRewardHeal(run);
      if (run.reward.cards && !run.reward.cardTaken) {
        const best = [...run.reward.cards].sort((a, b) => cardDef(b).cost - cardDef(a).cost)[0];
        takeRewardCard(run, best);
      }
      ackReward(run, meta);
    } else if (run.screen === "shop") shop(run, meta);
    else if (run.screen === "event" && run.event) {
      if (run.event.done) continueEvent(run);
      else {
        const event = getEvent(run.event.id);
        const order = [pickEvent(run), ...event.choices.map((choice) => choice.id)];
        let moved = false;
        for (const choice of order) {
          if (chooseEvent(run, meta, choice).ok) {
            moved = true;
            break;
          }
        }
        if (!moved) break;
      }
    } else if (run.screen === "gamble" && run.gamble) {
      if (run.gamble.done) leaveGamble(run);
      else chooseGamble(run, meta, run.hp > run.maxHp * 0.62 && run.relics.filter((id) => getRelic(id).kind === "curse").length < 2);
    } else if (run.screen === "remove" && run.remove) {
      const basic = run.deck.find((card) => card.id === "gunBurst" || card.id === "flarePop");
      if (basic && run.deck.length > 6 && (run.remove.price === 0 || run.gold >= run.remove.price)) removeCard(run, meta, basic.uid);
      else cancelRemoval(run);
    } else if (run.screen === "intermission") {
      chooseIntermission(run, meta, run.hp < run.maxHp * 0.82 ? "heal" : "relic");
    } else break;
  }
}

describe("simulated sorties", () => {
  it("a built interceptor can shoot down Graue Eule", () => {
    const meta = freshMeta();
    const run = createRun("kite", 3, meta);
    run.relics.push("ordnanceBay", "stabilators", "hotNozzle", "busTie", "ejectionSeat", "beaconLamp");
    const extra = ["missilePair", "missilePair", "breaker", "cruiseMissile", "brace", "flareWall", "afterburnDash", "heavySalvo"];
    for (const id of extra) {
      run.uid += 1;
      run.deck.push({ uid: run.uid, id });
    }
    startEncounter(run, "a1-eule");
    run.screen = "combat";
    fight(run, meta);
    const screen = run.screen as string;
    expect(screen).not.toBe("defeat");
    expect(screen).not.toBe("combat");
    expect(run.hp).toBeGreaterThan(0);
  });

  it("gets a naive autopilot into Act 2 across seeded attempts", () => {
    const jets: JetId[] = ["kite", "kite", "bulwark", "kite"];
    let deepest = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const meta = freshMeta();
      if (seed % 2 === 0) meta.unlocked.bulwark = true;
      const run = createRun(jets[seed % jets.length], seed * 17 + 3, meta);
      auto(run, meta);
      deepest = Math.max(deepest, run.act, meta.stats.deepest);
    }
    expect(deepest).toBeGreaterThanOrEqual(2);
  });
});
