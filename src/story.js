
/* PUERTAS DEL CASTELLANO — SUPABASE */

setup.supabase = {
    url: "https://piqrpkzahyjkoytdycdg.supabase.co",
    key: "sb_publishable_o8s0h6t3P60zn5hLPrtL5Q_hIVrzv_x"
};

// Share the wall's door catalog with passages, including direct entries.
let castleDoorsRequest;
let castleDoorCatalog = [];
setup.getCastleDoors = function (refresh = false) {
    if (!castleDoorsRequest || refresh) {
        const endpoint = setup.supabase.url + "/rest/v1/castle_doors?select=position,name,destination_passage,badge,initial_door,published,testing";
        const options = { headers: { apikey: setup.supabase.key } };

        const request = (async () => {
            const response = await fetch(endpoint, options);
            if (!response.ok) throw new Error(`Supabase: ${response.status}`);
            const rows = await response.json();
            if (!Array.isArray(rows)) throw new Error("Invalid castle doors response");
            castleDoorCatalog = rows;
            return rows;
        })();
        castleDoorsRequest = request;
        request.catch(() => {
            if (castleDoorsRequest === request) castleDoorsRequest = undefined;
        });
    }
    return castleDoorsRequest;
};

// Explicit development configuration is source-controlled; query strings never enable it.
setup.castleDevelopment = false;
setup.canEnterRoom = function (room) {
    const development = ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
        setup.castleDevelopment === true;
    return room?.published === true || (development && room?.testing === true);
};

// Protect passage navigation before widgets, room code or requests execute.
setup.castleDoorForPassage = function (title) {
    const aliases = {
        TestMystRoom: "CastleEntrance", TestCircularRoom: "CastleEntrance",
        PuertaPalabras: "CastleEntrance", TestSupabase: "CastleEntrance",
        PDMChapter: "PDMRoom", PDMReview: "PDMRoom", PDMGenerated: "PDMRoom", PDMDiary: "PDMRoom"
    };
    return /^PDD\d+$/.test(title) ? "CastleEntrance" : aliases[title] || title;
};
const castleNavigationOverride = Config.navigation.override;
Config.navigation.override = function (requested) {
    const title = castleNavigationOverride?.(requested) || requested;
    if (["Empieza", "StoryInit"].includes(title)) return title;
    // All playable non-home passages belong to a door. Unknown destinations fail closed.
    const destination = setup.castleDoorForPassage(title);
    const allowed = () => castleDoorCatalog.some(row =>
        row.destination_passage === destination && setup.canEnterRoom(row));
    if (allowed()) return title;
    if (!castleDoorCatalog.length) {
        setup.getCastleDoors().then(() => {
            if (State.passage === "Empieza" && allowed()) Engine.play(title);
        }).catch(() => {});
    }
    return "Empieza";
};

$(document).on(":passagedisplay", async (event) => {
    const heading = event.content.querySelector(".castle-door-title");
    if (!heading) return;

    const destination = heading.dataset.doorDestination || event.passage.title;
    const selectedPosition = State.variables.castleWallIndex + 1;
    try {
        const rows = await setup.getCastleDoors();
        const matchingDoors = rows.filter((row) => row.destination_passage === destination);
        const door = matchingDoors.find((row) => row.position === selectedPosition) || matchingDoors[0];
        const name = typeof door?.name === "string" ? door.name.trim() : "";
        if (name && heading.isConnected) heading.textContent = name;
    } catch {
        // Keep the localized fallback already rendered by the widget.
    }
});

setup.getPublishedLinks = async function (signal) {
    const endpoint = setup.supabase.url + "/rest/v1/links" +
        "?select=id,title,url,description&published=eq.true&order=sort_order.asc,id.asc";
    const response = await fetch(endpoint, {
        headers: { apikey: setup.supabase.key },
        signal
    });

    if (!response.ok) throw new Error("Supabase: " + response.status);
    const links = await response.json();
    if (!Array.isArray(links)) throw new Error("Invalid links response");
    return links;
};

setup.getGrammarAdventures = async function (signal) {
    const response = await fetch(setup.supabase.url + "/rest/v1/grammar_adventures" +
        "?select=slug,title,grammar_focus,premise,outline&active=eq.true&order=sort_order.asc,slug.asc", {
        headers: { apikey: setup.supabase.key }, signal
    });
    if (!response.ok) throw new Error("Grammar catalog unavailable");
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.every(setup.isGrammarAdventure)) throw new Error("Invalid grammar catalog");
    return rows;
};

setup.getRoom = async function (pdd) {
    const endpoint =
        setup.supabase.url +
        "/rest/v1/rooms?select=*&pdd=eq." +
        encodeURIComponent(pdd);

    const response = await fetch(endpoint, {
        headers: {
            apikey: setup.supabase.key
        }
    });

    if (!response.ok) {
        throw new Error("Supabase error: " + response.status);
    }

    const rooms = await response.json();
    return rooms[0] || null;
};

/* PUERTAS DEL CASTELLANO — CHAPTER LOOKUP */

setup.getChapter = async function (chapterId) {
    const endpoint =
        setup.supabase.url +
        "/rest/v1/chapters?select=*&id=eq." +
        encodeURIComponent(chapterId);

    const response = await fetch(endpoint, {
        headers: {
            apikey: setup.supabase.key
        }
    });

    if (!response.ok) {
        throw new Error("Chapter lookup error: " + response.status);
    }

    const chapters = await response.json();
    return chapters[0] || null;
};

/* PUERTAS DEL CASTELLANO — ROOM CONNECTIONS */

setup.getConnections = async function (pdd) {
    const endpoint =
        setup.supabase.url +
        "/rest/v1/room_connections" +
        "?select=*" +
        "&enabled=eq.true" +
        "&or=(from_pdd.eq." + encodeURIComponent(pdd) +
        ",to_pdd.eq." + encodeURIComponent(pdd) + ")";

    const response = await fetch(endpoint, {
        headers: {
            apikey: setup.supabase.key
        }
    });

    if (!response.ok) {
        throw new Error(
            "Connections error: " + response.status
        );
    }

    return await response.json();
};

/* PUERTAS DEL CASTELLANO — PUBLISHED ROOMS */

setup.getPublishedRooms = async function (pddNumbers) {
    if (!pddNumbers.length) {
        return [];
    }

    const endpoint =
        setup.supabase.url +
        "/rest/v1/rooms" +
        "?select=*" +
        "&published=eq.true" +
        "&pdd=in.(" +
        pddNumbers.map(Number).join(",") +
        ")";

    const response = await fetch(endpoint, {
        headers: {
            apikey: setup.supabase.key
        }
    });

    if (!response.ok) {
        throw new Error(
            "Published rooms error: " + response.status
        );
    }

    return await response.json();
};


/* PUERTAS DEL CASTELLANO — NEIGHBOURS */
setup.getChronologicalNeighbors = async function(currentPdd) {
    const base = setup.supabase.url + "/rest/v1/rooms";
    const headers = {
        apikey: setup.supabase.key
    };

    async function findNeighbor(operator, direction) {
        const endpoint = base
           + "?select=*" 
            + "&published=eq.true"
            + "&pdd=" + operator + "." + Number(currentPdd)
            + "&order=pdd." + direction
            + "&limit=1";

        const response = await fetch(endpoint, { headers });

        if (!response.ok) {
            throw new Error("Chronological neighbor error: " + response.status);
        }

        const rooms = await response.json();
        return rooms[0] || null;
    }

    const [previous, next] = await Promise.all([
        findNeighbor("lt", "desc"),
        findNeighbor("gt", "asc")
    ]);

    return { previous, next };
};

