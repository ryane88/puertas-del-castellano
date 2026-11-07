import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("../../src/story.js", import.meta.url), "utf8");

function loadStory(fetch) {
    const context = createContext({
        setup: {},
        Config: { ui: {} },
        document: {},
        window: { location: { origin: "https://castle.test" } },
        $: () => ({ on() {}, one() {} }),
        Audio: class { load() {} },
        fetch,
    });
    runInContext(source, context);
    return context;
}

test("PDL preserves Spanish letters and forces a different order when possible", () => {
    const context = loadStory();
    runInContext("Math.random = () => 0.999", context);
    const scramble = runInContext("scramblePdlAnswer", context);
    assert.equal(scramble("Año"), "ñAo");
    assert.equal(scramble("té"), "ét");
    assert.equal(scramble("A"), "A");
    assert.equal(scramble("aaa"), "aaa");

    const normalize = runInContext("normalizePdlAnswer", context);
    assert.equal(normalize("  ¡Mañána! "), normalize("MAÑANA"));
    assert.notEqual(normalize("año"), normalize("ano"));
});

test("PDL draws only single words from all published pages before repeating", async () => {
    const requested = [];
    const context = loadStory(async (url, options) => {
        const { pathname, searchParams } = new URL(url);
        assert.equal(pathname, "/rest/v1/rooms");
        assert.equal(searchParams.get("published"), "eq.true");
        assert.ok(options.headers.apikey);
        const cursor = searchParams.get("pdd");
        requested.push(cursor);
        const rows = cursor === "gt.0"
            ? Array.from({ length: 250 }, (_, index) => ({
                pdd: index + 1,
                word: index === 0 ? " Té " : "al mal tiempo, buena cara",
                short_definition: " Bebida ",
            }))
            : [
                null,
                { pdd: -1, word: "inválido" },
                { pdd: 251, word: " " },
                { pdd: 252, word: "sin prisa" },
                { pdd: 253, word: "¡hola!" },
                { pdd: 254, word: "teórico-práctico" },
                { pdd: 255, word: "a2" },
                { pdd: 256, word: "a", short_definition: null },
                { pdd: 257, word: "Año" },
            ];
        return { ok: true, json: async () => rows };
    });
    const rooms = await runInContext("getPdlRooms()", context);
    assert.deepEqual(requested, ["gt.0", "gt.250"]);
    assert.deepEqual(Array.from(rooms, ({ pdd, word, definition }) => [pdd, word, definition]),
        [[1, "Té", "Bebida"], [256, "a", ""], [257, "Año", ""]]);

    const draw = runInContext("drawPdlRoom", context);
    const firstRound = Array.from(rooms, () => draw(rooms).pdd);
    const secondRound = Array.from(rooms, () => draw(rooms).pdd);
    assert.notEqual(firstRound.at(-1), secondRound[0]);
    assert.deepEqual(firstRound.sort(), [1, 256, 257]);
    assert.deepEqual(secondRound.sort(), [1, 256, 257]);
});
