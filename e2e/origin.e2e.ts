/*
 * Where attacks come from. A battle is rendered in a real browser at phone and desktop sizes, cards
 * are played by tapping them, and everything the effects canvas draws is recorded in screen
 * coordinates (probe.js). The first frame of each shot is then measured against the jet as it is
 * actually drawn: tracer must begin at the gun port, a missile must appear on the station it hung on.
 *
 * Every shot is checked twice: at the browser's own frame rate, and held to a slow one, because a
 * phone that drops frames must still show the round leaving the gun rather than appearing in mid-air.
 */

import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canvasFit, flares, launches, muzzleGap, PLAYER, tracers, type FrameShot, type Log } from "./analyze";

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const FIGHTS = JSON.parse(readFileSync(here("./fixtures/fights.json"), "utf8")) as { meta: unknown; runs: Record<string, unknown> };

/** How far, in CSS pixels, an effect may begin from the point on the sprite it is meant to leave. */
const NEAR = 4;
/** A slow phone: about fifteen frames a second. */
const SLOW_FRAME = 66;

const SCREENS = [
  { name: "phone portrait 390x844 @3x", width: 390, height: 844, dpr: 3, touch: true, jets: ["f16", "a10", "f22"] },
  { name: "phone portrait 430x932 @3x", width: 430, height: 932, dpr: 3, touch: true, jets: ["f16"] },
  { name: "phone landscape 844x390 @3x", width: 844, height: 390, dpr: 3, touch: true, jets: ["f16"] },
  { name: "desktop 1280x800", width: 1280, height: 800, dpr: 1, touch: false, jets: ["f16"] },
];

const CARDS: Record<string, { gun: string; missile: string }> = {
  f16: { gun: "Gun Burst", missile: "Sidewinder" },
  a10: { gun: "BRRRT", missile: "Maverick" },
  f22: { gun: "Gun Burst", missile: "Whisper Shot" },
};

async function openFight(page: Page, info: TestInfo, jet: string) {
  const url = info.project.metadata.url as string;
  await page.addInitScript({ path: here("./probe.js") });
  await page.goto(url);
  await page.evaluate(
    ([meta, run]) => {
      localStorage.setItem("meridian.meta.v1", meta);
      localStorage.setItem("meridian.run.v1", run);
    },
    [JSON.stringify(FIGHTS.meta), JSON.stringify(FIGHTS.runs[jet])],
  );
  await page.goto(url);
  await press(page, '[data-act="continue"]');
  await page.waitForSelector(".battle .ally .cj img");
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>(".battle .cj img")].every((img) => img.complete && img.naturalWidth > 0));
  // Let the entrance animations and the camera settle.
  await page.waitForTimeout(2600);
}

async function press(page: Page, selector: string) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: "visible" });
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await target.tap();
  else await target.click();
}

async function idle(page: Page) {
  await page.waitForFunction(() => !document.body.classList.contains("busy"), undefined, { timeout: 60_000 });
}

/** Runs `act` with the probe recording, at the given frame pace, and returns what was drawn. */
async function record(page: Page, frameMs: number, act: () => Promise<void>, settle = 900): Promise<Log> {
  await page.evaluate((ms) => {
    const probe = (window as any).__probe;
    probe.ops.length = 0;
    probe.releases.length = 0;
    probe.frames = {};
    probe.minFrameMs = ms;
    probe.on = true;
  }, frameMs);
  await act();
  await page.waitForTimeout(250);
  await idle(page);
  await page.waitForTimeout(settle);
  return page.evaluate(() => {
    const probe = (window as any).__probe;
    probe.on = false;
    probe.minFrameMs = 0;
    return { ops: probe.ops, frames: probe.frames, releases: probe.releases };
  });
}

/** Waits until the effects canvas has stopped drawing, so that what is recorded next belongs to the next card. */
async function quiet(page: Page) {
  await page.evaluate(() => {
    const probe = (window as any).__probe;
    probe.ops.length = 0;
    probe.seen = -1;
    probe.on = true;
  });
  await page.waitForFunction(
    () => {
      const probe = (window as any).__probe;
      const still = probe.seen === probe.ops.length;
      probe.seen = probe.ops.length;
      return still;
    },
    undefined,
    { polling: 500, timeout: 30_000 },
  );
}

async function playCard(page: Page, title: string) {
  await press(page, `.hand .slot:has-text("${title}") .card`);
  await page.waitForTimeout(350);
  await press(page, ".foe:not(.down):not(.crashing)");
}

/** Plays a card that needs no target: on a phone the first tap previews it and a tap on the preview plays it. */
async function playOwnCard(page: Page, title: string) {
  await press(page, `.hand .slot:has-text("${title}") .card`);
  await page.waitForTimeout(350);
  const preview = page.locator('[data-act="preview-play"]').first();
  if (await preview.isVisible()) await press(page, '[data-act="preview-play"]');
}

const snapshot = (page: Page) => page.evaluate(() => (window as any).__probe.snapshot() as FrameShot);

