import { describe, expect, it } from "vitest";
import { JET_ORDER } from "../src/game/jets";
import { makeBot } from "../tools/sim/bots";
import { simulateRun } from "../tools/sim/runner";
import type { RunRecord } from "../tools/sim/runner";
import { markdown, summarize } from "../tools/sim/stats";

const SEEDS = [11, 2027, 90210];

function sane(record: RunRecord) {
  expect(record.fights.length).toBeGreaterThan(0);
  expect(record.win || record.death !== null || record.stalled).toBe(true);
  for (const fight of record.fights) {
    expect(fight.hpBefore).toBeLessThanOrEqual(fight.maxHp);
    expect(fight.hpAfter).toBeGreaterThanOrEqual(0);
    expect(fight.hpAfter).toBeLessThanOrEqual(record.maxHp);
    expect(fight.act).toBeGreaterThanOrEqual(1);
    expect(fight.act).toBeLessThanOrEqual(3);
  }
  if (record.win) {
    expect(record.fights.some((fight) => fight.act === 3 && fight.kind === "boss" && !fight.died)).toBe(true);
    expect(record.finalHp).toBeGreaterThan(0);
  }
  expect(record.finalDeck.length).toBeGreaterThanOrEqual(5);
}

describe("balance simulator smoke", () => {
  for (const kind of ["greedy", "smart"] as const) {
    it(`${kind} bot plays full sorties on every jet without errors`, () => {
      const records: RunRecord[] = [];
      for (const jet of JET_ORDER) {
        for (const seed of SEEDS) {
          const record = simulateRun(jet, seed, makeBot(kind), { explore: kind === "smart" ? 0.3 : 0 });
          sane(record);
          records.push(record);
        }
      }
      const summary = summarize(records);
      expect(summary.groups).toHaveLength(JET_ORDER.length);
      expect(summary.encounters.length).toBeGreaterThan(5);
      expect(markdown(summary, "smoke")).toContain("Win rate");
    });
  }

  it("replays a seed identically", () => {
    const a = simulateRun("kite", 4242, makeBot("smart"), { explore: 0.3 });
    const b = simulateRun("kite", 4242, makeBot("smart"), { explore: 0.3 });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("smart bot clears some sorties on the starter jet, but not all", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => (i + 1) * 7919);
    const wins = seeds.filter((seed) => simulateRun("kite", seed, makeBot("smart")).win).length;
    expect(wins).toBeGreaterThanOrEqual(2);
    expect(wins).toBeLessThanOrEqual(18);
  });
});
