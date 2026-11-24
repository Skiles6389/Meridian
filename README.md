# Meridian

A roguelike deck-builder about holding three air corridors. You fly one real-world jet, spend Energy on a hand of attacks, maneuvers, and systems, and try to bring the airframe home.

The aircraft are real types: you fly an F-16C, F-15E, F-22A, or EA-18G against German-operated Starfighters, Alpha Jets, Phantoms, Fulcrums, Tornados, Eurofighters, and the F-35A. Squadrons, callsigns, and the conflict itself are fictional, and every airframe wears neutral markings. No historical or national insignia appear anywhere.

All art is original and painted for this game: side-view jets, layered act skies, a hand-drawn briefing chart, card illustrations, and event scenes. The look leans lightly toward aviation anime: cel shading, clean ink linework, flatter color with crisp highlights, and drifting speed lines over the skies, while the airframes stay true to the real types.

**Play in a browser:** [htmlpreview.github.io/?https://github.com/Skiles6389/Meridian/blob/main/play/meridian.html](https://htmlpreview.github.io/?https://github.com/Skiles6389/Meridian/blob/main/play/meridian.html)

## Run it

```bash
npm install
npm run dev
```

The dev server binds to port **8731**. Open [http://127.0.0.1:8731](http://127.0.0.1:8731).

```bash
npm test          # combat, map generation, and seeded full-sortie simulations
npm run build     # typecheck and write static files to dist/
npm run preview   # serve the production build
npm run build:single
```

`npm run build` emits a static site (`base: "./"`), so `dist/` can be hosted on any static file host.

`npm run build:single` writes `dist-single/meridian.html`: one file (about 2.2 MB) with the script, styles, fonts, and art inlined. Double-click it, or open it from `file://`, on a desktop or phone browser. No server. Sortie progress and unlocks stay in that browser's `localStorage`. A copy is committed at `play/meridian.html`, and a workflow rebuilds it on every push to `main`.

## How a sortie works

1. Pick a jet in the hangar. Only the **F-16C Fighting Falcon** is available on a fresh browser.
2. Each act is a fully visible branching map. Choose a lane, then the next connected plot.
3. Fights are turn-based. You draw 5 cards, spend Energy, then end the turn. Enemies telegraph their next action with an intent icon above the jet.
4. HP carries from fight to fight. It rises only when something heals you: a card, a relic, a reward, a depot, or an event.
5. Clear the act boss to generate the next corridor. Clear Act 3's boss, **Nebelhorn**, to win.

Plot types: **Battle**, **Elite**, **Depot** (shop), **Mystery**, **Gamble**, and **Boss**.

Depots sell cards, relics, a repair, and card removal. Gambles install either a useful relic or a cursed one. Mysteries ask you to choose.

After each fight you stow a gold purse plus one extra find: a choice of cards, a relic, repairs, or bonus gold. Bosses pay a relic, a card draft, and a repair.

## Jets and unlocks

Unlocks and the in-progress sortie are stored in `localStorage` (`meridian.meta.v1` and `meridian.run.v1`). Clearing site data resets them. Saves from before the re-skin keep working: internal jet ids (`kite`, `bulwark`, `moth`, `lattice`) are unchanged, and a fight saved mid-turn picks up the new names when it loads.

| Jet | Role | Starts | Unlocks when |
| --- | --- | --- | --- |
| F-16C Fighting Falcon | Multirole fighter | Yes | — |
| F-15E Strike Eagle | Strike fighter | No | Defeat the Act 1 boss, the Phantom “Graue Eule” |
| F-22A Raptor | Stealth air superiority | No | Win a full sortie |
| EA-18G Growler | Electronic warfare | No | Resolve 5 mystery events across sorties |

Each jet has its own max HP, starting deck, card pool, and a built-in relic:

- **Fly-by-Wire** (F-16C): the first Attack each turn costs 1 less Energy.
- **Conformal Stations** (F-15E): the first Attack each turn deals 5 extra damage.
- **Low-Observable Skin** (F-22A): gain 1 Evasion at the start of each turn.
- **ALQ-99 Pods** (EA-18G): apply 1 Jam to the lead enemy at the start of each turn.

The hangar shows locked jets and the exact condition. The Records screen tracks sorties, wins, deepest corridor, and the mystery counter.

## Combat, briefly

- **Shield** absorbs attack damage until your next turn. It does not stop Burn.
- **Evasion** cancels one incoming hit per stack.
- **Locked** adds 3 damage to every hit against that craft. One stack fades at the start of each of your turns, so apply it and then fire.
- **Jam** reduces the next attack that craft makes by 3 per stack, then clears.
- **Burn** deals damage through Shield and Armor at the start of that craft's turn, then fades by 1.
- **Thrust** and **Armor** last the whole fight. **Suppress** zeroes the next attack. **Static** reduces your draw.

Systems exhaust and stay in effect for the fight. The hand holds 10 cards.

Controls: click a card to play it, or drag it onto the stage. Cards that need a target arm on click (an arrow follows the pointer), then fire at the enemy you click; dragging onto an enemy also works. On a phone, the first tap raises a card so you can read it, and a second tap (or a tap on an enemy) plays it. Keys: `1–9` play a card, `E` or `Enter` ends the turn, `Esc` cancels. Clicking during an animation speeds it up.

## What's in the box

- 70+ cards across a shared pool and four jet pools
- 28 relics, including six cursed relics that only come from gambles and one bad offer
- 20 enemy airframes, including three bosses with their own phase rules
- 10 mystery events
- 3 acts: Baltic Shelf, Rhine Gate, Glass Meridian

Enemies are real German-operated types flown by fictional flights with animal and weather callsigns: F-104G Starfighters, Alpha Jets, RF-4E and F-4F Phantoms, MiG-29G Fulcrums, Tornado IDS and ECR, Eurofighter Typhoons, and the F-35A. Variants (night, recon, test-cell, cruise-missile carrier) fill out the roster, each with its own livery tint. The bosses are an F-4F Phantom (“Graue Eule”), a Typhoon display prototype (“Königsadler”), and an F-35A (“Nebelhorn”).

## Art

Painted art lives in `src/assets/art/` as WebP (about 1.2 MB in total):

- `jets/`: 16 side-view airframes on transparent backgrounds. `jets.json` records each image's aspect ratio and nozzle position, which the game uses to place the afterburner glow.
- `scenes/`: act skies (stormy sea, river valley at dusk, high altitude under the aurora), drifting fog layers, the hangar, the depot, and the briefing-chart paper.
- `cards/`: 18 illustration themes that the cards map onto by effect.
- `events/`: one scene per mystery, plus the gamble and intermission screens.

`tools/process-art.py` is the pipeline that turned the raw paintings into these files: it keys the jets out of a flat backdrop, crops them, measures nozzles, and resizes and compresses everything. The raw sources are not checked in.

## Tests

`npm test` covers:

- Map generation: every seed connects every plot to a start and to the boss, with the right mix of plot types
- Combat: damage, Shield, Burn, Evasion, Locked, Jam, the Kite's Energy discount, and a play-through of every card
- Sortie flow: HP does not reset after a fight, the F-15E unlocks when Graue Eule goes down, depots sell cards and repairs
- Content: every jet, enemy, card, and event has art; a pre-re-skin combat save loads with the new names
- A scripted interceptor build can kill the Act 1 boss
- Seeded autopilot sorties win at least one full three-act run

## Design notes

The autopilot used in tests is intentionally simple. It still wins some seeds and reaches Act 3 on others, which is the band the fights were tuned for: a careful player who blocks the telegraphed hits and spends gold on repairs should be able to finish. A greedy damage race can still lose, especially to elites and the later bosses.

Graue Eule gains a damage bonus and paints Burn once she drops under half HP. Königsadler sheds Armor over the fight, then molts into a hotter airframe after you have had a turn at zero Armor. Nebelhorn changes pattern at 60% and 30% HP; the last layer ignores Evasion.
