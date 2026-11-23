# Meridian

A roguelike deck-builder about holding three fictional air corridors. You fly one jet, spend Energy on a hand of attacks, maneuvers, and systems, and try to bring the airframe home.

Every squadron, airframe, and marking in Meridian is original. Jets are drawn in code as SVG. Nothing here uses historical air-force insignia.

## Run it

```bash
npm install
npm run dev
```

The dev server binds to port **8731**. Open [http://127.0.0.1:8731](http://127.0.0.1:8731).

```bash
npm test        # combat, map generation, and seeded full-sortie simulations
npm run build   # typecheck and write static files to dist/
npm run preview # serve the production build
```

`npm run build` emits a static site (`base: "./"`), so `dist/` can be hosted on any static file host.

## How a sortie works

1. Pick a jet in the hangar. Only the **CF-9 Kite** is available on a fresh browser.
2. Each act is a fully visible branching map. Choose a lane, then the next connected plot.
3. Fights are turn-based. You draw 5 cards, spend Energy, then end the turn. Enemies telegraph their next action.
4. HP carries from fight to fight. It rises only when something heals you: a card, a relic, a reward, a depot, or an event.
5. Clear the act boss to generate the next corridor. Clear Act 3's boss, **Nebelhorn**, to win.

Plot types: **Battle**, **Elite**, **Depot** (shop), **Mystery**, **Gamble**, and **Boss**.

Depots sell cards, relics, a repair, and card removal. Gambles install either a useful relic or a cursed one. Mysteries ask you to choose.

After each fight you stow a gold purse plus one extra find: a choice of cards, a relic, repairs, or bonus gold. Bosses pay a relic, a card draft, and a repair.

## Jets and unlocks

Unlocks and the in-progress sortie are stored in `localStorage` (`meridian.meta.v1` and `meridian.run.v1`). Clearing site data resets them.

| Jet | Role | Starts | Unlocks when |
| --- | --- | --- | --- |
| CF-9 Kite | Interceptor | Yes | — |
| AS-4 Bulwark | Strike fighter | No | Defeat the Act 1 boss, Graue Eule |
| VX-7 Moth | Stealth jet | No | Win a full sortie |
| EW-2 Lattice | Electronic warfare | No | Resolve 5 mystery events across sorties |

Each jet has its own max HP, starting deck, card pool, and a built-in relic:

- **Vector Vanes** (Kite): the first Attack each turn costs 1 less Energy.
- **Ordnance Bay** (Bulwark): the first Attack each turn deals 5 extra damage.
- **Moth Dust** (Moth): gain 1 Evasion at the start of each turn.
- **Spectrum Mast** (Lattice): apply 1 Jam to the lead enemy at the start of each turn.

The hangar shows locked jets and the exact condition. The Records screen tracks sorties, wins, deepest corridor, and the mystery counter.

## Combat, briefly

- **Shield** absorbs attack damage until your next turn. It does not stop Burn.
- **Evasion** cancels one incoming hit per stack.
- **Locked** adds 3 damage to every hit against that craft. One stack fades at the start of each of your turns, so apply it and then fire.
- **Jam** reduces the next attack that craft makes by 3 per stack, then clears.
- **Burn** deals damage through Shield and Armor at the start of that craft's turn, then fades by 1.
- **Thrust** and **Armor** last the whole fight. **Suppress** zeroes the next attack. **Static** reduces your draw.

Systems exhaust and stay in effect for the fight. The hand holds 10 cards. Keys: `1–9` play a card, `E` or `Enter` ends the turn.

## What's in the box

- 70+ cards across a shared pool and four jet pools
- 28 relics, including six cursed relics that only come from gambles and one bad offer
- 20 enemy airframes, including three bosses with their own phase rules
- 10 mystery events
- 3 acts: Baltic Shelf, Rhine Gate, Glass Meridian

Enemies are fictional Graukreis designs with animal and weather names (Habicht, Sturmfalke, Königsadler, Nebelhorn, and others). Markings are a plain ring and chevron.

## Tests

`npm test` covers:

- Map generation: every seed connects every plot to a start and to the boss, with the right mix of plot types
- Combat: damage, Shield, Burn, Evasion, Locked, Jam, the Kite's Energy discount, and a play-through of every card
- Sortie flow: HP does not reset after a fight, Bulwark unlocks when Graue Eule goes down, depots sell cards and repairs
- A scripted interceptor build can kill the Act 1 boss
- Seeded autopilot sorties win at least one full three-act run

## Design notes

The autopilot used in tests is intentionally simple. It still wins some seeds and reaches Act 3 on others, which is the band the fights were tuned for: a careful player who blocks the telegraphed hits and spends gold on repairs should be able to finish. A greedy damage race can still lose, especially to elites and the later bosses.

Graue Eule gains a damage bonus and paints Burn once she drops under half HP. Königsadler sheds Armor over the fight, then molts into a hotter airframe after you have had a turn at zero Armor. Nebelhorn changes pattern at 60% and 30% HP; the last layer ignores Evasion.