/* PUERTAS DEL CASTELLANO — LATESTPUBLISHED*/
setup.getLatestPublishedPdd = async function () {
    const endpoint = setup.supabase.url
        + "/rest/v1/rooms"
        + "?select=pdd"
        + "&published=eq.true"
        + "&order=pdd.desc"
        + "&limit=1";

    const response = await fetch(endpoint, {
        headers: {
            apikey: setup.supabase.key
        }
    });

    if (!response.ok) {
        throw new Error("Latest PDD lookup failed: " + response.status);
    }

    const rooms = await response.json();

    return rooms.length ? Number(rooms[0].pdd) : null;
};
/* PUERTAS DEL CASTELLANO — DIRECT LINK SESSION RESET AND PRIORITY */

$(document).one(":storyready", function () {
    const pdd = new URLSearchParams(window.location.search).get("pdd");

    if (!pdd) return;

    if (sessionStorage.getItem("pddDirectLinkHandled") !== window.location.search) {
        sessionStorage.setItem("pddDirectLinkHandled", window.location.search);
        Engine.restart();
        return;
    }

    (async function () {
        let destination = null;

        if (pdd === "today") {
            destination = await setup.getLatestPublishedPdd();
        } else if (/^\d+$/.test(pdd) && Number(pdd) > 0) {
            destination = Number(pdd);
        }

        if (destination === null) return;

        State.variables.currentPdd = destination;
        State.variables.enteredFromPdd = 0;

        Engine.play("TestMystRoom");
    })().catch(function (error) {
        console.error("Direct PDD link error:", error);
    });
});
/* PUERTAS DEL CASTELLANO — MANUSCRIPT INTERACTION */

$(document).on("click", "#pdd-open-manuscript", function () {
    $("#pdd-manuscript-overlay").prop("hidden", false);
});

$(document).on("click", "#pdd-close-manuscript", function () {
    $("#pdd-manuscript-overlay").prop("hidden", true);
});

$(document).on("click", "#pdd-manuscript-overlay", function (event) {
    if (event.target === this) {
        $(this).prop("hidden", true);
    }
});
/* PUERTAS DEL CASTELLANO — MANUSCRIPT WORD NAVIGATION */

$(document).on("click", ".pdd-manuscript-word", function (event) {
    event.preventDefault();

    const destination = Number($(this).attr("data-pdd"));

    if (!destination) return;

    State.variables.enteredFromPdd =
        Number(State.variables.currentPdd || 0);

    State.variables.currentPdd = destination;

    Engine.play("TestMystRoom");
});
Config.ui.stowBarInitially = true;

/* PUERTAS DEL CASTELLANO — AUDIO */
/* Preload the door creak */
setup.doorSound = new Audio("audio/door-open.wav");
setup.doorSound.preload = "auto";
setup.doorSound.load();

setup.audio = { enabled: true, music: new Audio() };
setup.audio.music.loop = true;
setup.audio.music.volume = 0.25;
try {
    setup.audio.enabled = localStorage.getItem("pdd-music-enabled") !== "false";
    const volume = localStorage.getItem("castle-music-volume");
    if (volume !== null && Number(volume) >= 0 && Number(volume) <= 1) {
        setup.audio.music.volume = Number(volume);
    }
} catch (error) {
    console.warn("Music preference unavailable:", error);
}

setup.audio.playMusic = function () {
    const { enabled, music } = setup.audio;
    if (!enabled || !music.hasAttribute("src") || !music.paused) return;

    return music.play().catch(function (error) {
        if (error.name !== "AbortError") console.log("Music playback unavailable:", error);
    });
};

setup.audio.setTrack = function (path) {
    const { music } = setup.audio;
    if (music.getAttribute("src") !== path) {
        music.pause();
        if (path === null) music.removeAttribute("src");
        else music.src = path;
        music.load();
    }
    setup.audio.playMusic();
};

setup.audio.pddTrack = function (pdd) {
    const number = Number(pdd);
    return Number.isInteger(number) && number > 0
        ? "audio/chamber" + (number % 10) + ".mp3"
        : null;
};

// Each passage can resolve its own track. Unlisted passages are silent.
const castleMusic = new Map([
    ["TestMystRoom", () => setup.audio.pddTrack(State.variables.currentPdd)]
]);

$(document).on(":passagedisplay", function (event) {
    setup.audio.setTrack(castleMusic.get(event.passage.title)?.() ?? null);
});

$(document).one(":storyready", function () {
    const $controls = $(`
        <div id="castle-sidebar-controls">
            <button type="button" id="castle-sidebar-home" aria-label="Volver a las puertas" title="Volver a las puertas">
                <span aria-hidden="true">🏠</span>
                <span class="castle-sidebar-expanded">Volver a las puertas</span>
            </button>
            <button type="button" id="castle-sidebar-mute" aria-label="Silenciar música" title="Silenciar música">
                <span aria-hidden="true"></span>
            </button>
            <label class="castle-sidebar-expanded" for="castle-sidebar-volume">
                Volumen
                <input type="range" id="castle-sidebar-volume" min="0" max="1" step="0.01">
            </label>
        </div>
    `).insertAfter("#ui-bar-tray");
    const $mute = $controls.find("#castle-sidebar-mute");

    function updateMute() {
        $mute.attr("aria-pressed", String(!setup.audio.enabled))
            .children("span").text(setup.audio.enabled ? "🔊" : "🔇");
    }

    function saveAudioPreference(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (error) {
            console.warn("Could not save music preference:", error);
        }
    }

    $controls.find("#castle-sidebar-home").on("click", function () {
        if (State.passage !== "Empieza") Engine.play("Empieza");
    });
    $mute.on("click", function () {
        setup.audio.enabled = !setup.audio.enabled;
        if (setup.audio.enabled) setup.audio.playMusic();
        else setup.audio.music.pause();
        saveAudioPreference("pdd-music-enabled", setup.audio.enabled);
        updateMute();
    });
    $controls.find("#castle-sidebar-volume").val(setup.audio.music.volume).on("input", function () {
        setup.audio.music.volume = Number(this.value);
        saveAudioPreference("castle-music-volume", this.value);
    });
    updateMute();
});

/* PUERTAS DEL CASTELLANO — EXPLORATION MEMORY */

setup.exploration = {};

setup.exploration.storageKey = "pdd-visited-rooms-v1";

setup.exploration.getVisited = function () {
    try {
        const saved = localStorage.getItem(
            setup.exploration.storageKey
        );

        const rooms = saved ? JSON.parse(saved) : [];

        return Array.isArray(rooms) ? rooms : [];
    } catch (error) {
        console.warn("Exploration memory unavailable:", error);
        return [];
    }
};

setup.exploration.visit = function (pdd) {
    const roomNumber = Number(pdd);
    if (!Number.isInteger(roomNumber) || roomNumber <= 0) return;

    const visited = setup.exploration.getVisited();

    if (!visited.includes(roomNumber)) {
        visited.push(roomNumber);

        try {
            localStorage.setItem(
                setup.exploration.storageKey,
                JSON.stringify(visited)
            );
        } catch (error) {
            console.warn("Could not save exploration:", error);
        }
    }
};
setup.features = {
    codex: false,
    manuscript: false
};

$(document).on("click", "#solo-restart", function () {
    if (!confirm(
        "¿Quieres comenzar una nueva aventura? " +
        "Se borrarán tu diario, tus recuerdos y tu progreso."
    )) {
        return;
    }

    [
        "soloCastleCurrentPrompt",
        "soloCastleCurrentVisit",
        "soloCastleVisits",
        "soloCastleIntro",
        "soloCastleMemories",
        "soloCastleJournal"
    ].forEach(key => localStorage.removeItem(key));

    Engine.play("SoloCastleRoom");
});



