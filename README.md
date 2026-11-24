# Dogfight

A roguelike deck-builder about holding three air corridors. You fly one real-world jet, spend Energy on a hand of attacks, maneuvers, and systems, and try to bring the airframe home.

The aircraft are real types: you fly an F-16C, F-15E, F-22A, EA-18G, or A-10C against German-operated Starfighters, Alpha Jets, Phantoms, Fulcrums, Tornados, Eurofighters, and the F-35A. Squadrons, callsigns, and the conflict itself are fictional, and every airframe wears neutral markings. No historical or national insignia appear anywhere.

All art is original and painted for this game: side-view jets, layered act skies, a hand-drawn briefing chart, card illustrations, and event scenes. The look leans lightly toward aviation anime: cel shading, clean ink linework, flatter color with crisp highlights, and drifting speed lines over the skies, while the airframes stay true to the real types.

**Play in a browser:** [htmlpreview.github.io/?https://github.com/Skiles6389/Meridian/blob/main/play/dogfight.html](https://htmlpreview.github.io/?https://github.com/Skiles6389/Meridian/blob/main/play/dogfight.html) (the older `play/meridian.html` link serves the same build)

## Run it

```bash
npm install
npm run dev
```

The dev server binds to port **8731**. Open [http://127.0.0.1:8731](http://127.0.0.1:8731).

```bash
npm test          # combat, map generation, and seeded full-sortie simulations
npm run sim       # headless balance simulator (see below)
npm run build     # typecheck and write static files to dist/
npm run preview   # serve the production build
npm run build:single
```

`npm run build` emits a static site (`base: "./"`), so `dist/` can be hosted on any static file host.

`npm run build:single` writes `dist-single/dogfight.html`: one file (about 2.5 MB) with the script, styles, fonts, and art inlined. Double-click it, or open it from `file://`, on a desktop or phone browser. No server. Sortie progress and unlocks stay in that browser's `localStorage`. Copies are committed at `play/dogfight.html` and `play/meridian.html` (the pre-rename path, kept so old links work), and a workflow rebuilds both on every push to `main`.

## How a sortie works

1. Pick a jet and a difficulty in the hangar. Only the **F-16C Fighting Falcon** is available on a fresh browser.
2. Each act is a fully visible branching map. Choose a lane, then the next connected plot.
3. Fights are turn-based tail chases. You draw 5 cards, spend Energy, then end the turn. Enemies telegraph their next action with an intent icon above the jet. Every jet faces the same way and the attacker flies behind: on your turn you sit on the enemies' tails, and when you end the turn the jets swing past each other so the enemies close in on your six.
4. HP carries from fight to fight. It rises only when something heals you: a card, a relic, a reward, a depot, or an event.
5. Clear the act boss to generate the next corridor. Clear Act 3's boss, **Nebelhorn**, to win.

Plot types: **Battle**, **Elite**, **Depot** (shop), **Mystery**, **Gamble**, and **Boss**.

Depots sell cards, relics, a repair, and card removal. Gambles install either a useful relic or a cursed one. Mysteries ask you to choose.

After each fight you stow a gold purse plus one extra find: a choice of cards, a relic, repairs, or bonus gold. Bosses pay a relic, a card draft, and a repair.

## Jets and unlocks

Unlocks and the in-progress sortie are stored in `localStorage` (`meridian.meta.v1` and `meridian.run.v1`). The keys still carry the game's original name, Meridian, so saves from before the rename keep loading. Clearing site data resets them. Saves from before the re-skin keep working: internal jet ids (`kite`, `bulwark`, `moth`, `lattice`) are unchanged, and a fight saved mid-turn picks up the new names when it loads. Saves from before difficulty existed load on Normal.

| Jet | Role | Starts | Unlocks when |
| --- | --- | --- | --- |
| F-16C Fighting Falcon | Multirole fighter | Yes | — |
| F-15E Strike Eagle | Strike fighter | No | Defeat the Act 1 boss, the Phantom “Graue Eule” |
| F-22A Raptor | Stealth air superiority | No | Win a full sortie |
| EA-18G Growler | Electronic warfare | No | Resolve 5 mystery events across sorties |
| A-10C Thunderbolt II | Close air support | No | Reach Act 3, the Glass Meridian, with any jet |

Each jet has its own max HP, starting deck, card pool, and a built-in relic:

- **Fly-by-Wire** (F-16C): the first Attack each turn costs 1 less Energy.
- **Conformal Stations** (F-15E): the first Attack each turn deals 9 extra damage.
- **Low-Observable Skin** (F-22A): gain 1 Evasion on turn 1 and every third turn after (4, 7, …).
- **ALQ-99 Pods** (EA-18G): apply 2 Jam to the lead enemy at the start of each turn.
- **Titanium Tub** (A-10C): start each fight with 8 Plating, and gain 4 Plating at the start of each turn.

The A-10C is the slow, armored one. **Plating** soaks hits after Shield, does not expire between turns (capped at 30), and feeds its payoffs: Maverick hits harder at 10+ Plating, Armored Run-In scales with it, and Manual Reversion refills it when hits get through. Its GAU-8 cards (BRRRT, Avenger Burst) pierce Armor.

## Difficulty

Pick a difficulty in the hangar before launch. Existing players start on Normal.

- **Rookie**: enemies have 15% less HP and hit 15% softer, repairs heal 40% more, purses pay 20% more, and you launch with 22 extra max HP.
- **Normal**: the standard tuning.
- **Threat 1–10**: an escalating ladder above Normal. Each level keeps every earlier modifier and adds one: veteran elites, thin repairs, hardened bosses, an extra curse at launch, thicker enemy skins, wartime depot prices, lean purses, hot enemy guns, a worn airframe (less max HP), and ace bosses.

Threat 1 opens after a Normal win with any jet, and each Threat win opens the next level. The hangar shows the best level each jet has cleared (R, N, or T1–T10 on the roster tile).

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

- 85+ cards across a shared pool and five jet pools
- 32 relics, including seven cursed relics that only come from gambles, events, the Threat ladder, and one bad offer
- 23 enemy airframes, including one elite per act and three bosses with their own phase rules
- 18 mystery events
- 3 acts: Baltic Shelf, Rhine Gate, Glass Meridian

Enemies are real German-operated types flown by fictional flights with animal and weather callsigns: F-104G Starfighters, Alpha Jets, RF-4E and F-4F Phantoms, MiG-29G Fulcrums, Tornado IDS and ECR, Eurofighter Typhoons, and the F-35A. Variants (night, recon, test-cell, cruise-missile carrier, display team, weapons school) fill out the roster, each with its own livery tint. The bosses are an F-4F Phantom (“Graue Eule”), a Typhoon display prototype (“Königsadler”), and an F-35A (“Nebelhorn”).

## Art

Painted art lives in `src/assets/art/` as WebP (about 1.5 MB in total):

- `jets/`: 17 side-view airframes on transparent backgrounds. `jets.json` records each image's aspect ratio and nozzle position, which the game uses to place the afterburner glow.
- `scenes/`: act skies (stormy sea, river valley at dusk, high altitude under the aurora), drifting fog layers, the hangar, the depot, and the briefing-chart paper.
- `cards/`: 20 illustration themes that the cards map onto by effect.
- `events/`: one scene per mystery, plus the gamble and intermission screens.

`tools/process-art.py` is the pipeline that turned the raw paintings into these files: it keys the jets out of a flat backdrop, crops them, measures nozzles, and resizes and compresses everything. The raw sources are not checked in.

## Tests

`npm test` covers:

- Map generation: every seed connects every plot to a start and to the boss, with the right mix of plot types
- Combat: damage, Shield, Burn, Evasion, Locked, Jam, the Kite's Energy discount, and a play-through of every card
- Sortie flow: HP does not reset after a fight, the F-15E unlocks when Graue Eule goes down, depots sell cards and repairs
- Content: every jet, enemy, card, and event has art; a pre-re-skin combat save loads with the new names
- A scripted interceptor build can kill the Act 1 boss
- Seeded autopilot sorties reach Act 2
- Balance simulator smoke test: both bots fly full sorties on every jet without errors at Rookie, Normal, Threat 5, and Threat 10, a seed replays identically, the smarter bot clears some but not all starter-jet sorties, and runs go deeper on Rookie than on Normal and deeper on Normal than on Threat 10
- Difficulty, A-10C, and new content: old saves default to Normal, the ladder unlocks one level per win, Plating persists and caps, every new event choice resolves

## Design notes

Numbers are tuned with the balance simulator so that, on Normal, a careful player who reads the telegraphed hits finishes roughly two sorties in five, on any jet. Rookie is tuned so that even the greedy bot wins about one sortie in five. Act 1 is a gentle on-ramp; Königsadler and the Act 3 corridor are where most sorties end. A greedy damage race usually loses by the Act 2 boss.

## Balance simulator

`tools/sim/` plays thousands of full sorties headlessly against the real game rules:

```bash
npm run sim -- --runs 2000 --bots greedy,smart --out sim-out
npm run sim -- --runs 1000 --bots smart --explore 0.3 --out sim-out/audit
npm run sim -- --runs 1000 --bots greedy,smart --difficulty rookie --out sim-out/rookie
```

- `--difficulty rookie|normal|1..10` flies every sortie at that difficulty (default `normal`).

- **greedy** plays the card that scores best right now and drafts the most expensive card.
- **smart** plans each turn with a beam search against the visible intents (it never peeks at the draw pile), drafts toward a balanced deck, and routes, shops, and gambles by expected value.
- `--explore 0.3` makes 30% of drafts, gambles, and intermission picks at random, so card and relic lift can be measured without the bot's own taste skewing it.
- `--tweak '{"hp":{"2:boss":1.1}}'` (or a JSON file) scales enemy HP or damage by act and kind, swaps card numbers, jet HP, starter relics, or decks in-process, to try an idea before editing the content files.

Each batch writes `report.md` (win rate and deaths by act per jet and bot, per-encounter damage taken, where runs end, card and relic lift, event and gamble outcomes, gold and healing flow) and `summary.json`; `--records` adds every run's raw record.

Graue Eule gains a damage bonus and paints Burn once she drops under half HP. Königsadler sheds Armor over the fight, then molts into a hotter airframe after you have had a turn at zero Armor. Nebelhorn changes pattern at 60% and 30% HP; the last layer ignores Evasion.
