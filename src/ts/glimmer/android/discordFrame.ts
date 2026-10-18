import type { ActivityOptions } from "../../roblox/discordRpc";

export const DISCORD_APPLICATION_ID = "363445589247131668";

const ACTIVITY_NAME = "Roblox on Android";

export function setActivityFrame(opts: ActivityOptions | null, nonce: string): string {
  const activity = !opts
    ? undefined
    : {
        name: ACTIVITY_NAME,
        details: opts.details,
        state: opts.state,
        timestamps:
          opts.startTimestamp || opts.endTimestamp
            ? { start: opts.startTimestamp, end: opts.endTimestamp }
            : undefined,
        assets:
          opts.largeImage || opts.smallImage
            ? {
                large_image: opts.largeImage,
                large_text: opts.largeText,
                small_image: opts.smallImage,
                small_text: opts.smallText,
              }
            : undefined,
        buttons: opts.buttons?.length ? opts.buttons : undefined,
        party: opts.partyId ? { id: opts.partyId, size: opts.partySize } : undefined,
        secrets:
          opts.joinSecret || opts.spectateSecret || opts.matchSecret
            ? { join: opts.joinSecret, spectate: opts.spectateSecret, match: opts.matchSecret }
            : undefined,
      };
  // undefined keys are dropped by JSON.stringify
  return JSON.stringify({ cmd: "SET_ACTIVITY", args: { pid: 0, activity }, nonce });
}
