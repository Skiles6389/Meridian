export interface HelpPage {
  title: string;
  lines: string[];
}

export const HELP: HelpPage[] = [
  {
    title: "The sortie",
    lines: [
      "Dogfight is a three-corridor deck sortie. You fly one jet, spend Energy on cards, and try to bring the airframe home.",
      "Act 1 is the Baltic Shelf, Act 2 is the Rhine Gate, Act 3 is the Glass Meridian. Clear the boss and the next map is generated. Clear Nebelhorn and the sortie is won.",
      "HP carries between fights. Nothing heals you unless a card, a relic, a depot, a reward, or an event says so.",
      "The aircraft are real types. Every squadron, callsign, and story is fictional. Markings are neutral, with no national or historical insignia.",
    ],
  },
  {
    title: "Your turn",
    lines: [
      "You start each turn with 3 Energy (more, if a relic says so) and draw 5 cards. The hand holds 10.",
      "Click a card to play it, or drag it onto a target. Spend Energy from the orb, then press End Turn. Enemies act left to right, using the intent shown above each jet.",
      "Shield disappears when your next turn starts. It soaks attack damage. It does not stop Burn.",
      "Keys: 1–9 play a card, E or Enter ends the turn, Esc closes a panel. On a phone, tap a card to inspect it and tap again (or tap a target) to play.",
    ],
  },
  {
    title: "Cards and piles",
    lines: [
      "Attacks deal damage. Maneuvers draw, raise Shield, or set up a shot. Systems exhaust and leave a lasting effect for the fight.",
      "Played cards wait until the turn ends, then go to the discard. When the draw pile is empty, the discard is shuffled back in. Exhausted cards stay out.",
      "After a fight you are often offered 1 of 3 cards. Skip is allowed. Depots also sell cards and will pull a card out of the deck for gold.",
    ],
  },
  {
    title: "Statuses",
    lines: [
      "Evasion cancels one incoming hit per stack, then is spent.",
      "Locked adds 3 damage to every hit against that craft. One stack fades at the start of each of your turns. Apply it, then hit.",
      "Jam reduces the next attack that craft makes by 3 per stack, shaved off the front hits, then clears.",
      "Burn deals its stacks as damage at the start of that craft's turn, through Shield and Armor, then fades by 1.",
      "Thrust adds damage to every hit for the rest of the fight. Armor reduces incoming attack damage for the rest of the fight. Suppress zeroes the next attack. Static makes you draw fewer cards.",
    ],
  },
  {
    title: "The map",
    lines: [
      "The whole act is visible before you pick a lane. Battle, Elite, Depot, Mystery, Gamble, and the Boss.",
      "Elites hit harder and pay better. Depots sell cards, relics, repairs, and removal. Mysteries ask you to choose. Gambles install either a useful relic or a cursed one.",
      "You can only fly to a connected plot. The boss waits at the top.",
    ],
  },
  {
    title: "Jets and unlocks",
    lines: [
      "F-16C Fighting Falcon, the nimble multirole fighter, is ready at the first briefing.",
      "F-15E Strike Eagle unlocks when you defeat the Act 1 boss, the Phantom “Graue Eule”.",
      "F-22A Raptor unlocks when you win a full sortie.",
      "EA-18G Growler unlocks when you have resolved 5 mystery events across sorties.",
      "Unlocks and the current sortie are stored in this browser.",
    ],
  },
];
