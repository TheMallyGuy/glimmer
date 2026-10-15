import type { parseLaunchLink } from "./args";

export type LaunchTarget = "player" | "studio";

export interface LaunchOptions {
  target: LaunchTarget;
  /**
   * a link from the Roblox website or a deep link, to launch with as Roblox's own launcher would
   * (the player only, Studio ignores it)
   */
  link?: string | null;
}

/** what a launch is doing, for the window to say in the person's language */
export type LaunchStatus =
  | {
    step:
    | "checkingForUpdates"
    | "fetchingManifest"
    | "finishingInstallation"
    | "applyingMods"
    | "applyingFlags"
    | "stoppingFleasion"
    | "startingFleasion"
    | "prepare";
  }
  | {
    step: "downloadingClient" | "extractingClient" | "downloadingModOriginals";
    done: number;
    total: number;
  }
  | { step: "signingIn"; name: string }
  | { step: "launching"; version: string };

/** called whenever the launch moves on: what it is doing, and how far it is (percent) when that is known */
export type LaunchReport = (
  status: LaunchStatus,
  progress: number | null,
) => void;

/** why a launch could not sign in as the selected account, for the window to say in the person's language */
export class LaunchError extends Error {
  constructor(
    readonly kind:
      | "accountNeeded"
      | "accountExpired"
      | "accountMissing"
      | "accountFailed",
    /** the display name of the account, for the message */
    readonly account: string,
    /** what went wrong, when the kind does not say it already */
    message: string,
  ) {
    super(message);
  }
}

export interface LaunchContext {
  isStudio: boolean;
  /** how the link of the launch is used, see `parseLaunchLink` */
  link: Awaited<ReturnType<typeof parseLaunchLink>>;
  report: LaunchReport;
}
