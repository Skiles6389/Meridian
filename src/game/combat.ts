import { getCard } from "./cards";
import { scaleFighter } from "./difficulty";
import { getEncounter, spawnFighter } from "./enemies";
import type { EncounterDef } from "./enemies";
import { RNG } from "./rng";
import { freshStatus } from "./types";
import type { CardDef, CardInst, Effect, Fighter, Plan, RunState, Status } from "./types";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** The player's id in combat effect events; enemy uids are always positive. */
export const PLAYER = -1;

/**
 * Presentation events emitted while combat resolves, so the UI can animate
 * hits and moves in order. They never feed back into game state.
 */
export type CombatFx =
  | { t: "hit"; who: number; from: number; amount: number; blocked: number; hp: number; shield: number }
  | { t: "evade"; who: number; from: number }
  | { t: "burn"; who: number; amount: number; hp: number }
  | { t: "move"; uid: number; kind: Plan["kind"]; name: string }
  | { t: "shield"; who: number; amount: number; shield: number }
  | { t: "heal"; who: number; amount: number; hp: number }
  | { t: "status"; who: number; k: string; n: number }
  | { t: "down"; who: number }
  | { t: "phase"; uid: number; text: string }
  | { t: "turn"; n: number };

let fxSink: ((event: CombatFx) => void) | null = null;

export function setCombatFxSink(sink: ((event: CombatFx) => void) | null) {
  fxSink = sink;
}

function fx(run: RunState, event: CombatFx) {
  if (fxSink && !run.scratch) fxSink(event);
}

const HAND_LIMIT = 10;
const FULL_SPECIALS = new Set([
  "stitchFire",
  "leadPursuit",
  "holdFire",
  "overpressure",
  "merge",
  "whisperShot",
  "heatSink",
  "burnThrough",
  "dataSpike",
  "cycleSteal",
  "maverick",
  "bathtubCharge",
]);

export const PLATING_CAP = 30;

export function livingEnemies(run: RunState): Fighter[] {
  return run.combat?.enemies.filter((enemy) => enemy.hp > 0) ?? [];
}

function log(run: RunState, message: string) {
  const combat = run.combat;
  if (!combat) return;
  combat.log.push(message);
  if (combat.log.length > 48) combat.log.splice(0, combat.log.length - 48);
}

function rngOf(run: RunState): RNG {
  const rng = new RNG(1);
  rng.state = run.rngState || 1;
  return rng;
}

function saveRng(run: RunState, rng: RNG) {
  run.rngState = rng.state;
}

function has(run: RunState, id: string): boolean {
  return run.relics.includes(id);
}

function powerCount(run: RunState, id: string): number {
  return run.combat?.powers.filter((power) => power === id).length ?? 0;
}

export function maxEnergy(run: RunState): number {
  return 3 + (has(run, "busTie") ? 1 : 0);
}

export function cardCost(run: RunState, def: CardDef): number {
  const combat = run.combat;
  if (!combat) return def.cost;
  let cost = def.cost;
  if ((def.special === "unseenStrike" || def.id === "unseenStrike") && combat.player.status.evasion >= 3) {
    cost -= 1;
  }
  if (def.type === "attack" && combat.attacksThisTurn === 0 && has(run, "vectorVanes")) cost -= 1;
  return Math.max(0, cost);
}

function heal(run: RunState, amount: number): number {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + Math.max(0, amount));
  if (run.hp > before) fx(run, { t: "heal", who: PLAYER, amount: run.hp - before, hp: run.hp });
  return run.hp - before;
}

function selfHarm(run: RunState, amount: number) {
  const before = run.hp;
  hurt(run, amount);
  fx(run, { t: "burn", who: PLAYER, amount: before - run.hp, hp: run.hp });
}

function hurt(run: RunState, amount: number): boolean {
  if (amount <= 0) return false;
  const combat = run.combat;
  run.hp -= amount;
  if (run.hp <= 0 && combat && has(run, "ejectionSeat") && !combat.ejectionUsed) {
    run.hp = 1;
    combat.ejectionUsed = true;
    log(run, "Ejection seat catches you at 1 HP.");
    return false;
  }
  if (run.hp <= 0) {
    run.hp = 0;
    if (combat) combat.outcome = "lost";
    log(run, "Airframe lost.");
    return true;
  }
  return false;
}

function gainShield(run: RunState, base: number): number {
  const combat = run.combat;
  if (!combat || base <= 0) return 0;
  let amount = base;
  if (has(run, "stabilators")) amount += 1;
  if (has(run, "smokedOptics")) amount -= 1;
  amount = Math.max(0, amount);
  combat.player.shield += amount;
  if (amount > 0) fx(run, { t: "shield", who: PLAYER, amount, shield: combat.player.shield });
  return amount;
}

function gainPlating(run: RunState, base: number): number {
  const combat = run.combat;
  if (!combat || base <= 0) return 0;
  const status = combat.player.status;
  const amount = Math.max(0, Math.min(base, PLATING_CAP - status.plating));
  status.plating += amount;
  if (amount > 0) fx(run, { t: "status", who: PLAYER, k: "plating", n: amount });
  return amount;
}

