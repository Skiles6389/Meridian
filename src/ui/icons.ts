import type { NodeType } from "../game/types";

const P: Record<string, string> = {
  shield: `<path d="M12 2.2 20 5.2V11c0 5.4-3.5 9.4-8 11-4.5-1.6-8-5.6-8-11V5.2Z" fill="currentColor" stroke="#0b0f14" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 4.6 17.8 6.8V11c0 3.9-2.4 7-5.8 8.5Z" fill="#fff" opacity=".22"/>`,
  evasion: `<path d="M3.5 16.5C6 9 12.5 5.5 20 7.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M16.5 3.8 20.6 7.4l-4.4 2.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20.5c3-4 7-6 12-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
  locked: `<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  jam: `<path d="M2.5 8.5 5.5 5l3 7 3-9 3 12 3-8 3 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M3 18h18" stroke="currentColor" stroke-width="2" stroke-dasharray="2.5 2" stroke-linecap="round"/>`,
  burn: `<path d="M12 2c1.8 3.7 6.2 6 6.2 11.6 0 4.6-3 8-6.2 8s-6.2-3.1-6.2-7.1c0-3 1.9-4.6 2.5-7.2 1.4 2 1.9 3 3 3.5C11.9 8 11 5.2 12 2Z" fill="currentColor" stroke="#0b0f14" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 13c1 1.6 2.6 2.6 2.6 4.6 0 1.8-1.2 3-2.6 3s-2.6-1.2-2.6-2.9c0-1.6 1.6-2.7 2.6-4.7Z" fill="#fff3c4"/>`,
  thrust: `<path d="M4 6l7 6-7 6M12 6l7 6-7 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  armor: `<path d="M12 2 20.5 7v10L12 22l-8.5-5V7Z" fill="currentColor" stroke="#0b0f14" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="9" r="1.1" fill="#0b0f14"/><circle cx="16" cy="9" r="1.1" fill="#0b0f14"/><circle cx="8" cy="15" r="1.1" fill="#0b0f14"/><circle cx="16" cy="15" r="1.1" fill="#0b0f14"/>`,
  suppress: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M6 18 18 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  static: `<path d="M4 18V9M8 18V5M12 18v-6M16 18V7M20 18v-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  energy: `<path d="M13.5 2 4.5 13.5h6.6L9.8 22 19.5 9.8h-6.6Z" fill="currentColor" stroke="#0b0f14" stroke-width="1.2" stroke-linejoin="round"/>`,
  attack: `<path d="M20.5 3.5 9 15l-2.5-.5L4 17l3 3 2.5-2.5L9 15" fill="none" stroke="#0b0f14" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><path d="M21 3 15.5 3.6 6.3 12.8l4.9 4.9 9.2-9.2Z" fill="currentColor" stroke="#0b0f14" stroke-width="1.3" stroke-linejoin="round"/><path d="m6.3 12.8-3.1.6 2.2 2.2-2.4 4.7 4.7-2.4 2.2 2.2.6-3.1" fill="#ffd27a" stroke="#0b0f14" stroke-width="1.2" stroke-linejoin="round"/>`,
  buff: `<path d="M5 13l7-7 7 7M5 20l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  debuff: `<path d="M2 12c3-5 6-5 9 0s6 5 9 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M2 18c3-5 6-5 9 0s6 5 9 0M2 6c3-5 6-5 9 0s6 5 9 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
  down: `<circle cx="9" cy="13" r="5" fill="currentColor" opacity=".7"/><circle cx="15" cy="10" r="6" fill="currentColor" opacity=".55"/><circle cx="14" cy="16" r="4" fill="currentColor" opacity=".8"/>`,
  coin: `<circle cx="12" cy="12" r="9.5" fill="#f2c14e" stroke="#5c3d08" stroke-width="1.5"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#a8740f" stroke-width="1.4"/><path d="M12 7.5 13.4 10.6 16.6 11 14.2 13.1 14.9 16.3 12 14.6 9.1 16.3 9.8 13.1 7.4 11 10.6 10.6Z" fill="#a8740f"/>`,
  heart: `<path d="M12 21s-8.5-5.2-8.5-11.2C3.5 6.5 5.8 4.3 8.5 4.3c1.6 0 2.8.8 3.5 2 .7-1.2 1.9-2 3.5-2 2.7 0 5 2.2 5 5.5C20.5 15.8 12 21 12 21Z" fill="#e0454f" stroke="#3a0b10" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 7.5c-1 .6-1.6 1.6-1.5 3" stroke="#ffb3b8" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
  deck: `<rect x="7.5" y="3" width="11" height="15" rx="1.6" fill="#2b3a4a" stroke="currentColor" stroke-width="1.6" transform="rotate(10 13 10.5)"/><rect x="5" y="5.5" width="11" height="15" rx="1.6" fill="#1b2633" stroke="currentColor" stroke-width="1.8"/><path d="M8 10h5M8 13h5M8 16h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  map: `<path d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20Z" fill="#2b3a4a" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 14.5l2.5-3 3 1.5 3-4" fill="none" stroke="#e05a4a" stroke-width="1.6" stroke-dasharray="1.6 1.6"/>`,
  gear: `<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8.4 5.3-1.9.4a6.8 6.8 0 0 1-.8 1.9l1.1 1.6-2 2-1.6-1.1a6.8 6.8 0 0 1-1.9.8l-.4 1.9h-2.8l-.4-1.9a6.8 6.8 0 0 1-1.9-.8L6.2 19.4l-2-2 1.1-1.6a6.8 6.8 0 0 1-.8-1.9l-1.9-.4v-2.8l1.9-.4c.2-.7.5-1.3.8-1.9L4.2 6.6l2-2 1.6 1.1c.6-.3 1.2-.6 1.9-.8l.4-1.9h2.8l.4 1.9c.7.2 1.3.5 1.9.8l1.6-1.1 2 2-1.1 1.6c.3.6.6 1.2.8 1.9l1.9.4Z" fill="currentColor"/>`,
  soundOn: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor"/><path d="M15 9c1.3 1.6 1.3 4.4 0 6M17.6 6.5c2.6 3 2.6 8 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  soundOff: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor"/><path d="m15.5 9.5 5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  help: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9v.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.2" fill="currentColor"/>`,
  log: `<path d="M6 3.5h10.5L19 6v14.5H6Z" fill="#2b3a4a" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8.5h7M9 12h7M9 15.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  discard: `<rect x="6" y="4" width="11" height="15" rx="1.6" fill="#1b2633" stroke="currentColor" stroke-width="1.7" transform="rotate(-12 11.5 11.5)"/><path d="M15 15.5 20 20.5M20 15.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  exhaust: `<path d="M12 2.5c1.6 3.4 5.4 5.4 5.4 10.4 0 4-2.7 7.1-5.4 7.1s-5.4-2.8-5.4-6.4c0-2.6 1.6-4 2.2-6.2 1.2 1.7 1.7 2.6 2.6 3.1.4-2.8-.4-5.3.6-8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
};