/* Empieza: continuous castle wall */
$(document).on(":passagedisplay", (event) => {
      "use strict";

      if (event.passage.title !== "Empieza") return;
      const root = event.content.querySelector("#castle-wall");
      if (!root) return;
      const lifetime = new AbortController();
      const listener = { signal: lifetime.signal };
      $(document).one(":passageinit", () => lifetime.abort());

      const imagePath = "images/castle_home_continuous.png";
      const pitch = 0.2655;
      const bufferDoors = 2;
      const doorCenters = [0.235, 0.5, 0.765];
      const alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
      const shortcuts = [
        { key: "B", badge: "PDB", name: "Páginas de la Bitácora", destination: "SoloCastleRoom" },
        { key: "C", badge: "PDC", name: "Poemas de la Conjugación", destination: "SalaPoemas" },
        { key: "D", badge: "PDD", name: "Palabra del Día", destination: "CastleEntrance" },
        { key: "E", badge: "PDE", name: "Posibilidad de Escapar", destination: "PDE" },
        { key: "H", badge: "PDH", name: "Pasadizo de Hipervínculos", destination: "PasadizoHipervinculos" },
        { key: "K", badge: "PDK", name: "Palacio del Karaoke", destination: "PDK" },
        { key: "L", badge: "PDL", name: "Pila de Letras", destination: "PilaDeLetras" },
        { key: "M", badge: "PDM", name: "Palabras de Maestría", destination: "PDMRoom" },
        { key: "O", badge: "PDO", name: "Palacio de Obras", destination: "PalacioDeObras" },
        { key: "P", badge: "PDP", name: "Puentes de Principiante", destination: "PDP" },
        { key: "Q", badge: "PDQ", name: "Pruebas de Don Quijote", destination: "PruebasDonQuijote" },
        { key: "R", badge: "PDR", name: "Puerta de los Roles", destination: "PDR" },
        { key: "T", badge: "PDT", name: "Posada de los Cuentos", destination: "TavernRoom" },
        { key: "X", badge: "PDX", name: "¿Puedes Descubrir la X?", destination: "PDX" }
      ];
      const keyTargets = {};
      const placeholders = Array.from(alphabet, (_, index) => {
        const number = String(index + 1).padStart(2, "0");
        return { index, badge: number, name: `Puerta ${number}`, route: "Recorrido de prueba" };
      });
      const doors = placeholders.map((door) => ({ ...door }));
      for (const shortcut of shortcuts) Object.assign(doors[alphabet.indexOf(shortcut.key)], shortcut);

      function bindShortcuts() {
        for (const door of doors) {
          door.key = "";
          door.route = door.destination ? door.badge : "Recorrido de prueba";
        }
        for (const { key, badge, destination } of shortcuts) {
          const door = doors.find((entry) => entry.destination === destination);
          const guide = root.querySelector("#shortcut-" + key);
          guide.parentElement.hidden = !door;
          if (door) {
            door.key = key;
            keyTargets[key.toLowerCase()] = door;
            guide.textContent = door.name;
          } else {
            delete keyTargets[key.toLowerCase()];
          }
        }
      }

      const panelCount = doors.length + bufferDoors * 2;
      const enterButton = root.querySelector("#enter-door");
      const comingSoon = root.querySelector("#door-coming-soon");

      const windowElement = root.querySelector("#" + "wall-window");
      const track = root.querySelector("#" + "wall-track");
      const previousButton = root.querySelector("#" + "previous-door");
      const nextButton = root.querySelector("#" + "next-door");
      const countElement = root.querySelector("#" + "selection-count");
      const nameElement = root.querySelector("#" + "selection-name");
      const hintElement = root.querySelector("#" + "selection-hint");
      let selectedIndex = State.variables.castleWallIndex ?? 1;
      let useInitialDoor = State.variables.castleWallIndex == null;
      enterButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (enterButton.disabled) return;
        const destination = doors[selectedIndex].destination;
        if (setup.canEnterRoom(doors[selectedIndex]) && destination && Story.has(destination)) Engine.play(destination);
      });

      const artworkSlots = [];
      track.style.width = `${panelCount * pitch * 100}%`;
      for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
        const doorIndex = panelIndex - bufferDoors;
        const panel = document.createElement("div");
        panel.className = "wall-panel";
        panel.style.width = `${100 / panelCount}%`;
        const artwork = document.createElement("img");
        artwork.className = "door-artwork";
        artwork.alt = "";
        artwork.loading = "lazy";
        artworkSlots.push({ artwork, doorIndex: wrap(doorIndex) });

        const frame = document.createElement("div");
        frame.className = "wall-frame";
        frame.setAttribute("aria-hidden", "true");
        panel.append(artwork, frame);

        frame.style.backgroundImage = `url("${imagePath}")`;
        frame.style.backgroundSize = `${100 / pitch}% 100%`;

        const center = doorCenters[((doorIndex % doorCenters.length) + doorCenters.length) % doorCenters.length];
        const backgroundPosition = (0.5 - center / pitch) / (1 - 1 / pitch);
        frame.style.backgroundPosition = `${backgroundPosition * 100}% 50%`;

        {
          const door = doors[wrap(doorIndex)];
          const button = document.createElement("button");
          const badge = document.createElement("span");

          button.className = "door-hit";
          button.type = "button";
          button.dataset.doorIndex = String(door.index);
          button.dataset.panelIndex = String(doorIndex);
          button.setAttribute("aria-label", `${door.name}, puerta ${door.index + 1} de 27`);
          button.addEventListener("click", () => selectDoor(doorIndex));

          badge.className = "door-badge";
          badge.textContent = door.badge;
          button.append(badge);
          panel.append(button);
        }

        track.append(panel);
      }

      function wrap(index) {
        return (index + doors.length) % doors.length;
      }

      function positionTrack(index, animate) {
        track.style.transitionProperty = animate ? "" : "none";
        const width = windowElement.clientWidth;
        const position = (index + bufferDoors + 0.5) * pitch * width;
        track.style.transform = `translate3d(${width / 2 - position}px, 0, 0)`;
        if (!animate) void track.offsetWidth;
      }

      function selectDoor(index, animate = true) {
        if (animate) useInitialDoor = false;
        const previousIndex = selectedIndex;
        selectedIndex = wrap(index);
        State.variables.castleWallIndex = selectedIndex;
        if (index !== selectedIndex) {
          positionTrack(previousIndex + selectedIndex - index, false);
        }
        positionTrack(selectedIndex, animate);

        const door = doors[selectedIndex];
        track.querySelectorAll(".door-hit").forEach((button) => {
          const panel = Number(button.dataset.panelIndex);
          const item = doors[Number(button.dataset.doorIndex)];
          button.querySelector(".door-badge").textContent = item.badge;
          const visible = Math.abs(panel - selectedIndex) <= 2;
          button.tabIndex = visible ? 0 : -1;
          button.setAttribute("aria-hidden", String(!visible));
          button.setAttribute("aria-current", String(panel === selectedIndex));
          button.setAttribute("aria-label", `${item.name}, puerta ${item.index + 1} de 27`);
        });
        enterButton.hidden = !setup.canEnterRoom(door) || !door.destination;
        comingSoon.hidden = !enterButton.hidden;
        const movement = track.getAnimations();
        enterButton.disabled = movement.length > 0;
        if (movement.length) {
          Promise.allSettled(movement.map((animation) => animation.finished)).then(() => {
            enterButton.disabled = track.getAnimations().length > 0;
          });
        }
        countElement.textContent = `Puerta ${String(selectedIndex + 1).padStart(2, "0")} / 27`;
        nameElement.textContent = door.name;
        hintElement.textContent = door.key
          ? `Atajo ${door.key} · ${door.route}`
          : door.route;

      }

      previousButton.addEventListener("click", () => selectDoor(selectedIndex - 1));
      nextButton.addEventListener("click", () => selectDoor(selectedIndex + 1));
      window.addEventListener("resize", () => selectDoor(selectedIndex, false), listener);
      window.addEventListener("keydown", (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.closest?.("input, textarea, select, [contenteditable]")) return;

        const key = event.key.toLowerCase();
        if (key === "arrowleft") {
          event.preventDefault();
          selectDoor(selectedIndex - 1);
        } else if (key === "arrowright") {
          event.preventDefault();
          selectDoor(selectedIndex + 1);
        } else if (keyTargets[key]) {
          event.preventDefault();
          selectDoor(keyTargets[key].index);
        }
      }, listener);

      async function loadDoorData() {
        const status = root.querySelector("#" + "data-status");
        try {
          const rows = await setup.getCastleDoors(true);
          if (lifetime.signal.aborted) return;
          let initialIndex;
          for (const [index, placeholder] of placeholders.entries()) {
            Object.assign(doors[index], placeholder, { destination: undefined, key: "", published: false, testing: false });
          }
          for (const row of rows) {
            const door = doors[row.position - 1];
            if (!door) continue;
            door.published = row.published;
            door.testing = row.testing;
            if (row.initial_door === true) initialIndex = door.index;
            if (typeof row.name === "string" && row.name.trim()) door.name = row.name.trim();
            if (row.destination_passage && Story.has(row.destination_passage)) {
              door.destination = row.destination_passage;
            }
            if (typeof row.badge === "string" && row.badge.trim()) {
              door.badge = row.badge.trim();
              // Preserve the pre-existing PDL fallback artwork and label.
              if (row.position === 12 && row.badge === "12" && door.destination === "PilaDeLetras") door.badge = "PDL";
            } else {
              const shortcut = shortcuts.find((entry) => entry.destination === door.destination);
              if (shortcut) door.badge = shortcut.badge;
            }
          }
          bindShortcuts();
          selectDoor(useInitialDoor ? initialIndex ?? selectedIndex : selectedIndex, false);
          status.textContent = rows.length === doors.length
            ? "Nombres y destinos de Supabase."
            : "Las puertas sin registro muestran nombres de prueba.";
        } catch {
          if (lifetime.signal.aborted) return;
          status.textContent = "Supabase no disponible. Se muestran los nombres de prueba.";
        }
      }

      bindShortcuts();
      selectDoor(selectedIndex, false);
      loadDoorData().then(() => {
        if (lifetime.signal.aborted) return;
        const fallback = "images/PDNA.jpg";
        for (const { artwork, doorIndex } of artworkSlots) {
          const badge = doors[doorIndex].badge;
          const source = /^[a-z0-9ñ_-]+$/i.test(badge)
            ? `images/${badge}.jpg`
            : fallback;
          artwork.addEventListener("error", () => {
            if (artwork.getAttribute("src") !== fallback) {
              artwork.src = fallback;
            } else {
              artwork.hidden = true;
            }
          });
          artwork.src = source;
        }
      });
    });