function enemyDowned(run: RunState) {
  if (!has(run, "gunCamera")) return;
  const gained = heal(run, 3);
  if (gained) log(run, `Gun Camera: heal ${gained}.`);
}

function draw(run: RunState, rng: RNG, count: number): number {
  const combat = run.combat;
  if (!combat || count <= 0) return 0;
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (combat.hand.length >= HAND_LIMIT) {
      log(run, "Hand is full.");
      break;
    }
    if (combat.draw.length === 0) {
      if (combat.discard.length === 0) break;
      combat.draw = rng.shuffle(combat.discard);
      combat.discard = [];
      log(run, "Discard reshuffles into the draw pile.");
    }
    const card = combat.draw.pop();
    if (!card) break;
    combat.hand.push(card);
    drawn += 1;
  }
  return drawn;
}

function shave(hits: number[], amount: number): number[] {
  let pool = Math.max(0, amount);
  return hits.map((hit) => {
    const cut = Math.min(hit, pool);
    pool -= cut;
    return hit - cut;
  });
}

function modifyOutgoing(status: Status, hits: number[]): number[] {
  if (status.suppress > 0) {
    status.suppress = 0;
    status.jam = 0;
    return hits.map(() => 0);
  }
  const reduced = shave(hits, status.jam * 3);
  if (status.jam > 0) status.jam = 0;
  return reduced;
}

function applyBurnToPlayer(run: RunState, amount: number) {
  const combat = run.combat;
  if (!combat || amount <= 0) return 0;
  let next = amount;
  if (has(run, "coolantLoop")) next = Math.max(0, next - 1);
  combat.player.status.burn += next;
  if (next > 0) fx(run, { t: "status", who: PLAYER, k: "burn", n: next });
  return next;
}

function rawHitEnemy(run: RunState, enemy: Fighter, amount: number) {
  if (enemy.hp <= 0 || amount <= 0) return;
  let damage = Math.max(0, amount - enemy.status.armor);
  const connected = damage > 0;
  const absorbed = Math.min(enemy.shield, damage);
  enemy.shield -= absorbed;
  damage -= absorbed;
  enemy.hp = Math.max(0, enemy.hp - damage);
  fx(run, { t: "hit", who: enemy.uid, from: PLAYER, amount: damage, blocked: amount - damage, hp: enemy.hp, shield: enemy.shield });
  if (connected && enemy.riposte > 0 && enemy.riposteReady) {
    enemy.riposteReady = false;
    enemy.shield += enemy.riposte;
    fx(run, { t: "shield", who: enemy.uid, amount: enemy.riposte, shield: enemy.shield });
  }
  if (enemy.hp <= 0) {
    log(run, `${enemy.name} is down.`);
    fx(run, { t: "down", who: enemy.uid });
    enemyDowned(run);
  }
}

function applyLocked(run: RunState, rng: RNG, enemy: Fighter, amount: number) {
  if (amount <= 0 || enemy.hp <= 0) return;
  enemy.status.locked += amount;
  fx(run, { t: "status", who: enemy.uid, k: "locked", n: amount });
  const combat = run.combat!;
  for (let i = 0; i < powerCount(run, "siegeRadar"); i++) rawHitEnemy(run, enemy, 6);
  if (!combat.lockedDrawUsed && combat.powers.includes("predictiveTrack")) {
    combat.lockedDrawUsed = true;
    draw(run, rng, 1);
  }
}

function attackFlat(run: RunState, firstAttack: boolean): number {
  const combat = run.combat!;
  let bonus = 0;
  if (firstAttack && has(run, "ordnanceBay")) bonus += 9;
  if (combat.attacksThisCombat > 0 && combat.attacksThisCombat % 3 === 0 && has(run, "tallyStencil")) bonus += 8;
  if (has(run, "leadBallast")) bonus += 4;
  if (has(run, "smokedOptics")) bonus += 4;
  return bonus;
}

function applyNumbersToEnemy(run: RunState, enemy: Fighter, hits: number[], pierce = false) {
  if (enemy.hp <= 0) return 0;
  const before = enemy.hp;
  for (const hit of hits) {
    if (enemy.hp <= 0) break;
    const raw = hit + enemy.status.locked * 3;
    let damage = Math.max(0, raw - (pierce ? 0 : enemy.status.armor));
    const connected = damage > 0;
    const absorbed = Math.min(enemy.shield, damage);
    enemy.shield -= absorbed;
    damage -= absorbed;
    enemy.hp = Math.max(0, enemy.hp - damage);
    fx(run, { t: "hit", who: enemy.uid, from: PLAYER, amount: damage, blocked: Math.max(0, raw - damage), hp: enemy.hp, shield: enemy.shield });
    if (connected && enemy.riposte > 0 && enemy.riposteReady) {
      enemy.riposteReady = false;
      enemy.shield += enemy.riposte;
      fx(run, { t: "shield", who: enemy.uid, amount: enemy.riposte, shield: enemy.shield });
    }
  }
  const dealt = before - enemy.hp;
  if (enemy.hp <= 0) {
    log(run, `${enemy.name} is down.`);
    fx(run, { t: "down", who: enemy.uid });
    enemyDowned(run);
  }
  return dealt;
}

