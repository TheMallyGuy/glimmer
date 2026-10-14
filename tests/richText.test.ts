import { describe, expect, test } from "bun:test";
import { RICH_TAGS, parseRichText, stripRichText } from "$lib/richText";

describe("parseRichText", () => {
    test("a string with no tags is one plain run", () => {
        expect(parseRichText("Nothing to see")).toEqual([{ text: "Nothing to see" }]);
    });

    test("an empty string has no runs", () => {
        expect(parseRichText("")).toEqual([]);
    });

    test("a tagged run sits between the plain text around it", () => {
        expect(parseRichText("Your login [danger]expired[/danger], sign in again")).toEqual([
            { text: "Your login " },
            { text: "expired", tag: "danger" },
            { text: ", sign in again" },
        ]);
    });

    test("a string that is all one tag has just that run", () => {
        expect(parseRichText("[accent]Done[/accent]")).toEqual([{ text: "Done", tag: "accent" }]);
    });

    test("several tags in one string keep their order", () => {
        expect(parseRichText("[danger]a[/danger] b [mono]c[/mono][muted]d[/muted]")).toEqual([
            { text: "a", tag: "danger" },
            { text: " b " },
            { text: "c", tag: "mono" },
            { text: "d", tag: "muted" },
        ]);
    });

    for (const tag of RICH_TAGS) {
        test(`${tag} is a tag`, () => {
            expect(parseRichText(`[${tag}]x[/${tag}]`)).toEqual([{ text: "x", tag }]);
        });
    }

    test("aurora runs tagged and unknown tags stay plain", () => {
        expect(parseRichText("[aurora]new[/aurora] [glow]x[/glow]")).toEqual([
            { text: "new", tag: "aurora" },
            { text: " [glow]x[/glow]" },
        ]);
    });

    test("a tagged run can span lines", () => {
        expect(parseRichText("[danger]one\ntwo[/danger]")).toEqual([{ text: "one\ntwo", tag: "danger" }]);
    });

    test("an empty tag shows nothing", () => {
        expect(parseRichText("a[danger][/danger]b")).toEqual([{ text: "a" }, { text: "b" }]);
    });

    test.each([
        "[GAME NAME] joined",
        "[bold]x[/bold]",
        "closed only[/danger]",
    ])("%p stays as it is", (text) => {
        expect(parseRichText(text)).toEqual([{ text }]);
    });

    test("a tag that is never closed runs to the end of the string", () => {
        expect(parseRichText("Careful. [danger]BANNABLE. Really.")).toEqual([
            { text: "Careful. " },
            { text: "BANNABLE. Really.", tag: "danger" },
        ]);
    });

    test("a tag closed by another tag's closing tag also runs to the end", () => {
        expect(parseRichText("[danger]x[/accent]")).toEqual([{ text: "x[/accent]", tag: "danger" }]);
    });

    test("an unclosed tag with nothing after it shows nothing", () => {
        expect(parseRichText("a[danger]")).toEqual([{ text: "a" }]);
    });

    test("tags don't nest: the inner tag shows as text", () => {
        expect(parseRichText("[danger]a [accent]b[/accent] c[/danger]")).toEqual([
            { text: "a [accent]b[/accent] c", tag: "danger" },
        ]);
    });
});

describe("stripRichText", () => {
    test("drops the tags and keeps the words", () => {
        expect(stripRichText("Your login [danger]expired[/danger], sign in again")).toBe("Your login expired, sign in again");
    });

    test("leaves a string with no tags alone", () => {
        expect(stripRichText("[GAME NAME] joined")).toBe("[GAME NAME] joined");
    });
});