export function icon(name: string, cls = ""): string {
  const body = P[name] ?? P.help;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

/** Top-down fighter silhouette used as an ink stamp on the chart. */
const TOPJET =
  "M20 3.5 21.6 11l.4 5.4 12.5 7.6v2.6l-12.2-2.9-.6 6.2 4.6 3.7v2l-6.3-1.4-6.3 1.4v-2l4.6-3.7-.6-6.2L5.5 26.6V24l12.5-7.6.4-5.4Z";

const NODE_SVG: Record<NodeType, string> = {
  battle: `<path d="${TOPJET}" fill="currentColor"/>`,
  elite: `<g transform="translate(20 20) scale(.78) translate(-20 -20)"><path d="${TOPJET}" fill="currentColor"/></g><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const x1 = 20 + Math.cos(a) * 15.5;
    const y1 = 20 + Math.sin(a) * 15.5;
    const x2 = 20 + Math.cos(a) * 19;
    const y2 = 20 + Math.sin(a) * 19;
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }).join("")}</g>`,
  shop: `<rect x="7" y="13" width="18" height="17" rx="1" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M7 21.5h18M16 13v17" stroke="currentColor" stroke-width="2"/><ellipse cx="29" cy="15" rx="5" ry="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M24 15v13c0 1.2 2.2 2 5 2s5-.8 5-2V15" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M24 20.5c0 1.1 2.2 2 5 2s5-.9 5-2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m9 10 6-6 2.5 2.5-6 6M8 4.2l3.3 3.3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
  mystery: `<circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-dasharray="4 3"/><path d="M15 15.5a5 5 0 1 1 7 4.6c-1.4.7-2 1.6-2 3.2v1" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><circle cx="20" cy="29" r="2" fill="currentColor"/>`,
  gamble: `<rect x="6" y="11" width="14" height="14" rx="2.5" transform="rotate(-14 13 18)" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="19" y="14" width="14" height="14" rx="2.5" transform="rotate(12 26 21)" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="10.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="15" cy="20.5" r="1.5" fill="currentColor"/><circle cx="23.5" cy="18" r="1.5" fill="currentColor"/><circle cx="26" cy="21" r="1.5" fill="currentColor"/><circle cx="28.5" cy="24" r="1.5" fill="currentColor"/>`,
  boss: `<path d="M20 2 24 9l-1 6 13 8v3l-13-2.6-.6 8 5.6 4.6v2.4l-8-2-8 2V36l5.6-4.6-.6-8L4 26v-3l13-8-1-6Z" fill="currentColor"/>`,
};

export function nodeIcon(type: NodeType): string {
  return `<svg class="node-ico" viewBox="0 0 40 40" aria-hidden="true">${NODE_SVG[type]}</svg>`;
}

const R: Record<string, string> = {
  fbw: `<path d="M12 3v7M12 10l-4 4h8Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 18h16M6 21h3M15 21h3M12 14v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="3.5" r="2" fill="currentColor"/>`,
  pylons: `<path d="M3 6h18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 6v3M17 6v3" stroke="currentColor" stroke-width="1.8"/><path d="M5 9h4v9l-2 3-2-3ZM15 9h4v9l-2 3-2-3Z" fill="currentColor"/>`,
  stealth: `<path d="M12 4 22 15l-4 1.5-6-3-6 3L2 15Z" fill="currentColor"/><path d="M8 19.5h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
  waves: `<path d="M12 21V11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="9.5" r="2" fill="currentColor"/><path d="M7.5 5.5a6.5 6.5 0 0 0 0 8M16.5 5.5a6.5 6.5 0 0 1 0 8M4.5 3a10 10 0 0 0 0 13M19.5 3a10 10 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  tank: `<path d="M3 12c0-2.5 3-4 9-4s9 1.5 9 4-3 4-9 4-9-1.5-9-4Z" fill="currentColor"/><path d="M8 8.6v6.8M16 8.6v6.8" stroke="#0b0f14" stroke-width="1.3"/>`,
  coin: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7.5v9M9.5 9.5c0-1 1-1.6 2.5-1.6s2.5.7 2.5 1.6c0 2.4-5 1.4-5 4 0 1 1 1.6 2.5 1.6s2.5-.6 2.5-1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  shield: `<path d="M12 2.5 19.5 5.3v5.5c0 5-3.3 8.7-7.5 10.2-4.2-1.5-7.5-5.2-7.5-10.2V5.3Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 8v7M8.5 11.5h7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  flame: P.burn,
  wrench: `<path d="M14.5 3.5a5 5 0 0 0-4.6 6.9L3.5 16.8a2 2 0 0 0 2.8 2.8l6.4-6.4a5 5 0 0 0 6.9-4.6l-3 3-2.8-.7-.7-2.8Z" fill="currentColor"/>`,
  eye: `<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>`,
  snow: `<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  card: `<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  lamp: `<path d="M8 10a4 4 0 0 1 8 0v5H8Z" fill="currentColor"/><path d="M6 15h12v3H6ZM12 3v2.5M5 6.5l1.8 1.8M19 6.5l-1.8 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="currentColor"/>`,
  tally: `<path d="M5 5v14M9 5v14M13 5v14M17 5v14M3 15l18-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  stamp: `<path d="M9.5 3h5v5.5l3 3H6.5l3-3Z" fill="currentColor"/><path d="M4.5 13.5h15v3h-15ZM6 19.5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="currentColor"/>`,
  seat: `<path d="M8 3h6l1 9H9Z" fill="currentColor"/><path d="M7 12h10v3H7ZM9 15l-2 6M15 15l2 6M11 3V1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="currentColor"/>`,
  radar: `<path d="M4 18a10 10 0 0 1 10-10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 19 15 9" stroke="currentColor" stroke-width="2"/><path d="M13.5 6.5a4 4 0 0 1 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 3a7.5 7.5 0 0 1 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  dial: `<circle cx="12" cy="13" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 13 16.5 8.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M5.5 13h1.5M17 13h1.5M12 6.5V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  plug: `<path d="M8 3v5M16 3v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5.5 8h13v3a6.5 6.5 0 0 1-13 0Z" fill="currentColor"/><path d="M12 17.5V22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  ammo: `<path d="M6 21V10l2-6 2 6v11ZM14 21V10l2-6 2 6v11Z" fill="currentColor"/><path d="M5.5 17h5M13.5 17h5" stroke="#0b0f14" stroke-width="1.2"/>`,
  tag: `<path d="M4 4h8.5L21 12.5 12.5 21 4 12.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.8" fill="currentColor"/>`,
  star: `<path d="M12 2.5 14.8 8.6l6.7.6-5 4.5 1.5 6.6L12 16.9l-6 3.4 1.5-6.6-5-4.5 6.7-.6Z" fill="currentColor"/>`,
  crack: `<path d="M4 4h16v16H4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2"/><path d="M13 3.5 10.5 9l3 2.5-4 4 1 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>`,
  weight: `<path d="M8 8a4 4 0 1 1 8 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 8h12l2.5 12h-17Z" fill="currentColor"/>`,
};

const RELIC_GLYPH: Record<string, string> = {
  vectorVanes: "fbw",
  ordnanceBay: "pylons",
  mothDust: "stealth",
  spectrumMast: "waves",
  auxTank: "tank",
  wingmanChit: "coin",
  stabilators: "shield",
  hotNozzle: "flame",
  redundantLines: "wrench",
  firstLook: "eye",
  coolantLoop: "snow",
  bingoCard: "card",
  beaconLamp: "lamp",
  tallyStencil: "tally",
  depotStamp: "stamp",
  ejectionSeat: "seat",
  rwrBulb: "radar",
  thirdDetent: "dial",
  busTie: "plug",
  chaffLoader: "ammo",
  memorialTag: "tag",
  noseArt: "star",
  warpedIntake: "crack",
  leadBallast: "weight",
  crackedCanopy: "crack",
  smokedOptics: "eye",
  hauntedPump: "crack",
  paperSeals: "stamp",
};

export function relicIcon(id: string): string {
  const body = R[RELIC_GLYPH[id] ?? "star"] ?? R.star;
  return `<svg class="relic-ico" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