// Use the deployed endpoint on localhost and the published castle.
setup.tavernChatMode = ["http://localhost:8000", "https://ryane88.github.io"].includes(window.location.origin) &&
    new URLSearchParams(window.location.search).get("pdt") !== "mock" ? "live" : "mock";

// Tavern chat and adventures share the same endpoint.
setup.tavernAdventureMode = setup.tavernChatMode;

setup.getBaldomeroReply = async function (messages, signal, adventure, introducePotion = false) {
    const mode = adventure ? setup.tavernAdventureMode : setup.tavernChatMode;
    if (mode === "live") {
        const response = await fetch(setup.supabase.url + "/functions/v1/tavern-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: messages.at(-1).content,
                mode: adventure ? "adventure" : "tavern",
                adventure,
                introducePotion: adventure ? undefined : introducePotion,
                history: messages.slice(-9, -1).map(({ role, content }) => ({
                    role,
                    content: content.slice(0, role === "assistant" && adventure ? 2600 : 800)
                }))
            }),
            signal
        });
        if (response.status === 429) {
            throw new Error("La posada está muy concurrida. Inténtalo más tarde.");
        }
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (typeof result.reply !== "string" || !result.reply.trim()) throw new Error();
        if (adventure && (!setup.isAdventureContext(result.adventure) ||
            (adventure.adventureType === "grammar" && !setup.isPuzzleState(result.adventure.puzzleState)))) throw new Error();
        return adventure ? result : result.reply;
    }

    if (adventure?.adventureType === "grammar") {
        throw new Error("La aventura gramatical no está disponible en modo de prueba. Elige Aventura libre para continuar.");
    }

    if (adventure) {
        const firstTurn = messages.length === 1;
        const examining = /mir|examin|busc|observ/i.test(messages.at(-1).content);
        const foundRibbon = adventure.discoveries.includes("Cinta azul con una luna de plata");
        const discovery = !firstTurn && examining && !foundRibbon;
        const reply = firstTurn
            ? "La última llama de la posada se estira como un hilo y desaparece. En su lugar queda un puente de piedra, húmedo y frío. Abajo corre un río oscuro que huele a tierra mojada. Al otro lado, una farolera protege su lámpara con la mano. Su capa está remendada con tela azul. «Hace años que este puente no recibe a nadie de la posada», dice, y retrocede un paso cuando algo golpea suavemente una de las piedras. El ruido vuelve a oírse. Esta vez, debajo del puente."
            : discovery
                ? "La farolera baja su lámpara. Entre dos piedras aparece una cinta azul, atada a una argolla. En la tela brilla una luna de plata. «Ese símbolo estaba en las cartas del viejo guardián», murmura. La cinta sigue atada y el río pasa justo debajo."
                : "La farolera inclina la cabeza. «Eso sí que no lo esperaba», dice con una sonrisa. Su lámpara dibuja un círculo en la niebla. Desde la otra orilla llega el sonido de una campana; la farolera se queda muy quieta, como si reconociera la señal.";
        return {
            reply,
            adventure: {
                ...adventure,
                location: firstTurn ? "El puente de la niebla" : adventure.location,
                situation: firstTurn ? "Una farolera espera junto al río." : discovery ? "Una cinta sigue atada bajo el puente." : adventure.situation,
                summary: firstTurn ? "La poción abrió un paso al puente donde espera una farolera." : adventure.summary,
                characters: firstTurn ? ["La farolera, cautelosa pero dispuesta a hablar."] : adventure.characters,
                discoveries: discovery ? [...adventure.discoveries, "Cinta azul con una luna de plata"] : adventure.discoveries,
                events: discovery ? [...adventure.events, "La farolera reconoció el símbolo del guardián."] : adventure.events,
                mysteries: firstTurn ? ["¿Qué golpea las piedras bajo el puente?"] : adventure.mysteries
            }
        };
    }

    if (introducePotion) {
        return "Baldomero ofrece dos frascos: «Aventura libre, para seguir tu curiosidad, o Aventura gramatical, para jugar con las palabras». Saca un frasco que brilla como una luciérnaga. «La última vez que lo ofrecí, tuve que explicarle a una cabra cómo volver a casa. Si te apetece una aventura, tengo una gota para ti.»";
    }

    const turns = messages.filter(message => message.role === "user").length;
    const prompts = [
        "Acércate al fuego. ¿De dónde vienes, viajero?",
        "Siempre hay sitio para una historia más. ¿Qué te ha traído hasta aquí?",
        "Cuéntame algo que hayas visto en el camino. Aquí tenemos toda la noche."
    ];
    return prompts[(turns - 1) % prompts.length];
};

