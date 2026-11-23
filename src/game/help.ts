export interface HelpPage {
  title: string;
  lines: string[];
}

export const HELP: HelpPage[] = [
  {
    title: "The sortie",
    lines: [
      "Meridian is a three-corridor deck sortie. You fly one jet, spend Energy on cards, and try to bring the airframe home.",
      "Act 1 is the Baltic Shelf, Act 2 is the Rhine Gate, Act 3 is the Glass Meridian. Clear the boss and the next map is generated. Clear Nebelhorn and the sortie is won.",
      "HP carries between fights. Nothing heals you unless a card, a relic, a depot, a reward, or an event says so.",
      "Every airframe, squadron, and marking in this game is fictional. No historical insignia are used.",
    ],
  },
  {
    title: "Your turn",
    lines: [
      "You start each turn with 3 Energy (more, if a relic says so) and draw 5 cards. The hand holds 10.",
      "Play Attacks, Maneuvers, and Systems by spending Energy. Then press End Turn. Enemies act in the order shown, using the intent above each jet.",
      "Shield disappears when your next turn starts. It soaks attack damage. It does not stop Burn.",
      "Keys: 1–9 play a card, E or Enter ends the turn, Esc closes a panel.",
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
      "CF-9 Kite, the interceptor, is ready at the first briefing.",
      "AS-4 Bulwark unlocks when you defeat the Act 1 boss, Graue Eule.",
      "VX-7 Moth unlocks when you win a full sortie.",
      "EW-2 Lattice unlocks when you have resolved 5 mystery events across sorties.",
      "Unlocks and the current sortie are stored in this browser.",
    ],
  },
];
