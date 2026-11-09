/* PDP — Puentes de Principiante */
(() => {
    "use strict";

    async function readPublished(table, columns, signal) {
        const response = await fetch(
            setup.supabase.url + "/rest/v1/" + table + "?select=" + columns + "&published=eq.true",
            { headers: { apikey: setup.supabase.key }, signal }
        );
        if (!response.ok) throw new Error("PDP content unavailable");
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error("Invalid PDP response");
        return rows;
    }

    async function loadGraph(signal) {
        const [islands, bridges] = await Promise.all([
            readPublished("pdp_islands", "slug,level,label", signal),
            readPublished("pdp_bridges", "from_slug,to_slug,sort_order", signal)
        ]);
        const bySlug = new Map(islands.map(island => [island.slug, { ...island, exits: [] }]));
        bridges.sort((a, b) => a.sort_order - b.sort_order);
        for (const bridge of bridges) {
            const from = bySlug.get(bridge.from_slug);
            const to = bySlug.get(bridge.to_slug);
            if (from && to && to.level === from.level + 1) from.exits.push(to);
        }
        const start = bySlug.get("yo");
        if (start?.level !== 1 || start.label !== "Yo") throw new Error("PDP starting island unavailable");

        // A verb is navigable only if it still has a published complement.
        start.exits = start.exits.filter(verb => verb.exits.length > 0);
        if (!start.exits.length) throw new Error("No complete PDP routes");
        return start;
    }

    function mount(room) {
        const lifetime = new AbortController();
        const { signal } = lifetime;
        $(document).one(":passageinit", () => lifetime.abort());

        const game = room.querySelector(".pdp-game");
        const destinationLabel = room.querySelector(".pdp-destination");
        const status = room.querySelector(".pdp-status");
        const retry = room.querySelector(".pdp-retry");
        const sentence = room.querySelector(".pdp-sentence");
        const choices = room.querySelector(".pdp-choices");
        const facing = room.querySelector(".pdp-facing");
        const span = room.querySelector(".pdp-span");
        const complete = room.querySelector(".pdp-complete");
        const buttons = Object.fromEntries(
            Array.from(room.querySelectorAll("[data-pdp-action]"), button => [button.dataset.pdpAction, button])
        );
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let path;
        let turnAnimation;

        function showBridge() {
            const { island, selected } = path.at(-1);
            const destination = island.exits[selected];
            if (!destination) return;
            destinationLabel.textContent = destination.label;
            facing.textContent = `Puente ${selected + 1} de ${island.exits.length}`;
            buttons.cross.setAttribute("aria-label", `Cruzar el puente a «${destination.label}»`);
        }

        function showIsland(moveFocus = true) {
            const { island } = path.at(-1);
            const finished = island.level === 3;
            turnAnimation?.cancel();
            sentence.textContent = path.map(({ island }) => island.label).join(" ") + (finished ? "." : "…");
            choices.hidden = destinationLabel.hidden = finished;
            span.style.display = finished ? "none" : "";
            complete.hidden = !finished;
            buttons.back.disabled = buttons.restart.disabled = path.length === 1;
            buttons.left.disabled = buttons.right.disabled = island.exits.length < 2;
            showBridge();
            if (moveFocus) sentence.focus();
        }

        function turn(direction) {
            const frame = path.at(-1);
            const count = frame.island.exits.length;
            frame.selected = (frame.selected + direction + count) % count;
            showBridge();
            if (motion.matches) return;
            turnAnimation?.cancel();
            turnAnimation = span.animate([
                { transform: `translateX(${direction * 45}px)`, opacity: 0.45 },
                { transform: "translateX(0)", opacity: 1 }
            ], { duration: 220, easing: "ease-out" });
        }

        async function load(moveFocus = false) {
            retry.hidden = true;
            status.hidden = false;
            status.textContent = "Cargando las islas…";
            try {
                const start = await loadGraph(signal);
                if (signal.aborted) return;
                path = [{ island: start, selected: 0 }];
                status.hidden = true;
                game.hidden = false;
                showIsland(moveFocus);
            } catch {
                if (signal.aborted) return;
                status.textContent = "No se pudieron cargar las islas.";
                retry.hidden = false;
                if (moveFocus) retry.focus();
            }
        }

        const actions = {
            left: () => turn(-1),
            right: () => turn(1),
            cross: () => {
                const { island, selected } = path.at(-1);
                path.push({ island: island.exits[selected], selected: 0 });
                showIsland();
            },
            back: () => {
                path.pop();
                showIsland();
            },
            restart: () => {
                path.length = 1;
                path[0].selected = 0;
                showIsland();
            }
        };
        for (const [action, button] of Object.entries(buttons)) {
            button.addEventListener("click", actions[action], { signal });
        }
        retry.addEventListener("click", () => load(true), { signal });
        load();
    }

    $(document).on(":passagedisplay", event => {
        if (event.passage.title !== "PDP") return;
        const room = event.content.querySelector(".pdp-room");
        if (room) mount(room);
    });
})();
