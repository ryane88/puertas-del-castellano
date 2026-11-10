// Run from the project root with Playwright and PGlite installed or supplied via env.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.PDE_PGLITE || "@electric-sql/pglite");
const { chromium } = await import(process.env.PDE_PLAYWRIGHT || "playwright");
const db = new PGlite();
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const migration = name => readFile("supabase/migrations/202611090000" + name + ".sql", "utf8");
const missionId = "escapar-el-establo";
const alchemistId = "el-secreto-del-alquimista";
let missions;
let doors;
try {
    await db.exec(`
        create role anon;
        create role authenticated;
        create table public.castle_doors (
            position int primary key, name text, badge text,
            destination_passage text, initial_door boolean
        );
        insert into public.castle_doors
        select n, 'Puerta ' || lpad(n::text, 2, '0'), lpad(n::text, 2, '0'), null, n = 1
        from generate_series(1, 27) as n;
    `);
    for (const name of ["00_pde_rooms", "01_pde_seed", "02_pde_castle_door", "03_pde_seed_establo"]) {
        await db.exec(await migration(name));
    }
    const alchemist = () => rows("select * from pde_objects where mission_slug = $1 order by slug", [alchemistId]);
    const original = await alchemist();
    doors = await rows("select * from castle_doors order by position");
    const upgrade = await migration("04_pde_caballerizas");
    await db.exec(upgrade);
    await db.exec(upgrade);
    assert.deepEqual(await rows("select * from castle_doors order by position"), doors);
    await db.exec("set role anon;");
    assert.deepEqual(await alchemist(), original);
    missions = await rows("select slug, title from pde_missions order by sort_order, slug");
    for (const mission of missions) {
        mission.scenes = await rows(
            "select slug,title,description,image_path from pde_scenes where mission_slug = $1 order by sort_order,slug",
            [mission.slug]
        );
        for (const scene of mission.scenes) {
            scene.objects = await rows(
                "select slug,name,description,hotspot_x,hotspot_y from pde_objects where mission_slug = $1 and scene_slug = $2 order by sort_order,slug",
                [mission.slug, scene.slug]
            );
        }
    }
    assert.equal(missions.length, 2);
    assert.equal(missions[1].title, "El secreto de las caballerizas");
    assert.equal(missions[1].scenes[0].objects.length, 3);
    await db.exec("reset role; update pde_objects set published = false where slug = 'escudo';");
    await db.exec(upgrade);
    await db.exec("set role anon;");
    assert.deepEqual(await rows("select slug from pde_objects where slug = 'escudo'"), []);
    console.log("SQL passed in local PostgreSQL: replay, publication flag, and Mission 1 data.");
} finally {
    await db.close();
}