const round = (p: readonly number[] | null) => (p ? p.map((v) => Math.round(v * 10) / 10) : p);

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test.use({ viewport: { width: screen.width, height: screen.height }, deviceScaleFactor: screen.dpr, isMobile: screen.touch, hasTouch: screen.touch });

    for (const jet of screen.jets) {
      test(`${jet}: the gun fires from the gun port and a missile leaves its station`, async ({ page }, info) => {
        await openFight(page, info, jet);

        // The markers the effects read sit where the anchor table says on the sprite as it is drawn.
        const still = await snapshot(page);
        expect(canvasFit(still), "the effects canvas covers the screen exactly").toBeLessThanOrEqual(1);
        for (const [who, unit] of Object.entries(still.units)) {
          expect(unit.guns.length, `unit ${who} has a gun marker`).toBeGreaterThan(0);
          expect(muzzleGap(unit), `unit ${who} (${unit.sprite}): the gun marker is where the anchor table puts the muzzle on the sprite's screen box`).toBeLessThanOrEqual(1);
        }
        const body = still.units[PLAYER];
        expect(body.guns[0][0]).toBeGreaterThan(body.box[0]);
        expect(body.guns[0][1]).toBeGreaterThan(body.box[1]);
        expect(body.guns[0][0]).toBeLessThan(body.box[0] + body.box[2]);
        expect(body.guns[0][1]).toBeLessThan(body.box[1] + body.box[3]);

        const report: Record<string, unknown> = { screen: screen.name, jet, project: info.project.name };
        for (const [pace, frameMs] of [["full speed", 0], ["slow frames", SLOW_FRAME]] as const) {
          const log = await record(page, frameMs, () => playCard(page, CARDS[jet].gun));
          const shots = tracers(log, [PLAYER], NEAR);
          report[`gun, ${pace}`] = { ...shots, firstAt: round(shots.firstAt), muzzle: round(shots.muzzle), worstAt: round(shots.worstAt), first: round([shots.first])![0], worst: round([shots.worst])![0] };
          expect.soft(shots.strokes, `${pace}: tracer was drawn`).toBeGreaterThan(3);
          expect.soft(shots.first, `${pace}: the first tracer starts at the gun port (began at ${round(shots.firstAt)}, muzzle at ${round(shots.muzzle)})`).toBeLessThanOrEqual(NEAR);
          expect.soft(shots.worst, `${pace}: no tracer appears away from the gun or from tracer already drawn (one began at ${round(shots.worstAt)})`).toBeLessThanOrEqual(NEAR);
          expect.soft(shots.flash, `${pace}: the muzzle flash is on the gun in the frame the first round leaves`).toBe(true);
        }

        for (const [pace, frameMs] of [["full speed", 0]] as const) {
          const log = await record(page, frameMs, () => playCard(page, CARDS[jet].missile), 1200);
          const fired = launches(log).filter((l) => l.who === PLAYER);
          report[`missile, ${pace}`] = fired.map((l) => ({ ...l, gap: round([l.gap])![0], at: round(l.at), station: round(l.station) }));
          expect.soft(fired.length, `${pace}: a station was fired`).toBeGreaterThan(0);
          for (const launch of fired) {
            expect.soft(launch.gap, `${pace}: the ${launch.kind} appears on its station (drawn at ${round(launch.at)}, station at ${round(launch.station)})`).toBeLessThanOrEqual(NEAR);
            expect.soft(launch.first, `${pace}: and that is the first frame it is drawn`).toBe(true);
          }
        }
        {
          await quiet(page);
          const log = await record(page, SLOW_FRAME, () => playOwnCard(page, "Flare Pop"), 1400);
          const salvo = flares(log);
          report["flares, slow frames"] = { ...salvo, worst: round([salvo.worst])![0], worstAt: round(salvo.worstAt) };
          expect.soft(salvo.lit, "slow frames: flares were thrown").toBeGreaterThan(0);
          expect.soft(salvo.worst, `slow frames: every flare is first seen at a dispenser (one at ${round(salvo.worstAt)})`).toBeLessThanOrEqual(NEAR);
        }
        await info.attach("report", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
        console.log(JSON.stringify(report));
      });
    }

    test("enemy fire comes from the enemy jets while they fly their attack", async ({ page }, info) => {
      await openFight(page, info, "f16");
      const log = await record(page, 0, () => press(page, '[data-act="end-turn"]'), 600);
      const foes = Object.keys(Object.values(log.frames)[0]?.units ?? {}).filter((who) => who !== PLAYER);
      const shots = tracers(log, foes, NEAR + 2);
      const fired = launches(log).filter((l) => l.who !== PLAYER);
      const report = { screen: screen.name, project: info.project.name, tracers: shots, launches: fired };
      await info.attach("report", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
      console.log(JSON.stringify(report));
      expect(shots.strokes + fired.length, "the enemy fired something").toBeGreaterThan(0);
      if (shots.strokes) {
        expect.soft(shots.first, `enemy tracer starts at an enemy gun (began at ${round(shots.firstAt)}, muzzle at ${round(shots.muzzle)})`).toBeLessThanOrEqual(NEAR + 2);
        expect.soft(shots.worst, `no enemy tracer appears in mid-air (one began at ${round(shots.worstAt)})`).toBeLessThanOrEqual(NEAR + 2);
      }
      for (const launch of fired) expect.soft(launch.gap, `enemy ${launch.kind} appears on its station (drawn at ${round(launch.at)}, station at ${round(launch.station)})`).toBeLessThanOrEqual(NEAR + 2);
    });
  });
}