function playerAttack(run: RunState, targets: Fighter[], bases: number[], firstAttack: boolean, pierce = false): number {
  const combat = run.combat!;
  const ghost =
    firstAttack && combat.player.status.evasion > 0 && combat.powers.includes("ghostDoctrine");
  let hits = bases.map((base) => (ghost ? base * 2 : base) + combat.player.status.thrust);
  if (hits.length) hits[0] += attackFlat(run, firstAttack);
  hits = modifyOutgoing(combat.player.status, hits);
  let dealt = 0;
  for (const target of targets) dealt += applyNumbersToEnemy(run, target, hits, pierce);
  return dealt;
}

function over(run: RunState): boolean {
  return !run.combat || run.combat.outcome !== "fight" || run.hp <= 0;
}

function resolveSpecial(run: RunState, rng: RNG, def: CardDef, foe: Fighter | null, notes: string[]): boolean {
  const combat = run.combat!;
  const firstAttack = def.type === "attack" && combat.attacksThisTurn === 1;
  if (def.special === "stitchFire" && foe) {
    const times = combat.player.status.evasion > 0 ? 3 : 2;
    const dealt = playerAttack(run, [foe], Array.from({ length: times }, () => 4), firstAttack);
    notes.push(`${dealt} damage`);
    return true;
  }
  if (def.special === "leadPursuit" && foe) {
    const dealt = playerAttack(run, [foe], [5 * combat.cardsThisTurn], firstAttack);
    notes.push(`${dealt} damage`);
    return true;
  }
  if (def.special === "holdFire") {
    const shield = gainShield(run, 7);
    notes.push(`+${shield} Shield`);
    if (combat.attacksThisTurn === 0) {
      const drawn = draw(run, rng, 2);
      notes.push(`draw ${drawn}`);
    }
    return true;
  }
  if (def.special === "overpressure" && foe) {
    const amount = combat.player.shield > 0 ? 18 : 9;
    const dealt = playerAttack(run, [foe], [amount], firstAttack);
    notes.push(`${dealt} damage`);
    return true;
  }
  if (def.special === "merge" && foe) {
    const amount = foe.status.locked > 0 ? 24 : 16;
    const dealt = playerAttack(run, [foe], [amount], firstAttack);
    notes.push(`${dealt} damage`);
    return true;
  }
  if (def.special === "whisperShot" && foe) {
    const dealt = playerAttack(run, [foe], [8], firstAttack);
    notes.push(`${dealt} damage`);
    if (combat.player.status.evasion > 0 && foe.hp > 0) {
      applyLocked(run, rng, foe, 1);
      notes.push("Lock 1");
    }
    return true;
  }
  if (def.special === "heatSink") {
    const burn = combat.player.status.burn;
    combat.player.status.burn = 0;
    combat.player.status.evasion += burn;
    if (burn) fx(run, { t: "status", who: PLAYER, k: "evasion", n: burn });
    notes.push(burn ? `clear ${burn} Burn, +${burn} Evasion` : "no Burn to clear");
    return true;
  }
  if (def.special === "burnThrough" && foe) {
    const amount = foe.status.jam > 0 ? 16 : 8;
    const dealt = playerAttack(run, [foe], [amount], firstAttack);
    notes.push(`${dealt} damage`);
    return true;
  }
  if (def.special === "dataSpike" && foe) {
    const stacks = foe.status.burn + foe.status.locked + foe.status.jam;
    const dealt = playerAttack(run, [foe], [Math.max(4, stacks * 4)], firstAttack);
    notes.push(`${dealt} damage`);
    return true;
  }
  if (def.special === "maverick" && foe) {
    const amount = combat.player.status.plating >= 10 ? 20 : 13;
    const dealt = playerAttack(run, [foe], [amount], firstAttack);
    notes.push(`${dealt} damage`);
    return true;
  }
  if (def.special === "bathtubCharge" && foe) {
    const amount = 4 + Math.floor(combat.player.status.plating / 2);
    const dealt = playerAttack(run, [foe], [amount], firstAttack);
    notes.push(`${dealt} damage`);
    return true;
  }
  if (def.special === "cycleSteal") {
    const drawn = draw(run, rng, 3);
    notes.push(`draw ${drawn}`);
    const options = livingEnemies(run);
    if (options.length) {
      const target = rng.pick(options);
      target.status.jam += 1;
      fx(run, { t: "status", who: target.uid, k: "jam", n: 1 });
      notes.push(`Jam 1 on ${target.name}`);
    }
    return true;
  }
  return false;
}

