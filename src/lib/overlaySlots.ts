import { Gamepad2, Link, Shuffle } from "@lucide/svelte";
import type { ServerActions } from "$ts/roblox/serverActions";
import { isGameSlot, normalizeSlots, type ActionId } from "$lib/boardSlots";

/** what a slot does: an action, or joining a game. Each has an entry in the `actions` of the `overlay` dictionary. */
export type SlotKind = ActionId | "game";

export interface RadialSlot {
  id: SlotKind;
  /** the name of the game, for a game slot */
  game?: string;
  /** the icon of the game, to draw on the slice in place of `icon` */
  image?: string;
  /** an action works on the server the player is in, so it needs a game. Joining a game does not. */
  needsGame: boolean;
  notify: "start" | "done";
  icon: typeof Link;
  run(actions: ServerActions): Promise<void>;
}

/** every action a slot can hold */
export const actionSlots: Record<ActionId, RadialSlot> = {
  copyInvite: {
    id: "copyInvite",
    needsGame: true,
    notify: "done",
    icon: Link,
    run: (actions) => actions.copyInvite(),
  },
  hop: {
    id: "hop",
    needsGame: true,
    notify: "start",
    icon: Shuffle,
    run: (actions) => actions.hop(),
  },
};

/** the slots of the saved board (blank slots are null): a new action goes in `actionSlots` and `ACTION_IDS` */
export function resolveSlots(saved: unknown): (RadialSlot | null)[] {
  return normalizeSlots(saved).map((slot) => {
    if (!slot) return null;
    if (!isGameSlot(slot)) return actionSlots[slot];
    return {
      id: "game",
      game: slot.name,
      image: slot.iconUrl,
      needsGame: false,
      notify: "start",
      icon: Gamepad2,
      run: (actions) => actions.joinGame(slot.placeId),
    };
  });
}
