import { afterEach, describe, expect, it } from "vitest";
import { getCard } from "../src/game/cards";
import { performEndTurn, performPlayCard, PLATING_CAP, startEncounter } from "../src/game/combat";
import { highestUnlocked, MAX_THREAT, NORMAL, ROOKIE, THREAT_STEPS, tuning } from "../src/game/difficulty";
import { getEnemy } from "../src/game/enemies";
import { EVENTS } from "../src/game/events";
import { JETS } from "../src/game/jets";
import { freshMeta, loadMeta, META_KEY, migrateRun } from "../src/game/meta";
import { getRelic } from "../src/game/relics";
import { ackReward, chooseEvent, createRun, enterNode, playCard } from "../src/game/run";
import type { RunState } from "../src/game/types";

const NEW_EVENTS = ["tanker", "gateguard", "airshow", "thunderhead", "simbay", "fuelcash", "numbers", "stray"];

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

function fight(run: RunState, encounterId: string, hand: string[], energy = 3) {
  startEncounter(run, encounterId);
  run.screen = "combat";
  const combat = run.combat!;
  combat.hand = hand.map((id, index) => ({ uid: 900 + index, id }));
  combat.energy = energy;
  return combat;
}

describe("saves from before the content round", () => {
  it("default old players to Normal and keep their unlocks", () => {
    const old = {
      version: 1,
      unlocked: { kite: true, bulwark: true, moth: false, lattice: false },
      stats: { runs: 9, wins: 0, mysteries: 2, deepest: 2 },
      mute: true,
      musicVol: 0.3,
      sfxVol: 0.5,
    };
    (globalThis as { localStorage?: unknown }).localStorage = memoryStorage({ [META_KEY]: JSON.stringify(old) });
    const meta = loadMeta();
    expect(meta.difficulty).toBe(NORMAL);
    expect(meta.cleared).toEqual({});
    expect(meta.unlocked).toMatchObject({ kite: true, bulwark: true, moth: false, hog: false });
    expect(meta.stats.runs).toBe(9);
    expect(meta.mute).toBe(true);
    expect(highestUnlocked(meta)).toBe(NORMAL);
  });

  it("opens the A-10 at load for players who already reached Act 3", () => {
    const old = { version: 1, unlocked: { kite: true }, stats: { deepest: 3 } };
    (globalThis as { localStorage?: unknown }).localStorage = memoryStorage({ [META_KEY]: JSON.stringify(old) });
    expect(loadMeta().unlocked.hog).toBe(true);
  });

  it("loads an in-progress sortie saved without a difficulty as Normal", () => {
    const meta = freshMeta();
    const run = createRun("kite", 21, meta);
    enterNode(run, meta, run.map.nodes.find((node) => node.row === 0)!.id);
    const saved = JSON.parse(JSON.stringify(run)) as RunState;
    delete (saved as Partial<RunState>).difficulty;
    delete (saved.combat!.player.status as { plating?: number }).plating;
    const loaded = migrateRun(saved);
    expect(loaded.difficulty).toBe(NORMAL);
    expect(loaded.combat!.player.status.plating).toBe(0);
    performEndTurn(loaded);
    expect(Number.isFinite(loaded.hp)).toBe(true);
  });
});