function resolveEffect(run: RunState, rng: RNG, effect: Effect, foe: Fighter | null, firstAttack: boolean, notes: string[], pierce = false) {
  if (over(run)) return;
  const combat = run.combat!;
  const amount = effect.n ?? 0;
  if (effect.k === "dmg") {
    const times = effect.times ?? 1;
    const bases = Array.from({ length: times }, () => amount);
    const targets = effect.aoe ? livingEnemies(run) : foe ? [foe] : [];
    const dealt = playerAttack(run, targets, bases, firstAttack, pierce);
    notes.push(`${dealt} damage`);
    return;
  }
  if (effect.k === "shield") {
    notes.push(`+${gainShield(run, amount)} Shield`);
    return;
  }
  if (effect.k === "draw") {
    notes.push(`draw ${draw(run, rng, amount)}`);
    return;
  }
  if (effect.k === "energy") {
    combat.energy += amount;
    fx(run, { t: "status", who: PLAYER, k: "energy", n: amount });
    notes.push(`+${amount} Energy`);
    return;
  }
  if (effect.k === "evasion") {
    combat.player.status.evasion += amount;
    fx(run, { t: "status", who: PLAYER, k: "evasion", n: amount });
    notes.push(`+${amount} Evasion`);
    return;
  }
  if (effect.k === "heal") {
    notes.push(`heal ${heal(run, amount)}`);
    return;
  }
  if (effect.k === "lose") {
    const before = run.hp;
    selfHarm(run, amount);
    notes.push(`lose ${before - run.hp} HP`);
    return;
  }
  if (effect.k === "thrust") {
    combat.player.status.thrust += amount;
    fx(run, { t: "status", who: PLAYER, k: "thrust", n: amount });
    notes.push(`+${amount} Thrust`);
    return;
  }
  if (effect.k === "armor") {
    combat.player.status.armor += amount;
    fx(run, { t: "status", who: PLAYER, k: "armor", n: amount });
    notes.push(`+${amount} Armor`);
    return;
  }
  if (effect.k === "plating") {
    notes.push(`+${gainPlating(run, amount)} Plating`);
    return;
  }
  if (effect.k === "power") {
    notes.push("system online");
    return;
  }
  const targets = effect.aoe ? livingEnemies(run) : foe ? [foe] : [];
  if (effect.k === "burn") {
    for (const target of targets) {
      target.status.burn += amount;
      fx(run, { t: "status", who: target.uid, k: "burn", n: amount });
    }
    if (targets.length) notes.push(`Burn ${amount}`);
    return;
  }
  if (effect.k === "locked") {
    for (const target of targets) applyLocked(run, rng, target, amount);
    if (targets.length) notes.push(`Lock ${amount}`);
    return;
  }
  if (effect.k === "jam") {
    for (const target of targets) {
      target.status.jam += amount;
      fx(run, { t: "status", who: target.uid, k: "jam", n: amount });
    }
    if (targets.length) notes.push(`Jam ${amount}`);
    return;
  }
  if (effect.k === "suppress") {
    for (const target of targets) {
      target.status.suppress += amount;
      fx(run, { t: "status", who: target.uid, k: "suppress", n: amount });
    }
    if (targets.length) notes.push("Suppress");
  }
}

function checkBoard(run: RunState) {
  const combat = run.combat;
  if (!combat || combat.outcome !== "fight") return;
  if (run.hp <= 0) {
    combat.outcome = "lost";
    return;
  }
  if (livingEnemies(run).length === 0) combat.outcome = "won";
}

function moveList(enemy: Fighter) {
  if (enemy.phases.length) return enemy.phases[Math.min(enemy.phase, enemy.phases.length) - 1];
  return enemy.moves;
}

function currentMove(enemy: Fighter) {
  const moves = moveList(enemy);
  return moves[enemy.movePtr % moves.length];
}

function advanceMove(enemy: Fighter) {
  const moves = moveList(enemy);
  enemy.movePtr = (enemy.movePtr + 1) % moves.length;
}

function bossOpening(run: RunState, enemy: Fighter, touchPlayer: boolean) {
  if (enemy.boss === "eule" && enemy.phase === 1 && enemy.hp <= enemy.maxHp * 0.5) {
    enemy.phase = 2;
    enemy.bonusDamage += 4;
    log(run, "Graue Eule closes the command net. Her strikes hit harder.");
    fx(run, { t: "phase", uid: enemy.uid, text: "Command net" });
  }
  if (touchPlayer && enemy.boss === "eule" && enemy.phase === 2) {
    const burned = applyBurnToPlayer(run, 1);
    if (burned) log(run, "Command mode paints Burn on you.");
  }
  if (enemy.boss === "adler") {
    if (enemy.moltedPending) {
      enemy.moltedPending = false;
      enemy.molted = true;
      enemy.phase = 2;
      enemy.status.armor = 6;
      enemy.status.thrust += 2;
      enemy.bonusDamage += 5;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + 22);
      log(run, "Königsadler punches off its tanks. Armor resets, thrust rises, and it recovers.");
      fx(run, { t: "phase", uid: enemy.uid, text: "Tanks away" });
    } else if (!enemy.molted) {
      enemy.status.armor = Math.max(0, enemy.status.armor - 2);
      if (enemy.status.armor === 0) enemy.moltedPending = true;
    } else {
      enemy.status.armor = Math.max(0, enemy.status.armor - 2);
    }
  }
  if (enemy.boss === "nebel") {
    if (enemy.phase < 2 && enemy.hp <= enemy.maxHp * 0.6) {
      enemy.phase = 2;
      enemy.movePtr = 0;
      enemy.status.thrust += 2;
      log(run, "Nebelhorn drops into the horn layer.");
      fx(run, { t: "phase", uid: enemy.uid, text: "Horn layer" });
    }
    if (enemy.phase < 3 && enemy.hp <= enemy.maxHp * 0.3) {
      enemy.phase = 3;
      enemy.movePtr = 0;
      enemy.ignoreEvasion = true;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + 20);
      if (touchPlayer) run.combat!.player.status.static += 1;
      log(run, "Whiteout. Nebelhorn ignores Evasion and crawls back into the fight.");
      fx(run, { t: "phase", uid: enemy.uid, text: "Whiteout" });
    }
  }
}

