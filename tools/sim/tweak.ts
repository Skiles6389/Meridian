import { CARDS } from "../../src/game/cards";
import { ENCOUNTERS, ENEMIES } from "../../src/game/enemies";
import { JETS } from "../../src/game/jets";
import type { JetId } from "../../src/game/types";

/** Scales applied to the live content tables before a batch, to try balance ideas without editing source. */
export interface Tweak {
  /** Keyed "act:kind", e.g. "1:battle". */
  hp?: Record<string, number>;
  dmg?: Record<string, number>;
  /** Card id to replacement effect numbers, in effect order. */
  cards?: Record<string, number[]>;
  /** Swap a jet's built-in relic, e.g. to measure what it is worth. */
  jetRelic?: Partial<Record<JetId, string>>;
  jetHp?: Partial<Record<JetId, number>>;
  jetDeck?: Partial<Record<JetId, string[]>>;
  /** Enemy id to [damage, hits] per move, in move order; phases are listed after moves. */
  moves?: Record<string, [number, number][]>;
  enemyHp?: Record<string, number>;
  /** Single hits at or above this size become two hits of half the size. */
  split?: number;
}

function homeOf(enemyId: string): string | null {
  const enc = ENCOUNTERS.find((candidate) => candidate.foes.some((foe) => foe.id === enemyId));
  return enc ? `${enc.act}:${enc.kind}` : null;
}

export function applyTweak(tweak: Tweak) {
  for (const enemy of ENEMIES) {
    const home = homeOf(enemy.id);
    if (!home) continue;
    const hp = tweak.hp?.[home] ?? 1;
    const dmg = tweak.dmg?.[home] ?? 1;
    enemy.hp = Math.round(enemy.hp * hp);
    const scale = (move: { damage: number; hits: number }) => {
      if (move.damage > 0) move.damage = Math.max(1, Math.round(move.damage * dmg));
      if (tweak.split && move.hits === 1 && move.damage >= tweak.split) {
        move.hits = 2;
        move.damage = Math.ceil(move.damage / 2);
      }
    };
    enemy.moves.forEach(scale);
    enemy.phases?.forEach((phase) => phase.forEach(scale));
  }
  for (const enc of ENCOUNTERS) {
    const hp = tweak.hp?.[`${enc.act}:${enc.kind}`] ?? 1;
    for (const foe of enc.foes) if (foe.hp) foe.hp = Math.round(foe.hp * hp);
  }
  for (const [jet, relic] of Object.entries(tweak.jetRelic ?? {})) JETS[jet as JetId].relic = relic!;
  for (const [jet, hp] of Object.entries(tweak.jetHp ?? {})) JETS[jet as JetId].hp = hp!;
  for (const [jet, deck] of Object.entries(tweak.jetDeck ?? {})) JETS[jet as JetId].deck = deck!;
  for (const [id, list] of Object.entries(tweak.moves ?? {})) {
    const enemy = ENEMIES.find((candidate) => candidate.id === id);
    if (!enemy) continue;
    const all = [...enemy.moves, ...(enemy.phases ?? []).flat()];
    list.forEach(([damage, hits], i) => {
      if (all[i]) {
        all[i].damage = damage;
        all[i].hits = hits;
      }
    });
  }
  for (const [id, hp] of Object.entries(tweak.enemyHp ?? {})) {
    const enemy = ENEMIES.find((candidate) => candidate.id === id);
    if (enemy) enemy.hp = hp;
  }
  for (const [id, numbers] of Object.entries(tweak.cards ?? {})) {
    const card = CARDS.find((candidate) => candidate.id === id);
    if (!card) continue;
    numbers.forEach((n, i) => {
      if (card.effects[i]) card.effects[i].n = n;
    });
  }
}
