import { describe, expect, test } from "bun:test";
import { setActivityFrame } from "$ts/glimmer/android/discordFrame";

describe("setActivityFrame", () => {
    test("turns the options into a SET_ACTIVITY frame with the nonce", () => {
        const frame = JSON.parse(
            setActivityFrame(
                {
                    details: "Blox Fruits",
                    state: "In a game",
                    largeImage: "https://x/y.png",
                    largeText: "Blox Fruits",
                    startTimestamp: 1000,
                    buttons: [{ label: "Play", url: "https://roblox.com" }],
                    partyId: "p",
                    partySize: [1, 5],
                },
                "n1",
            ),
        );

        expect(frame).toEqual({
            cmd: "SET_ACTIVITY",
            nonce: "n1",
            args: {
                pid: 0,
                activity: {
                    name: "Roblox",
                    details: "Blox Fruits",
                    state: "In a game",
                    timestamps: { start: 1000 },
                    assets: { large_image: "https://x/y.png", large_text: "Blox Fruits" },
                    buttons: [{ label: "Play", url: "https://roblox.com" }],
                    party: { id: "p", size: [1, 5] },
                },
            },
        });
    });

    test("leaves out what is not set, and null clears the activity", () => {
        expect(JSON.parse(setActivityFrame({ details: "a" }, "n")).args.activity).toEqual({ name: "Roblox", details: "a" });
        expect(JSON.parse(setActivityFrame(null, "n")).args).toEqual({ pid: 0 });
    });
});
