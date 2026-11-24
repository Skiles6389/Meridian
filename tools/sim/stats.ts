import { getCard } from "../../src/game/cards";
import { getRelic } from "../../src/game/relics";
import type { RunRecord } from "./runner";

export interface Rate {
  n: number;
  rate: number;
  /** Half-width of a 95% confidence interval. */
  ci: number;
}

export function rate(hits: number, n: number): Rate {
  const p = n ? hits / n : 0;
  return { n, rate: p, ci: n ? 1.96 * Math.sqrt((p * (1 - p)) / n) : 0 };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

export interface GroupSummary {
  jet: string;
  bot: string;
  win: Rate;
  /** Share of all runs that died in each act. */
  deathsByAct: number[];
  /** Of the runs that reached each act, the share that cleared it. */
  clearByAct: number[];
  stalls: number;
  avgFights: number;
  winHpPct: number;
  bossHpPct: number[];
  goldByAct: number[];
  healByAct: number[];
}

export interface EncounterSummary {
  enc: string;
  act: number;
  kind: string;
  n: number;
  deaths: number;
  deathRate: number;
  /** Damage taken as a share of max HP. */
  meanLoss: number;
  sdLoss: number;
  p90Loss: number;
  meanTurns: number;
}

export interface LiftRow {
  id: string;
  name: string;
  rarity: string;
  pool: string;
  offered: number;
  taken: number;
  pickRate: number;
  /** Win rate after taking it, minus the win rate of all runs alive at that point. */
  lift: number;
  liftN: number;
  /** Among random picks only: win rate when taken minus win rate when offered and passed over. */
  randomLift: number;
  randomN: number;
}

export interface RelicRow {
  id: string;
  name: string;
  kind: string;
  count: number;
  lift: number;
  bySource: Record<string, number>;
}

export interface ChoiceRow {
  kind: string;
  id: string;
  choice: string;
  n: number;
  lift: number;
  randomN: number;
  randomWin: number;
  hpDelta: number;
  goldDelta: number;
}

export interface Summary {
  runs: number;
  groups: GroupSummary[];
  encounters: EncounterSummary[];
  deathSpots: { where: string; share: number; count: number }[];
  cards: LiftRow[];
  relics: RelicRow[];
  choices: ChoiceRow[];
  gambleResults: { result: string; count: number; lift: number }[];
  economy: {
    goldEarnedByAct: number[];
    spend: Record<string, number>;
    shopVisits: number;
    shopGold: number;
    shopSpend: number;
    heals: Record<string, number>;
    removalsPerRun: number;
  };
}

/** Win rate for runs still flying after `index` fights, per jet and bot, as a baseline for lift. */
function survivalBaseline(records: RunRecord[]) {
  const table = new Map<string, { wins: number[]; alive: number[] }>();
  for (const rec of records) {
    const key = `${rec.jet}|${rec.bot}`;
    if (!table.has(key)) table.set(key, { wins: [], alive: [] });
    const row = table.get(key)!;
    const survived = rec.fights.filter((fight) => !fight.died).length;
    for (let i = 0; i <= survived; i++) {
      row.alive[i] = (row.alive[i] ?? 0) + 1;
      if (rec.win) row.wins[i] = (row.wins[i] ?? 0) + 1;
    }
  }
  return (rec: RunRecord, index: number) => {
    const row = table.get(`${rec.jet}|${rec.bot}`)!;
    const alive = row.alive[index] ?? 0;
    return alive ? (row.wins[index] ?? 0) / alive : 0;
  };
}

export function summarize(records: RunRecord[]): Summary {
  const baseline = survivalBaseline(records);
  const groups: GroupSummary[] = [];
  const keys = [...new Set(records.map((rec) => `${rec.jet}|${rec.bot}`))];
  for (const key of keys) {
    const [jet, bot] = key.split("|");
    const runs = records.filter((rec) => rec.jet === jet && rec.bot === bot);
    const wins = runs.filter((rec) => rec.win);
    const deathsByAct = [1, 2, 3].map((act) => runs.filter((rec) => !rec.win && rec.act === act).length / runs.length);
    const clearByAct = [1, 2, 3].map((act) => {
      const reached = runs.filter((rec) => rec.act >= act).length;
      const cleared = runs.filter((rec) => rec.act > act || rec.win).length;
      return reached ? cleared / reached : 0;
    });
    const bossHpPct = [1, 2, 3].map((act) =>
      mean(runs.flatMap((rec) => rec.fights.filter((fight) => fight.kind === "boss" && fight.act === act).map((fight) => fight.hpBefore / fight.maxHp))),
    );
    groups.push({
      jet,
      bot,
      win: rate(wins.length, runs.length),
      deathsByAct,
      clearByAct,
      stalls: runs.filter((rec) => rec.stalled).length,
      avgFights: mean(runs.map((rec) => rec.fights.length)),
      winHpPct: mean(wins.map((rec) => rec.finalHp / rec.maxHp)),
      bossHpPct,
      goldByAct: [0, 1, 2].map((i) => mean(runs.filter((rec) => rec.act > i || rec.win).map((rec) => rec.goldByAct[i]))),
      healByAct: [0, 1, 2].map((i) => mean(runs.filter((rec) => rec.act > i || rec.win).map((rec) => rec.healsByAct[i]))),
    });
  }

  const encMap = new Map<string, { act: number; kind: string; losses: number[]; turns: number[]; deaths: number }>();
  for (const rec of records) {
    for (const fight of rec.fights) {
      const key = fight.enc;
      if (!encMap.has(key)) encMap.set(key, { act: fight.act, kind: fight.kind, losses: [], turns: [], deaths: 0 });
      const row = encMap.get(key)!;
      row.losses.push(fight.died ? 1 : (fight.hpBefore - fight.hpAfter) / fight.maxHp);
      row.turns.push(fight.turns);
      if (fight.died) row.deaths += 1;
    }
  }
  const encounters = [...encMap.entries()]
    .map(([enc, row]) => ({
      enc,
      act: row.act,
      kind: row.kind,
      n: row.losses.length,
      deaths: row.deaths,
      deathRate: row.deaths / row.losses.length,
      meanLoss: mean(row.losses),
      sdLoss: sd(row.losses),
      p90Loss: quantile(row.losses, 0.9),
      meanTurns: mean(row.turns),
    }))
    .sort((a, b) => a.act - b.act || a.kind.localeCompare(b.kind) || a.enc.localeCompare(b.enc));

  const losses = records.filter((rec) => !rec.win && rec.death);
  const spotMap = new Map<string, number>();
  for (const rec of losses) spotMap.set(rec.death!.where, (spotMap.get(rec.death!.where) ?? 0) + 1);
  const deathSpots = [...spotMap.entries()]
    .map(([where, count]) => ({ where, count, share: count / Math.max(1, losses.length) }))
    .sort((a, b) => b.count - a.count);

  const cardMap = new Map<string, { offered: number; taken: number; lift: number[]; rTaken: number[]; rPassed: number[] }>();
  const cardRow = (id: string) => {
    if (!cardMap.has(id)) cardMap.set(id, { offered: 0, taken: 0, lift: [], rTaken: [], rPassed: [] });
    return cardMap.get(id)!;
  };
  for (const rec of records) {
    for (const pick of rec.picks) {
      if (pick.source === "shop") {
        for (const id of pick.offered) cardRow(id).offered += 1;
        if (pick.taken) {
          cardRow(pick.taken).taken += 1;
          cardRow(pick.taken).lift.push(Number(rec.win) - baseline(rec, pick.index));
        }
        continue;
      }
      for (const id of new Set(pick.offered)) {
        const row = cardRow(id);
        row.offered += 1;
        if (pick.random) (pick.taken === id ? row.rTaken : row.rPassed).push(Number(rec.win));
      }
      if (pick.taken) {
        const row = cardRow(pick.taken);
        row.taken += 1;
        row.lift.push(Number(rec.win) - baseline(rec, pick.index));
      }
    }
  }
  const cards = [...cardMap.entries()]
    .map(([id, row]) => {
      const def = getCard(id);
      return {
        id,
        name: def.name,
        rarity: def.rarity,
        pool: def.pool,
        offered: row.offered,
        taken: row.taken,
        pickRate: row.offered ? row.taken / row.offered : 0,
        lift: mean(row.lift),
        liftN: row.lift.length,
        randomLift: row.rTaken.length && row.rPassed.length ? mean(row.rTaken) - mean(row.rPassed) : 0,
        randomN: row.rTaken.length,
      };
    })
    .sort((a, b) => b.lift - a.lift);

  const relicMap = new Map<string, { lift: number[]; bySource: Record<string, number> }>();
  for (const rec of records) {
    for (const relic of rec.relics) {
      if (!relicMap.has(relic.id)) relicMap.set(relic.id, { lift: [], bySource: {} });
      const row = relicMap.get(relic.id)!;
      row.lift.push(Number(rec.win) - baseline(rec, relic.index));
      row.bySource[relic.source] = (row.bySource[relic.source] ?? 0) + 1;
    }
  }
  const relics = [...relicMap.entries()]
    .map(([id, row]) => ({ id, name: getRelic(id).name, kind: getRelic(id).kind, count: row.lift.length, lift: mean(row.lift), bySource: row.bySource }))
    .sort((a, b) => b.lift - a.lift);

  const choiceMap = new Map<string, { kind: string; id: string; choice: string; lift: number[]; random: number[]; hp: number[]; gold: number[] }>();
  for (const rec of records) {
    for (const decision of rec.decisions) {
      const key = `${decision.kind}|${decision.id}|${decision.choice}`;
      if (!choiceMap.has(key)) choiceMap.set(key, { kind: decision.kind, id: decision.id, choice: decision.choice, lift: [], random: [], hp: [], gold: [] });
      const row = choiceMap.get(key)!;
      row.lift.push(Number(rec.win) - baseline(rec, decision.index));
      if (decision.random) row.random.push(Number(rec.win));
      row.hp.push(decision.hpDelta);
      row.gold.push(decision.goldDelta);
    }
  }
  const choices = [...choiceMap.values()]
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      choice: row.choice,
      n: row.lift.length,
      lift: mean(row.lift),
      randomN: row.random.length,
      randomWin: mean(row.random),
      hpDelta: mean(row.hp),
      goldDelta: mean(row.gold),
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || a.choice.localeCompare(b.choice));

  const gambleMap = new Map<string, number[]>();
  for (const rec of records) {
    for (const decision of rec.decisions) {
      if (decision.kind !== "gamble" || decision.choice !== "take") continue;
      const key = decision.result.split(":")[0] === "curse" ? `curse:${decision.result.split(":")[1]}` : decision.result.startsWith("buff") ? "buff" : decision.result;
      if (!gambleMap.has(key)) gambleMap.set(key, []);
      gambleMap.get(key)!.push(Number(rec.win) - baseline(rec, decision.index));
    }
  }
  const gambleResults = [...gambleMap.entries()].map(([result, lifts]) => ({ result, count: lifts.length, lift: mean(lifts) })).sort((a, b) => b.count - a.count);

  const spend: Record<string, number> = { cards: 0, relics: 0, heal: 0, removal: 0, events: 0 };
  const heals: Record<string, number> = { reward: 0, shop: 0, event: 0, intermission: 0, combat: 0, afterFight: 0 };
  for (const rec of records) {
    spend.cards += rec.gold.spentCards;
    spend.relics += rec.gold.spentRelics;
    spend.heal += rec.gold.spentHeal;
    spend.removal += rec.gold.spentRemoval;
    spend.events += rec.gold.spentEvents;
    for (const key of Object.keys(heals)) heals[key] += rec.heals[key as keyof typeof rec.heals];
  }
  for (const key of Object.keys(spend)) spend[key] /= records.length;
  for (const key of Object.keys(heals)) heals[key] /= records.length;
  const shops = records.flatMap((rec) => rec.shops);
  return {
    runs: records.length,
    groups,
    encounters,
    deathSpots,
    cards,
    relics,
    choices,
    gambleResults,
    economy: {
      goldEarnedByAct: [0, 1, 2].map((i) => mean(records.filter((rec) => rec.act > i || rec.win).map((rec) => rec.goldByAct[i]))),
      spend,
      shopVisits: shops.length / records.length,
      shopGold: mean(shops.map((shop) => shop.gold)),
      shopSpend: mean(shops.map((shop) => shop.spent)),
      heals,
      removalsPerRun: mean(records.map((rec) => rec.removals)),
    },
  };
}

