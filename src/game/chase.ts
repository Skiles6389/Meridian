import { PLAYER, type CombatFx } from "./combat";

export interface TurnTimeline {
  /** Events from the enemy phase, played with the chase camera pulled back wide. */
  enemy: CombatFx[];
  /** Events from the start of the player's next turn onward, played close behind the player's jet. */
  player: CombatFx[];
}

/** Splits the events of an end-turn at the start of the player's next turn. */
export function splitTurnEvents(events: CombatFx[]): TurnTimeline {
  const at = events.findIndex((event) => event.t === "turn");
  if (at < 0) return { enemy: events, player: [] };
  return { enemy: events.slice(0, at), player: events.slice(at) };
}

/** The camera pulls back for the enemy phase only when at least one enemy acts. */
export function enemiesTakeLead(enemyEvents: CombatFx[]): boolean {
  return enemyEvents.some((event) => event.t === "move");
}

/** Enemies that shoot at the player in an enemy phase, in the order they first fire. */
export function attackersOf(enemyEvents: CombatFx[]): number[] {
  const out: number[] = [];
  for (const event of enemyEvents) {
    if ((event.t === "hit" || event.t === "evade") && event.who === PLAYER && event.from !== PLAYER && !out.includes(event.from)) out.push(event.from);
  }
  return out;
}
