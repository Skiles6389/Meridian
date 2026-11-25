import type { JetId, Meta, RunState } from "../game/types";
import type { CamShot } from "./camera";

export interface AppState {
  view: "title" | "how" | "hangar" | "records" | "run";
  meta: Meta;
  run: RunState | null;
  jetPick: JetId;
  seedInput: string;
  modal: null | "deck" | "abort" | "confirm-new" | "settings";
  deckTab: "loadout" | "draw" | "discard" | "exhaust";
  targetUid: number | null;
  toast: string;
  toastKind: "info" | "bad";
  relicId: string | null;
  selectedNode: string | null;
  howPage: number;
  returnView: "title" | "run";
  /** Hand index raised for inspection or waiting for a target. */
  armed: number | null;
  showLog: boolean;
  /** Battle snapshot drawn while the final blows of a fight play out. */
  frozen: RunState | null;
  /** On phones, the reward or shop card tapped once and waiting for a confirming tap. */
  pickArm: string | null;
  /** Battle camera: close behind the jet on the player's turn, pulled back while enemies attack. */
  cam: CamShot;
}
