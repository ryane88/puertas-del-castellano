/* PDE — Posibilidad de Escapar */
(() => {
    "use strict";

    async function readMissions(signal) {
        const query = new URLSearchParams({
            select: "slug,title,scenes:pde_scenes(slug,title,description,image_path,sort_order," +
                "objects:pde_objects(slug,name,description,hotspot_x,hotspot_y,sort_order))",
            published: "eq.true",
            "scenes.published": "eq.true",
            "scenes.objects.published": "eq.true",
            order: "sort_order.asc,slug.asc",
            "scenes.order": "sort_order.asc,slug.asc",
            "scenes.objects.order": "sort_order.asc,slug.asc"
        });
        const response = await fetch(setup.supabase.url + "/rest/v1/pde_missions?" + query, {
            headers: { apikey: setup.supabase.key },
            signal
        });
        if (!response.ok) throw new Error("PDE content unavailable");
        const missions = await response.json();
        if (!Array.isArray(missions)) throw new Error("Invalid PDE response");
        return missions;
    }

    function fillPicker(picker, entries) {
        picker.replaceChildren(...entries.map(entry => new Option(entry.title, entry.slug)));
        picker.parentElement.hidden = entries.length < 2;
    }

    function showObject(object, trigger, puzzle) {
        trigger.focus();
        Dialog.create("Examinar objeto", "pde-dialog");

        const name = document.createElement("h3");
        name.textContent = object.name;
        const description = document.createElement("p");
        description.textContent = object.description;
        const close = document.createElement("button");
        close.type = "button";
        close.textContent = "Volver a la sala";
        close.addEventListener("click", () => Dialog.close());

        const clue = puzzle?.clue(object.slug);
        name.tabIndex = -1;
        Dialog.body().append(name, clue ?? description, close);
        Dialog.open();
        (clue ? name : close).focus();
    }

    function mount(room) {
        const lifetime = new AbortController();
        const { signal } = lifetime;
        $(document).one(":passageinit", () => {
            lifetime.abort();
            if (Dialog.isOpen("pde-dialog")) Dialog.close();
        });

        const status = room.querySelector(".pde-status");
        const retry = room.querySelector(".pde-retry");
        const content = room.querySelector(".pde-content");
        const missionPicker = room.querySelector(".pde-mission-picker");
        const missionTitle = room.querySelector(".pde-mission-title");
        const scenePicker = room.querySelector(".pde-scene-picker");
        const scenePanel = room.querySelector(".pde-scene");
        const sceneTitle = room.querySelector(".pde-scene-title");
        const sceneDescription = room.querySelector(".pde-scene-description");
        const view = room.querySelector(".pde-view");
        const hotspots = room.querySelector(".pde-hotspots");
        const objectHint = room.querySelector(".pde-object-hint");
        const objectList = room.querySelector(".pde-object-list");
        let image = room.querySelector(".pde-image");
        let missions = [];

        function showImage(path) {
            const next = document.createElement("img");
            next.className = "pde-image";
            next.alt = "";
            next.hidden = true;
            view.classList.remove("pde-has-image");
            image.replaceWith(next);
            image = next;

            // Only load raster art bundled with the castle.
            if (!path || !/^images\/(?:[\w-]+\/)*[\w-]+\.(?:jpe?g|png|webp|avif)$/i.test(path)) return;
            next.addEventListener("load", () => {
                if (next !== image) return;
                next.hidden = false;
                view.classList.add("pde-has-image");
            }, { once: true, signal });
            next.src = path;
        }

        function renderScene(mission, scene) {
            scenePanel.hidden = !scene;
            status.textContent = scene ? "" : "Esta misión aún no tiene salas publicadas.";
            if (!scene) return;

            sceneTitle.textContent = scene.title;
            sceneDescription.textContent = scene.description;
            showImage(scene.image_path);
            hotspots.replaceChildren();
            objectList.replaceChildren();
            objectHint.textContent = scene.objects.length
                ? "Toca un número en la escena o elige un objeto de la lista."
                : "Aún no hay objetos para explorar en esta sala.";

            const puzzle = [setup.pdeAlchemist, setup.pdeStables].find(entry => entry.matches(mission, scene));
            scene.objects.forEach((object, index) => {
                const marker = document.createElement("button");
                marker.type = "button";
                marker.className = "pde-hotspot";
                marker.textContent = index + 1;
                marker.setAttribute("aria-label", "Examinar: " + object.name);
                marker.style.setProperty("--pde-x", Number(object.hotspot_x) + "%");
                marker.style.setProperty("--pde-y", Number(object.hotspot_y) + "%");
                marker.addEventListener("click", () => showObject(object, marker, puzzle));
                hotspots.append(marker);

                const item = document.createElement("li");
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = object.name;
                button.addEventListener("click", () => showObject(object, button, puzzle));
                item.append(button);
                objectList.append(item);
            });
        }

        function renderMission(mission) {
            missionTitle.textContent = mission.title;
            fillPicker(scenePicker, mission.scenes);
            renderScene(mission, mission.scenes[0]);
        }

        async function load(moveFocus = false) {
            retry.hidden = true;
            status.textContent = "Cargando las misiones…";
            try {
                missions = await readMissions(signal);
                if (signal.aborted) return;
                if (!missions.length) {
                    status.textContent = "Aún no hay misiones publicadas.";
                    return;
                }
                fillPicker(missionPicker, missions);
                renderMission(missions[0]);
                content.hidden = false;
                if (moveFocus) missionTitle.focus();
            } catch {
                if (signal.aborted) return;
                status.textContent = "No se pudieron cargar las misiones.";
                retry.hidden = false;
                if (moveFocus) retry.focus();
            }
        }

        missionTitle.tabIndex = -1;
        missionPicker.addEventListener("change", () => renderMission(missions[missionPicker.selectedIndex]));
        scenePicker.addEventListener("change", () => {
            const mission = missions[missionPicker.selectedIndex];
            renderScene(mission, mission.scenes[scenePicker.selectedIndex]);
        });
        retry.addEventListener("click", () => load(true));
        load();
    }

    $(document).on(":passagedisplay", event => {
        if (event.passage.title !== "PDE") return;
        const room = event.content.querySelector(".pde-room");
        if (room) mount(room);
    });
})();