// SugarCube keeps the active transcript in story state. This snapshot restores
// only PDT after a browser restart, without loading a whole-story save.
function createTavernMemory(key, validate) {
    let baseline;
    let corrupted = false;
    let unsaved;
    let warning = "";

    function restore(fallback) {
        if (unsaved) return { messages: unsaved, warning };
        try {
            baseline = undefined;
            corrupted = false;
            baseline = localStorage.getItem(key);
            if (baseline === null) return { messages: fallback, warning: "" };

            corrupted = true;
            const messages = JSON.parse(baseline);
            if (!validate(messages)) throw new Error();
            corrupted = false;
            return { messages, warning: "" };
        } catch {
            warning = "No se pudo recuperar la conversación guardada. Puedes seguir hablando durante esta visita.";
            return { messages: fallback, warning };
        }
    }

    async function save(messages, reset = false) {
        const expected = baseline;
        const preserveCorruptedSave = corrupted && !reset;

        function write() {
            if (preserveCorruptedSave) {
                return "La copia guardada está dañada y se ha conservado.";
            }
            const current = localStorage.getItem(key);
            if (current !== (expected ?? null)) {
                return "La conversación guardada cambió en otra pestaña. Recarga para abrir esa versión.";
            }
            const snapshot = JSON.stringify(messages);
            localStorage.setItem(key, snapshot);
            baseline = snapshot;
            corrupted = false;
            return "";
        }

        try {
            warning = navigator.locks ? await navigator.locks.request(key, write) : write();
        } catch {
            warning = "No se pudo guardar en este navegador. La conversación sigue disponible en esta pestaña.";
        }
        if (!warning || !reset) unsaved = warning ? messages : undefined;
        return warning;
    }

    return { restore, save };
}

setup.isTavernSceneImage = function (image) {
    return typeof image?.path === "string" &&
        /^images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:jpe?g|png|webp|avif|gif)$/i.test(image.path) &&
        typeof image.altText === "string" && image.altText.trim().length > 0;
};

function isTavernDialogue(messages) {
    return Array.isArray(messages) && messages.length % 2 === 0 &&
        messages.every((message, index) =>
            message?.role === (index % 2 === 0 ? "user" : "assistant") &&
            typeof message.content === "string" && message.content.trim());
}

setup.isAdventureContext = function (value) {
    return value && typeof value.location === "string" && value.location.trim() && value.location.length <= 120 &&
        typeof value.summary === "string" && value.summary.length <= 900 &&
        [value.characters, value.inventory].every(items => Array.isArray(items) && items.length <= 8 &&
            items.every(item => typeof item === "string" && item.length <= 120)) &&
        [value.background, value.situation].every(field =>
            field === undefined || (typeof field === "string" && field.length <= 300)) &&
        [value.discoveries, value.events, value.mysteries].every(items =>
            items === undefined || (Array.isArray(items) && items.length <= 8 &&
                items.every(item => typeof item === "string" && item.length <= 120)));
};

setup.tavernMemory = createTavernMemory("puertas-del-castellano:pdt:conversation:v1", isTavernDialogue);
setup.tavernAdventureMemory = createTavernMemory("puertas-del-castellano:pdt:adventure:v1", value =>
    value && (value.status === "not_started" ||
        (["active", "completed"].includes(value.status) && typeof value.id === "string" &&
            typeof value.playerName === "string" && setup.isAdventureContext(value) &&
            isTavernDialogue(value.dialogue) &&
            (value.adventureType === undefined || value.adventureType === "open" ||
                (value.adventureType === "grammar" && setup.isGrammarAdventure(value.grammarAdventure) &&
                    setup.isPuzzleState(value.puzzleState)))))
);

// Keep the Phase 4 storage key. Older adventures gain empty fields on read.
setup.getTavernAdventureContext = function (adventure) {
    const { playerName, location, summary, characters, inventory } = adventure;
    return {
        playerName, location, summary, characters, inventory,
        background: adventure.background ?? "",
        situation: adventure.situation ?? "",
        discoveries: adventure.discoveries ?? [],
        events: adventure.events ?? [],
        mysteries: adventure.mysteries ?? [],
        adventureType: adventure.adventureType ?? "open",
        ...(adventure.adventureType === "grammar" ? {
            grammarSlug: adventure.grammarAdventure.slug,
            puzzleState: adventure.puzzleState ?? { turnsSincePuzzle: 0, pending: null }
        } : {})
    };
};


setup.isGrammarAdventure = function (entry) {
    return entry && typeof entry.slug === "string" && /^[a-z0-9-]{1,80}$/.test(entry.slug) &&
        ["title", "grammar_focus", "premise", "outline"].every(field =>
            typeof entry[field] === "string" && entry[field].trim() && entry[field].length <= 2000);
};

setup.isPuzzleState = function (state) {
    return state && Number.isInteger(state.turnsSincePuzzle) && state.turnsSincePuzzle >= 0 &&
        state.turnsSincePuzzle <= 10000 &&
        (state.pending === null || (typeof state.pending?.prompt === "string" &&
            state.pending.prompt.length <= 300 && typeof state.pending.answer === "string" &&
            state.pending.answer.length <= 120));
};

