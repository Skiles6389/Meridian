/**
 * Headless balance simulator. Plays full sorties with heuristic bots and writes a report.
 *
 *   npm run sim -- --runs 2000 --bots greedy,smart --explore 0.3 --out sim-out
 *   npm run sim -- --difficulty rookie        (or normal, or a Threat Level 1-10)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import type { JetId } from "../../src/game/types";
import { makeBot } from "./bots";
import { simulateRun } from "./runner";
import type { RunRecord } from "./runner";
import { markdown, summarize } from "./stats";
import { applyTweak } from "./tweak";
import type { Tweak } from "./tweak";

interface Job {
  jet: JetId;
  bot: "greedy" | "smart";
  seed: number;
  explore: number;
  difficulty: number;
}

export function seedFor(base: number, i: number): number {
  return (Math.imul(i + 1, 2654435761) + base) >>> 0 || 1;
}

function parseDifficulty(value: string | undefined): number {
  if (!value || value === "normal") return 0;
  if (value === "rookie") return -1;
  const level = Number(value.replace(/^threat/i, ""));
  if (!Number.isInteger(level) || level < -1 || level > 10) throw new Error(`Unknown difficulty ${value}`);
  return level;
}

function parse(argv: string[]) {
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) opts[key] = "1";
      else {
        opts[key] = next;
        i += 1;
      }
    }
  }
  return {
    runs: Number(opts.runs ?? 200),
    jets: (opts.jets ?? "kite,bulwark,moth,lattice,hog").split(",") as JetId[],
    difficulty: parseDifficulty(opts.difficulty),
    bots: (opts.bots ?? "greedy,smart").split(",") as Job["bot"][],
    explore: Number(opts.explore ?? 0),
    base: Number(opts.seed ?? 1),
    out: opts.out ?? "sim-out",
    workers: Number(opts.workers ?? Math.max(1, availableParallelism())),
    label: opts.label ?? "Dogfight balance simulation",
    records: opts.records !== undefined,
    tweak: opts.tweak ? (JSON.parse(opts.tweak.trim().startsWith("{") ? opts.tweak : readFileSync(opts.tweak, "utf8")) as Tweak) : null,
  };
}

async function main() {
  const opts = parse(process.argv.slice(2));
  const jobs: Job[] = [];
  for (const bot of opts.bots) for (const jet of opts.jets) for (let i = 0; i < opts.runs; i++) jobs.push({ jet, bot, seed: seedFor(opts.base, i), explore: opts.explore, difficulty: opts.difficulty });
  const started = Date.now();
  const records: RunRecord[] = [];
  const self = fileURLToPath(import.meta.url);
  const size = Math.ceil(jobs.length / (opts.workers * 6));
  const chunks: Job[][] = [];
  for (let i = 0; i < jobs.length; i += size) chunks.push(jobs.slice(i, i + size));
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(opts.workers, chunks.length) }, () => {
      const worker = new Worker(self, { workerData: { child: true, tweak: opts.tweak } });
      return new Promise<void>((resolve, reject) => {
        const feed = () => {
          if (next >= chunks.length) {
            void worker.terminate();
            resolve();
            return;
          }
          worker.postMessage(chunks[next++]);
        };
        worker.on("message", (batch: RunRecord[]) => {
          records.push(...batch);
          done += batch.length;
          process.stderr.write(`\r${done}/${jobs.length} runs`);
          feed();
        });
        worker.on("error", reject);
        feed();
      });
    }),
  );
  process.stderr.write(`\n${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  records.sort((a, b) => a.bot.localeCompare(b.bot) || a.jet.localeCompare(b.jet) || a.seed - b.seed);
  const summary = summarize(records);
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(join(opts.out, "summary.json"), JSON.stringify(summary, null, 1));
  writeFileSync(join(opts.out, "report.md"), markdown(summary, opts.label));
  if (opts.records) writeFileSync(join(opts.out, "records.json"), JSON.stringify(records));
  for (const g of summary.groups) {
    console.log(
      `${g.bot.padEnd(6)} ${g.jet.padEnd(8)} win ${(g.win.rate * 100).toFixed(1).padStart(5)}% ±${(g.win.ci * 100).toFixed(1)}  died A1 ${(g.deathsByAct[0] * 100).toFixed(1)}%  A2 ${(g.deathsByAct[1] * 100).toFixed(1)}%  A3 ${(g.deathsByAct[2] * 100).toFixed(1)}%  stalls ${g.stalls}`,
    );
  }
}

if (isMainThread) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else if (workerData?.child) {
  if (workerData.tweak) applyTweak(workerData.tweak);
  const bots = { greedy: makeBot("greedy"), smart: makeBot("smart") };
  parentPort!.on("message", (chunk: Job[]) => {
    parentPort!.postMessage(chunk.map((job) => simulateRun(job.jet, job.seed, bots[job.bot], { explore: job.explore, difficulty: job.difficulty })));
  });
}
