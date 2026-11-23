export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  gold?: number;
  /** Enabled only when current HP is strictly greater than this. */
  hpgt?: number;
  spareRelic?: boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  body: string;
  choices: EventChoice[];
}

export const EVENTS: GameEvent[] = [
  {
    id: "pallet",
    title: "Pallet in the Weather",
    body: "A cargo pallet is drifting under a half-open chute, strobe still blinking. Nobody on the guard frequency is claiming it.",
    choices: [
      { id: "open", label: "Cut it open", detail: "Install a random avionics package." },
      { id: "strip", label: "Strip the mounts", detail: "Stow 45 gold and leave the crate." },
      { id: "leave", label: "Leave it spinning", detail: "Heal 8 while you watch it go." },
    ],
  },
  {
    id: "mayday",
    title: "Mayday, Low and Slow",
    body: "A transport squawks once, then goes quiet. Its escort has already turned for home. You still have fuel enough to be stupid.",
    choices: [
      { id: "escort", label: "Drop in as escort", detail: "Fight a patrol. Win and the crew wires you 45 gold on top of the purse." },
      { id: "share", label: "Share a fuel cell", detail: "Lose 8 HP. Stow 55 gold.", gold: 0, hpgt: 8 },
      { id: "dark", label: "Stay dark", detail: "Let the frequency die. No change." },
    ],
  },
  {
    id: "hardstand",
    title: "Unmarked Hardstand",
    body: "An old dispersal pad, still warm, with a tool chest chained to a bollard. The chain has already been cut.",
    choices: [
      { id: "repair", label: "Repair", detail: "Heal 30% of your max HP." },
      { id: "refit", label: "Refit the bay", detail: "Remove a card from your deck for free." },
      { id: "patch", label: "Patch and push", detail: "Heal 10 and stow 20 gold." },
    ],
  },
  {
    id: "crate",
    title: "Crate with the Tape Still On",
    body: "Ordnance crates, three of them, labeled in a hand you don't know. The tape says DO NOT ISSUE. It has already been peeled once.",
    choices: [
      { id: "pay45", label: "Pay 45 for the good tape", detail: "Choose 1 of 3 stronger cards.", gold: 45 },
      { id: "pay30", label: "Pay 30 for a loose round", detail: "Add a random common card.", gold: 30 },
      { id: "walk", label: "Leave the tape on", detail: "Walk back to the jet." },
    ],
  },
  {
    id: "shear",
    title: "Shear Line",
    body: "The corridor ahead is a standing wave of cloud, radar painting it as weather and also as something that moves against the wind.",
    choices: [
      { id: "punch", label: "Punch through", detail: "Take 8 damage. Add a random common card.", hpgt: 8 },
      { id: "divert", label: "Divert", detail: "Add ten minutes and lose nothing." },
      { id: "edge", label: "Ride the edge", detail: "Gain 3 max HP. Take 10 damage.", hpgt: 10 },
    ],
  },
  {
    id: "controller",
    title: "Controller on the Quiet",
    body: "A voice with no callsign offers you a picture of the next plot, then asks what you'll send back. The encryption is yesterday's.",
    choices: [
      { id: "picture", label: "Take the picture", detail: "Choose 1 of 3 cards." },
      { id: "tape", label: "Hand over a tape", detail: "Remove a card, then stow 30 gold." },
      { id: "signoff", label: "Sign off", detail: "Heal 6. Keep your tapes." },
    ],
  },
  {
    id: "linegang",
    title: "Line Gang",
    body: "Three techs in unmarked jackets are already under your wing with a lamp. One of them taps a wet seam and waits to see what you'll pay.",
    choices: [
      { id: "pay", label: "Pay 35 to patch it", detail: "Heal 14.", gold: 35 },
      { id: "bleed", label: "Fly it wet", detail: "Lose 7 HP.", hpgt: 7 },
      { id: "jury", label: "Jury-rig with a spare part", detail: "Lose a relic other than your jet's built-in. Heal 18.", spareRelic: true },
    ],
  },
  {
    id: "channel",
    title: "The Offer on Channel 9",
    body: "Channel 9 is supposed to be empty. Tonight it is a whisper offering a sealed avionics can. They will not say which bench it came off.",
    choices: [
      { id: "accept", label: "Accept the can", detail: "Even odds: a useful relic, or a cursed one." },
      { id: "decline", label: "Decline", detail: "Heal 10 and clear the channel." },
    ],
  },
  {
    id: "bingo",
    title: "Bingo at the Strip",
    body: "An abandoned strip, lights still on a timer. The tower door is open and the slot for the cash box is not.",
    choices: [
      { id: "bet", label: "Bet 30 gold on the timer", detail: "Even odds: stow 80 gold, or lose the 30 and take 6 damage.", gold: 30, hpgt: 6 },
      { id: "tower", label: "Search the tower", detail: "Stow 22 gold." },
      { id: "taxi", label: "Keep taxiing", detail: "Leave the strip dark." },
    ],
  },
  {
    id: "wingman",
    title: "Wingman, Off Scope",
    body: "A chute on the ridge. The beacon is yours — same wing, last month's roster. You can land this as a rite, a salvage, or a very bad idea.",
    choices: [
      { id: "memorial", label: "Cut a memorial tag", detail: "Install Memorial Tag. If you already fly with it, gain 4 max HP and heal 10." },
      { id: "scavenge", label: "Scavenge the kit", detail: "Stow 70 gold." },
      { id: "rescue", label: "Try the rescue", detail: "Fight a heavy contact. If you win, heal 25% and stow 30 extra gold." },
    ],
  },
];

const BY_ID: Record<string, GameEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function getEvent(id: string): GameEvent {
  const event = BY_ID[id];
  if (!event) throw new Error(`Unknown event ${id}`);
  return event;
}

export function eventIds(): string[] {
  return EVENTS.map((e) => e.id);
}
