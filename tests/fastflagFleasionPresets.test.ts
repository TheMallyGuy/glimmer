import { describe, expect, test } from "bun:test";
import { FleasionPreset, hiddenFlags } from "$ts/roblox/fastflag/fleasionPresets";

const on = { enabled: true, settings: { deVng: true } };

describe("hiddenFlags", () => {
    test("is empty when Fleasion is off, whatever the options say", async () => {
        expect(await hiddenFlags({ ...on, enabled: false })).toEqual({});
    });

    test("is empty when De-VNG is off", async () => {
        expect(await hiddenFlags({ enabled: true, settings: { deVng: false } })).toEqual({});
    });

    test("De-VNG gives its flags, every value as text", async () => {
        const flags = await hiddenFlags(on);

        expect(flags.FFlagVngAppUpsellPcLayout).toBe("false");
        expect(flags.DFLogAlternateChatKey13OrOverVng).toBe("/");
        expect(flags.FStringVNGWebshopUrl).toStartWith("https://");
        expect(Object.values(flags).every((v) => typeof v === "string")).toBe(true);
        expect(Object.keys(flags).sort()).toEqual(Object.keys(await FleasionPreset.deVng()).sort());
    });
});
