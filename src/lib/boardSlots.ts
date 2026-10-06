/** the actions of the in-game menu. Their name, description and result text are in the `overlay` dictionary under the same id. */
export const ACTION_IDS = ["copyInvite", "hop"] as const;

export type ActionId = (typeof ACTION_IDS)[number];

/** a slot that joins one game, on any server. The name is kept so the menu can show it without asking Roblox. */
export interface GameSlot {
  placeId: number;
  name: string;
  /** the icon of the game, a picture on the Roblox CDN */
  iconUrl?: string;
}

/** what the board has in a slot: an action, a game, or null for a blank slot */
export type Slot = ActionId | GameSlot | null;

export type Slots = Slot[];

export const SLOT_COUNT = 6;

export const DEFAULT_SLOTS: Slots = ["copyInvite", "hop", null, null, null, null];

export function isGameSlot(slot: Slot): slot is GameSlot {
  return typeof slot === "object" && slot !== null;
}

function normalizeSlot(saved: unknown): Slot {
  const action = ACTION_IDS.find((known) => known === saved);
  if (action) return action;

  if (typeof saved !== "object" || saved === null) return null;
  const { placeId, name, iconUrl } = saved as Record<string, unknown>;
  if (typeof placeId !== "number" || !Number.isSafeInteger(placeId) || placeId <= 0) return null;
  return {
    placeId,
    name: typeof name === "string" && name ? name : String(placeId),
    ...(typeof iconUrl === "string" && iconUrl.startsWith("https://") && { iconUrl }),
  };
}

/** the saved slots as a board can use them: always `SLOT_COUNT` long, and anything unknown (an action from another version, bad JSON) becomes a blank slot. Nothing saved gives the default board. */
export function normalizeSlots(saved: unknown): Slots {
  if (!Array.isArray(saved)) return [...DEFAULT_SLOTS];
  return Array.from({ length: SLOT_COUNT }, (_, i) => normalizeSlot(saved[i]));
}