const pc = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const signed = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;

export function markdown(summary: Summary, title: string): string {
  const out: string[] = [`# ${title}`, "", `${summary.runs} simulated runs.`, ""];
  out.push("## Win rate", "", "| Jet | Bot | Runs | Win | ±95% | Died A1 | Died A2 | Died A3 | Clear A1 | Clear A2 | Clear A3 | HP at bosses (A1/A2/A3) | Stalls |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const g of summary.groups) {
    out.push(
      `| ${g.jet} | ${g.bot} | ${g.win.n} | ${pc(g.win.rate)} | ${pc(g.win.ci)} | ${g.deathsByAct.map((x) => pc(x)).join(" | ")} | ${g.clearByAct.map((x) => pc(x, 0)).join(" | ")} | ${g.bossHpPct.map((x) => pc(x, 0)).join(" / ")} | ${g.stalls} |`,
    );
  }
  out.push("", "## Encounters", "", "Loss is HP lost as a share of max HP (a death counts as 100%).", "", "| Encounter | Act | Kind | Fights | Death rate | Mean loss | SD | P90 | Turns |", "|---|---|---|---|---|---|---|---|---|");
  for (const e of summary.encounters) {
    out.push(`| ${e.enc} | ${e.act} | ${e.kind} | ${e.n} | ${pc(e.deathRate)} | ${pc(e.meanLoss)} | ${pc(e.sdLoss)} | ${pc(e.p90Loss)} | ${e.meanTurns.toFixed(1)} |`);
  }
  out.push("", "## Where runs end", "", "| Spot | Share of losses |", "|---|---|");
  for (const spot of summary.deathSpots.slice(0, 15)) out.push(`| ${spot.where} | ${pc(spot.share)} (${spot.count}) |`);
  out.push("", "## Cards", "", "Lift is the win rate after taking the card minus the win rate of every run alive at that point, in points. Random lift compares random picks that took the card against random picks that passed it over.", "", "| Card | Rarity | Pool | Offered | Pick rate | Lift | Random lift (n) |", "|---|---|---|---|---|---|---|");
  for (const c of summary.cards) {
    out.push(`| ${c.name} | ${c.rarity} | ${c.pool} | ${c.offered} | ${pc(c.pickRate, 0)} | ${signed(c.lift)} (${c.liftN}) | ${c.randomN ? `${signed(c.randomLift)} (${c.randomN})` : "–"} |`);
  }
  out.push("", "## Relics", "", "| Relic | Kind | Acquired | Lift | Sources |", "|---|---|---|---|---|");
  for (const r of summary.relics) {
    out.push(`| ${r.name} | ${r.kind} | ${r.count} | ${signed(r.lift)} | ${Object.entries(r.bySource).map(([k, v]) => `${k} ${v}`).join(", ")} |`);
  }
  out.push("", "## Choices", "", "| Node | Id | Choice | Times | Lift | Random win (n) | HP Δ | Gold Δ |", "|---|---|---|---|---|---|---|---|");
  for (const c of summary.choices) {
    out.push(`| ${c.kind} | ${c.id} | ${c.choice} | ${c.n} | ${signed(c.lift)} | ${c.randomN ? `${pc(c.randomWin)} (${c.randomN})` : "–"} | ${c.hpDelta.toFixed(1)} | ${c.goldDelta.toFixed(1)} |`);
  }
  out.push("", "## Gamble outcomes", "", "| Result | Count | Lift |", "|---|---|---|");
  for (const g of summary.gambleResults) out.push(`| ${g.result} | ${g.count} | ${signed(g.lift)} |`);
  const e = summary.economy;
  out.push(
    "",
    "## Economy (per run)",
    "",
    `- Gold earned by act (runs that reached it): ${e.goldEarnedByAct.map((x) => x.toFixed(0)).join(" / ")}`,
    `- Spend: ${Object.entries(e.spend).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")}`,
    `- Shop visits ${e.shopVisits.toFixed(2)}, gold on entry ${e.shopGold.toFixed(0)}, spent per visit ${e.shopSpend.toFixed(0)}`,
    `- Healing: ${Object.entries(e.heals).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")}`,
    `- Removals per run: ${e.removalsPerRun.toFixed(2)}`,
  );
  return out.join("\n") + "\n";
}
