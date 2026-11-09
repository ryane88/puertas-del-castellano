import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PDX_PLAYWRIGHT || "playwright");
const [fixture, story = "index.html"] = process.argv.slice(2);
const data = JSON.parse(await readFile(fixture, "utf8"));
data.pdx_assets.push({
    slug: "escenario-de-prueba", kind: "scene", label: "Escenario de prueba",
    image_url: "https://pdx-test.invalid/scene.svg"
});
data.pdx_cells.find(cell => cell.maze_slug === "pdx-v2" && cell.id === 42).scene_asset = "escenario-de-prueba";

const browser = await chromium.launch({ executablePath: process.env.PDX_CHROME });
try {
    for (const width of [393, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.route(/^https?:/, async route => {
            const url = new URL(route.request().url());
            if (url.hostname === "pdx-test.invalid") {
                return route.fulfill({
                    contentType: "image/svg+xml",
                    body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#432"/></svg>'
                });
            }
            if (!url.pathname.includes("/rest/v1/")) return route.abort();
            const table = url.pathname.split("/").at(-1);
            const slug = (url.searchParams.get(table === "pdx_mazes" ? "slug" : "maze_slug") || "").slice(3);
            const rows = data[table] || [];
            return route.fulfill({
                json: slug ? rows.filter(row => (row.maze_slug ?? row.slug) === slug) : rows,
                headers: { "access-control-allow-origin": "*" }
            });
        });
        await page.goto(pathToFileURL(resolve(story)).href);
        await page.waitForFunction(() => window.SugarCube?.State?.passage);
        const play = passage => page.evaluate(name => SugarCube.Engine.play(name), passage);
        const position = (cellId, facing, floor, clues) => page.waitForFunction(expected => {
            const picker = document.querySelector(".pdx-picker");
            if (document.querySelector(".pdx-game")?.hidden !== false) return false;
            const vars = SugarCube.State.variables;
            const progress = picker.value === "pdx-v2" ? vars.pdxV2 : vars.pdx;
            return JSON.stringify([progress.cellId, progress.facing, progress.clues]) === JSON.stringify(expected.slice(0, 3)) &&
                document.querySelector(".pdx-location").textContent.startsWith("Piso " + expected[3] + " ·") &&
                document.querySelectorAll(".pdx-poem").length === progress.clues.length &&
                document.querySelector(".pdx-heading").textContent === "NESO"[progress.facing];
        }, [cellId, facing, clues, floor]);
        const picker = page.locator(".pdx-picker");
        const button = action => page.locator(`[data-pdx-action="${action}"]`);
        const act = async (...actions) => {
            for (const action of actions) await button(action).click({ timeout: 3000 });
        };
        const scene = filename => page.waitForFunction(value => {
            const view = document.querySelector(".pdx-view");
            return getComputedStyle(view).backgroundImage.includes(value);
        }, filename);
        const state = () => page.evaluate(() => SugarCube.State.variables);
        const [f, r, l] = ["forward", "right", "left"];
        const doors = async (...slots) => {
            assert.equal(await page.locator(".pdx-door").count(), slots.length);
            for (const slot of slots) {
                const door = page.locator(`.pdx-door.pdx-slot-${slot}`);
                const art = door.locator("img");
                await art.waitFor({ state: "visible" });
                assert(await art.evaluate(img => {
                    return img.offsetTop === 0 && img.offsetHeight === img.parentElement.clientHeight;
                }));
                const filename = slot === "back" ? "door_front.png" : "door_perspective.png";
                assert.equal((await art.getAttribute("src")).split("/").at(-1), filename);
                if (slot !== "back") {
                    assert.equal(await door.evaluate(node => getComputedStyle(node).transform),
                        slot === "right" ? "matrix(-1, 0, 0, 1, 0, 0)" : "none");
                }
            }
        };
        const ladder = async (direction, side) => {
            assert(await button(direction).isVisible());
            const art = page.locator(`.pdx-ladder-${direction} img`);
            await art.waitFor({ state: "visible" });
            const placement = await art.evaluate(img => {
                const scene = img.closest(".pdx-view");
                const view = scene.getBoundingClientRect();
                const door = scene.querySelector(".pdx-door.pdx-slot-back")?.getBoundingClientRect();
                const rect = img.getBoundingClientRect();
                const center = (rect.left + rect.width / 2 - view.left) / view.width;
                return {
                    filename: img.src.split("/").at(-1),
                    transform: getComputedStyle(img).transform,
                    inside: rect.top >= view.top && rect.bottom <= view.bottom &&
                        rect.left >= view.left && rect.right <= view.right,
                    clearOfDoor: !door || rect.right <= door.left - 2 || rect.left >= door.right + 2,
                    inset: Math.min(center, 1 - center) >= .30,
                    side: rect.right < view.left + view.width / 2 ? "left" : "right",
                    narrow: rect.width <= view.width * .25,
                    proportional: Math.abs(rect.width - rect.height * img.naturalWidth / img.naturalHeight) < 1
                };
            });
            assert.deepEqual(placement, {
                filename: `ladder_${direction}_front.png`,
                transform: "none",
                inside: true, clearOfDoor: true, inset: true, side, narrow: true, proportional: true
            });
        };
        const rotateLadder = async direction => {
            const sides = direction === "up"
                ? ["left", "left", "right", "right"]
                : ["right", "right", "left", "left"];
            for (const side of sides) {
                await ladder(direction, side);
                await act(r);
            }
        };

        await play("PDX");
        await position(21, 0, 1, [1]);
        assert.equal(await page.locator(".pdx-ladder").count(), 0);
        await act(f);
        await position(16, 0, 1, [1]);
        const first = (await state()).pdx;

        await picker.selectOption("pdx-v2");
        await position(20, 0, 1, [1]);
        await scene("pasillo-pdd-00.jpg");
        await act(f, f, r, f, f, f, r, f, r, f);
        await position(16, 3, 1, [1, 2]);
        await act(l, f, f, r, r, f, r, f, f, l, f);
        await position(18, 0, 1, [1, 2, 3]);
        assert(await button("up").isVisible());
        assert(await button("down").isHidden());
        await doors();
        await rotateLadder("up");
        await act("up");
        await position(48, 0, 2, [1, 2, 3]);
        await scene("pasillo-pdd-09.jpg");
        await doors("back", "left");
        await act(r);
        await doors("left", "right");
        await act(l);
        await rotateLadder("down");
        await act(r);
        await act("return-clue");
        await position(18, 0, 1, [1, 2, 3]);
        await act("up", f);
        await position(42, 0, 2, [1, 2, 3]);
        await scene("pdx-test.invalid/scene.svg");

        await picker.selectOption("pdx-v1");
        await position(16, 0, 1, [1]);
        await picker.selectOption("pdx-v2");
        await position(42, 0, 2, [1, 2, 3]);
        assert.deepEqual((await state()).pdx, first);
        await play("Empieza");
        await play("PDX");
        await position(42, 0, 2, [1, 2, 3]);
        await act(f);
        assert(await button("down").isVisible());
        assert(await button("up").isHidden());
        await act("down", l, f, f);
        await position(4, 3, 1, [1, 2, 3]);
        assert((await page.locator(".pdx-location").textContent()).includes("Piedra suelta"));
        await act("inspect");
        assert((await state()).pdxV2.found);
        assert(await page.locator(".pdx-found").count());
        page.once("dialog", dialog => dialog.accept());
        await act("new-adventure");
        await position(20, 0, 1, [1]);
        assert(!(await state()).pdxV2.found);
        assert.deepEqual((await state()).pdx, first);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

        await picker.selectOption("pdx-v1");
        await position(16, 0, 1, [1]);
        await play("Empieza");
        await play("PDX");
        await position(21, 0, 1, [1]);
        await act(f, f, r, f, f);
        await position(13, 1, 1, [1, 2]);
        await act(l, f, f, r, f, f);
        await position(5, 1, 1, [1, 2]);
        await ladder("up", "left");
        await act("up");
        await position(30, 1, 2, [1, 2, 3]);
        await ladder("down", "right");
        await act(r, f, f, r, f, f, l, f, "inspect");
        await position(43, 2, 2, [1, 2, 3]);
        assert((await state()).pdx.found);
        assert(!(await state()).pdxV2.found);
        console.log(`PASS · ${width}px · escaleras en cuatro orientaciones, pistas, X, cambio de imagen, reentrada y progreso independiente`);
        await page.close();
    }
} finally {
    await browser.close();
}
