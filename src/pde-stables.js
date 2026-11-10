/* El secreto de las caballerizas */
(() => {
    "use strict";

    const inscription = "Quiero que la flor ___ aquí, y estoy seguro de que el león no ___. Aunque el dragón ___ feroz, el castillo ___ fuerte y no caerá.";
    const heraldry = [
        { symbol: "flor", answer: "esté", x: 19, y: 16 },
        { symbol: "león", answer: "está", x: 83, y: 15 },
        { symbol: "dragón", answer: "sea", x: 45, y: 82 },
        { symbol: "castillo", answer: "es", x: 56, y: 77 }
    ];
    const engravings = [
        { digit: "7", word: "sea", x: 21, y: 30 },
        { digit: "2", word: "es", x: 78, y: 30 },
        { digit: "4", word: "esté", x: 21, y: 49 },
        { digit: "9", word: "está", x: 78, y: 49 }
    ];
    const digits = new Map(engravings.map(({ digit, word }) => [word, digit]));
    const solution = heraldry.map(({ answer }) => digits.get(answer)).join("");

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function save(progress) {
        State.variables.pdeStables = progress;
        // Keep mid-passage changes in the history moment serialized by SugarCube saves.
        State.current.variables.pdeStables = { ...progress };
    }

    function showArt(panel, filename, caption, marks, className) {
        const figure = element("figure", "", "pde-stable-art " + className);
        const painting = element("div", "", "pde-stable-painting");
        const img = element("img");
        img.alt = "";
        img.width = img.height = 1024;
        img.addEventListener("error", () => { painting.hidden = true; }, { once: true });
        painting.setAttribute("aria-hidden", "true");
        painting.append(img);
        for (const { text, x, y } of marks) {
            const mark = element("span", text, "pde-stable-mark");
            mark.style.left = x + "%";
            mark.style.top = y + "%";
            painting.append(mark);
        }
        figure.append(painting, element("figcaption", caption));
        panel.append(figure);
        img.src = "images/pde/" + filename;
    }

    function renderShield(panel) {
        const marks = heraldry.map(({ symbol, x, y }, index) => ({ symbol, x, y, text: String(index + 1) }));
        const caption = marks.map(({ text, symbol }) => text + " — " + symbol).join(" · ");
        showArt(panel, "escudo-caballerizas.jpg", caption, marks, "pde-stable-shield");
        panel.append(element("p", "Sigue el orden de los cuarteles para introducir las cifras en la cerradura."));
    }

    function renderHorseshoe(panel) {
        const marks = engravings.map(({ digit, word, x, y }) => ({ x, y, text: digit + "—" + word }));
        const caption = marks.map(({ text }) => text).join(" · ");
        showArt(panel, "herradura-caballerizas.jpg", caption, marks, "pde-stable-horseshoe");
        panel.append(element("p", "Cada forma verbal tiene una cifra grabada en el hierro."));
    }

    function renderLock(panel, progress) {
        const reset = element("button", "Reiniciar misión");
        reset.type = "button";
        reset.addEventListener("click", () => {
            const fresh = { code: "", solved: false };
            save(fresh);
            panel.replaceChildren();
            renderLock(panel, fresh);
            panel.querySelector("input").focus();
        });

        if (progress.solved) {
            const reward = element("p", "¡El arcón se abre! Dentro encuentras la llave de la verja del patio.", "pde-key");
            reward.setAttribute("role", "status");
            reward.tabIndex = -1;
            const exit = element("button", "Salir al castillo");
            exit.type = "button";
            exit.addEventListener("click", () => {
                Dialog.close();
                Engine.play("Empieza");
            });
            panel.append(reward, exit, reset);
            return;
        }

        const form = element("form", "", "pde-lock");
        const label = element("label", "Combinación de cuatro cifras");
        const input = element("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.maxLength = heraldry.length;
        input.value = progress.code;
        const check = element("button", "Probar combinación");
        check.type = "submit";
        const feedback = element("p", "", "pde-feedback");
        feedback.setAttribute("role", "status");

        input.addEventListener("input", () => {
            input.value = input.value.replace(/[^0-9]/g, "");
            progress.code = input.value;
            save(progress);
            feedback.textContent = "";
        });
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (progress.code.length !== heraldry.length) {
                feedback.textContent = "Escribe cuatro cifras.";
                return;
            }
            if (progress.code !== solution) {
                feedback.textContent = "El arcón sigue cerrado. Revisa las palabras, la herradura y el orden del escudo.";
                return;
            }
            progress.solved = true;
            save(progress);
            panel.replaceChildren();
            renderLock(panel, progress);
            panel.querySelector(".pde-key").focus();
        });
        label.append(input);
        form.append(label, check, feedback);
        panel.append(form, reset);
    }

    function renderArmory(panel) {
        const parchment = element("blockquote", inscription, "pde-stable-parchment");
        const lock = element("div", "", "pde-stable-lock");
        lock.append(element("p", "Completa la inscripción. Usa la herradura para convertir las palabras en cifras y el escudo para ordenarlas."));
        const controls = element("div");
        renderLock(controls, State.variables.pdeStables ?? { code: "", solved: false });
        lock.append(controls);
        panel.append(parchment, lock);
    }

    const renderers = {
        "arcon-de-la-armeria": renderArmory,
        escudo: renderShield,
        herradura: renderHorseshoe
    };

    setup.pdeStables = {
        matches(mission, scene) {
            return mission.slug === "escapar-el-establo" && scene.slug === "el-establo" &&
                Object.keys(renderers).every(slug => scene.objects.some(object => object.slug === slug));
        },
        clue(slug) {
            if (!Object.hasOwn(renderers, slug)) return null;
            const panel = element("div", "", "pde-clue pde-stable-clue");
            renderers[slug](panel);
            return panel;
        }
    };
})();