function strikePlayer(run: RunState, enemy: Fighter, hits: number[]) {
  const combat = run.combat!;
  const outgoing = modifyOutgoing(enemy.status, hits);
  let suffered = 0;
  for (const hit of outgoing) {
    if (run.hp <= 0 || combat.outcome !== "fight") break;
    let damage = hit + combat.player.status.locked * 3;
    damage = Math.max(0, damage - combat.player.status.armor);
    if (damage > 0 && combat.player.status.evasion > 0 && !enemy.ignoreEvasion) {
      combat.player.status.evasion -= 1;
      damage = 0;
      fx(run, { t: "evade", who: PLAYER, from: enemy.uid });
      continue;
    }
    const shielded = Math.min(combat.player.shield, damage);
    combat.player.shield -= shielded;
    damage -= shielded;
    const plated = Math.min(combat.player.status.plating, damage);
    combat.player.status.plating -= plated;
    damage -= plated;
    const absorbed = shielded + plated;
    const before = run.hp;
    if (damage > 0) hurt(run, damage);
    suffered += before - run.hp;
    fx(run, { t: "hit", who: PLAYER, from: enemy.uid, amount: before - run.hp, blocked: absorbed, hp: run.hp, shield: combat.player.shield });
    if (run.hp < before && combat.outcome === "fight") {
      for (let i = 0; i < powerCount(run, "manualReversion"); i++) gainPlating(run, 3);
    }
  }
  return suffered;
}

function performMove(run: RunState, enemy: Fighter) {
  const move = currentMove(enemy);
  advanceMove(enemy);
  const kind: Plan["kind"] = move.hits > 0 && move.damage > 0 ? "attack" : move.shield > 0 ? "defend" : move.thrust || move.armor || move.heal ? "buff" : "debuff";
  fx(run, { t: "move", uid: enemy.uid, kind, name: move.name });
  const bits: string[] = [];
  if (move.burn) {
    const burned = applyBurnToPlayer(run, move.burn);
    if (burned) bits.push(`Burn ${burned}`);
  }
  if (move.locked) {
    run.combat!.player.status.locked += move.locked;
    fx(run, { t: "status", who: PLAYER, k: "locked", n: move.locked });
    bits.push(`Lock ${move.locked}`);
  }
  if (move.jam) {
    run.combat!.player.status.jam += move.jam;
    fx(run, { t: "status", who: PLAYER, k: "jam", n: move.jam });
    bits.push(`Jam ${move.jam}`);
  }
  if (move.suppress) {
    run.combat!.player.status.suppress += move.suppress;
    fx(run, { t: "status", who: PLAYER, k: "suppress", n: move.suppress });
    bits.push("Suppress");
  }
  if (move.stat) {
    run.combat!.player.status.static += move.stat;
    fx(run, { t: "status", who: PLAYER, k: "static", n: move.stat });
    bits.push(`Static ${move.stat}`);
  }
  if (move.heal) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + move.heal);
    fx(run, { t: "heal", who: enemy.uid, amount: move.heal, hp: enemy.hp });
    bits.push(`heal ${move.heal}`);
  }
  if (move.shield) {
    enemy.shield += move.shield;
    fx(run, { t: "shield", who: enemy.uid, amount: move.shield, shield: enemy.shield });
    bits.push(`+${move.shield} Shield`);
  }
  if (move.thrust) {
    enemy.status.thrust += move.thrust;
    fx(run, { t: "status", who: enemy.uid, k: "thrust", n: move.thrust });
    bits.push(`Thrust +${move.thrust}`);
  }
  if (move.armor) {
    enemy.status.armor += move.armor;
    fx(run, { t: "status", who: enemy.uid, k: "armor", n: move.armor });
    bits.push(`Armor +${move.armor}`);
  }
  if (move.hits > 0 && move.damage > 0 && run.combat!.outcome === "fight") {
    const per = move.damage + enemy.status.thrust + enemy.bonusDamage;
    const hits = Array.from({ length: move.hits }, () => per);
    const suffered = strikePlayer(run, enemy, hits);
    bits.push(`${suffered} to you`);
  }
  log(run, `${enemy.name} — ${move.name}${bits.length ? ": " + bits.join(", ") : "."}`);
}

