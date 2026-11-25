# Dogfight

A roguelike deck-builder about holding three air corridors. You fly one real-world jet, spend Energy on a hand of attacks, maneuvers, and systems, and try to bring the airframe home.

The aircraft are real types: you fly an F-16C, F-15E, F-22A, EA-18G, or A-10C against German-operated Starfighters, Alpha Jets, Phantoms, Fulcrums, Tornados, Eurofighters, and the F-35A. Squadrons, callsigns, and the conflict itself are fictional, and every airframe wears neutral markings. No historical or national insignia appear anywhere.

All art is original and painted for this game: title key art, side views and chase-camera rear and front views of every jet, layered act skies, a hand-drawn briefing chart, card illustrations, and event scenes. The look is cel-shaded 3D anime: crisp ink outlines, two-to-three-tone shading with hard-edged shadows, a cool rim light and sharp specular highlights, so the jets read as models rather than flat paintings, while the airframes stay true to the real types.

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

`npm run build:single` writes `dist-single/dogfight.html`: one file (about 4.3 MB) with the script, styles, fonts, and art inlined. Double-click it, or open it from `file://`, on a desktop or phone browser. No server. Sortie progress and unlocks stay in that browser's `localStorage`. Copies are committed at `play/dogfight.html` and `play/meridian.html` (the pre-rename path, kept so old links work), and a workflow rebuilds both on every push to `main`.

## How a sortie works

1. Pick a jet and a difficulty in the hangar. Only the **F-16C Fighting Falcon** is available on a fresh browser.
2. Each act is a fully visible branching map. Choose a lane, then the next connected plot.
3. Fights are turn-based and seen from a chase camera just behind and above your jet. You draw 5 cards, spend Energy, then end the turn. On your turn the camera sits close on your tail and looks ahead at the bandits, with a HUD bracket on the one you are tracking; tap or click a jet to pick your target. Each enemy telegraphs its next action with an intent icon above it, and its hull, Shield, and statuses sit just below. Your own hull, Shield, statuses, and powers are on the pilot panel. When you end the turn the camera pulls well back to a wide external view of your jet and the airspace around it. Each attacking bandit banks out past the edge of the screen trailing vapour, stays out of sight for a beat, then comes back in low and settles onto your six. While they are behind you the tag reads "Bandits on your six". From there they fire forward at your jet, and the hits, blocks, and dodges land on it. Bandits that are only shielding or buffing roll in place. Then they overshoot off-screen ahead of you and drop back into their slots as the camera pushes in for your turn. With reduced motion turned on, the bandits move straight to the six and back without the flight.
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

## Animation and effects

Card effects are physically grounded: everything starts from a real place on the jet's sprite and behaves like the hardware it stands for.

- **Guns** fire tracer from the jet's actual gun position: the F-16's left wing root, the F-15E's and F-22's right wing root, the EA-18G's nose, the A-10's GAU-8 under the nose, and each enemy's own gun. The muzzle flash sits on the jet at the gun port and lights the hull around it, the tracers start from it, the rounds shrink into the distance as they close on the target, and they strike sparks off its hull. Some rounds go wide.
- **Missiles** hang on the wing as drawn missile silhouettes, sized to the airframe's wingspan and leaning in with the rear view's perspective: on the F-16, AIM-9s on the wingtip rails and AIM-120s on the outer pylons. Playing a missile card lights the motor of one of them where it hangs, and that same missile leaves along its own axis, then flies a guided arc on a smoke trail to detonate on the target. That station stays empty until the start of your next turn. The F-22 and F-35 carry theirs inside: a bay door opens and the missile drops out. Enemies launch from their own pylons in the same way.
- **Rockets** ripple from the A-10's pods, **bombs** fall from the belly or bay, and a jamming attack is a faint shimmer from the EA-18G's pods followed by interference and arcing on the target's hull.
- **Flares** eject from the dispensers and fall behind, **chaff** is a glittering cloud from the tail, a **shield or plating** card is a sheen across the hull and a blocked hit is a ricochet off it, stealth cards darken the hull and dim the exhaust, and maneuver cards fly the maneuver with vapour off the wingtips.

The code is split by job:

