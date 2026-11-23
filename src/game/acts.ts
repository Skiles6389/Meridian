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
    blurb: "Patrol lanes over cold water. The Graukreis are still warming their engines.",
  },
  2: {
    id: 2,
    name: "Rhine Gate",
    blurb: "Veteran wings hold the river corridor. Expect heavier airframes.",
  },
  3: {
    id: 3,
    name: "Glass Meridian",
    blurb: "Experimental plots. The last line before the coast goes dark.",
  },
};
