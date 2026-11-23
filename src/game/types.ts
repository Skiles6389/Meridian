export type JetId = "kite" | "bulwark" | "moth" | "lattice";
export type ActId = 1 | 2 | 3;
export type CardType = "attack" | "maneuver" | "system" | "burden";
export type Rarity = "starter" | "common" | "uncommon" | "rare" | "burden";
export type Pool = "shared" | JetId;
export type NodeType = "battle" | "elite" | "shop" | "mystery" | "gamble" | "boss";
export type SilhouetteId =
  | "kite"
  | "bulwark"
  | "moth"
  | "lattice"
  | "habicht"
  | "kiebitz"
  | "dachs"
  | "luchs"
  | "rabe"
  | "moorhau"
  | "falke"
  | "nachtigall"
  | "bernstein"
  | "marder"
  | "zwilling"
  | "hochbahn"
  | "spiegel"
  | "gewitter"
  | "eisenwal"
  | "schwarz"
  | "weiss"
  | "eule"
  | "adler"
  | "nebel";

export type BossId = "" | "eule" | "adler" | "nebel";

export interface Effect {
  k:
    | "dmg"
    | "shield"
    | "draw"
    | "energy"
    | "evasion"
    | "heal"
    | "lose"
    | "burn"
    | "locked"
    | "jam"
    | "suppress"
    | "static"
    | "thrust"
    | "armor"
    | "power";
  n?: number;
  times?: number;
  aoe?: boolean;
}

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  rarity: Rarity;
  pool: Pool;
  text: string;
  effects: Effect[];
  special?: string;
  exhaust?: boolean;
  target: "enemy" | "all" | "none";
}

export interface CardInst {
  uid: number;
  id: string;
}

export interface Status {
  evasion: number;
  thrust: number;
  armor: number;
  burn: number;
  locked: number;
  jam: number;
  suppress: number;
  static: number;
}

export interface Move {
  name: string;
  damage: number;
  hits: number;
  shield: number;
  thrust: number;
  armor: number;
  burn: number;
  locked: number;
  jam: number;
  suppress: number;
  stat: number;
  heal: number;
}

export interface Fighter {
  uid: number;
  defId: string;
  name: string;
  epithet: string;
  hp: number;
  maxHp: number;
  shield: number;
  status: Status;
  moves: Move[];
  phases: Move[][];
  movePtr: number;
  phase: number;
  silhouette: SilhouetteId;
  accent: string;
  boss: BossId;
  riposte: number;
  riposteReady: boolean;
  bonusDamage: number;
  ignoreEvasion: boolean;
  molted: boolean;
  moltedPending: boolean;
  elite: boolean;
}

export interface CombatState {
  encounterId: string;
  encounterName: string;
  rewardMode: "battle" | "elite" | "boss";
  side: boolean;
  bonusGold: number;
  bonusHealPct: number;
  bonusNote: string;
  enemies: Fighter[];
  draw: CardInst[];
  discard: CardInst[];
  hand: CardInst[];
  played: CardInst[];
  exhaustPile: CardInst[];
  energy: number;
  maxEnergy: number;
  turn: number;
  attacksThisTurn: number;
  maneuversThisTurn: number;
  cardsThisTurn: number;
  attacksThisCombat: number;
  lockedDrawUsed: boolean;
  ejectionUsed: boolean;
  powers: string[];
  player: { shield: number; status: Status };
  log: string[];
  outcome: "fight" | "won" | "lost";
}

export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: NodeType;
  edges: string[];
  encounterId: string;
  eventId: string;
}

export interface GameMap {
  act: ActId;
  rows: number;
  nodes: MapNode[];
}

export interface ShopOffer {
  kind: "card" | "relic";
  id: string;
  price: number;
  sold: boolean;
}

export interface ShopState {
  cards: ShopOffer[];
  relics: ShopOffer[];
  healPrice: number;
  healAmount: number;
  healSold: boolean;
}

export interface RewardState {
  purse: number;
  cards: string[] | null;
  relic: string | null;
  heal: number;
  cardTaken: boolean;
  relicTaken: boolean;
  healTaken: boolean;
  note: string;
  next: "map" | "intermission" | "victory" | "advance";
}

export interface EventView {
  id: string;
  done: boolean;
  counted: boolean;
  result: string;
}

export interface GambleView {
  done: boolean;
  result: string;
}

export interface RemoveView {
  price: number;
  next: "shop" | "map";
  /** Gold paid out only after a card actually leaves the deck. */
  goldOnRemove: number;
}

export type RunScreen =
  | "map"
  | "combat"
  | "reward"
  | "shop"
  | "event"
  | "gamble"
  | "remove"
  | "intermission"
  | "victory"
  | "defeat";

export interface RunState {
  version: 1;
  seed: number;
  rngState: number;
  uid: number;
  jet: JetId;
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInst[];
  relics: string[];
  act: ActId;
  map: GameMap;
  nodeId: string | null;
  route: string[];
  screen: RunScreen;
  combat: CombatState | null;
  reward: RewardState | null;
  shop: ShopState | null;
  event: EventView | null;
  gamble: GambleView | null;
  remove: RemoveView | null;
  removals: number;
  notices: string[];
  defeatReason: string;
  closed: boolean;
  /** Sandbox copies used by previews must not touch meta or saves. */
  scratch: boolean;
  tally: {
    battles: number;
    elites: number;
    bosses: number;
    mysteries: number;
    cardsPlayed: number;
    goldEarned: number;
  };
}

export interface MetaStats {
  runs: number;
  wins: number;
  losses: number;
  battles: number;
  elites: number;
  bosses: number;
  act1Bosses: number;
  mysteries: number;
  goldEarned: number;
  cardsPlayed: number;
  deepest: number;
  bestVictoryHp: number;
}

export interface Meta {
  version: 1;
  unlocked: Record<JetId, boolean>;
  stats: MetaStats;
  mute: boolean;
}

export interface Plan {
  kind: "attack" | "defend" | "buff" | "debuff" | "mixed" | "down";
  title: string;
  damage: number;
  hits: number;
  perHit: number;
  uneven: boolean;
  shield: number;
  tags: string[];
}

export function freshStatus(): Status {
  return {
    evasion: 0,
    thrust: 0,
    armor: 0,
    burn: 0,
    locked: 0,
    jam: 0,
    suppress: 0,
    static: 0,
  };
}