const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const browser = await chromium.launch({ executablePath: process.env.PDE_CHROME });
try {
    for (const [width, height] of [[375, 667], [1280, 900]]) {
        const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
        page.setDefaultTimeout(7000);
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route(/^https?:/, route => {
            const path = new URL(route.request().url()).pathname;
            const json = path.endsWith("/pde_missions") ? missions : path.endsWith("/castle_doors") ? doors : null;
            if (!json) return route.abort();
            return route.fulfill({ json, headers: { "access-control-allow-origin": "*" } });
        });
        await page.goto(pathToFileURL(resolve("index.html")).href);
        await page.waitForFunction(() => window.SugarCube?.State?.passage === "Empieza");
        const play = title => page.evaluate(name => SugarCube.Engine.play(name), title);
        const picker = page.locator(".pde-mission-picker");
        const chooseStables = () => picker.selectOption(missionId);
        const markers = page.locator(".pde-hotspot");
        const dialog = page.locator("#ui-dialog");
        const body = dialog.locator(".pde-dialog");
        const close = () => body.getByRole("button", { name: "Volver a la sala" }).click();
        const lock = body.locator(".pde-lock input");
        const check = () => body.getByRole("button", { name: "Probar combinación" }).click();
        const openArmory = () => page.locator(".pde-object-list button").nth(2).click();
        const feedback = body.locator(".pde-feedback");
        const progress = () => page.evaluate(() => SugarCube.State.variables.pdeStables);
        const save = slot => page.evaluate(id => SugarCube.Save.browser.slot.save(id), slot);
        const load = slot => page.evaluate(id => SugarCube.Save.browser.slot.load(id).then(() => {
            SugarCube.Engine.show();
        }), slot);

        await page.waitForFunction(() => document.querySelector("#data-status")?.textContent === "Nombres y destinos de Supabase.");
        await page.keyboard.press("e");
        assert((await page.locator("#selection-count").textContent()).endsWith("05 / 27"));
        await page.locator("#enter-door").click();
        await picker.waitFor();
        assert.equal(await picker.inputValue(), alchemistId);
        for (const [i, file] of ["manuscrito.jpg", "pociones.jpg", "bandera.jpg"].entries()) {
            await markers.nth(i).click();
            const image = body.locator("img");
            assert.equal((await image.getAttribute("src")).split("/").pop(), file);
            await close();
        }
        await chooseStables();
        await page.locator(".pde-has-image").waitFor();
        assert.equal(await page.locator(".pde-image").getAttribute("src"), "images/pde/caballerizas.jpg");
        assert.equal(await markers.count(), 3);
        const markerBounds = await markers.evaluateAll(nodes => nodes.map(node => {
            const rect = node.getBoundingClientRect();
            const frame = node.closest(".pde-view").getBoundingClientRect();
            return [rect.width, rect.height,
                Math.round(100 * (rect.x + rect.width / 2 - frame.x) / frame.width),
                Math.round(100 * (rect.y + rect.height / 2 - frame.y) / frame.height)];
        }));
        assert.deepEqual(markerBounds, [[44, 44, 23, 52], [44, 44, 53, 30], [44, 44, 79, 58]]);

        for (const order of orders) {
            for (const i of order) {
                const marker = markers.nth(i);
                await marker.focus();
                await page.keyboard.press("Enter");
                await body.waitFor();
                const rect = await dialog.boundingBox();
                assert(rect.x >= 0 && rect.x + rect.width <= width);
                if (i === 2) {
                    assert.equal(await body.locator("blockquote").textContent(),
                        "Quiero que la flor ___ aquí, y estoy seguro de que el león no ___. Aunque el dragón ___ feroz, el castillo ___ fuerte y no caerá.");
                    assert.equal(await lock.getAttribute("inputmode"), "numeric");
                } else {
                    const expected = i === 0 ? ["7—sea", "2—es", "4—esté", "9—está"] : ["1", "2", "3", "4"];
                    assert.deepEqual(await body.locator(".pde-stable-mark").allTextContents(), expected);
                    await body.locator("img").evaluate(img => img.decode());
                    if (i === 1) {
                        assert.equal(await body.locator("figcaption").textContent(), "1 — flor · 2 — león · 3 — dragón · 4 — castillo");
                    }
                }
                await close();
                assert(await marker.evaluate(node => node === document.activeElement));
            }
        }

        await openArmory();
        await lock.fill("49");
        await check();
        assert.match(await feedback.textContent(), /Escribe cuatro cifras/);
        await close();
        await save(0);
        await openArmory();
        assert.equal(await lock.inputValue(), "49");
        for (const code of ["0000", "7249", "4927"]) {
            await lock.fill(code);
            await check();
            assert.match(await feedback.textContent(), /sigue cerrado/);
            assert.deepEqual(await progress(), { code, solved: false });
        }
        await lock.fill("4972");
        await check();
        assert.match(await body.locator(".pde-key").textContent(), /llave de la verja/);
        assert.deepEqual(await progress(), { code: "4972", solved: true });
        await close();
        await save(1);
        await openArmory();
        await body.getByRole("button", { name: "Salir al castillo" }).click();
        await page.waitForFunction(() => SugarCube.State.passage === "Empieza");
        assert.deepEqual(await progress(), { code: "4972", solved: true });
        await play("PDE");
        await chooseStables();
        await openArmory();
        await body.locator(".pde-key").waitFor();

        await body.getByRole("button", { name: "Reiniciar misión" }).click();
        assert.equal(await lock.inputValue(), "");
        assert.deepEqual(await progress(), { code: "", solved: false });
        await close();
        await picker.selectOption(alchemistId);
        await chooseStables();
        await openArmory();
        assert.equal(await lock.inputValue(), "");
        await close();
        await load(1);
        await chooseStables();
        await openArmory();
        await body.locator(".pde-key").waitFor();
        await close();
        await load(0);
        await chooseStables();
        await openArmory();
        assert.equal(await lock.inputValue(), "49");
        await close();
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`Browser passed at ${width}×${height}: all six inspection orders, lock, navigation, saves, and reset.`);
    }
} finally {
    await browser.close();
}
