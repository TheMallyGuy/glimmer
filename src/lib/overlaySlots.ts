import { Link, Shuffle } from "@lucide/svelte";
import type { Component } from "svelte";
import type { ServerActions } from "$ts/roblox/serverActions";

/** the actions of the in-game menu. Their name, description and result text are in the `overlay` dictionary under the same id. */
export type ActionId = "copyInvite" | "hop";

export interface RadialSlot {
  id: ActionId;
  icon: Component<{ size?: number; strokeWidth?: number; class?: string; x?: number; y?: number }>;
  run(actions: ServerActions): Promise<void>;
}

export const radialSlots: (RadialSlot | null)[] = [
  { id: "copyInvite", icon: Link, run: (actions) => actions.copyInvite() },
  { id: "hop", icon: Shuffle, run: (actions) => actions.hop() },
  null,
  null,
  null,
  null,
];
