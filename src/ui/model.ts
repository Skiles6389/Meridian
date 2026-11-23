import type { JetId, Meta, RunState } from "../game/types";

export interface AppState {
  view: "title" | "how" | "hangar" | "records" | "run";
  meta: Meta;
  run: RunState | null;
  jetPick: JetId;
  seedInput: string;
  modal: null | "deck" | "abort" | "confirm-new";
  deckTab: "loadout" | "draw" | "discard" | "exhaust";
  targetUid: number | null;
  toast: string;
  toastKind: "info" | "bad";
  shake: boolean;
  relicId: string | null;
  selectedNode: string | null;
  howPage: number;
  returnView: "title" | "run";
}