function enemyPhase(run: RunState) {
  for (const enemy of run.combat!.enemies) {
    if (run.combat!.outcome !== "fight") return;
    if (enemy.hp <= 0) continue;
    if (enemy.status.burn > 0) {
      enemy.hp -= enemy.status.burn;
      log(run, `${enemy.name} burns for ${enemy.status.burn}.`);
      fx(run, { t: "burn", who: enemy.uid, amount: enemy.status.burn, hp: Math.max(0, enemy.hp) });
      enemy.status.burn -= 1;
      if (enemy.hp <= 0) {
        enemy.hp = 0;
        log(run, `${enemy.name} burns down.`);
        fx(run, { t: "down", who: enemy.uid });
        enemyDowned(run);
        continue;
      }
    }
    enemy.shield = 0;
    bossOpening(run, enemy, true);
    if (run.hp <= 0) {
      run.combat!.outcome = "lost";
      return;
    }
    if (enemy.hp <= 0) continue;
    performMove(run, enemy);
    if (run.hp <= 0) {
      run.combat!.outcome = "lost";
      return;
    }
  }
  checkBoard(run);
}

export function beginPlayerTurn(run: RunState) {
  const combat = run.combat;
  if (!combat || combat.outcome !== "fight") return;
  const rng = rngOf(run);
  combat.turn += 1;
  fx(run, { t: "turn", n: combat.turn });
  combat.player.shield = 0;
  combat.attacksThisTurn = 0;
  combat.maneuversThisTurn = 0;
  combat.cardsThisTurn = 0;
  combat.lockedDrawUsed = false;
  if (combat.player.status.locked > 0) combat.player.status.locked -= 1;
  for (const enemy of combat.enemies) {
    if (enemy.status.locked > 0) enemy.status.locked -= 1;
    if (enemy.riposte > 0) enemy.riposteReady = true;
  }
  if (combat.player.status.burn > 0) {
    const burn = combat.player.status.burn;
    log(run, `Burn sears you for ${burn}.`);
    selfHarm(run, burn);
    combat.player.status.burn = Math.max(0, burn - 1);
  }
  if (combat.outcome === "fight" && has(run, "crackedCanopy")) {
    log(run, "Cracked Canopy weeps 1 HP.");
    selfHarm(run, 1);
  }
  if (combat.outcome === "fight" && has(run, "warpedIntake")) {
    log(run, "Warped Intake bites for 1.");
    selfHarm(run, 1);
  }
  if (combat.outcome !== "fight" || run.hp <= 0) {
    combat.outcome = "lost";
    saveRng(run, rng);
    return;
  }
  combat.maxEnergy = maxEnergy(run);
  combat.energy = combat.maxEnergy;
  if (has(run, "warpedIntake")) combat.energy += 1;
  if (combat.turn === 1 && has(run, "dropTank")) combat.energy += 1;
  if (has(run, "thirdDetent") && combat.turn % 3 === 0) {
    combat.energy += 1;
    log(run, "Third Detent opens another Energy.");
  }
  let drawCount = 5;
  if (combat.turn === 1 && has(run, "firstLook")) drawCount += 1;
  if (has(run, "paperSeals")) drawCount += 1;
  if (has(run, "leadBallast")) drawCount -= 1;
  drawCount -= combat.player.status.static;
  if (combat.player.status.static > 0) combat.player.status.static -= 1;
  const drawn = draw(run, rng, Math.max(0, drawCount));
  log(run, `Turn ${combat.turn}. Draw ${drawn}. Energy ${combat.energy}.`);
  for (let i = 0; i < powerCount(run, "hotStart"); i++) combat.energy += 1;
  if (has(run, "mothDust") && combat.turn % 3 === 1) combat.player.status.evasion += 1;
  for (let i = 0; i < powerCount(run, "trimAuthority"); i++) combat.player.status.evasion += 1;
  for (let i = 0; i < powerCount(run, "lowObservable"); i++) combat.player.status.evasion += 1;
  const lead = livingEnemies(run)[0];
  if (lead && has(run, "spectrumMast")) lead.status.jam += 2;
  if (powerCount(run, "ecmWing")) {
    for (const enemy of livingEnemies(run)) enemy.status.jam += powerCount(run, "ecmWing");
  }
  if (combat.turn === 1 && has(run, "beaconLamp")) {
    const shield = gainShield(run, 8);
    log(run, `Beacon Lamp raises ${shield} Shield.`);
  }
  if (has(run, "titaniumTub")) gainPlating(run, 4);
  for (let i = 0; i < powerCount(run, "survivability"); i++) gainPlating(run, 3);
  for (let i = 0; i < powerCount(run, "anvilProtocol"); i++) {
    const shield = gainShield(run, 5);
    log(run, `Anvil Protocol raises ${shield} Shield.`);
  }
  if (has(run, "rwrBulb") && livingEnemies(run).some((enemy) => enemyPlan(run, enemy).damage > 0)) {
    const shield = gainShield(run, 3);
    log(run, `RWR Bulb throws ${shield} Shield.`);
  }
  saveRng(run, rng);
}

