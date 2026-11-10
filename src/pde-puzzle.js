/* El secreto del alquimista — la cerradura de los cuatro colores */
(() => {
    "use strict";

    const clues = {
        azul: { label: "Azul", ingredient: "Parafenol", por: 1, para: 3 },
        amarillo: { label: "Amarillo", ingredient: "Empornax", por: 7, para: 2 },
        morado: { label: "Morado", ingredient: "Parafyl", por: 6, para: 9 },
        verde: { label: "Verde", ingredient: "Porexene", por: 4, para: 8 }
    };
    const sentences = [
        { color: "morado", before: "", after: " salir del castillo, busca la llave.", answer: "para" },
        { color: "verde", before: "Pasa ", after: " la ventana.", answer: "por" },
        { color: "azul", before: "", after: " quedarte aquí, cierra la puerta.", answer: "para" },
        { color: "amarillo", before: "Sal ", after: " la puerta del jardín.", answer: "por" }
    ];
    const flag = ["azul", "amarillo", "morado", "verde"];
    const vialOrder = ["verde", "amarillo", "morado", "azul"];
    const descriptions = {
        manuscrito: "En la última página lees: «Las palabras revelan los colores».",
        "tubo-de-ensayo": "Hay cuatro frascos de vidrio. Cada uno tiene dos medidas: una «POR CADA AVENTURA» y otra «PARA EL HECHIZO».",
        cofre: "La cerradura tiene cuatro ruedas. Lee los colores de la bandera de izquierda a derecha."
    };
    const art = {
        manuscrito: ["manuscrito.jpg", "Un manuscrito abierto a la luz de una vela"],
        "tubo-de-ensayo": ["pociones.jpg", "Cuatro frascos: verde, amarillo, morado y azul"],
        cofre: ["bandera.jpg", "Bandera con cuatro franjas: azul, amarilla, morada y verde"]
    };

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function colorLabel(color) {
        return element("span", clues[color].label, "pde-color pde-color-" + color);
    }

    function currentProgress() {
        return State.variables.pdeAlchemist ?? { answers: ["", "", "", ""], code: "", solved: false };
    }

    function save(progress) {
        State.variables.pdeAlchemist = progress;
        // SugarCube serializes the current history moment when saving mid-passage.
        State.current.variables.pdeAlchemist = { ...progress, answers: [...progress.answers] };
    }

    function correctAnswers(progress) {
        return sentences.filter((sentence, index) => progress.answers[index] === sentence.answer).length;
    }

    function renderManuscript(panel, progress) {
        const form = element("form");
        const list = element("ol", "", "pde-sentences");
        const feedback = element("p", "", "pde-feedback");
        feedback.setAttribute("role", "status");

        sentences.forEach(({ color, before, after }, index) => {
            const line = element("li");
            const label = element("label", "", "pde-sentence");
            const select = element("select");
            select.setAttribute("aria-label", (before + "___" + after).trim() + " (" + clues[color].label + ")");
            select.append(new Option("…", ""), new Option("por", "por"), new Option("para", "para"));
            select.value = progress.answers[index];
            select.addEventListener("change", () => {
                progress.answers[index] = select.value;
                save(progress);
                feedback.textContent = "";
            });
            label.append(before, select, after);
            line.append(colorLabel(color), label);
            list.append(line);
        });

        const check = element("button", "Comprobar palabras");
        check.type = "submit";
        form.append(list, check, feedback);
        form.addEventListener("submit", event => {
            event.preventDefault();
            const count = correctAnswers(progress);
            feedback.textContent = count === sentences.length
                ? "¡Las cuatro palabras son correctas!"
                : "Palabras correctas: " + count + " de " + sentences.length + ". Revisa las frases.";
        });
        panel.append(form);
    }

    function renderVials(panel) {
        panel.append(element("p", "Para cada color, usa la medida que indica la palabra del manuscrito."));
        const table = element("table", "", "pde-vials");
        const header = table.createTHead().insertRow();
        for (const title of ["Frasco", "POR CADA AVENTURA", "PARA EL HECHIZO"]) {
            const cell = element("th", title);
            cell.scope = "col";
            header.append(cell);
        }
        const body = table.createTBody();
        for (const color of vialOrder) {
            const { ingredient, por, para } = clues[color];
            const row = body.insertRow();
            const label = element("th");
            label.scope = "row";
            label.append(colorLabel(color), element("small", ingredient));
            row.append(label, element("td", por + " ml"), element("td", para + " ml"));
        }
        panel.append(table);
    }

    function renderChest(panel, progress) {
        if (progress.solved) {
            const result = element("p", "¡El cofre se abre! Dentro hay una llave dorada.", "pde-key");
            result.setAttribute("role", "status");
            result.tabIndex = -1;
            const reset = element("button", "Reiniciar el rompecabezas");
            reset.type = "button";
            reset.addEventListener("click", () => {
                const fresh = { answers: ["", "", "", ""], code: "", solved: false };
                save(fresh);
                panel.replaceChildren();
                renderChest(panel, fresh);
                panel.querySelector("input").focus();
            });
            panel.append(result, reset);
            return;
        }

        const order = element("ol", "", "pde-flag-order");
        order.setAttribute("aria-label", "Orden de los colores de la bandera");
        for (const color of flag) {
            const item = element("li");
            item.append(colorLabel(color));
            order.append(item);
        }
        const form = element("form", "", "pde-lock");
        const label = element("label", "Combinación de cuatro cifras");
        const input = element("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.maxLength = flag.length;
        input.value = progress.code;
        input.addEventListener("input", () => {
            input.value = input.value.replace(/[^0-9]/g, "");
            progress.code = input.value;
            save(progress);
            feedback.textContent = "";
        });
        label.append(input);
        const submit = element("button", "Probar combinación");
        submit.type = "submit";
        const feedback = element("p", "", "pde-feedback");
        feedback.setAttribute("role", "status");
        form.append(label, submit, feedback);
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (progress.code.length !== flag.length) {
                feedback.textContent = "Escribe cuatro cifras.";
                return;
            }
            if (correctAnswers(progress) !== sentences.length) {
                feedback.textContent = "La cerradura no se mueve. Revisa las cuatro palabras del manuscrito.";
                return;
            }

            const words = new Map(sentences.map((sentence, index) => [sentence.color, progress.answers[index]]));
            const solution = flag.map(color => clues[color][words.get(color)]).join("");
            if (progress.code !== solution) {
                feedback.textContent = "El cofre sigue cerrado. Revisa las medidas y el orden de la bandera.";
                return;
            }

            progress.solved = true;
            save(progress);
            panel.replaceChildren();
            renderChest(panel, progress);
            panel.querySelector(".pde-key").focus();
        });
        panel.append(order, form);
    }

    const renderers = {
        manuscrito: renderManuscript,
        "tubo-de-ensayo": renderVials,
        cofre: renderChest
    };

    setup.pdeAlchemist = {
        matches(mission, scene) {
            return mission.slug === "el-secreto-del-alquimista" && scene.slug === "el-taller" &&
                Object.keys(renderers).every(slug => scene.objects.some(object => object.slug === slug));
        },
        clue(slug) {
            if (!Object.hasOwn(renderers, slug)) return null;
            const panel = element("div", "", "pde-clue");
            const [file, alt] = art[slug];
            const image = element("img");
            image.alt = alt;
            image.width = 960;
            image.height = 640;
            image.addEventListener("error", () => image.remove(), { once: true });
            image.src = "images/pde/" + file;
            panel.append(image, element("p", descriptions[slug]));
            const controls = element("div", "", "pde-clue-controls");
            renderers[slug](controls, currentProgress());
            panel.append(controls);
            return panel;
        }
    };
})();
