/* PDK — Palacio del Karaoke */
(() => {
    "use strict";

    const videoId = /^[A-Za-z0-9_-]{11}$/;
    let youtubeApi;

    function loadYouTubeApi() {
        if (window.YT?.Player) return Promise.resolve(window.YT);
        if (youtubeApi) return youtubeApi;

        youtubeApi = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            const previous = window.onYouTubeIframeAPIReady;
            const ready = () => {
                clearTimeout(timeout);
                window.onYouTubeIframeAPIReady = previous;
                resolve(window.YT);
                previous?.();
            };
            function fail() {
                clearTimeout(timeout);
                if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
                script.remove();
                reject(new Error("YouTube player API unavailable"));
            }
            const timeout = setTimeout(fail, 10000);
            window.onYouTubeIframeAPIReady = ready;
            script.src = "https://www.youtube.com/iframe_api";
            script.addEventListener("error", fail, { once: true });
            document.head.append(script);
        }).catch(error => {
            youtubeApi = undefined;
            throw error;
        });
        return youtubeApi;
    }

    async function readSongs(signal) {
        const query = new URLSearchParams({
            select: "id,title,artist,youtube_video_id,difficulty,tags,learning_notes",
            published: "eq.true",
            order: "sort_order.asc,id.asc"
        });
        const response = await fetch(setup.supabase.url + "/rest/v1/karaoke_songs?" + query, {
            headers: { apikey: setup.supabase.key },
            signal
        });
        if (!response.ok) throw new Error("Karaoke catalog unavailable");
        const songs = await response.json();
        if (!Array.isArray(songs)) throw new Error("Invalid karaoke catalog");
        return songs;
    }

    function searchText(text) {
        return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    }

    function mount(room) {
        const lifetime = new AbortController();
        const { signal } = lifetime;
        const find = selector => room.querySelector(selector);
        const search = find("#pdk-search");
        const picker = find("#pdk-song");
        const status = find(".pdk-status");
        const retry = find(".pdk-retry");
        const detail = find(".pdk-song-detail");
        const stageHint = find(".pdk-stage-hint");
        const play = find(".pdk-play");
        const frame = find(".pdk-player");
        const watch = find(".pdk-watch");
        const videoStatus = find(".pdk-video-status");
        let songs = [];
        let song;
        let activeVideo;

        function stopVideo() {
            const current = activeVideo;
            activeVideo = undefined;
            clearTimeout(current?.timeout);
            current?.player?.destroy();
            frame.replaceChildren();
            frame.hidden = true;
        }

        $(document).one(":passageinit", () => {
            lifetime.abort();
            stopVideo();
        });

        function selectSong(next) {
            if (song === next) return;
            stopVideo();
            song = next;
            detail.hidden = !song;
            stageHint.hidden = Boolean(song);
            if (!song) return;

            const id = song.youtube_video_id;
            const playable = typeof id === "string" && videoId.test(id);
            find(".pdk-song-title").textContent = song.title;
            find(".pdk-artist").textContent = song.artist;
            find(".pdk-tags").textContent = [song.difficulty, ...song.tags].join(" · ");
            const note = find(".pdk-note");
            note.hidden = !song.learning_notes;
            note.textContent = song.learning_notes ? "Para practicar · " + song.learning_notes : "";
            play.hidden = watch.hidden = !playable;
            if (playable) {
                watch.href = "https://www.youtube.com/watch?v=" + id;
            } else {
                watch.removeAttribute("href");
            }
            videoStatus.textContent = playable ? "" : "Esta canción aún no tiene una pista disponible.";
        }

        function filterSongs() {
            const terms = searchText(search.value.trim()).split(/\s+/);
            const matches = songs.filter(entry => {
                const fields = searchText([entry.title, entry.artist, entry.difficulty, ...entry.tags].join(" "));
                return terms.every(term => fields.includes(term));
            });
            const selected = matches.includes(song) ? song : undefined;
            picker.replaceChildren(new Option("Elige una canción", ""), ...matches.map(entry =>
                new Option(entry.title + " — " + entry.artist, entry.id)
            ));
            picker.value = selected?.id ?? "";
            picker.disabled = !matches.length;
            selectSong(selected);
            status.textContent = matches.length === 1 ? "1 canción disponible."
                : matches.length ? matches.length + " canciones disponibles."
                : "No hay canciones que coincidan con la búsqueda.";
        }

        async function loadCatalog() {
            retry.hidden = true;
            status.textContent = "Abriendo el cancionero…";
            try {
                songs = await readSongs(signal);
                if (signal.aborted) return;
                if (!songs.length) {
                    status.textContent = "Aún no hay canciones publicadas en el cancionero.";
                    retry.hidden = false;
                    return;
                }
                search.disabled = false;
                filterSongs();
            } catch {
                if (signal.aborted) return;
                status.textContent = "No se pudo abrir el cancionero. Puedes volver a intentarlo.";
                retry.hidden = false;
            }
        }

        search.addEventListener("input", filterSongs, { signal });
        picker.addEventListener("change", () => selectSong(songs.find(entry => entry.id === picker.value)), { signal });
        retry.addEventListener("click", loadCatalog, { signal });
        play.addEventListener("click", async () => {
            if (!song || !videoId.test(song.youtube_video_id)) return;
            const id = song.youtube_video_id;
            const title = "Karaoke de " + song.title;
            const current = {};
            activeVideo = current;
            play.hidden = true;
            videoStatus.textContent = "Cargando la pista de YouTube…";

            function unavailable() {
                if (activeVideo !== current) return;
                stopVideo();
                play.hidden = false;
                videoStatus.textContent = "La pista no se pudo reproducir aquí. Puedes abrirla en YouTube.";
            }

            try {
                const yt = await loadYouTubeApi();
                if (activeVideo !== current) return;
                const embed = new URL("https://www.youtube-nocookie.com/embed/" + id);
                embed.searchParams.set("enablejsapi", "1");
                embed.searchParams.set("playsinline", "1");
                if (/^https?:$/.test(location.protocol)) embed.searchParams.set("origin", location.origin);

                const iframe = document.createElement("iframe");
                iframe.title = title;
                iframe.allow = "encrypted-media; picture-in-picture; fullscreen";
                iframe.allowFullscreen = true;
                iframe.referrerPolicy = "strict-origin-when-cross-origin";
                iframe.src = embed.href;
                frame.replaceChildren(iframe);
                frame.hidden = false;
                current.timeout = setTimeout(unavailable, 12000);
                current.player = new yt.Player(iframe, {
                    events: {
                        onReady: () => {
                            if (activeVideo !== current) return;
                            clearTimeout(current.timeout);
                            videoStatus.textContent = "";
                            if (document.activeElement === document.body) {
                                iframe.focus({ preventScroll: true });
                                frame.scrollIntoView({ block: "nearest" });
                            }
                        },
                        onError: unavailable
                    }
                });
            } catch {
                unavailable();
            }
        }, { signal });

        loadCatalog();
    }

    $(document).on(":passagedisplay", event => {
        if (event.passage.title === "PDK") mount(event.content.querySelector(".pdk-room"));
    });
})();
