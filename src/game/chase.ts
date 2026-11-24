import type { CombatFx } from "./combat";

/** Who is attacking, and so flying behind the other side in the tail chase. */
export type ChaseLead = "player" | "enemy";

export interface TurnTimeline {
  /** Events from the enemy phase, played with the enemies behind the player. */
  enemy: CombatFx[];
  /** Events from the start of the player's next turn onward, played with the player behind. */
  player: CombatFx[];
}

/** Splits the events of an end-turn at the start of the player's next turn. */
export function splitTurnEvents(events: CombatFx[]): TurnTimeline {
  const at = events.findIndex((event) => event.t === "turn");
  if (at < 0) return { enemy: events, player: [] };
  return { enemy: events.slice(0, at), player: events.slice(at) };
}

/** Enemies swing behind the player only when at least one of them acts. */
export function enemiesTakeLead(enemyEvents: CombatFx[]): boolean {
  return enemyEvents.some((event) => event.t === "move");
}
