import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, mock } from "node:test";

const origin = "http://localhost:8000";
const env = new Map(Object.entries({
  PDO_ALLOWED_ORIGINS: origin,
  PDO_SESSION_KEY: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}',
  OPENAI_API_KEY: "test",
}));
let handler;
globalThis.Deno = { env, serve: (callback) => { handler = callback; } };
await import("../../supabase/functions/pdo-mystery/index.ts");

function request(body, requestOrigin = origin) {
  return handler(new Request("https://edge.test", {
    method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

async function call(body, status = 200) {
  const response = await request(body);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
}

test("PDO fixes the case, gates its reveal and keeps both routes solvable", async (t) => {
  let allowed = true;
  const scenes = ["act_1", "act_2_a", "act_2_b", "act_3"];
  const names = ["Alba", "Berta", "Celia", "Damián", "Emilio", "Fabio"];
  const occupations = ["copista", "guardia", "tramoyista", "músico", "sastre", "cocinero"];
  const imagePaths = Object.fromEntries(scenes.map((key) => [key, "images/" + key + ".jpg"]));
  const migration = readFileSync(new URL("../../supabase/migrations/20261106000002_pdo_scenario_rules.sql", import.meta.url), "utf8");
  const definitions = new Map([...migration.matchAll(/\('([^']+)', \$json\$([\s\S]+?)\$json\$::jsonb\)/g)]
    .map(([, slug, definition]) => [slug, JSON.parse(definition)]));
  assert.deepEqual([...definitions.keys()], ["manuscrito", "campana", "brindis"]);
  const usedSeeds = new Set();
  let selectedScenario = "manuscrito";
  let generated;
  let chosenCulprit = 0;
  const randomValues = crypto.getRandomValues.bind(crypto);
  t.mock.method(crypto, "getRandomValues", (array) => {
    if (array instanceof Uint32Array) {
      array.set([Math.floor((chosenCulprit + 0.5) / names.length * 2 ** 32), 0, 0]);
      return array;
    }
    return randomValues(array);
  });
  let reservations = 0;
  let generations = 0;
  let externalCalls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    externalCalls++;
    const endpoint = new URL(url);
    if (endpoint.origin === env.get("SUPABASE_URL")) {
      assert.equal(options.headers.get("apikey"), "sb_secret_test");
      switch (endpoint.pathname) {
        case "/rest/v1/pdo_scenarios":
          assert.equal(endpoint.searchParams.get("published"), "eq.true");
          const slug = endpoint.searchParams.get("slug").slice(3);
          return Response.json(definitions.has(slug) || slug === "sin-reglas"
            ? [{ title: slug, premise: "Premisa de prueba.", image_paths: imagePaths }] : []);
        case "/rest/v1/pdo_scenario_rules": {
          const rules = definitions.get(endpoint.searchParams.get("slug").slice(3));
          return Response.json(rules ? [{ definition: rules }] : []);
        }
        case "/rest/v1/rpc/reserve_tavern_chat_request":
          reservations++;
          return Response.json(allowed);
        default:
          assert.fail("Unexpected database request");
      }
    }
    assert.equal(url, "https://api.openai.com/v1/responses");
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.text.format.strict, true);
    const { titulo, premisa, semilla, escenas, ...privateFacts } = JSON.parse(payload.input);
    assert.equal(titulo, selectedScenario);
    assert.equal(premisa, "Premisa de prueba.");
    assert.deepEqual(escenas, Object.fromEntries(Object.entries(definitions.get(selectedScenario).scenes)
      .map(([key, { brief }]) => [key, brief])));
    assert.deepEqual(privateFacts, {});
    assert.ok(!usedSeeds.has(semilla));
    usedSeeds.add(semilla);
    generations++;
    return Response.json({
      status: "completed", output: [
        { type: "message", content: [{ type: "output_text", text: JSON.stringify(generated) }] },
      ],
    });
  });

  const start = { action: "start", scenario: "manuscrito", players: 3 };
  assert.equal((await request(start, "https://untrusted.test")).status, 403);
  assert.equal((await request({ extra: "x".repeat(80 * 1024) })).status, 413);
  const preflight = await handler(new Request("https://edge.test", { method: "OPTIONS", headers: { Origin: origin } }));
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  assert.equal(preflight.status, 204);
  await call({ ...start, players: 2 }, 400);
  assert.equal((await call({ ...start, scenario: "inventado" }, 400)).error, "scenario_unavailable");
  assert.equal((await call({ ...start, scenario: "sin-reglas" }, 400)).error, "scenario_unavailable");
  allowed = false;
  await call(start, 429);
  allowed = true;
  generated = { cast: [], scenes: {} };
  assert.equal((await call(start, 502)).error, "generation_failed");

  for (const [slug, rules] of definitions) {
    selectedScenario = slug;
    for (let culprit = 0; culprit < names.length; culprit++) {
      chosenCulprit = culprit;
      generated = {
        cast: names.map((_, i) => ({ name: names[(i + culprit) % names.length], occupation: occupations[i] })),
        scenes: Object.fromEntries(scenes.map((key) => [key, {
          description: "Introducción nueva para " + key + " en la partida " + culprit + "." +
            (culprit === 5 ? "⛅".repeat(350) : ""),
          turns: names.map((_, i) => ({
            first: "Quiero comprobar el detalle " + i + ".",
            second: culprit === 5 && key !== "act_1" ? "⛅".repeat(219) + "." : "Escuchemos a los demás.",
          })),
        }])),
      };
      if (culprit === 0) {
        generated.scenes.act_1.turns[0] = {
          first: "El Sr. Ruiz dijo: «Buscad en el patio…»",
          second: "Pero\nquiero comprobarlo",
        };
        generated.scenes.act_2_b.description += "\nSe acerca alguien.";
      }
      const players = 3 + culprit % 4;
      const act1 = await call({ ...start, players, scenario: slug });
      const callsAtStart = externalCalls;
      assert.equal(act1.token.length, 76496);
      assert.equal(act1.title, rules.scenes.act_1.title);
      assert.deepEqual(act1.choices.map(({ label }) => label), rules.routes.map(({ label }) => label));
      assert.ok(!JSON.stringify(act1).includes(rules.reveal.secrets[0]));
      assert.ok(!atob(act1.token).includes(generated.scenes.act_3.description));
      assert.equal(new Set(act1.cast.slice(0, players).map(({ player }) => player)).size, players);
      const roles = generated.cast.map(({ name, occupation }) => name + ", " + occupation);
      assert.deepEqual(act1.cast.map(({ name }) => name), roles);
      assert.equal(act1.description, generated.scenes.act_1.description);
      assert.equal(act1.art.src, imagePaths.act_1);
      assert.ok(!JSON.stringify(act1).includes(generated.scenes.act_3.description));
      assert.equal(act1.lines[0].text, culprit === 0
        ? "El Sr. Ruiz dijo: «Buscad en el patio…» Pero quiero comprobarlo."
        : "Quiero comprobar el detalle 0. Escuchemos a los demás.");
      const votes = Array(players).fill(culprit);
      const advance = (view, choice) => call({ action: "advance", token: view.token, choice });
      await call({ action: "vote", token: act1.token, votes }, 409);
      await call({ action: "advance", token: act1.token, choice: "continue" }, 400);
      const tampered = (act1.token[0] === "A" ? "B" : "A") + act1.token.slice(1);
      await call({ action: "advance", token: tampered, choice: "act_2_a" }, 409);

      const endings = [];
      for (const path of ["act_2_a", "act_2_b"]) {
        const act2 = await advance(act1, path);
        const act3 = await advance(act2, "continue");
        if (culprit === 0 && path === "act_2_b") {
          assert.equal(act2.description, generated.scenes.act_2_b.description.replace("\n", " "));
        }
        assert.equal(act2.art.src, imagePaths[path]);
        assert.equal(act3.description, generated.scenes.act_3.description);
        const ballot = await advance(act3, "continue");
        assert.deepEqual([act1.phase, act2.phase, act3.phase, ballot.phase], [1, 2, 3, 4]);
        for (const view of [act1, act2, act3, ballot]) {
          assert.equal(view.token.length, act1.token.length);
          for (const key of ["culprit", "motive", "secret", "variant", "evidence"]) assert.ok(!(key in view));
          if (!view.lines) continue;
          assert.ok(view.description?.trim());
          assert.equal(view.lines.length, roles.length);
          for (const { text } of view.lines) {
            const sentences = text.match(/[.!?…][»”"]*(?=\s|$)/g)?.length;
            assert.ok(sentences === 2 || sentences === 3, text);
          }
          const assignments = view.lines.map(({ role }) => act1.cast[role].player);
          assert.ok(assignments.slice(1).every((player, i) => player !== assignments[i]));
        }
        const lines = [...act2.lines, ...act3.lines].map(({ text }) => text).join(" ");
        const marked = act1.cast.filter(({ facts }) => facts.every((fact) => lines.includes(fact.split(": ")[1])));
        assert.deepEqual(marked.map(({ name }) => name), [roles[culprit]]);
        await call({ action: "vote", token: act3.token, votes }, 409);
        await call({ action: "vote", token: ballot.token, votes: [] }, 400);
        await call({ action: "vote", token: ballot.token, votes: Array.from({ length: players }, (_, i) => i) }, 409);
        const ending = await call({ action: "vote", token: ballot.token, votes });
        assert.equal(ending.culprit, roles[culprit]);
        assert.equal(ending.accusation, roles[culprit]);
        assert.equal(ending.title, rules.reveal.title);
        assert.equal(ending.culpritLabel, rules.reveal.culprit_label);
        assert.equal(ending.motive, rules.reveal.motives[0]);
        assert.equal(ending.secret, rules.reveal.secrets[0]);
        endings.push(ending);
      }
      assert.deepEqual(endings[0], endings[1]);
      assert.equal(externalCalls, callsAtStart, "Scene changes and votes require no external calls");

      const now = mock.method(Date, "now", () => Number.MAX_SAFE_INTEGER);
      try {
        assert.equal((await call({ action: "advance", token: act1.token, choice: "act_2_a" }, 409)).error, "invalid_session");
      } finally {
        now.mock.restore();
      }
    }

  }

  assert.equal(generations, 19);
  assert.equal(reservations, 20);
});