- `src/ui/anchors.ts` is the table of where things are on each chase sprite, in percentages of the sprite: the gun muzzle and the weapon stations for every jet in every view, plus flare dispensers, the chaff point, jamming pods, wingtips, belly and nose for the player jets.
- `src/ui/art.ts` lays the stores and invisible anchor markers over each sprite, so effects read real screen positions and follow the jet as it moves, banks, or is mirrored.
- `src/ui/stores.ts` draws the hanging weapons (AIM-9, AIM-120, air-to-ground missile, rocket pod) and works out their size and lean from the airframe's wingspan. The launch effect draws the same shape, so the missile that flies is the one that was hanging.
- `src/ui/debug.ts` is the anchor sheet: add `#anchors` to the game's address to see every chase sprite on a grid with its anchors marked and labelled, or `#anchors=f16-rear` for one sprite. Use it when adding or moving an anchor.
- `src/ui/flight.ts` is the moving battle backdrop (see below).
- `src/ui/loadout.ts` remembers which pylons have been fired, so a redraw does not put a missile back.
- `src/ui/cardfx.ts` is pure data: one recipe per card id. A recipe is a list of cast steps on your own jet, an optional shot, an impact, and how long the cast leads the hit. Cards of one kind share a base animation and differ in its numbers.
- `src/ui/cardplay.ts` draws those recipes. Enemy fire uses the same shots.
- `src/ui/gfx.ts` is the engine: particles and drawn effects on a single full-screen 2D canvas, capped at 700 particles, with a freeze for hit-stop. A turn costs a redraw of that canvas and almost no DOM work.
- `src/ui/fx.ts` runs the timeline: card ghosts, deal, discard and reshuffle, damage numbers, bars, banners, the camera, and the enemy swap.
- `src/ui/crashplan.ts` and `src/ui/wreck.ts` are how a jet dies (see below): the first is the choice, the timings and the break lines, as plain data; the second draws it.
- `src/motion.css` holds the easing tokens, the one-shot UI animations, screen entrances, and the reduced-motion overrides.

To give a new card its animation, add one entry to `CARD_ANIMS` in `cardfx.ts`:

```ts
myCard: {
  cast: [{ fx: "designate", on: "target", shape: "diamond", tint: C.red, sfx: "lock" }],
  shot: aam({ loft: 60 }),
  impact: { fx: "blast", color: "#ffb347" },
  lead: 220,
},
```

The shots are `gun`, `missile`, `rocket`, `bomb` and `ew`; the cast steps are `flares`, `chaff`, `jam`, `armor`, `pose`, `burner`, `vent`, `dim`, `designate`, `scan`, `repair`, `reload`, `strobe`, `spinup` and `crack`. A card with no entry still plays with a plain fallback, and the tests fail until it gets its own. A new airframe needs an entry in `ANCHORS` for each of its chase sprites; the tests fail without one.

### The moving backdrop

Behind a fight the world moves as if you are flying over it. One WebGL canvas draws the act's sky above a steady horizon, the sea or terrain streaming toward and under the camera in perspective, a cloud deck and near wisps that pass faster the closer they are, and distant ridges that barely move. The backdrop banks and bobs with your jet, from the same motion that sways the jet itself. On the enemy turn the view widens and the world speeds up a little. It is one full-screen shader pass, and it lowers its own resolution if frames come late. With reduced motion the world creeps and nothing sways. Without WebGL the act's still painting shows instead.

### Shoot-downs

A jet that is killed crashes and explodes, in one of two ways. Both are drawn from a copy of the sprite that was on screen, in its paint.

- **Mid-air kill.** A white impact frame, then a fireball of flat cel tones that cools to a smoke puff. The airframe breaks along jagged lines: the four wing panels are cut from the view you were looking at, and the tail section, centre section and nose from the profile. Each piece is scorched, has a glowing torn edge, and spins and tumbles away under gravity trailing a wisp of smoke.
- **Crash.** The jet catches fire, rolls off into its profile and goes down nose first, either corkscrewing or in a straight dive, with flames on the airframe and a trail of black smoke. It shrinks toward a point on the sea or the ground and blows up there: a fireball with a column of water and a foam ring over the sea (Acts 1 and 3), or dust, thrown debris and a scorch mark over land (Act 2). The mark is pinned to the moving ground, so it slides toward the camera, grows, and passes away underneath. This is drawn on a second canvas between the backdrop and the fight, so the jet falls behind your own jet and the HUD.

What killed the jet weighs the choice. Missiles, rockets and bombs break a jet up four times in five; gunfire brings it down burning three times in four; a jet that burns to death always goes down; anything else is even. A bandit on your six always breaks up, because it has no room to fall through the frame.

A boss gets a longer, bigger version: its airframe shudders under a run of secondary explosions before the end, the blast and debris are 1.6 times the size, more explosions follow, and the whole thing lasts about twice as long. Your own jet dies the same two ways when a sortie is lost. In a crash the camera stops following, the jet falls away ahead of you, and you fly over where it hit before the result comes up.

The explosion (the break-up, or the impact with the surface) is the frame the hit-stop, the screen shake, the flash and the sound are fired from, all on the effects clock, so they stay together when you tap to hurry. A kill in the middle of a fight holds things up for about half a second and plays out behind your next card; the kill that ends a fight is allowed to finish before the banner. With reduced motion there is one still fireball that fades, and the sound.

To see one kind on every kill in the dev server, run `__dogfight.forceDemise("midair")` or `("crash")` in the console; `null` goes back to choosing.

On the enemy turn the camera pulls back and the attackers bank out past the edge of the screen, stay out of sight for a beat, then come back in low onto your six. After firing they overshoot off-screen and return to their slots. Two attackers take a little under four seconds.