export function openCombat(
  run: RunState,
  encounter: EncounterDef,
  options: { rewardMode?: "battle" | "elite" | "boss"; side?: boolean; bonusGold?: number; bonusHealPct?: number; bonusNote?: string } = {},
) {
  const rng = rngOf(run);
  let uid = run.uid;
  const enemies = encounter.foes.map((spawn) => {
    uid += 1;
    const fighter = spawnFighter(spawn, uid);
    scaleFighter(fighter, run.difficulty ?? 0);
    return fighter;
  });
  run.uid = uid;
  for (const enemy of enemies) {
    if (has(run, "hauntedPump")) enemy.status.thrust += 1;
    if (has(run, "paperSeals")) enemy.status.armor += 3;
  }
  const deck = run.deck.map((card) => ({ ...card }));
  run.combat = {
    encounterId: encounter.id,
    encounterName: encounter.name,
    rewardMode: options.rewardMode ?? (encounter.kind === "boss" ? "boss" : encounter.kind === "elite" ? "elite" : "battle"),
    side: !!options.side,
    bonusGold: options.bonusGold ?? 0,
    bonusHealPct: options.bonusHealPct ?? 0,
    bonusNote: options.bonusNote ?? "",
    enemies,
    draw: rng.shuffle(deck),
    discard: [],
    hand: [],
    played: [],
    exhaustPile: [],
    energy: 0,
    maxEnergy: maxEnergy(run),
    turn: 0,
    attacksThisTurn: 0,
    maneuversThisTurn: 0,
    cardsThisTurn: 0,
    attacksThisCombat: 0,
    lockedDrawUsed: false,
    ejectionUsed: false,
    powers: [],
    player: { shield: 0, status: freshStatus() },
    log: [`Contact: ${encounter.name}.`],
    outcome: "fight",
  };
  if (has(run, "hotNozzle")) run.combat.player.status.thrust += 1;
  if (has(run, "afterburnerLeak")) {
    run.combat.player.status.thrust += 2;
    run.combat.player.status.burn += 3;
  }
  if (has(run, "titaniumTub")) run.combat.player.status.plating = 4;
  saveRng(run, rng);
  beginPlayerTurn(run);
}

export function performPlayCard(run: RunState, handIndex: number, targetUid: number | null): ActionResult {
  const combat = run.combat;
  if (!combat || combat.outcome !== "fight") return { ok: false, message: "No fight in progress." };
  const inst = combat.hand[handIndex];
  if (!inst) return { ok: false, message: "That card is gone." };
  const def = getCard(inst.id);
  const cost = cardCost(run, def);
  if (combat.energy < cost) return { ok: false, message: "Not enough Energy." };
  const living = livingEnemies(run);
  let foe: Fighter | null = null;
  if (def.target === "enemy") {
    foe = living.find((enemy) => enemy.uid === targetUid) ?? null;
    if (!foe && living.length === 1) foe = living[0];
    if (!foe) return { ok: false, message: "Select a target." };
  }
  const rng = rngOf(run);
  combat.energy -= cost;
  combat.cardsThisTurn += 1;
  if (def.type === "attack") {
    combat.attacksThisTurn += 1;
    combat.attacksThisCombat += 1;
  }
  const firstManeuver = def.type === "maneuver" && combat.maneuversThisTurn === 0;
  if (def.type === "maneuver") combat.maneuversThisTurn += 1;
  const firstAttack = def.type === "attack" && combat.attacksThisTurn === 1;
  const notes: string[] = [];
  const handled = def.special && FULL_SPECIALS.has(def.special) ? resolveSpecial(run, rng, def, foe, notes) : false;
  if (!handled) {
    for (const effect of def.effects) {
      if (effect.k === "power") combat.powers.push(def.id);
      resolveEffect(run, rng, effect, foe, firstAttack, notes, !!def.pierce);
      if (over(run)) break;
    }
  }
  if (def.type === "attack" && combat.outcome === "fight") {
    for (let i = 0; i < powerCount(run, "closeAirSupport"); i++) notes.push(`+${gainPlating(run, 2)} Plating`);
  }
  if (def.type === "maneuver" && combat.outcome === "fight") {
    if (firstManeuver && has(run, "chaffLoader")) notes.push(`chaff +${gainShield(run, 4)} Shield`);
    for (let i = 0; i < powerCount(run, "countermeasures"); i++) notes.push(`+${gainShield(run, 2)} Shield`);
    if (has(run, "memorialTag")) {
      const gained = heal(run, 1);
      if (gained) notes.push("heal 1");
    }
  }
  combat.hand.splice(handIndex, 1);
  if (def.exhaust || def.type === "system" || def.effects.some((effect) => effect.k === "power")) {
    combat.exhaustPile.push(inst);
  } else {
    combat.played.push(inst);
  }
  log(run, `${def.name}${notes.length ? ": " + notes.join(", ") : "."}`);
  checkBoard(run);
  saveRng(run, rng);
  if (!run.scratch) run.tally.cardsPlayed += 1;
  return { ok: true };
}

