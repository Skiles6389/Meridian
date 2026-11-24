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
  {
    id: "tanker",
    title: "Tanker on the Track",
    body: "A tanker is flying a slow racetrack above the cloud deck with its boom already down. The boom operator sounds like nobody has talked to them since breakfast.",
    choices: [
      { id: "plug", label: "Plug in", detail: "Take on fuel and calm down. Heal 25% of your max HP." },
      { id: "droptank", label: "Ask about the spare drop tank", detail: "Install Drop Tank. The hookup is clumsy: take 6 damage.", hpgt: 6 },
      { id: "gossip", label: "Trade gossip for a long minute", detail: "They know what is waiting downrange. Choose 1 of 3 cards." },
    ],
  },
  {
    id: "gateguard",
    title: "Gate Guard",
    body: "An old Phantom sits on a plinth outside a base nobody locked when they left. Its gun camera is still in the nose, and the brass plaque is worth something to somebody.",
    choices: [
      { id: "camera", label: "Pull the gun camera", detail: "Install Gun Camera." },
      { id: "plaque", label: "Pry off the plaque", detail: "Stow 55 gold. The fence wire takes 5 HP.", hpgt: 5 },
      { id: "salute", label: "Salute and log it", detail: "Gain 4 max HP and heal 4." },
    ],
  },
  {
    id: "airshow",
    title: "Airshow Fill-In",
    body: "A county airshow lost its headline act to a flat tyre. The announcer is sweating through his shirt and offering the takings from the cake stall.",
    choices: [
      { id: "display", label: "Fly the display", detail: "Pull hard at low level. Take 10 damage. Stow 85 gold.", hpgt: 10 },
      { id: "static", label: "Park in the static line", detail: "Sign hats for an hour. Stow 25 gold and heal 6." },
      { id: "hangar", label: "Borrow their hangar instead", detail: "Spend the afternoon on the jet. Remove a card from your deck." },
    ],
  },
  {
    id: "thunderhead",
    title: "Thunderhead",
    body: "A storm cell stands across the corridor like a wall. There is a bright seam straight through the middle of it, and the seam is closing.",
    choices: [
      { id: "thread", label: "Thread the seam", detail: "Even odds: come out clean and remove a card for free, or take 14 damage.", hpgt: 14 },
      { id: "climb", label: "Climb over the anvil", detail: "Take 6 damage from the cold. From the top you can see the whole corridor: choose 1 of 3 cards.", hpgt: 6 },
      { id: "divert", label: "Divert to a farm strip", detail: "Pay 25 gold in landing fees and wait it out. Heal 12.", gold: 25 },
    ],
  },
  {
    id: "simbay",
    title: "Sim Bay",
    body: "A training wing left its simulator running. The instructor stayed too, mostly for the coffee, and is happy to put you through the syllabus.",
    choices: [
      { id: "drills", label: "Run the free drills", detail: "Replace 2 starter cards with random common cards." },
      { id: "syllabus", label: "Book the full syllabus", detail: "Pay 60 gold. Replace 2 starter cards with random uncommon cards.", gold: 60 },
      { id: "nap", label: "Sleep in the briefing room", detail: "Heal 10." },
    ],
  },
  {
    id: "fuelcash",
    title: "Fuel for Cash",
    body: "A fuel truck with no markings idles beside the strip. The driver wants your reserve fuel and has an envelope ready. His tailgate is covered in parts that came off other jets.",
    choices: [
      { id: "sell", label: "Sell your reserve", detail: "Fly lighter from now on. Lose 6 max HP. Stow 70 gold." },
      { id: "buy", label: "Buy a part off the tailgate", detail: "Pay 60 gold. Install a random useful relic.", gold: 60 },
      { id: "report", label: "Call it in", detail: "The base sends a mechanic out as thanks. Heal 8." },
    ],
  },
  {
    id: "numbers",
    title: "Numbers Station",
    body: "On a guard frequency that should be silent, a flat voice is reading out five-digit groups. Somebody, somewhere, is listening for them.",
    choices: [
      { id: "copy", label: "Copy the groups down", detail: "Add a random rare card. The distraction costs you: add an Airframe Crack to your deck." },
      { id: "report", label: "File an intercept report", detail: "Intelligence pays for the recording. Stow 30 gold." },
      { id: "off", label: "Switch it off", detail: "Some things are not your business. Heal 5." },
    ],
  },
  {
    id: "stray",
    title: "Stray Wingman",
    body: "A lone light fighter has drifted into your corridor on fumes, its pilot waving sheepishly. Their squadron is a long way north.",
    choices: [
      { id: "lead", label: "Lead them home", detail: "The detour takes 10 HP. Their squadron sends thanks: choose 1 of 3 rare cards.", hpgt: 10 },
      { id: "swap", label: "Swap parts on a road strip", detail: "Their crew chief fits a hot-running burner can. Install Afterburner Leak (Curse) and heal 10." },
      { id: "vector", label: "Give them a vector", detail: "They insist on paying for the help. Stow 20 gold." },
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
