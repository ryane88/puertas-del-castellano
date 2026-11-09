/* PDX — El laberinto de la X */
(() => {
    const progressKeys = { "pdx-v1": "pdx", "pdx-v2": "pdxV2" };
    const headings = ["norte", "este", "sur", "oeste"];
    const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const turn = (facing, amount) => (facing + amount + headings.length) % headings.length;
    const positions = ["left", "center", "right", "back"];
    const symbols = { sol: "☀", torre: "♜", puerta: "", escalones: "▟", piedra: "◆", x: "✕" };
    const mazeCache = new Map();

    async function getMaze(slug, signal) {
        if (mazeCache.has(slug)) return mazeCache.get(slug);

        async function read(table, query) {
            const response = await fetch(setup.supabase.url + "/rest/v1/" + table + "?" + query, {
                headers: { apikey: setup.supabase.key },
                signal
            });
            if (!response.ok) throw new Error(table + ": " + response.status);
            const rows = await response.json();
            if (!Array.isArray(rows)) throw new Error("Invalid " + table + " response");
            return rows;
        }

        const filter = "&maze_slug=eq." + slug;
        const [[maze], cells, connections, clues, assets] = await Promise.all([
            read("pdx_mazes", "select=start_cell,start_facing,goal_cell,goal_facing&slug=eq." + slug + "&published=eq.true"),
            read("pdx_cells", "select=id,floor,x,y,scene_asset,objects" + filter),
            read("pdx_connections", "select=cell_a,cell_b,kind,asset" + filter),
            read("pdx_clues", "select=sequence,cell_id,facing,verses&order=sequence.asc" + filter),
            read("pdx_assets", "select=slug,kind,label,image_url")
        ]);
        const library = new Map(assets.map(asset => [asset.slug, asset]));
        const byId = new Map(cells.map(cell => [cell.id, { ...cell, exits: new Map() }]));

        if (!maze || !byId.has(maze.start_cell) || !byId.has(maze.goal_cell) ||
            !headings[maze.start_facing] || !headings[maze.goal_facing] ||
            clues.length !== 3 || clues[0].cell_id !== maze.start_cell ||
            clues.some((clue, i) => clue.sequence !== i + 1 || !byId.has(clue.cell_id) ||
                !headings[clue.facing] || !Array.isArray(clue.verses) || clue.verses.length !== 4)) {
            throw new Error("Incomplete PDX maze or clues");
        }
        for (const cell of cells) {
            if (!Array.isArray(cell.objects) ||
                cell.objects.some(object => library.get(object.asset)?.kind !== "object" ||
                    !headings[object.facing] || !positions.includes(object.position))) {
                throw new Error("Invalid PDX object");
            }
        }
        for (const { cell_a, cell_b, kind, asset } of connections) {
            const a = byId.get(cell_a);
            const b = byId.get(cell_b);
            if (!a || !b || library.get(asset)?.kind !== "object") throw new Error("Invalid PDX connection");
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const df = b.floor - a.floor;
            const direction = offsets.findIndex(([x, y]) => x === dx && y === dy);
            const isStair = kind === "stairs" && dx === 0 && dy === 0 && Math.abs(df) === 1;
            const isDoor = kind === "door" && df === 0 && direction >= 0;
            if (!isStair && !isDoor) throw new Error("Invalid PDX connection geometry");

            const from = isDoor ? direction : df > 0 ? "up" : "down";
            const to = isDoor ? turn(direction, 2) : df > 0 ? "down" : "up";
            if (a.exits.has(from) || b.exits.has(to)) throw new Error("Duplicate PDX exit");
            a.exits.set(from, { cell: b.id, asset });
            b.exits.set(to, { cell: a.id, asset });
        }
        const content = { maze, byId, clues, library };
        if (!signal.aborted) mazeCache.set(slug, content);
        return content;
    }

    function imageUrl(asset) {
        if (!asset?.image_url) return "";
        try {
            const url = new URL(asset.image_url);
            return url.protocol === "https:" ? url.href : "";
        } catch {
            return "";
        }
    }

    function overlay(asset, position, door = false, url = imageUrl(asset)) {
        const item = document.createElement("div");
        item.classList.add("pdx-object", "pdx-slot-" + position);
        if (door) item.classList.add("pdx-door");
        const fallback = document.createElement("span");
        fallback.textContent = door ? "" : symbols[asset.slug] ?? "◇";
        item.append(fallback);

        if (url) {
            const img = document.createElement("img");
            img.alt = "";
            img.hidden = true;
            img.addEventListener("load", () => {
                img.hidden = false;
                fallback.hidden = true;
                item.classList.add("pdx-has-art");
            }, { once: true });
            img.src = url;
            item.append(img);
        }
        if (!door) {
            const label = document.createElement("small");
            label.textContent = asset.label;
            item.append(label);
        }
        return item;
    }

    function mount(room) {
        const lifetime = new AbortController();
        let request;
        $(document).one(":passageinit", () => {
            request?.abort();
            lifetime.abort();
        });
        const { signal } = lifetime;
        const find = selector => room.querySelector(selector);
        const picker = find(".pdx-picker");
        const game = find(".pdx-game");
        let slug = State.variables.pdxSelected === "pdx-v2" ? "pdx-v2" : "pdx-v1";
        picker.value = slug;
        const status = find(".pdx-status");
        const location = find(".pdx-location");
        const heading = find(".pdx-heading");
        const view = find(".pdx-view");
        const objects = find(".pdx-objects");
        const journal = find(".pdx-journal");
        const buttons = new Map(Array.from(room.querySelectorAll("[data-pdx-action]"),
            button => [button.dataset.pdxAction, button]));
        let content;
        let progress;
        let renderedClues = -1;
        let renderedCell;

        function renderScene(cell) {
            if (renderedCell === cell) return;
            renderedCell = cell;

            const asset = content.library.get(cell.scene_asset);
            const scene = asset?.kind === "scene" ? asset : null;
            const sceneSlug = scene?.slug ?? "";

            const placeholder = find(".pdx-placeholder");
            view.dataset.scene = sceneSlug;
            view.style.removeProperty("--pdx-backdrop");
            view.style.removeProperty("--pdx-texture");
            view.classList.remove("pdx-has-backdrop");
            placeholder.textContent = scene
                ? `Escenario esquemático · ${scene.label}`
                : "Escenario esquemático · Imagen no disponible";
            placeholder.hidden = false;

            // The original catalog entry keeps showing the original image until it moves to 00.
            const legacyScene = sceneSlug === "pasillo-pdd-01" &&
                scene.label === "Pasillo de piedra" && !scene.image_url;
            const backdropSlug = legacyScene ? "pasillo-pdd-00" : sceneSlug;
            const backdrop = /^pasillo-pdd-0[0-9]$/.test(backdropSlug)
                ? `images/pdx-${backdropSlug}.jpg` : "";
            const sceneUrl = slug === "pdx-v2" ? imageUrl(scene) || backdrop : backdrop || imageUrl(scene);
            const sceneSignal = request.signal;
            const variant = (cell.id % 10 + 10) % 10;
            const fallbackUrl = `images/pdx-pasillo-pdd-0${variant}.jpg`;

            function loadImage(url, isBackdrop) {
                const image = new Image();
                image.onload = () => {
                    if (sceneSignal.aborted || renderedCell !== cell) return;
                    view.style.setProperty(isBackdrop ? "--pdx-backdrop" : "--pdx-texture",
                        `url(${JSON.stringify(url)})`);
                    view.classList.toggle("pdx-has-backdrop", isBackdrop);
                    placeholder.hidden = true;
                };
                image.onerror = () => {
                    if (sceneSignal.aborted || renderedCell !== cell || url === fallbackUrl) return;
                    loadImage(fallbackUrl, true);
                };
                image.src = url;
            }

            loadImage(sceneUrl || fallbackUrl, slug === "pdx-v2" || Boolean(backdrop) || !sceneUrl);
        }

        function renderJournal() {
            const count = progress.clues.length;
            if (count === renderedClues) return;
            const verses = find(".pdx-verses");
            verses.replaceChildren();
            find(".pdx-journal-title").textContent = `Cuaderno de pistas · ${count}/3`;
            for (const clue of content.clues.slice(0, count).reverse()) {
                const poem = document.createElement("section");
                const title = document.createElement("h2");
                title.textContent = `Poema ${clue.sequence} · Mira al ${headings[clue.facing]}`;
                const lines = document.createElement("p");
                lines.className = "pdx-poem";
                lines.textContent = clue.verses.join("\n");
                poem.append(title, lines);
                verses.append(poem);
            }
            renderedClues = count;
        }

        function discoverClue() {
            const { cellId, facing } = progress;
            const nextClue = content.clues[progress.clues.length];
            if (nextClue?.cell_id === cellId) {
                progress.clues.push(nextClue.sequence);
                progress.lastClue = { cellId, facing };
                journal.open = true;
                status.textContent = `Has encontrado el poema ${nextClue.sequence}.`;
            }
        }

        function returnToLastClue() {
            progress.cellId = progress.lastClue.cellId;
            progress.facing = progress.lastClue.facing;
            journal.open = true;
        }

        function startAdventure() {
            const { start_cell, start_facing } = content.maze;
            progress = State.variables[progressKeys[slug]] = {
                slug, cellId: start_cell, facing: start_facing, clues: [], found: false
            };
        }

        function render() {
            const { maze, byId, clues, library } = content;
            const { cellId, facing, found } = progress;
            const cell = byId.get(cellId);
            if (found) status.textContent = "¡Has descubierto la X! El laberinto guarda tu hallazgo.";

            const forward = cell.exits.get(facing);
            const left = cell.exits.get(turn(facing, -1));
            const right = cell.exits.get(turn(facing, 1));
            const atGoal = cellId === maze.goal_cell && facing === maze.goal_facing;
            const props = cell.objects.filter(object => object.facing === facing);
            const openings = [left && "izquierda", forward && "frente", right && "derecha"].filter(Boolean);
            const features = props.map(object => library.get(object.asset).label);

            view.classList.toggle("pdx-open-front", Boolean(forward));

            renderScene(cell);

            objects.replaceChildren();
            if (forward) {
                objects.append(overlay(library.get(forward.asset), "back", true, "images/door_front.png"));
            }
            if (left) {
                objects.append(overlay(library.get(left.asset), "left", true, "images/door_perspective.png"));
            }
            if (right) {
                objects.append(overlay(library.get(right.asset), "right", true, "images/door_perspective.png"));
            }
            // Vertical exits are directly accessible from every heading.
            for (const direction of ["up", "down"]) {
                const exit = cell.exits.get(direction);
                buttons.get(direction).hidden = !exit;
                if (!exit) continue;

                const isUp = direction === "up";
                const position = (facing < 2) === isUp ? "left" : "right";
                const label = isUp ? "Escalera de subida" : "Escalera de bajada";
                const ladder = overlay({ ...library.get(exit.asset), label }, position, false,
                    `images/ladder_${direction}_front.png`);
                ladder.classList.add("pdx-ladder", "pdx-ladder-" + direction);
                features.push(label);
                objects.append(ladder);
            }
            for (const object of props) {
                objects.append(overlay(library.get(object.asset), object.position));
            }
            if (found && atGoal) {
                const mark = overlay({ slug: "x", label: "X descubierta" }, "right");
                mark.classList.add("pdx-found");
                objects.append(mark);
            }

            location.textContent = [
                `Piso ${cell.floor} · Mirando al ${headings[facing]}`,
                openings.length ? "Salidas a la vista · " + openings.join(", ") : "Paredes a la vista",
                ...features
            ].join(". ") + ".";
            heading.textContent = headings[facing][0].toUpperCase();
            buttons.get("forward").disabled = !forward;
            buttons.get("inspect").hidden = !atGoal || found || progress.clues.length !== clues.length;
            buttons.get("return-clue").disabled = !progress.lastClue;
            find(".pdx-return-help").hidden = Boolean(progress.lastClue);
            renderJournal();
        }

        let reenter = true;
        async function load() {
            request?.abort();
            request = new AbortController();
            const { signal } = request;
            const requestedSlug = slug;
            progress = undefined;
            renderedClues = -1;
            renderedCell = undefined;
            journal.open = false;
            game.hidden = true;
            buttons.get("retry").hidden = true;
            status.textContent = "Cargando el laberinto…";
            try {
                const loaded = await getMaze(requestedSlug, signal);
                if (signal.aborted) return;

                content = loaded;
                const { byId, clues } = content;
                const saved = State.variables[progressKeys[slug]];
                if (saved?.slug === slug && byId.has(saved.cellId) && headings[saved.facing] &&
                    Array.isArray(saved.clues) && saved.clues.length <= clues.length &&
                    saved.clues.every((sequence, index) => sequence === clues[index].sequence)) {
                    progress = saved;
                } else {
                    startAdventure();
                }
                status.textContent = "";
                const latest = clues[progress.clues.length - 1];
                if (latest) {
                    if (progress.lastClue?.cellId !== latest.cell_id || !headings[progress.lastClue?.facing]) {
                        // Older saves kept the poem number but not the discovery heading.
                        progress.lastClue = { cellId: latest.cell_id, facing: latest.facing };
                    }
                    if (reenter && slug === "pdx-v1") returnToLastClue();
                    else journal.open = true;
                } else {
                    discoverClue();
                }
                game.hidden = false;
                render();
                reenter = false;
            } catch (error) {
                if (signal.aborted) return;
                console.error("PDX:", error);
                game.hidden = true;
                status.textContent = "No se pudo cargar el laberinto.";
                buttons.get("retry").hidden = false;
            }
        }

        picker.addEventListener("change", () => {
            slug = picker.value;
            State.variables.pdxSelected = slug;
            reenter = false;
            load();
        }, { signal });

        for (const [action, button] of buttons) {
            button.addEventListener("click", () => {
                if (action === "retry") return load();
                if (!progress || button.hidden || button.disabled) return;
                if (action === "left" || action === "right") {
                    progress.facing = turn(progress.facing, action === "left" ? -1 : 1);
                } else if (action === "inspect") {
                    progress.found = true;
                } else if (action === "return-clue") {
                    returnToLastClue();
                } else if (action === "new-adventure") {
                    if (!window.confirm("¿Empezar una nueva aventura? Se reiniciará tu progreso en este laberinto.")) return;
                    startAdventure();
                } else {
                    const cell = content.byId.get(progress.cellId);
                    const exit = cell.exits.get(action === "forward" ? progress.facing : action);
                    if (!exit) return;
                    progress.cellId = exit.cell;
                }
                status.textContent = "";
                if (action !== "return-clue") discoverClue();
                render();
                if (button.hidden || button.disabled) buttons.get("left").focus();
            }, { signal });
        }
        load();
    }

    $(document).on(":passagedisplay", event => {
        if (event.passage.title !== "PDX") return;
        const room = event.content.querySelector(".pdx-room");
        if (room) mount(room);
    });
})();
