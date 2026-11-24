import { describe, expect, it } from "vitest";
import { CARDS, getCard } from "../src/game/cards";
import { performEndTurn, performPlayCard, startEncounter } from "../src/game/combat";
import { ENCOUNTERS, ENEMIES } from "../src/game/enemies";
import { EVENTS } from "../src/game/events";
import { JET_ORDER, JETS } from "../src/game/jets";
import { freshMeta, migrateRun } from "../src/game/meta";
import { generateMap, mapIsConnected } from "../src/game/map";
import { RELICS } from "../src/game/relics";
import { RNG } from "../src/game/rng";
import { ackReward, buyShopCard, buyShopHeal, createRun, enterNode, openRemoval, playCard, removeCard } from "../src/game/run";
import { cardTheme, CARD_ART, EVENT_ART, hasJetArt } from "../src/ui/art";
import type { RunState } from "../src/game/types";

function boot(seed = 7, jet: "kite" | "bulwark" | "moth" | "lattice" = "kite") {
  const meta = freshMeta();
  const run = createRun(jet, seed, meta);
  return { meta, run };
}

function forceHand(run: RunState, ids: string[], energy = 3) {
  const combat = run.combat!;
  combat.hand = ids.map((id, index) => ({ uid: 500 + index, id }));
  combat.energy = energy;
  combat.outcome = "fight";
}

describe("map", () => {
  it("builds a connected act with a boss and a visible start", () => {
    for (const act of [1, 2, 3] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        const map = generateMap(act, new RNG(seed + act * 100));
        expect(mapIsConnected(map)).toBe(true);
        expect(map.nodes.filter((node) => node.type === "boss")).toHaveLength(1);
        expect(map.nodes.filter((node) => node.row === 0).every((node) => node.type === "battle")).toBe(true);
        expect(map.nodes.some((node) => node.type === "shop")).toBe(true);
        expect(map.nodes.some((node) => node.type === "elite")).toBe(true);
        expect(map.nodes.some((node) => node.type === "mystery")).toBe(true);
        expect(map.nodes.some((node) => node.type === "gamble")).toBe(true);
        for (const node of map.nodes) {
          if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
            expect(ENCOUNTERS.some((encounter) => encounter.id === node.encounterId)).toBe(true);
          }
          if (node.type === "mystery") expect(EVENTS.some((event) => event.id === node.eventId)).toBe(true);
        }
      }
    }
  });

  it("repeats a seed exactly", () => {
    const a = generateMap(2, new RNG(99));
    const b = generateMap(2, new RNG(99));
    expect(a.nodes.map((node) => [node.id, node.type, node.col, node.edges.join(".")])).toEqual(
      b.nodes.map((node) => [node.id, node.type, node.col, node.edges.join(".")]),
    );
  });
});

describe("combat", () => {
  it("deals attack damage, then lets shield soak the reply", () => {
    const { run } = boot();
    startEncounter(run, "a1-habicht");
    const enemy = run.combat!.enemies[0];
    forceHand(run, ["gunBurst"]);
    performPlayCard(run, 0, enemy.uid);
    expect(enemy.hp).toBe(enemy.maxHp - 6);
    forceHand(run, ["flarePop"]);
    performPlayCard(run, 0, null);
    expect(run.combat!.player.shield).toBe(5);
    const hp = run.hp;
    performEndTurn(run);
    expect(run.hp).toBe(hp - 3);
    expect(run.combat!.player.shield).toBe(0);
  });

  it("lets burn ignore shield and evasion cancel a hit", () => {
    const { run } = boot();
    startEncounter(run, "a1-habicht");
    run.combat!.player.shield = 12;
    run.combat!.player.status.burn = 4;
    const hp = run.hp;
    performEndTurn(run);
    expect(run.hp).toBe(hp - 4);
    expect(run.combat!.player.status.burn).toBe(3);

    run.combat!.player.status.evasion = 1;
    run.combat!.player.status.burn = 0;
    run.combat!.player.shield = 0;
    run.combat!.enemies[0].movePtr = 0;
    const before = run.hp;
    performEndTurn(run);
    expect(run.hp).toBe(before);
    expect(run.combat!.player.status.evasion).toBe(0);
  });

  it("applies locked, jam, and the kite's first-attack discount", () => {
    const { run } = boot();
    startEncounter(run, "a1-luchs");
    const enemy = run.combat!.enemies[0];
    enemy.status.locked = 2;
    forceHand(run, ["gunBurst", "gunBurst"]);
    expect(run.combat!.energy).toBe(3);
    performPlayCard(run, 0, enemy.uid);
    expect(enemy.hp).toBe(enemy.maxHp - 12);
    expect(run.combat!.energy).toBe(3);
    performPlayCard(run, 0, enemy.uid);
    expect(run.combat!.energy).toBe(2);

    enemy.status.jam = 2;
    enemy.movePtr = 0;
    const hp = run.hp;
    run.combat!.player.shield = 0;
    run.combat!.player.status.burn = 0;
    performEndTurn(run);
    expect(run.hp).toBe(hp - 6);
  });

  it("plays every card without throwing", () => {
    for (const card of CARDS) {
      const { run } = boot(3);
      startEncounter(run, "a1-habicht");
      run.hp = 60;
      forceHand(run, [card.id], 10);
      const result = performPlayCard(run, 0, run.combat!.enemies[0].uid);
      expect(result.ok, card.id).toBe(true);
    }
  });
});

