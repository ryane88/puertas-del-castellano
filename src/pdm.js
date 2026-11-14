(() => {
    "use strict";

    const prefix = "pdm-unknown-v1:";
    const wordId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
    let currentChapter;

    setup.pdmGuest = {
        markUnknown({ id, word }) {
            if (!wordId.test(id) || typeof word !== "string" || !word.trim()) return false;
            return SugarCube.storage.set(prefix + id, word.trim());
        },
        markKnown(id) {
            return wordId.test(id) && SugarCube.storage.delete(prefix + id);
        },
        unknownWords() {
            const words = [];
            for (const key of SugarCube.storage.keys()) {
                if (!key.startsWith(prefix)) continue;
                const id = key.slice(prefix.length);
                if (!wordId.test(id)) continue;
                const word = SugarCube.storage.get(key);
                if (typeof word === "string" && word.trim()) words.push({ id, word });
            }
            return words.sort((a, b) => a.word.localeCompare(b.word, "es"));
        }
    };

    function validWord(entry) {
        return wordId.test(entry?.id) && typeof entry.word === "string" &&
            typeof entry.short_definition === "string" && entry.short_definition.trim();
    }

    async function readWords(query, signal) {
        query.set("select", "id,word,short_definition");
        query.set("published", "eq.true");
        const response = await fetch(setup.supabase.url + "/rest/v1/pdm_words?" + query, {
            headers: { apikey: setup.supabase.key },
            signal: AbortSignal.any([signal, AbortSignal.timeout(10000)])
        });
        if (!response.ok) throw new Error("PDM vocabulary unavailable");
        const entries = await response.json();
        if (!Array.isArray(entries)) throw new Error("Invalid PDM vocabulary");
        return entries;
    }

    function showWord(entry, trigger) {
        trigger.focus();
        Dialog.create(entry.word, "pdm-definition");

        const definition = document.createElement("p");
        definition.textContent = entry.short_definition;
        const mark = document.createElement("button");
        mark.type = "button";
        mark.textContent = "Marcar como desconocida";
        const status = document.createElement("p");
        status.setAttribute("role", "status");
        const close = document.createElement("button");
        close.type = "button";
        close.textContent = "Volver al capítulo";
        close.addEventListener("click", () => Dialog.close());

        function saved() {
            mark.disabled = true;
            status.textContent = "Esta palabra está en tu Diario de Maestría.";
        }

        try {
            if (SugarCube.storage.has(prefix + entry.id)) saved();
        } catch {
            status.textContent = "No se pudo leer el diario en este navegador.";
        }
        mark.addEventListener("click", () => {
            try {
                if (!setup.pdmGuest.markUnknown(entry)) throw new Error();
                saved();
                close.focus();
            } catch {
                status.textContent = "No se pudo guardar la palabra en este navegador.";
            }
        });

        Dialog.body().append(definition, mark, status, close);
        Dialog.open();
        (mark.disabled ? close : mark).focus();
    }

    function mountChapter(chapter) {
        const lifetime = new AbortController();
        const { signal } = lifetime;
        $(document).one(":passageinit", () => {
            lifetime.abort();
            if (Dialog.isOpen("pdm-definition")) Dialog.close();
        });

        const buttons = [...chapter.querySelectorAll(".pdm-word")];
        const status = chapter.querySelector("[role=status]");
        const retry = chapter.querySelector(".pdm-vocabulary-retry");
        const words = new Map();
        const query = new URLSearchParams({
            word: "in.(" + buttons.map(button => JSON.stringify(button.dataset.word)).join(",") + ")"
        });

        for (const button of buttons) {
            button.addEventListener("click", () => {
                const entry = words.get(button.dataset.word);
                if (entry) showWord(entry, button);
            });
        }

        async function loadWords() {
            retry.hidden = true;
            status.textContent = "Cargando definiciones…";
            try {
                const entries = await readWords(query, signal);
                if (signal.aborted) return;
                words.clear();
                for (const entry of entries) {
                    if (validWord(entry)) words.set(entry.word, entry);
                }
                for (const button of buttons) button.disabled = !words.has(button.dataset.word);
                status.textContent = buttons.every(button => !button.disabled)
                    ? "" : "Algunas definiciones no están disponibles.";
                retry.hidden = !status.textContent;
            } catch {
                if (signal.aborted) return;
                status.textContent = "No se pudieron cargar las definiciones. Puedes seguir leyendo.";
                retry.hidden = false;
            }
        }

        retry.addEventListener("click", loadWords);
        loadWords();
    }

    async function readReviewVocabulary(signal) {
        const vocabulary = [];
        const pageSize = 250;
        for (let offset = 0; ; offset += pageSize) {
            const query = new URLSearchParams({ order: "id.asc", limit: pageSize, offset });
            const entries = await readWords(query, signal);
            vocabulary.push(...entries.filter(validWord));
            if (entries.length < pageSize) return vocabulary;
        }
    }

    function selectPracticeWords(vocabulary, flagged) {
        const priority = vocabulary.filter(entry => flagged.has(entry.id)).shuffle();
        const other = vocabulary.filter(entry => !flagged.has(entry.id)).shuffle();
        // Reserve up to two places for unflagged words when available.
        const selected = priority.slice(0, Math.max(4, 6 - other.length));
        return selected.concat(other.slice(0, 6 - selected.length));
    }

    function mountGenerator(room) {
        const lifetime = new AbortController();
        const { signal } = lifetime;
        $(document).one(":passageinit", () => {
            lifetime.abort();
            if (Dialog.isOpen("pdm-definition")) Dialog.close();
        });
        const generate = room.querySelector(".pdm-generate");
        const status = room.querySelector("[role=status]");
        const story = room.querySelector("article");
        const readRequested = setup.pdmReadRequested;
        setup.pdmReadRequested = false;

        function renderChapter(chapter, ids) {
            if (typeof chapter.title !== "string" || !Array.isArray(chapter.paragraphs) ||
                !Array.isArray(chapter.words) || chapter.words.length !== ids.length ||
                !chapter.words.every((entry, index) => validWord(entry) && entry.id === ids[index])) {
                throw new Error("Invalid PDM chapter");
            }
            const title = document.createElement("h2");
            title.textContent = chapter.title;
            const paragraphs = chapter.paragraphs.map(text => {
                const paragraph = document.createElement("p");
                for (const [index, part] of text.split(/\[\[(\d+)\]\]/g).entries()) {
                    if (index % 2 === 0) {
                        paragraph.append(part);
                        continue;
                    }
                    const entry = chapter.words[Number(part) - 1];
                    if (!entry) throw new Error("Invalid PDM marker");
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "pdm-word";
                    button.textContent = entry.word;
                    button.addEventListener("click", () => showWord(entry, button));
                    paragraph.append(button);
                }
                return paragraph;
            });
            story.replaceChildren(title, ...paragraphs);
            story.hidden = false;
            generate.textContent = "Generar otro capítulo";
        }

        async function generateChapter() {
            generate.disabled = true;
            status.textContent = "Preparando un capítulo…";
            try {
                const vocabulary = await readReviewVocabulary(signal);
                const flagged = new Set(setup.pdmGuest.unknownWords().map(entry => entry.id));
                const ids = selectPracticeWords(vocabulary, flagged).map(entry => entry.id);
                if (ids.length < 2) {
                    status.textContent = "Se necesitan al menos dos palabras publicadas.";
                    return;
                }
                const response = await fetch(setup.supabase.url + "/functions/v1/pdm-generate-chapter", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wordIds: ids }),
                    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)])
                });
                if (response.status === 429) {
                    status.textContent = "Se alcanzó el límite de capítulos. Inténtalo más tarde.";
                    return;
                }
                if (!response.ok) throw new Error("PDM generation unavailable");
                const chapter = await response.json();
                if (signal.aborted) return;
                renderChapter(chapter, ids);
                currentChapter = { chapter, ids };
                status.textContent = "Capítulo listo.";
            } catch {
                if (!signal.aborted) status.textContent = "No se pudo generar el capítulo. Puedes volver al capítulo del archivo.";
            } finally {
                if (!signal.aborted) generate.disabled = false;
            }
        }

        generate.addEventListener("click", generateChapter);
        if (currentChapter) {
            renderChapter(currentChapter.chapter, currentChapter.ids);
        } else if (readRequested) {
            generateChapter();
        }
    }

    function mountReview(review) {
        const lifetime = new AbortController();
        const { signal } = lifetime;
        $(document).one(":passageinit", () => lifetime.abort());

        const status = review.querySelector(".pdm-review-status");
        const question = review.querySelector("fieldset");
        const title = question.querySelector("legend");
        const choices = review.querySelector(".pdm-review-choices");
        const feedback = review.querySelector(".pdm-review-feedback");
        const mark = review.querySelector(".pdm-review-mark");
        const next = review.querySelector(".pdm-review-next");
        const start = review.querySelector(".pdm-review-start");
        let round;
        let definitions;
        let flagged;
        let index;
        let correct;

        function showQuestion() {
            const entry = round[index];
            const answer = entry.short_definition;
            const alternatives = definitions.filter(definition => definition !== answer).shuffle().slice(0, 2);
            status.textContent = "Palabra " + (index + 1) + " de " + round.length;
            title.textContent = "¿Qué significa «" + entry.word + "»?";
            feedback.textContent = "";
            mark.hidden = next.hidden = true;
            mark.disabled = false;
            next.textContent = index === round.length - 1 ? "Ver resultado" : "Siguiente";
            question.disabled = false;
            choices.replaceChildren(...[answer, ...alternatives].shuffle().map(definition => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = definition;
                button.addEventListener("click", () => {
                    if (definition === answer) correct++;
                    feedback.textContent = definition === answer ? "Correcto." : "Significado: " + answer;
                    mark.hidden = flagged.has(entry.id);
                    next.hidden = false;
                    next.focus();
                    question.disabled = true;
                });
                return button;
            }));
            question.hidden = false;
            title.focus();
        }

        async function startRound() {
            start.hidden = question.hidden = mark.hidden = next.hidden = true;
            feedback.textContent = "";
            status.textContent = "Preparando el repaso…";
            try {
                const vocabulary = await readReviewVocabulary(signal);
                if (signal.aborted) return;
                definitions = [...new Set(vocabulary.map(entry => entry.short_definition))];
                if (definitions.length < 2) {
                    status.textContent = "El repaso necesita al menos dos palabras con significados distintos.";
                    start.textContent = "Volver a cargar";
                    start.hidden = false;
                    return;
                }
                flagged = new Set(setup.pdmGuest.unknownWords().map(entry => entry.id));
                round = selectPracticeWords(vocabulary, flagged);
                index = correct = 0;
                showQuestion();
            } catch {
                if (signal.aborted) return;
                status.textContent = "No se pudo preparar el repaso. Inténtalo otra vez.";
                start.textContent = "Volver a intentar";
                start.hidden = false;
            }
        }

        mark.addEventListener("click", () => {
            const entry = round[index];
            try {
                if (!setup.pdmGuest.markUnknown(entry)) throw new Error();
                flagged.add(entry.id);
                mark.textContent = "Guardada en el diario";
                mark.disabled = true;
                next.focus();
            } catch {
                feedback.textContent = "No se pudo guardar la palabra en este navegador.";
            }
        });
        next.addEventListener("click", () => {
            mark.textContent = "Marcar como desconocida";
            if (++index < round.length) {
                showQuestion();
                return;
            }
            question.hidden = mark.hidden = next.hidden = true;
            feedback.textContent = "";
            status.textContent = "Resultado: " + correct + " de " + round.length + " respuestas correctas.";
            start.textContent = "Otra ronda";
            start.hidden = false;
            start.focus();
        });
        start.addEventListener("click", startRound);
        startRound();
    }

    $(document).on(":passagedisplay", event => {
        if (event.passage.title === "PDMChapter") mountChapter(event.content.querySelector("#pdm-chapter"));
        if (event.passage.title === "PDMReview") mountReview(event.content.querySelector("#pdm-review"));
        if (event.passage.title === "PDMGenerated") mountGenerator(event.content.querySelector("#pdm-generated"));
    });

    $(document).on(":passagedisplay", event => {
        if (event.passage.title !== "PDMDiary") return;
        const diary = event.content.querySelector("#pdm-diary");
        const list = diary.querySelector("ul");
        const status = diary.querySelector("#pdm-diary-status");

        function render() {
            list.replaceChildren();
            try {
                const words = setup.pdmGuest.unknownWords();
                status.textContent = words.length ? "" : "Todavía no has marcado ninguna palabra.";
                for (const { id, word } of words) {
                    const item = document.createElement("li");
                    const button = document.createElement("button");
                    button.type = "button";
                    button.textContent = "Ya la conozco";
                    button.setAttribute("aria-label", "Ya conozco «" + word + "»");
                    button.addEventListener("click", () => {
                        try {
                            if (!setup.pdmGuest.markKnown(id)) throw new Error();
                            render();
                        } catch {
                            status.textContent = "No se pudo actualizar el diario en este navegador.";
                        }
                    });
                    item.append(word + " ", button);
                    list.append(item);
                }
            } catch {
                status.textContent = "No se pudo abrir el diario en este navegador.";
            }
        }

        render();
    });
})();