// PDQ keeps lesson progress in the SugarCube moment, with requests scoped to the passage.
setup.mountPdq = function (room) {
    if (!room) return;
    const stages = ["discover", "understand", "use"];
    const labels = ["Descubrir", "Comprender", "Utilizar"];
    const heading = room.querySelector(".pdq-stage");
    const history = room.querySelector(".pdq-history");
    const status = room.querySelector(".pdq-status");
    const form = room.querySelector(".pdq-answer");
    const input = form.querySelector("textarea");
    const next = room.querySelector(".pdq-next");
    const extra = room.querySelector(".pdq-extra");
    const diploma = room.querySelector(".pdq-diploma");
    const diplomaArt = diploma.querySelector(".pdq-diploma-art");
    const diplomaNumber = diploma.querySelector(".pdq-diploma-number");
    const diplomaWord = diploma.querySelector(".pdq-diploma-word");
    const diplomaDefinition = diploma.querySelector(".pdq-diploma-definition");
    diplomaArt.addEventListener("load", () => { diplomaArt.hidden = false; }, { once: true });
    const diaryToggle = room.querySelector(".pdq-diary-toggle");
    const diary = room.querySelector("#pdq-diary");
    const diaryEntries = diary.querySelector(".pdq-diary-entries");
    const diaryStatus = diary.querySelector(".pdq-diary-status");
    const diaryKey = "pdq-diplomas";
    const lifetime = new AbortController();
    $(document).one(":passageinit", () => lifetime.abort());

    const variables = State.variables;
    let lesson = variables.pdq;
    let vocabulary = lesson?.vocabulary;
    let busy = false;

    function readDiplomas() {
        return SugarCube.storage.get(diaryKey) ?? [];
    }

    function renderDiary() {
        diaryEntries.replaceChildren();
        try {
            const diplomas = readDiplomas();
            diaryStatus.textContent = diplomas.length ? "" : "Todavía no has ganado ningún diploma.";
            for (const { pdd, word, definition } of diplomas) {
                const entry = document.createElement("li");
                entry.textContent = `PDD ${pdd} · ${word} — ${definition}`;
                diaryEntries.append(entry);
            }
        } catch {
            diaryStatus.textContent = "No se pudo abrir el diario de diplomas.";
        }
    }

    function saveDiploma() {
        const { pdd, word, definition } = lesson.vocabulary;
        try {
            const diplomas = readDiplomas();
            if (!diplomas.some((entry) => entry.pdd === pdd) &&
                !SugarCube.storage.set(diaryKey, [{ pdd, word, definition }, ...diplomas])) {
                throw new Error("Diploma storage unavailable");
            }
            if (!diary.hidden) renderDiary();
            return true;
        } catch {
            return false;
        }
    }

    function render() {
        const stage = lesson?.stage ?? 0;
        heading.hidden = !lesson || lesson.completed;
        heading.textContent = `Prueba ${stage + 1} de 3 · ${labels[stage]}`;
        history.replaceChildren();
        const turns = lesson?.history ?? [];
        const latestNarration = turns.findLastIndex(turn => turn.role === "assistant");
        turns.forEach((turn, index) => {
            const line = document.createElement("p");
            if (turn.role === "assistant") {
                const narration = document.createElement("em");
                narration.textContent = "Don Quijote: " + turn.content;
                if (index === latestNarration) {
                    const emphasis = document.createElement("strong");
                    emphasis.append(narration);
                    line.append(emphasis);
                } else {
                    line.append(narration);
                }
            } else {
                line.textContent = "Tú: " + turn.content;
            }
            history.append(line);
        });
        const waitingForAnswer = lesson && !lesson.completed && lesson.stageHistory.length > 0;
        form.hidden = !waitingForAnswer;
        for (const control of form.elements) control.disabled = busy;
        next.hidden = Boolean(waitingForAnswer || lesson?.completed);
        next.disabled = busy;
        next.textContent = !vocabulary ? "Cargar la palabra"
            : stage === 0 ? "Comenzar una prueba" : "Continuar a la siguiente prueba";
        extra.hidden = !lesson?.completed;
        extra.disabled = busy;
        diploma.hidden = !lesson?.completed;
        if (lesson?.completed) {
            const { pdd, word, definition } = lesson.vocabulary;
            diplomaNumber.textContent = `PDD ${pdd}`;
            diplomaWord.textContent = word;
            diplomaDefinition.textContent = definition;
            if (!diplomaArt.hasAttribute("src")) diplomaArt.src = "images/pdq-diploma.png";
        }
    }

    const wordKey = word => word.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");

    async function loadVocabulary() {
        status.textContent = "Buscando la última palabra publicada…";
        const response = await fetch(setup.supabase.url + "/rest/v1/rooms" +
            "?select=pdd,word,short_definition,description&published=eq.true&order=pdd.desc.nullslast&limit=1", {
            headers: { apikey: setup.supabase.key },
            signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(10000)])
        });
        if (!response.ok) throw new Error();
        const rows = await response.json();
        const record = Array.isArray(rows) ? rows[0] : null;
        const pdd = Number(record?.pdd);
        const word = typeof record?.word === "string" ? record.word.trim() : "";
        const definition = typeof record?.short_definition === "string" ? record.short_definition.trim() : "";
        if (!Number.isSafeInteger(pdd) || pdd < 1 || !word || !definition) {
            status.textContent = "La última palabra publicada aún no está disponible para la prueba.";
            return;
        }
        if (readDiplomas().some(entry => Number(entry.pdd) === pdd || wordKey(entry.word) === wordKey(word))) {
            await loadRandomVocabulary(false);
            return;
        }
        const description = typeof record.description === "string" ? record.description.trim() : "";
        vocabulary = { pdd, word: word.slice(0, 120), definition: definition.slice(0, 800),
            description: description.slice(0, 2000) };
        status.textContent = "";
    }

    async function loadRandomVocabulary(startLesson = true) {
        // Read the diary afresh: another completed lesson may have been saved since entry.
        const diplomas = readDiplomas();
        const seenPdds = new Set(diplomas.map(entry => Number(entry.pdd)));
        const seenWords = new Set(diplomas.map(entry => wordKey(entry.word)));
        if (lesson?.vocabulary) {
            seenPdds.add(Number(lesson.vocabulary.pdd));
            seenWords.add(wordKey(lesson.vocabulary.word));
        }
        const candidates = new Map();
        const pageSize = 250;
        status.textContent = "Buscando una palabra nueva para tu próxima aventura…";
        for (let offset = 0; ; offset += pageSize) {
            const response = await fetch(setup.supabase.url + "/rest/v1/rooms" +
                "?select=pdd,word,short_definition,description&published=eq.true&pdd=gt.0" +
                "&order=pdd.asc,id.asc&limit=" + pageSize + "&offset=" + offset, {
                headers: { apikey: setup.supabase.key },
                signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(10000)])
            });
            if (!response.ok) throw new Error();
            const rows = await response.json();
            if (!Array.isArray(rows)) throw new Error();
            for (const record of rows) {
                const pdd = Number(record?.pdd);
                const word = typeof record?.word === "string" ? record.word.trim() : "";
                const definition = typeof record?.short_definition === "string" ? record.short_definition.trim() : "";
                if (!Number.isSafeInteger(pdd) || pdd < 1 || !word || !definition ||
                    seenPdds.has(pdd) || seenWords.has(wordKey(word))) continue;
                candidates.set(wordKey(word), { pdd, word: word.slice(0, 120),
                    definition: definition.slice(0, 800),
                    description: typeof record.description === "string" ? record.description.trim().slice(0, 2000) : "" });
            }
            if (rows.length < pageSize) break;
        }
        const words = [...candidates.values()];
        if (!words.length) {
            status.textContent = "¡Ya has completado todas las palabras disponibles! Vuelve cuando se publiquen más.";
            return;
        }
        // Start only after selection and AI response succeed; preserve the diploma on failure.
        const selected = words[Math.floor(Math.random() * words.length)];
        if (startLesson) await play("", selected);
        else {
            vocabulary = selected;
            status.textContent = "Una palabra nueva te espera. Comienza la prueba cuando quieras.";
        }
    }

    async function run(action, errorMessage) {
        if (busy) return;
        busy = true;
        render();
        try {
            await action();
        } catch {
            if (!lifetime.signal.aborted) status.textContent = errorMessage;
        } finally {
            busy = false;
            if (!lifetime.signal.aborted) render();
        }
    }

    async function play(message, freshVocabulary) {
        const current = freshVocabulary ? { vocabulary: freshVocabulary, stage: 0, attempts: 0,
            history: [], stageHistory: [], completed: false } : lesson ?? { vocabulary,
            stage: 0, attempts: 0, history: [], stageHistory: [], completed: false };
        const attempt = message ? current.attempts + 1 : 0;
        status.textContent = "Don Quijote está pensando…";
        const response = await fetch(setup.supabase.url + "/functions/v1/pdq-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...current.vocabulary, stage: stages[current.stage], attempt,
                history: current.stageHistory, message
            }),
            signal: lifetime.signal
        });
        if (response.status === 429) {
            status.textContent = "La sala está muy concurrida. Inténtalo más tarde.";
            return;
        }
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (typeof result?.reply !== "string" || !result.reply.trim() ||
            result.reply.length > 1200 || typeof result.advance !== "boolean") throw new Error();
        if (lifetime.signal.aborted) return;

        const turns = [];
        if (message) turns.push({ role: "user", content: message });
        turns.push({ role: "assistant", content: result.reply });
        current.history.push(...turns);
        current.stageHistory.push(...turns);
        current.attempts = attempt;
        if (attempt > 0 && (result.advance || attempt === 3)) {
            if (!result.advance) {
                current.history.push({ role: "assistant",
                    content: `Recuerda: «${vocabulary.word}» significa ${vocabulary.definition}` });
            }
            current.stage += 1;
            current.attempts = 0;
            current.stageHistory = [];
            current.completed = current.stage === stages.length;
        }
        lesson = variables.pdq = current;
        vocabulary = current.vocabulary;
        input.value = "";
        if (current.completed) {
            status.textContent = saveDiploma() ? "¡Diploma guardado en tu diario!"
                : "Has completado las pruebas, pero no se pudo guardar el diploma.";
        } else {
            status.textContent = current.stageHistory.length ? `Intento ${current.attempts + 1} de 3.` : "";
        }
    }

    const loadError = "No se pudo cargar la palabra. Inténtalo de nuevo.";
    const replyError = "Don Quijote no pudo responder. Inténtalo de nuevo.";
    next.addEventListener("click", () => {
        if (busy) return;
        if (lesson?.completed) return;
        if (!vocabulary) return run(loadVocabulary, loadError);
        return run(() => play(""), replyError);
    });
    extra.addEventListener("click", () => {
        if (!busy && lesson?.completed) return run(loadRandomVocabulary,
            "No se pudo comenzar otra prueba. Tu diploma sigue guardado; inténtalo de nuevo.");
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = input.value.trim();
        if (message && message.length <= 800 && lesson?.stageHistory.length && !lesson.completed) {
            return run(() => play(message), replyError);
        }
    });

    diaryToggle.addEventListener("click", () => {
        diary.hidden = !diary.hidden;
        diaryToggle.setAttribute("aria-expanded", String(!diary.hidden));
        if (!diary.hidden) {
            if (lesson?.completed && saveDiploma()) status.textContent = "¡Diploma guardado en tu diario!";
            else renderDiary();
        }
    });

    render();
    if (lesson?.completed && !saveDiploma()) status.textContent = "No se pudo guardar el diploma.";
    if (!vocabulary) run(loadVocabulary, loadError);
    else if (lesson.stageHistory.length) status.textContent = `Intento ${lesson.attempts + 1} de 3.`;
};

