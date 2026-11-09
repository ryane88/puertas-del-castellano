import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const { PGlite } = await import(process.env.PDX_PGLITE || "@electric-sql/pglite");
const db = new PGlite();
const sql = name => readFile(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8");
const tables = ["pdx_mazes", "pdx_cells", "pdx_connections", "pdx_clues"];
const orders = ["slug", "maze_slug, id", "maze_slug, cell_a, cell_b", "maze_slug, sequence"];
const rows = async query => (await db.query(query)).rows;
const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async (table, i) => [
    table, await rows(`select * from ${table} order by ${orders[i]}`)
])));

try {
    await db.exec(`
        create role anon;
        create role authenticated;
        create table castle_doors (
            position integer primary key, name text not null, badge text not null unique,
            destination_passage text, initial_door boolean not null
        );
        insert into castle_doors values (25, 'Puerta 25', '25', null, false);
    `);
    await db.exec(await sql("20261108000000_pdx_v1.sql"));
    await db.exec("insert into pdx_assets values ('pasillo-pdd-00', 'scene', 'Escenario existente')");
    const oldAssets = await rows("select * from pdx_assets order by slug");
    const oldDoors = await rows("select * from castle_doors order by position");
    await db.exec("set role anon");
    const v1 = await snapshot();
    await db.exec("reset role");
    await db.exec(await sql("20261108000001_pdx_v2.sql"));
    assert.deepEqual(await rows("select * from castle_doors order by position"), oldDoors);
    await db.exec("set role anon");
    const data = await snapshot();
    data.pdx_assets = await rows("select * from pdx_assets order by slug");
    assert.deepEqual(data.pdx_assets.filter(asset => asset.slug !== "pasillo-pdd-09"), oldAssets);
    for (const table of tables) {
        const unchanged = data[table].filter(row => (row.maze_slug ?? row.slug) === "pdx-v1");
        assert.deepEqual(unchanged, v1[table]);
    }

    const v2 = rows => rows.filter(row => (row.maze_slug ?? row.slug) === "pdx-v2");
    const [maze] = v2(data.pdx_mazes);
    const cells = new Map(v2(data.pdx_cells).map(cell => [cell.id, { ...cell, exits: new Map() }]));
    const clues = v2(data.pdx_clues);
    assert.equal(maze.floor_count, 2);
    for (const floor of [1, 2]) {
        assert.equal([...cells.values()].filter(cell => cell.floor === floor).length, 30);
    }
    for (const cell of cells.values()) {
        assert(data.pdx_assets.some(asset => asset.slug === cell.scene_asset && asset.kind === "scene"));
    }
    const offsets = ["0,-1,0", "1,0,0", "0,1,0", "-1,0,0", "0,0,1", "0,0,-1"];
    function link(a, b, kind) {
        const direction = offsets.indexOf([b.x - a.x, b.y - a.y, b.floor - a.floor].join());
        assert(direction >= 0 && (direction >= 4 ? "stairs" : "door") === kind);
        assert(!a.exits.has(direction), `Salida duplicada en ${a.id}`);
        a.exits.set(direction, b.id);
    }
    const connections = v2(data.pdx_connections);
    for (const edge of connections) {
        const a = cells.get(edge.cell_a);
        const b = cells.get(edge.cell_b);
        assert(data.pdx_assets.some(asset => asset.slug === edge.asset && asset.kind === "object"));
        link(a, b, edge.kind);
        link(b, a, edge.kind);
    }
    assert.equal(connections.filter(edge => edge.kind === "stairs").length, 2);
    const reached = new Set([maze.start_cell]);
    for (const id of reached) {
        for (const next of cells.get(id).exits.values()) reached.add(next);
    }
    assert.equal(reached.size, cells.size);

    // Pair each verse with its action and distance. An edit to a navigational phrase
    // must pass the corresponding text check as well as the walk through the seed.
    const routes = [
        [
            [/^Dos pasos al norte/, 0, 2],
            [/^tres hacia el este/, 1, 3],
            [/^Un paso hacia el sur/, 2, 1],
            [/^y uno hacia el oeste/, 3, 1]
        ],
        [
            [/^Gira a la izquierda y avanza dos,/, -1, 2],
            [/^da media vuelta y avanza uno /, 2, 1],
            [/^Gira a la derecha y avanza dos /, 1, 2],
            [/^gira a la izquierda y avanza uno /, -1, 1]
        ],
        [
            [/^Sube la escalera /, 4, 1],
            [/^al norte dos pasos /, 0, 2],
            [/^Baja la escalera /, 5, 1],
            [/^da dos pasos al oeste y examina la piedra suelta\./, 3, 2]
        ]
    ];
    assert.equal(clues.length, 3);
    assert.deepEqual([clues[0].cell_id, clues[0].facing], [maze.start_cell, maze.start_facing]);
    let id = maze.start_cell;
    let facing = maze.start_facing;
    for (const [i, route] of routes.entries()) {
        const clue = clues[i];
        assert.equal(clue.sequence, i + 1);
        assert.equal(clue.verses.length, 4);
        assert.deepEqual([id, facing], [clue.cell_id, clue.facing]);
        for (const [line, [phrase, direction, distance]] of route.entries()) {
            assert.match(clue.verses[line], phrase);
            if (direction < 4) facing = i === 1 ? (facing + direction + 4) % 4 : direction;
            for (let step = 0; step < distance; step++) {
                const next = cells.get(id).exits.get(direction >= 4 ? direction : facing);
                assert(next, `Poema ${i + 1}, verso ${line + 1}: salida bloqueada desde ${id}`);
                assert(!clues.slice(i + 2).some(later => later.cell_id === next));
                id = next;
            }
        }
    }
    assert.deepEqual([id, facing], [maze.goal_cell, maze.goal_facing]);
    assert(cells.get(id).objects.some(object => object.asset === "piedra" && object.facing === facing));
    assert(data.pdx_assets.some(asset => asset.slug === "piedra" && asset.kind === "object"));

    if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(data));
    console.log("PASS · SQL con permisos anon, laberinto 1 intacto, 60 celdas accesibles y 12 versos transitables");
} finally {
    await db.close();
}
