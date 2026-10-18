import { fetch } from "@tauri-apps/plugin-http";
import { baseUrl } from "$ts/svg/api";
import { joinUrl } from "$ts/glimmer/utils";

export class GmLink {
  constructor(private readonly base = baseUrl) {}

  async share(code: string, username: string, games: number[]) {
    const res = await fetch(await joinUrl(this.base, `link/${encodeURIComponent(code)}/submit`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, games }),
    });

    const reply = (await res.json().catch(() => null)) as {
      status?: string;
      message?: string;
    } | null;
    if (reply?.status !== "success") {
      throw new Error(reply?.message ?? `the server answered ${res.status}`);
    }
  }
}