export function performEndTurn(run: RunState) {
  const combat = run.combat;
  if (!combat || combat.outcome !== "fight") return;
  if (combat.powers.includes("patience") && combat.attacksThisTurn === 0) {
    const copies = powerCount(run, "patience");
    combat.player.status.evasion += 2 * copies;
    const shield = gainShield(run, 5 * copies);
    log(run, `Patience: +${2 * copies} Evasion, +${shield} Shield.`);
  }
  if (powerCount(run, "loiter") && combat.energy > 0) {
    const plated = gainPlating(run, 3 * combat.energy * powerCount(run, "loiter"));
    log(run, `Loiter: +${plated} Plating.`);
  }
  if (has(run, "bingoCard") && combat.energy === 0) {
    const shield = gainShield(run, 5);
    log(run, `Bingo Card raises ${shield} Shield.`);
  }
  combat.discard.push(...combat.played, ...combat.hand);
  combat.played = [];
  combat.hand = [];
  enemyPhase(run);
  if (combat.outcome !== "fight") return;
  beginPlayerTurn(run);
}

/**
 * A sandbox copy for previews. Combat only ever writes to the combat state,
 * hp, the rng, uids, and the tally, so the map, deck, and relics are shared.
 */
export function scratchCopy(run: RunState): RunState {
  return { ...run, combat: run.combat ? structuredClone(run.combat) : null, tally: { ...run.tally }, scratch: true };
}

export function enemyPlan(run: RunState, enemy: Fighter): Plan {
  if (!run.combat || enemy.hp <= 0) {
    return { kind: "down", title: "Down", damage: 0, hits: 0, perHit: 0, uneven: false, shield: 0, tags: [] };
  }
  const clone = scratchCopy(run);
  const twin = clone.combat?.enemies.find((candidate) => candidate.uid === enemy.uid);
  if (!twin) {
    return { kind: "down", title: "Down", damage: 0, hits: 0, perHit: 0, uneven: false, shield: 0, tags: [] };
  }
  if (twin.hp <= twin.status.burn) {
    return { kind: "down", title: "Burnout", damage: 0, hits: 0, perHit: 0, uneven: false, shield: 0, tags: ["Burns down"] };
  }
  twin.hp -= twin.status.burn;
  twin.status.burn = Math.max(0, twin.status.burn - 1);
  twin.shield = 0;
  bossOpening(clone, twin, false);
  if (twin.hp <= 0) {
    return { kind: "down", title: "Burnout", damage: 0, hits: 0, perHit: 0, uneven: false, shield: 0, tags: [] };
  }
  const move = currentMove(twin);
  const tags: string[] = [];
  if (move.burn) tags.push(`Burn ${has(run, "coolantLoop") ? Math.max(0, move.burn - 1) : move.burn}`);
  if (move.locked) tags.push(`Lock ${move.locked}`);
  if (move.jam) tags.push(`Jam ${move.jam}`);
  if (move.suppress) tags.push("Suppress");
  if (move.stat) tags.push(`Static ${move.stat}`);
  if (move.thrust) tags.push(`Thrust +${move.thrust}`);
  if (move.armor) tags.push(`Armor +${move.armor}`);
  if (twin.boss === "eule" && twin.phase === 2) tags.push("Burn 1");
  let amounts: number[] = [];
  if (move.hits > 0 && move.damage > 0) {
    const per = move.damage + twin.status.thrust + twin.bonusDamage;
    amounts = Array.from({ length: move.hits }, () => per);
    if (twin.status.suppress > 0) amounts = amounts.map(() => 0);
    else amounts = shave(amounts, twin.status.jam * 3);
  }
  const damage = amounts.reduce((sum, hit) => sum + hit, 0);
  const perHit = amounts[0] ?? 0;
  const uneven = amounts.some((hit) => hit !== perHit);
  let kind: Plan["kind"] = "buff";
  if (damage > 0 && (move.shield > 0 || tags.length > 0)) kind = "mixed";
  else if (damage > 0) kind = "attack";
  else if (move.shield > 0 && tags.length > 0) kind = "mixed";
  else if (move.shield > 0) kind = "defend";
  else if (tags.length) kind = "debuff";
  return { kind, title: move.name, damage, hits: amounts.length, perHit, uneven, shield: move.shield, tags };
}

export function forecastLoss(run: RunState): number {
  if (!run.combat || run.combat.outcome !== "fight") return 0;
  const clone = scratchCopy(run);
  const before = clone.hp;
  performEndTurn(clone);
  return Math.max(0, before - clone.hp);
}

export function startEncounter(run: RunState, encounterId: string, options?: Parameters<typeof openCombat>[2]) {
  openCombat(run, getEncounter(encounterId), options);
}

export function pileCounts(run: RunState): { draw: number; discard: number; hand: number; exhaust: number } {
  const combat = run.combat;
  if (!combat) return { draw: 0, discard: 0, hand: 0, exhaust: 0 };
  return {
    draw: combat.draw.length,
    discard: combat.discard.length,
    hand: combat.hand.length,
    exhaust: combat.exhaustPile.length,
  };
}

export function allCombatCards(run: RunState): { zone: string; card: CardInst }[] {
  const combat = run.combat;
  if (!combat) return [];
  return [
    ...combat.draw.map((card) => ({ zone: "Draw", card })),
    ...combat.hand.map((card) => ({ zone: "Hand", card })),
    ...combat.played.map((card) => ({ zone: "In play", card })),
    ...combat.discard.map((card) => ({ zone: "Discard", card })),
    ...combat.exhaustPile.map((card) => ({ zone: "Exhaust", card })),
  ];
}