setup.mountPdo = function (room) {
    if (!room) return;
    const start = room.querySelector(".pdo-start");
    const picker = start.elements.scenario;
    const launch = start.querySelector('button[type="submit"]');
    const retryCatalog = start.querySelector(".pdo-catalog-retry");
    const play = room.querySelector(".pdo-play");
    const reset = room.querySelector(".pdo-reset");
    const status = room.querySelector(".pdo-status");
    const lifetime = new AbortController();
    $(document).one(":passageinit", () => lifetime.abort());

    let token;
    let cast;
    let players;
    let scenes = [];
    let busy = false;

    function element(tag, content, parent) {
        const node = document.createElement(tag);
        if (content) node.textContent = content;
        parent?.append(node);
        return node;
    }

    function script(view, parent) {
        if (view.description) {
            element("p", view.description, parent).className = "pdo-scene-description";
        }
        const list = element("ol", "", parent);
        list.setAttribute("role", "list");
        list.className = "pdo-script";
        for (const { role, text } of view.lines) {
            const item = element("li", "", list);
            element("strong", cast[role].name.split(",")[0] + ":", item);
            item.append(" " + text);
        }
    }

    function illustrated(view) {
        const content = element("div", "", play);
        content.className = "pdo-illustrated";
        if (view.art) {
            const image = element("img", "", content);
            image.alt = view.art.alt;
            image.src = view.art.src;
        }
        return content;
    }

    function show(view) {
        play.replaceChildren();
        play.hidden = false;
        start.hidden = true;
        reset.hidden = false;
        const heading = element("h2", view.title, play);
        heading.tabIndex = -1;
        heading.focus();
        if (view.phase === 5) {
            const content = illustrated(view);
            const correct = view.accusation === view.culprit;
            element("p", (correct ? "¡El grupo acertó! Votasteis por " : "El grupo votó por ") + view.accusation + ".", content);
            element("p", (view.culpritLabel || "Se llevó el manuscrito") + ": " + view.culprit + ".", content);
            element("p", view.motive + " " + view.secret, content);
            element("p", view.evidence, content);
            return;
        }

        const roster = element("details", "", play);
        roster.open = view.phase === 1;
        element("summary", "Reparto y datos de la investigación", roster);
        const list = element("ul", "", roster);
        cast.forEach(({ name, player, facts, shape, color }, role) => {
            const clues = facts || [shape, color];
            element("li", "Jugador " + player + " · " + name + " · " +
                (role < players ? "Papel principal" : "Papel secundario") + " · " + clues.join(" · "), list);
        });
        if (scenes.length) {
            const history = element("details", "", play);
            element("summary", "Consultar escenas anteriores", history);
            for (const previous of scenes) {
                element("h3", previous.title, history);
                script(previous, history);
            }
        }

        if (view.phase === 4) {
            element("p", "Comentad las pistas. Cada jugador vota por un personaje en esta pantalla.", play);
            const ballot = element("form", "", play);
            const selects = [];
            for (let player = 1; player <= players; player++) {
                const label = element("label", "Jugador " + player, ballot);
                const select = element("select", "", ballot);
                select.id = "pdo-vote-" + player;
                select.required = true;
                label.htmlFor = select.id;
                element("option", "Elige un personaje", select).value = "";
                cast.forEach(({ name }, role) => { element("option", name, select).value = String(role); });
                selects.push(select);
            }
            element("button", "Contar votos y revelar", ballot).type = "submit";
            ballot.addEventListener("submit", (event) => {
                event.preventDefault();
                send({ action: "vote", token, votes: selects.map((select) => Number(select.value)) });
            });
            return;
        }

        element("p", "Leed todas las líneas antes de representarlas en orden.", play);
        script(view, illustrated(view));
        const actions = element("div", "", play);
        actions.className = "pdo-actions";
        if (view.choices.length > 1) element("p", "Elegid juntos cómo investigar.", actions);
        for (const choice of view.choices) {
            const button = element("button", choice.label, actions);
            button.type = "button";
            button.addEventListener("click", () => send({ action: "advance", token, choice: choice.id }, view));
        }
    }

    async function send(payload, previous) {
        if (busy) return;
        busy = true;
        const buttons = [...room.querySelectorAll("button")];
        buttons.forEach((button) => { button.disabled = true; });
        status.textContent = payload.action === "start" ? "Escribiendo una obra nueva… Puede tardar un poco." : "Un momento…";
        try {
            const response = await fetch(setup.supabase.url + "/functions/v1/pdo-mystery", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: lifetime.signal,
            });
            const { token: nextToken, ...view } = await response.json();
            if (!response.ok) {
                status.textContent = ({
                    scenario_unavailable: "Esta obra todavía no está disponible.",
                    generation_failed: "No se pudo escribir la obra. Intentad empezar de nuevo.",
                    tie: "Hay empate. Comentad las pistas y volved a votar.",
                    rate_limit: "Hay muchas solicitudes. Intentadlo en un minuto.",
                    invalid_session: "La partida ha caducado. Empezad otra partida.",
                })[view.error] || "No se pudo continuar. Intentadlo de nuevo.";
                return;
            }
            if (view.phase === 1) {
                cast = view.cast;
                players = payload.players;
            }
            if (previous) scenes.push(previous);
            token = nextToken;
            status.textContent = "";
            show(view);
        } catch {
            if (!lifetime.signal.aborted) status.textContent = "No se pudo conectar. Intentadlo de nuevo.";
        } finally {
            busy = false;
            buttons.forEach((button) => { button.disabled = false; });
        }
    }

    async function loadCatalog() {
        retryCatalog.hidden = true;
        picker.disabled = launch.disabled = true;
        status.textContent = "Cargando las obras…";
        try {
            const response = await fetch(setup.supabase.url +
                "/rest/v1/pdo_scenarios?select=slug,title&published=eq.true&order=sort_order.asc,slug.asc", {
                headers: { apikey: setup.supabase.key },
                signal: lifetime.signal,
            });
            if (!response.ok) throw new Error("PDO catalog unavailable");
            const rows = await response.json();
            if (!Array.isArray(rows) || !rows.every(({ slug, title }) =>
                typeof slug === "string" && typeof title === "string" && slug && title)) {
                throw new Error("Invalid PDO catalog");
            }
            picker.replaceChildren();
            for (const { slug, title } of rows) element("option", title, picker).value = slug;
            picker.selectedIndex = rows.length ? 0 : -1;
            picker.disabled = launch.disabled = rows.length === 0;
            retryCatalog.hidden = rows.length > 0;
            status.textContent = rows.length ? "" : "No hay obras publicadas.";
        } catch {
            if (lifetime.signal.aborted) return;
            status.textContent = "No se pudieron cargar las obras.";
            retryCatalog.hidden = false;
        }
    }

    retryCatalog.addEventListener("click", loadCatalog);
    start.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!picker.value) return;
        send({ action: "start", scenario: picker.value, players: Number(start.elements.players.value) });
    });
    loadCatalog();
    reset.addEventListener("click", () => {
        token = cast = undefined;
        scenes = [];
        play.replaceChildren();
        play.hidden = reset.hidden = true;
        start.hidden = false;
        status.textContent = "";
        picker.focus();
    });
};