describe("sortie flow", () => {
  it("keeps HP after a fight and unlocks Bulwark for downing the Act 1 boss", () => {
    const { run, meta } = boot();
    run.hp = 40;
    startEncounter(run, "a1-eule");
    run.screen = "combat";
    run.combat!.enemies[0].hp = 1;
    forceHand(run, ["gunBurst"], 1);
    playCard(run, meta, 0, run.combat!.enemies[0].uid);
    expect(run.screen).toBe("reward");
    expect(run.hp).toBe(40);
    expect(meta.unlocked.bulwark).toBe(true);
    expect(meta.stats.act1Bosses).toBe(1);
    ackReward(run, meta);
    expect(run.screen).toBe("intermission");
    expect(run.hp).toBe(40);
  });

  it("sells a card and a repair without raising HP for free", () => {
    const { run, meta } = boot(4);
    const start = run.map.nodes.find((node) => node.row === 0)!;
    start.type = "shop";
    enterNode(run, meta, start.id);
    expect(run.screen).toBe("shop");
    const before = run.hp;
    const offer = run.shop!.cards[0];
    run.gold = 400;
    buyShopCard(run, 0);
    expect(run.deck.some((card) => card.id === offer.id)).toBe(true);
    run.hp = Math.max(1, before - 10);
    const hurt = run.hp;
    buyShopHeal(run);
    expect(run.hp).toBeGreaterThan(hurt);
    openRemoval(run);
    const starter = run.deck.find((card) => card.id === "gunBurst")!;
    removeCard(run, meta, starter.uid);
    expect(run.deck.some((card) => card.uid === starter.uid)).toBe(false);
  });
});

describe("content", () => {
  it("has a full original roster", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(CARDS.length);
    expect(RELICS.length).toBeGreaterThanOrEqual(20);
    expect(ENEMIES.length).toBeGreaterThanOrEqual(12);
    expect(ENEMIES.filter((enemy) => enemy.boss).length).toBe(3);
    expect(EVENTS.length).toBeGreaterThanOrEqual(8);
    expect(JET_ORDER).toHaveLength(4);
    for (const jet of JET_ORDER) {
      expect(hasJetArt(JETS[jet].silhouette)).toBe(true);
      for (const id of JETS[jet].deck) getCard(id);
    }
    for (const enemy of ENEMIES) expect(hasJetArt(enemy.silhouette)).toBe(true);
    for (const card of CARDS) expect(CARD_ART[cardTheme(card.id)]).toBeTruthy();
    for (const event of EVENTS) expect(EVENT_ART[event.id]).toBeTruthy();
    for (const encounter of ENCOUNTERS) {
      expect(encounter.foes.length).toBeGreaterThan(0);
      for (const foe of encounter.foes) expect(ENEMIES.some((enemy) => enemy.id === foe.id)).toBe(true);
    }
  });
});

describe("saves", () => {
  it("refreshes display names on a combat saved before the re-skin", () => {
    const { meta, run } = boot(11);
    const start = run.map.nodes.find((node) => node.row === 0)!;
    expect(enterNode(run, meta, start.id).ok).toBe(true);
    const saved = JSON.parse(JSON.stringify(run)) as RunState;
    saved.combat!.encounterName = "Old contact";
    for (const fighter of saved.combat!.enemies) {
      fighter.name = "Old name";
      fighter.silhouette = "f16";
    }
    const loaded = migrateRun(saved);
    expect(loaded.combat!.encounterName).toBe(run.combat!.encounterName);
    loaded.combat!.enemies.forEach((fighter, index) => {
      expect(fighter.name).toBe(run.combat!.enemies[index].name);
      expect(fighter.silhouette).toBe(run.combat!.enemies[index].silhouette);
      expect(fighter.hp).toBe(run.combat!.enemies[index].hp);
    });
  });
});