describe("difficulty", () => {
  it("stacks one Threat modifier per level", () => {
    expect(THREAT_STEPS).toHaveLength(MAX_THREAT);
    const names = new Set(THREAT_STEPS.map((step) => step.name));
    expect(names.size).toBe(MAX_THREAT);
    expect(tuning(NORMAL)).toEqual(tuning(0));
    expect(tuning(1).eliteHp).toBeGreaterThan(1);
    expect(tuning(1).heal).toBe(1);
    expect(tuning(2).heal).toBeLessThan(1);
    expect(tuning(4).curses).toBe(1);
    expect(tuning(9).maxHp).toBeLessThan(1);
    expect(tuning(10).bossDmg).toBeGreaterThan(1);
  });

  it("Rookie softens enemies and raises the airframe; Threat 10 does the opposite", () => {
    const meta = freshMeta();
    const rookie = createRun("kite", 5, meta, ROOKIE);
    const normal = createRun("kite", 5, meta, NORMAL);
    const hard = createRun("kite", 5, meta, MAX_THREAT);
    expect(rookie.maxHp).toBeGreaterThan(normal.maxHp);
    expect(hard.maxHp).toBeLessThan(normal.maxHp);
    expect(hard.relics.filter((id) => getRelic(id).kind === "curse")).toHaveLength(1);
    expect(normal.relics).toEqual([JETS.kite.relic]);
    const boss = getEnemy("eule");
    startEncounter(rookie, "a1-eule");
    startEncounter(normal, "a1-eule");
    startEncounter(hard, "a1-eule");
    expect(normal.combat!.enemies[0].maxHp).toBe(boss.hp);
    expect(rookie.combat!.enemies[0].maxHp).toBeLessThan(boss.hp);
    expect(hard.combat!.enemies[0].maxHp).toBeGreaterThan(boss.hp);
    expect(rookie.combat!.enemies[0].moves[2].damage).toBeLessThan(boss.moves[2].damage);
    expect(hard.combat!.enemies[0].moves[2].damage).toBeGreaterThan(boss.moves[2].damage);
  });

  it("records the clear per jet and opens the next Threat Level after a win", () => {
    const meta = freshMeta();
    const run = createRun("kite", 8, meta, NORMAL);
    run.act = 3;
    const combat = fight(run, "a3-nebel", ["gunBurst"]);
    combat.enemies[0].hp = 1;
    combat.enemies[0].shield = 0;
    expect(playCard(run, meta, 0, combat.enemies[0].uid).ok).toBe(true);
    expect(run.screen).toBe("reward");
    ackReward(run, meta);
    expect(run.screen).toBe("victory");
    expect(meta.cleared.kite).toBe(NORMAL);
    expect(highestUnlocked(meta)).toBe(1);
    expect(run.notices.some((note) => note.includes("Threat 1 unlocked"))).toBe(true);
  });

  it("caps the ladder at Threat 10 and ignores Rookie clears", () => {
    const meta = freshMeta();
    meta.cleared = { kite: ROOKIE };
    expect(highestUnlocked(meta)).toBe(NORMAL);
    meta.cleared = { kite: 3, moth: 1 };
    expect(highestUnlocked(meta)).toBe(4);
    meta.cleared = { hog: MAX_THREAT };
    expect(highestUnlocked(meta)).toBe(MAX_THREAT);
  });
});

describe("A-10C Thunderbolt II", () => {
  it("has its own card pool, starter relic, and art", () => {
    const pool = ["brrt", "bathtub", "strafeRun", "lowPass", "rivetLine", "rocketPods", "maverick", "bathtubCharge", "speedTape", "loiter", "manualReversion", "avenger", "closeAirSupport", "survivability"];
    for (const id of pool) expect(getCard(id).pool).toBe("hog");
    expect(getRelic(JETS.hog.relic).jet).toBe("hog");
    expect(JETS.hog.deck).toHaveLength(10);
  });

  it("keeps Plating between turns, spends it after Shield, and caps it", () => {
    const meta = freshMeta();
    const run = createRun("hog", 3, meta);
    const combat = fight(run, "a1-habicht", ["bathtub", "flarePop"]);
    expect(combat.player.status.plating).toBe(8);
    performPlayCard(run, 0, null);
    expect(combat.player.status.plating).toBe(13);
    const enemy = combat.enemies[0];
    enemy.moves = [{ ...enemy.moves[0], damage: 4, hits: 1 }];
    enemy.movePtr = 0;
    const hp = run.hp;
    performEndTurn(run);
    expect(run.hp).toBe(hp);
    expect(run.combat!.player.status.plating).toBe(13 - 4 + 4);
    run.combat!.player.status.plating = PLATING_CAP - 1;
    run.combat!.hand = [{ uid: 990, id: "speedTape" }];
    run.combat!.energy = 3;
    performPlayCard(run, 0, null);
    expect(run.combat!.player.status.plating).toBe(PLATING_CAP);
  });

  it("fires armor-piercing gun cards and scales its payoffs with Plating", () => {
    const meta = freshMeta();
    const run = createRun("hog", 4, meta);
    const combat = fight(run, "a2-adler", ["brrt", "maverick", "bathtubCharge"], 9);
    const adler = combat.enemies[0];
    expect(adler.status.armor).toBeGreaterThan(0);
    let before = adler.hp;
    performPlayCard(run, 0, adler.uid);
    expect(before - adler.hp).toBe(12);
    combat.player.status.plating = 20;
    before = adler.hp;
    performPlayCard(run, 0, adler.uid);
    expect(before - adler.hp).toBe(20 - adler.status.armor);
    before = adler.hp;
    performPlayCard(run, 0, adler.uid);
    expect(before - adler.hp).toBe(Math.max(0, 4 + 10 - adler.status.armor));
  });

  it("runs its systems: Loiter, Close Air Support, Manual Reversion", () => {
    const meta = freshMeta();
    const run = createRun("hog", 6, meta);
    const combat = fight(run, "a1-kiebitz", ["loiter", "closeAirSupport", "manualReversion", "gunBurst"], 6);
    performPlayCard(run, 0, null);
    performPlayCard(run, 0, null);
    performPlayCard(run, 0, null);
    const plating = combat.player.status.plating;
    performPlayCard(run, 0, combat.enemies[0].uid);
    expect(combat.player.status.plating).toBe(plating + 2);
    expect(combat.energy).toBe(1);
    combat.player.status.plating = 0;
    const enemy = combat.enemies[0];
    enemy.moves = [{ ...enemy.moves[0], damage: 30, hits: 1 }];
    enemy.movePtr = 0;
    enemy.status.jam = 0;
    performEndTurn(run);
    expect(run.combat!.player.status.plating).toBeGreaterThanOrEqual(4 + 3);
  });
});