With `prefers-reduced-motion` set, flights, particles, crashes, shake and hit-stop are skipped and state changes cut straight to their result. Pylons still empty and rearm.

## What's in the box

- 85+ cards across a shared pool and five jet pools
- 32 relics, including seven cursed relics that only come from gambles, events, the Threat ladder, and one bad offer
- 23 enemy airframes, including one elite per act and three bosses with their own phase rules
- 18 mystery events
- 3 acts: Baltic Shelf, Rhine Gate, Glass Meridian

Enemies are real German-operated types flown by fictional flights with animal and weather callsigns: F-104G Starfighters, Alpha Jets, RF-4E and F-4F Phantoms, MiG-29G Fulcrums, Tornado IDS and ECR, Eurofighter Typhoons, and the F-35A. Variants (night, recon, test-cell, cruise-missile carrier, display team, weapons school) fill out the roster, each with its own livery tint. The bosses are an F-4F Phantom (“Graue Eule”), a Typhoon display prototype (“Königsadler”), and an F-35A (“Nebelhorn”).

## Art

Painted art lives in `src/assets/art/` as WebP (about 2.8 MB in total):

- `jets/`: 17 side-view airframes on transparent backgrounds, used in the hangar, title, and HUD. `jets.json` records each image's aspect ratio and nozzle position, which the game uses to place the afterburner glow.
- `chase/`: 25 chase-camera sprites: a rear view of each of the five player jets and of each enemy airframe, plus a front-quarter view of each enemy for when it comes round toward the camera during the swap. `chase.json` records each sprite's aspect ratio and lit nozzles for the afterburner flicker. The sprites are painted clean, with no weapons on them: missiles and rocket pods are drawn over them at the stations in `src/ui/anchors.ts`.
- `scenes/`: act skies (stormy sea, river valley at dusk, high altitude under the aurora), high-altitude chase-camera versions of each for battles and a seamless ground texture per act for the moving backdrop, drifting fog layers, the hangar, the depot, the briefing-chart paper, and the title screen's key art (a wide and a tall painting of the dogfight, and two cloud banks that drift across it).
- `chase-mask.json`: a coarse map of where each chase sprite is solid, which the tests use to keep every anchor on the airframe.
- `cards/`: 20 illustration themes that the cards map onto by effect.
- `events/`: one scene per mystery, plus the gamble and intermission screens.

`tools/process-art.py` is the pipeline that turned the raw paintings into these files: it keys the jets out of a flat backdrop, crops them, finds the lit nozzle glow, erases any painted-on stores listed in its `CHASE_ERASE` table so they do not clash with the weapon overlays, and resizes and compresses everything. The raw sources are not checked in.

## Tests

`npm test` covers:

- Map generation: every seed connects every plot to a start and to the boss, with the right mix of plot types
- Combat: damage, Shield, Burn, Evasion, Locked, Jam, the Kite's Energy discount, and a play-through of every card
- Sortie flow: HP does not reset after a fight, the F-15E unlocks when Graue Eule goes down, depots sell cards and repairs
- Content: every jet, enemy, card, and event has art; a pre-re-skin combat save loads with the new names
- Chase camera: every player jet has a rear view and every enemy has rear and front views; foes stay inside the frame and clear of each other on desktop, phone portrait, and phone landscape; the enemy-turn shot pulls back well over twice as wide; the six slots sit behind and below your jet without overlapping; the swap leaves past the screen edge, re-enters from beyond it, and arrives tail-on (also on a wide, short landscape stage), and the overshoot leaves tail-on and settles back from the side it left by; heading picks the rear, profile, or front-quarter painting
- Anchors: every anchor of every chase sprite lands on a solid pixel of the sprite, not in the air around it; every player jet has a gun muzzle, weapon stations, flare dispensers and the other markers on its rear view; every enemy has a muzzle and stations in both its rear and front-quarter views; every chase sprite has an entry and every point is inside its sprite; the guns sit where the real ones do; the F-22 and F-35 use bays; pylons fire once each, wanted kinds first, and rearm
- Stores and backdrop: the F-16 carries AIM-9s on its tips and AIM-120s on its pylons, hanging weapons lean inward and more so further out, each has nose and tail markers for the launch; every act has a sky and a ground texture, the jet's sway stays gentle and stops for reduced motion, the wide shot is wider and faster
- Effects: every card id has its own animation recipe and no two recipes are the same; recipes only use known steps, shots, impacts and sound cues; every attack has a shot and an impact; the particle pool respects its cap and effects settle with no canvas
- Shoot-downs: both deaths can happen under every weapon, a burning jet always crashes and a jet on your six always breaks up; a boss's death is bigger and longer with secondary explosions; the hit-stop is short and sits on the explosion; every beat has a sound cue; the break lines tile the sprite with no gaps, stay inside it, and always include four wing panels and a tail; a fall only goes down, a spiral rolls right round, and the landing point is below the horizon, on screen and away from your jet on desktop and phone; a mark on the ground moves toward the camera and grows until it passes underneath, and stays put when the ground is not moving
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
