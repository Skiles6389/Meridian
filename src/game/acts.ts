import type { ActId } from "./types";

export interface ActInfo {
  id: ActId;
  name: string;
  blurb: string;
}

export const ACTS: Record<ActId, ActInfo> = {
  1: {
    id: 1,
    name: "Baltic Shelf",
    blurb: "Patrol lanes over a storm-tossed sea. The Graukreis aggressor wing is still warming its Starfighters.",
  },
  2: {
    id: 2,
    name: "Rhine Gate",
    blurb: "Tornados and Fulcrums hold the river corridor at dusk. Expect heavier airframes.",
  },
  3: {
    id: 3,
    name: "Glass Meridian",
    blurb: "High above the cloud deck, under the aurora. Typhoons and Lightnings guard the last line.",
  },
};
