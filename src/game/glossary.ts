export interface GlossaryEntry {
  id: string;
  name: string;
  text: string;
}

export const STATUSES: GlossaryEntry[] = [
  {
    id: "shield",
    name: "Shield",
    text: "Absorbs attack damage until your next turn starts. It does not stop Burn.",
  },
  {
    id: "evasion",
    name: "Evasion",
    text: "Each stack cancels one incoming hit completely, then is spent. Burn ignores it.",
  },
  {
    id: "locked",
    name: "Locked",
    text: "Attacks against this craft deal +3 damage per hit, per stack. One stack fades at the start of each of your turns.",
  },
  {
    id: "jam",
    name: "Jam",
    text: "The next attack this craft makes deals 3 less damage per stack, shaved off the front hits. Making an attack clears Jam.",
  },
  {
    id: "burn",
    name: "Burn",
    text: "At the start of this craft's turn, Burn deals that much damage through Shield and Armor, then fades by 1.",
  },
  {
    id: "thrust",
    name: "Thrust",
    text: "This craft's attacks deal +1 damage per hit, per stack, for the rest of the fight.",
  },
  {
    id: "armor",
    name: "Armor",
    text: "Incoming attack damage is reduced by Armor. It lasts the whole fight and does not stop Burn.",
  },
  {
    id: "plating",
    name: "Plating",
    text: "Absorbs attack damage after Shield, but carries over between turns until spent. Caps at 30. Burn ignores it.",
  },
  {
    id: "suppress",
    name: "Suppress",
    text: "The next attack this craft makes deals no damage. Suppress then clears.",
  },
  {
    id: "static",
    name: "Static",
    text: "You draw that many fewer cards at the start of your turn, then Static fades by 1.",
  },
];

export const STATUS_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(
  STATUSES.map((s) => [s.id, s]),
);