describe("new relics", () => {
  it("Drop Tank adds Energy on turn 1, Gun Camera heals on a kill, Afterburner Leak trades Thrust for Burn", () => {
    const meta = freshMeta();
    const run = createRun("kite", 9, meta);
    run.relics.push("dropTank", "gunCamera", "afterburnerLeak");
    run.hp = 40;
    startEncounter(run, "a1-kiebitz");
    const combat = run.combat!;
    expect(combat.energy).toBe(4);
    expect(combat.player.status.thrust).toBe(2);
    expect(combat.player.status.burn).toBeGreaterThan(0);
    expect(getRelic("afterburnerLeak").kind).toBe("curse");
    combat.enemies[0].hp = 1;
    combat.enemies[0].shield = 0;
    combat.hand = [{ uid: 700, id: "gunBurst" }];
    const hp = run.hp;
    performPlayCard(run, 0, combat.enemies[0].uid);
    expect(run.hp).toBe(hp + 3);
  });
});

describe("new mystery events", () => {
  it("adds eight events with three real choices each", () => {
    for (const id of NEW_EVENTS) {
      const event = EVENTS.find((candidate) => candidate.id === id);
      expect(event, id).toBeTruthy();
      expect(event!.choices).toHaveLength(3);
      expect(event!.body.length).toBeGreaterThan(60);
    }
  });

  it("resolves every choice of every event without breaking the run", () => {
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        const meta = freshMeta();
        const run = createRun("lattice", 31, meta);
        run.gold = 200;
        run.relics.push("auxTank");
        run.event = { id: event.id, done: false, counted: false, result: "" };
        run.screen = "event";
        const deck = run.deck.length;
        const result = chooseEvent(run, meta, choice.id);
        expect(result.ok, `${event.id}:${choice.id}`).toBe(true);
        expect(["event", "reward", "remove", "combat", "map"]).toContain(run.screen);
        expect(run.hp).toBeGreaterThan(0);
        expect(run.hp).toBeLessThanOrEqual(run.maxHp);
        if (event.id === "simbay" && choice.id !== "nap") {
          expect(run.deck).toHaveLength(deck);
          expect(run.deck.filter((card) => getCard(card.id).rarity === "starter").length).toBe(deck - 2);
        }
        if (event.id === "numbers" && choice.id === "copy") expect(run.deck.some((card) => card.id === "airframeCrack")).toBe(true);
        if (event.id === "fuelcash" && choice.id === "sell") expect(run.maxHp).toBe(createRun("lattice", 31, freshMeta()).maxHp - 6);
      }
    }
  });
});