/* PDL — Pila de Letras */
let pdlRoomsRequest;
let pdlRemaining = [];
let pdlLastPdd;

function normalizePdlAnswer(value) {
    return value.toLocaleLowerCase("es").normalize("NFD")
        .replace(/n\u0303/g, "ñ")
        .replace(/\p{M}/gu, "")
        .replace(/['’]/g, "")
        .replace(/[\p{P}\p{S}\s]+/gu, " ")
        .trim();
}

function shufflePdl(items) {
    for (let index = items.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [items[index], items[other]] = [items[other], items[index]];
    }
    return items;
}

function scramblePdlAnswer(answer) {
    const word = answer.normalize("NFC");
    const letters = shufflePdl(word.match(/\p{L}\p{M}*/gu));
    if (letters.join("").toLocaleLowerCase("es") === word.toLocaleLowerCase("es")) {
        // Force a visible change if the shuffle kept the original order.
        const first = letters[0].toLocaleLowerCase("es");
        const other = letters.findIndex((letter) => letter.toLocaleLowerCase("es") !== first);
        if (other > 0) [letters[0], letters[other]] = [letters[other], letters[0]];
    }
    return letters.join("");
}

async function getPdlRooms() {
    const rooms = [];
    const pageSize = 250;
    let afterPdd = 0;
    while (true) {
        const pageStart = afterPdd;
        const response = await fetch(setup.supabase.url + "/rest/v1/rooms" +
            "?select=pdd,word,short_definition&published=eq.true&order=pdd.asc" +
            "&limit=" + pageSize + "&pdd=gt." + afterPdd, {
            headers: { apikey: setup.supabase.key }
        });
        if (!response.ok) throw new Error("PDL rooms unavailable");
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error("Invalid PDL rooms response");

        for (const row of rows) {
            const pdd = row?.pdd;
            const word = typeof row?.word === "string" ? row.word.trim() : "";
            if (!Number.isSafeInteger(pdd) || pdd <= afterPdd) continue;
            afterPdd = pdd;
            if (!/^(?:\p{L}\p{M}*)+$/u.test(word)) continue;
            rooms.push({
                pdd,
                word,
                definition: typeof row.short_definition === "string" ? row.short_definition.trim() : ""
            });
        }
        if (rows.length < pageSize) return rooms;
        if (afterPdd === pageStart) throw new Error("Invalid PDL page cursor");
    }
}

function drawPdlRoom(rooms) {
    if (!pdlRemaining.length) {
        pdlRemaining = shufflePdl([...rooms]);
        const last = pdlRemaining.length - 1;
        if (last > 0 && pdlRemaining[last].pdd === pdlLastPdd) {
            [pdlRemaining[0], pdlRemaining[last]] = [pdlRemaining[last], pdlRemaining[0]];
        }
    }
    const puzzle = pdlRemaining.pop();
    pdlLastPdd = puzzle?.pdd;
    return puzzle;
}

$(document).on(":passagedisplay", (event) => {
    if (event.passage.title !== "PilaDeLetras") return;
    const room = event.content.querySelector(".pdl-room");
    const puzzleView = room.querySelector(".pdl-puzzle");
    const art = room.querySelector(".pdl-art");
    const letters = room.querySelector(".pdl-letters");
    const definition = room.querySelector(".pdl-definition");
    const form = room.querySelector("form");
    const answer = form.elements.answer;
    const status = room.querySelector(".pdl-status");
    const hint = room.querySelector(".pdl-hint");
    const next = room.querySelector(".pdl-next");
    const fallbackArt = "images/pdd-placeholder.jpg";
    let rooms;
    let puzzle;
    let hintUsed;

    art.addEventListener("error", () => {
        if (art.getAttribute("src") === fallbackArt) art.hidden = true;
        else art.src = fallbackArt;
    });

    function showPuzzle() {
        puzzle = drawPdlRoom(rooms);
        hintUsed = false;
        hint.disabled = false;
        answer.value = "";
        letters.textContent = scramblePdlAnswer(puzzle.word);
        definition.textContent = puzzle.definition || "No hay una definición breve disponible.";
        art.hidden = false;
        art.src = "images/pdd" + puzzle.pdd + ".jpg";
        puzzleView.hidden = false;
        status.textContent = "";
        next.textContent = "¿Otra?";
    }

    async function nextPuzzle() {
        if (rooms) {
            showPuzzle();
            return;
        }
        next.disabled = true;
        status.textContent = "Cargando palabras…";
        try {
            pdlRoomsRequest ??= getPdlRooms().catch((error) => {
                pdlRoomsRequest = undefined;
                throw error;
            });
            const loadedRooms = await pdlRoomsRequest;
            if (!room.isConnected || State.passage !== "PilaDeLetras") return;
            if (loadedRooms.length) {
                rooms = loadedRooms;
                showPuzzle();
            } else {
                pdlRoomsRequest = undefined;
                status.textContent = "Aún no hay palabras disponibles.";
                next.textContent = "Volver a intentar";
            }
        } catch {
            status.textContent = "No se pudieron cargar las palabras.";
            next.textContent = "Volver a intentar";
        } finally {
            next.disabled = false;
        }
    }

    form.addEventListener("submit", (submit) => {
        submit.preventDefault();
        if (!puzzle) return;
        const guess = normalizePdlAnswer(answer.value);
        if (!guess) status.textContent = "Escribe una respuesta.";
        else if (guess === normalizePdlAnswer(puzzle.word)) status.textContent = "¡Correcto! " + puzzle.word;
        else status.textContent = "Prueba otra vez.";
    });
    hint.addEventListener("click", () => {
        if (hintUsed) {
            letters.textContent = puzzle.word;
            status.textContent = "La respuesta es: " + puzzle.word;
            hint.disabled = true;
            return;
        }

        hintUsed = true;
        const [first, ...rest] = puzzle.word.normalize("NFC").match(/\p{L}\p{M}*/gu);
        if (!rest.length) {
            status.textContent = "La palabra tiene una sola letra.";
            return;
        }

        const suffix = rest.join("");
        const scrambledSuffix = scramblePdlAnswer(suffix);
        // Keep the existing pile if fixing the first letter would solve the whole word.
        if (scrambledSuffix.toLocaleLowerCase("es") !== suffix.toLocaleLowerCase("es")) {
            letters.textContent = first + scrambledSuffix;
        }
        status.textContent = "Primera letra: «" + first + "».";
    });
    room.querySelector(".pdl-visit").addEventListener("click", () => {
        State.variables.currentPdd = puzzle.pdd;
        State.variables.enteredFromPdd = 0;
        Engine.play("TestMystRoom");
    });
    next.addEventListener("click", nextPuzzle);
    nextPuzzle();
});
