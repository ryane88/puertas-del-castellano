type Solution = { culprit: number; motive: number; secret: number };
type Game = { players: number; phase: number; path?: string; expires: number };
const sceneKeys = ["act_1", "act_2_a", "act_2_b", "act_3"] as const;
type SceneKey = typeof sceneKeys[number];
type GeneratedScene = { description: string; turns: { first: string; second: string }[] };
type GeneratedPlay = {
  cast: { name: string; occupation: string }[];
  scenes: Record<SceneKey, GeneratedScene>;
};
type Rules = {
  facts: { label: string; values: string[] }[];
  opening_clue: string;
  continue_label: string;
  scenes: Record<SceneKey, { title: string; alt: string; brief: string }>;
  routes: { label: string; first_clue: string; last_clue: string }[];
  reveal: { title: string; culprit_label: string; evidence: string; motives: string[]; secrets: string[] };
};
type Play = GeneratedPlay & { solution: Solution; images: Record<SceneKey, string>; rules: Rules };
type Session = Game & { play: Play };
type Catalog = { title: string; premise: string; image_paths: Play["images"] };

const castSize = 6;
const branchIds = ["act_2_a", "act_2_b"];

function objectSchema(properties: Record<string, object>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const text = { type: "string" };
const six = (items: object) => ({ type: "array", items, minItems: castSize, maxItems: castSize });
const sceneSchema = objectSchema({
  description: text,
  turns: six(objectSchema({ first: text, second: text })),
});
const format = {
  type: "json_schema", name: "palacio_obra", strict: true,
  schema: objectSchema({
    cast: six(objectSchema({ name: text, occupation: text })),
    scenes: objectSchema(Object.fromEntries(sceneKeys.map((key) => [key, sceneSchema]))),
  }),
};
const instructions = `Escribe una obra de misterio nueva en español B1–B2 para leer en voz alta.
Inventa seis nombres de pila distintos, sin apellidos, y seis oficios o funciones distintas en el castillo.
Dales voces y preocupaciones diferentes. Haz que se respondan y discrepen con naturalidad.
En cada escena escribe un párrafo de ambiente de dos frases y seis turnos en el mismo orden que el reparto.
Cada turno tiene first y second, una frase completa y breve en cada campo. Evita puntos suspensivos y abreviaturas.
No incluyas etiquetas de hablante, acotaciones dentro de los turnos ni listas. Las cuatro escenas deben sentirse diferentes.
Sigue las indicaciones de cada escena. En el acto III escribe diálogo que sirva después de cualquiera de las rutas.
El servidor añade las pruebas exactas. Los personajes pueden hablar sobre las fuentes, pero deja los datos de las pruebas sin describir.
No inventes pruebas, coartadas concluyentes, confesiones, culpables, motivos ocultos ni la resolución.
Acaba con la discusión antes de votar. Da prioridad a la tensión entre personajes y a lo que les preocupa.`;

function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\x00-\x1F\x7F]/.test(value);
}

function normalizeProse(value: unknown, max: number, field: string) {
  const prose = typeof value === "string" ? value.replace(/[\t\r\n]+/g, " ").trim() : value;
  if (!validText(prose, max)) throw new Error("Invalid scene " + field);
  return prose;
}

function finishSentence(value: unknown, field: string) {
  const prose = normalizeProse(value, 220, field);
  return /[.!?…][»”"')\]]*$/u.test(prose) ? prose : prose + ".";
}

function readGenerated(value: GeneratedPlay): GeneratedPlay {
  if (!Array.isArray(value?.cast) || value.cast.length !== castSize || !value.scenes) {
    throw new Error("Invalid play shape");
  }
  const cast = value.cast.map(({ name, occupation }) => {
    if (!validText(name, 35) || !/^[\p{L}]+(?:[ -][\p{L}]+)*$/u.test(name.trim()) ||
        !validText(occupation, 70) || !/^[\p{L}]+(?:[ -][\p{L}]+)*$/u.test(occupation.trim())) {
      throw new Error("Invalid cast");
    }
    return { name: name.trim(), occupation: occupation.trim() };
  });
  if (new Set(cast.map(({ name }) => name.normalize("NFC").toLocaleLowerCase("es"))).size !== castSize ||
      new Set(cast.map(({ occupation }) => occupation.normalize("NFC").toLocaleLowerCase("es"))).size !== castSize) {
    throw new Error("Repeated cast");
  }
  const scenes = Object.fromEntries(sceneKeys.map((key) => {
    const entry = value.scenes[key];
    if (!Array.isArray(entry?.turns) || entry.turns.length !== castSize) {
      throw new Error(`Invalid scene ${key} turn count`);
    }
    return [key, {
      description: normalizeProse(entry.description, 420, `${key} description`),
      turns: entry.turns.map((turn, index) => {
        const field = `${key} turn ${index + 1}`;
        return {
          first: finishSentence(turn?.first, field + " first"),
          second: finishSentence(turn?.second, field + " second"),
        };
      }),
    }];
  })) as GeneratedPlay["scenes"];
  return { cast, scenes };
}

function factValues(rules: Rules, role: number) {
  const [first, second] = rules.facts;
  return [first.values[role % first.values.length], second.values[Math.floor(role / first.values.length)]];
}

function roleName({ name, occupation }: GeneratedPlay["cast"][number]) {
  return `${name}, ${occupation}`;
}

function artwork(play: Play, key: SceneKey) {
  return { src: play.images[key], alt: play.rules.scenes[key].alt };
}

function choices(game: Game, rules: Rules) {
  if (game.phase === 1) return rules.routes.map(({ label }, index) => ({ id: branchIds[index], label }));
  return [{ id: "continue", label: game.phase === 2 ? rules.continue_label : "Pasar a la votación" }];
}

function clueText(template: string, [a, b]: string[], name = "") {
  const values = { a, b, name };
  return template.replace(/\{(a|b|name)\}/g, (_, key: keyof typeof values) => values[key]);
}

function scene(game: Game, play: Play) {
  const { phase, path } = game;
  const { rules } = play;
  const secondRoute = path === branchIds[1];
  const route = rules.routes[secondRoute ? 1 : 0];
  const key = phase === 1 ? "act_1" : phase === 2 ? (secondRoute ? "act_2_b" : "act_2_a") : "act_3";
  const { description, turns } = play.scenes[key];
  const clueRole = phase === 2 ? 2 : 1;
  const clue = phase === 1 ? rules.opening_clue : clueText(
    phase === 2 ? route.first_clue : route.last_clue,
    factValues(rules, play.solution.culprit),
  );

  return {
    phase, title: rules.scenes[key].title, description, art: artwork(play, key), choices: choices(game, rules),
    lines: turns.map(({ first, second }, role) => ({
      role, text: role === clueRole ? `${first} ${clue} ${second}` : `${first} ${second}`,
    })),
    ...(phase === 1 ? { cast: play.cast.map((member, role) => ({
      name: roleName(member),
      player: role % game.players + 1,
      facts: factValues(rules, role).map((value, i) => `${rules.facts[i].label}: ${value}`),
    })) } : {}),
  };
}

function reveal(play: Play, accusation: number) {
  const { culprit, motive, secret } = play.solution;
  const { rules } = play;
  const culpritName = roleName(play.cast[culprit]);
  return {
    phase: 5, title: rules.reveal.title, art: artwork(play, "act_3"),
    culpritLabel: rules.reveal.culprit_label,
    accusation: roleName(play.cast[accusation]),
    culprit: culpritName,
    motive: rules.reveal.motives[motive],
    secret: rules.reveal.secrets[secret],
    evidence: clueText(rules.reveal.evidence, factValues(rules, culprit), culpritName),
  };
}

const lifetime = 2 * 60 * 60 * 1000;
// Bound UTF-8 JSON for the full play and hide its actual length in the token.
const padding = 56 * 1024;
const nonceSize = 12;
const tokenLength = Math.ceil((padding + nonceSize + 16) / 3) * 4;
const maxRequestBytes = tokenLength + 1024;
const context = new TextEncoder().encode("pdo-mystery/v4");

function cipher(iv: Uint8Array<ArrayBuffer>) {
  return { name: "AES-GCM", iv, additionalData: context };
}

async function sealGame(key: CryptoKey, session: Session) {
  const nonce = crypto.getRandomValues(new Uint8Array(nonceSize));
  const encoded = new TextEncoder().encode(JSON.stringify(session));
  if (encoded.length > padding) throw new Error("Play exceeds token size");
  const data = new Uint8Array(padding).fill(0x20);
  data.set(encoded);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(cipher(nonce), key, data));
  let binary = String.fromCharCode(...nonce);
  for (let offset = 0; offset < encrypted.length; offset += 8192) {
    binary += String.fromCharCode(...encrypted.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function openGame(key: CryptoKey, token: unknown): Promise<Session | undefined> {
  if (typeof token !== "string" || token.length !== tokenLength) return;
  try {
    const bytes = Uint8Array.from(atob(token), (char) => char.charCodeAt(0));
    const data = await crypto.subtle.decrypt(cipher(bytes.slice(0, nonceSize)), key, bytes.slice(nonceSize));
    const session: Session = JSON.parse(new TextDecoder().decode(data));
    if (session.expires > Date.now()) return session;
  } catch {
    // Invalid tokens and tampered state have the same response.
  }
}

function database() {
  const secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default;
  const databaseKey = secretKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!databaseKey || !supabaseUrl) throw new Error("Missing database configuration");
  const headers = new Headers({ apikey: databaseKey, "Content-Type": "application/json" });
  if (!secretKey) headers.set("Authorization", `Bearer ${databaseKey}`);
  return (path: string, options?: RequestInit) =>
    fetch(supabaseUrl + "/rest/v1/" + path, { ...options, headers, signal: AbortSignal.timeout(5000) });
}

async function loadCatalog(db: ReturnType<typeof database>, slug: string): Promise<Catalog | undefined> {
  const query = new URLSearchParams({ select: "title,premise,image_paths", slug: "eq." + slug, published: "eq.true" });
  const response = await db("pdo_scenarios?" + query);
  if (!response.ok) throw new Error("Scenario catalog unavailable");
  const [row] = await response.json();
  if (!row) return;
  if (!validText(row.title, 120) || !validText(row.premise, 1000) ||
      !sceneKeys.every((key) => validText(row.image_paths?.[key], 200) &&
        /^images\/[a-z0-9_/-]+\.(?:jpg|jpeg|png|webp)$/i.test(row.image_paths[key]))) {
    throw new Error("Invalid scenario catalog row");
  }
  return row;
}

async function loadRules(db: ReturnType<typeof database>, slug: string): Promise<Rules | undefined> {
  const query = new URLSearchParams({ select: "definition", slug: "eq." + slug });
  const response = await db("pdo_scenario_rules?" + query);
  if (!response.ok) throw new Error("Scenario rules unavailable: " + response.status);
  const [row] = await response.json();
  if (!row) return;
  const rules: Rules = row.definition;
  const list = (values: unknown, max: number) => Array.isArray(values) && values.length > 0 &&
    values.length <= 8 && values.every((value) => validText(value, max)) && new Set(values).size === values.length;
  if (!rules || new TextEncoder().encode(JSON.stringify(rules)).length > 8192 ||
      !Array.isArray(rules.facts) || rules.facts.length !== 2 ||
      !rules.facts.every((fact, i) => validText(fact?.label, 70) &&
        list(fact.values, 70) && fact.values.length === (i === 0 ? 3 : 2)) ||
      !validText(rules.opening_clue, 250) || !validText(rules.continue_label, 100) ||
      !sceneKeys.every((key) => {
        const scene = rules.scenes?.[key];
        return validText(scene?.title, 120) && validText(scene.alt, 200) && validText(scene.brief, 700);
      }) ||
      !Array.isArray(rules.routes) || rules.routes.length !== 2 ||
      !rules.routes.every((route, index) => validText(route?.label, 100) &&
        validText(route.first_clue, 250) && validText(route.last_clue, 250) &&
        route.first_clue.match(/\{[^{}]+\}/g)?.join() === (index === 0 ? "{a}" : "{b}") &&
        route.last_clue.match(/\{[^{}]+\}/g)?.join() === (index === 0 ? "{b}" : "{a}")) ||
      !validText(rules.reveal?.title, 120) || !validText(rules.reveal.culprit_label, 120) ||
      !validText(rules.reveal.evidence, 350) ||
      !["{a}", "{b}", "{name}"].every((slot) => rules.reveal.evidence.includes(slot)) ||
      !list(rules.reveal.motives, 220) || !list(rules.reveal.secrets, 220)) {
    throw new Error("Invalid scenario definition: " + slug);
  }
  return rules;
}

async function generatePlay(catalog: Catalog, rules: Rules, seed: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Missing OpenAI configuration");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("PDO_OPENAI_MODEL")?.trim() || "gpt-4.1-mini",
      instructions,
      input: JSON.stringify({
        titulo: catalog.title,
        premisa: catalog.premise,
        semilla: seed,
        escenas: Object.fromEntries(sceneKeys.map((key) => [key, rules.scenes[key].brief])),
      }),
      text: { format }, store: false, max_output_tokens: 4500,
    }),
    signal: AbortSignal.timeout(75000),
  });
  if (!response.ok) throw new Error("OpenAI generation unavailable: " + response.status);
  const result = await response.json();
  if (result.status !== "completed") throw new Error("Incomplete generation");
  const parts = result.output.filter((item: { type: string }) => item.type === "message")
    .flatMap((item: { content: { type: string; text: string }[] }) => item.content);
  if (parts.length !== 1 || parts[0].type !== "output_text") throw new Error("Missing generated play");
  return readGenerated(JSON.parse(parts[0].text));
}

function chooseSolution(rules: Rules): Solution {
  // Use a separate random draw for each private fact. The prose prompt receives none of them.
  const values = crypto.getRandomValues(new Uint32Array(3));
  return {
    culprit: Math.floor(values[0] / 2 ** 32 * castSize),
    motive: Math.floor(values[1] / 2 ** 32 * rules.reveal.motives.length),
    secret: Math.floor(values[2] / 2 ** 32 * rules.reveal.secrets.length),
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const origins = (Deno.env.get("PDO_ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim());
  const headers = new Headers({ Vary: "Origin", "Cache-Control": "no-store" });
  const json = (status: number, body: object) => Response.json(body, { status, headers });

  if (!origin || origin === "null" || !origins.includes(origin)) return json(403, { error: "origin" });
  headers.set("Access-Control-Allow-Origin", origin);
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "content-type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return json(405, { error: "method" });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return json(415, { error: "content_type" });
  }

  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json(400, { error: "input" });
    const decoder = new TextDecoder();
    let raw = "";
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) {
        await reader.cancel();
        return json(413, { error: "input" });
      }
      raw += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(raw + decoder.decode());
    if (!input || typeof input !== "object" || Array.isArray(input)) return json(400, { error: "input" });
  } catch {
    return json(400, { error: "input" });
  }

  try {
    const secret = Uint8Array.from(atob(Deno.env.get("PDO_SESSION_KEY") ?? ""), (char) => char.charCodeAt(0));
    if (secret.length !== 32) return json(503, { error: "unavailable" });
    const key = await crypto.subtle.importKey("raw", secret, "AES-GCM", false, ["encrypt", "decrypt"]);
    if (input.action === "start") {
      if ((!validText(input.scenario, 80) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.scenario)) ||
          !Number.isInteger(input.players) || input.players < 3 || input.players > 6) {
        return json(400, { error: "input" });
      }
      const db = database();
      const [catalog, rules] = await Promise.all([
        loadCatalog(db, input.scenario), loadRules(db, input.scenario),
      ]);
      if (!catalog || !rules) return json(400, { error: "scenario_unavailable" });
      const quota = await db("rpc/reserve_tavern_chat_request", { method: "POST", body: "{}" });
      if (!quota.ok) throw new Error("Quota unavailable");
      const allowed = await quota.json();
      if (allowed === false) return json(429, { error: "rate_limit" });
      if (allowed !== true) throw new Error("Invalid quota response");

      const solution = chooseSolution(rules);
      let generated;
      try {
        generated = await generatePlay(catalog, rules, crypto.randomUUID());
      } catch (error) {
        console.warn("pdo_generation_failed", error instanceof Error ? error.message : "");
        return json(502, { error: "generation_failed" });
      }
      const play = { ...generated, solution, images: catalog.image_paths, rules };
      const session = { players: input.players, phase: 1, expires: Date.now() + lifetime, play };
      return json(200, { ...scene(session, play), token: await sealGame(key, session) });
    }

    const session = await openGame(key, input.token);
    if (!session) return json(409, { error: "invalid_session" });
    const { play, ...game } = session;
    const advancing = input.action === "advance" && game.phase < 4;
    const voting = input.action === "vote" && game.phase === 4;
    if (!advancing && !voting) return json(409, { error: "wrong_phase" });
    if (advancing) {
      if (!choices(game, play.rules).some((choice) => choice.id === input.choice)) return json(400, { error: "input" });
      if (game.phase === 1) game.path = input.choice;
      game.phase++;
      const view = game.phase === 4 ? { phase: 4, title: "Votación del grupo" } : scene(game, play);
      return json(200, { ...view, token: await sealGame(key, { ...game, play }) });
    }
    if (!Array.isArray(input.votes) || input.votes.length !== game.players ||
        !input.votes.every((vote: number) => Number.isInteger(vote) && vote >= 0 && vote < castSize)) {
      return json(400, { error: "input" });
    }
    const counts = play.cast.map((_, role) => input.votes.filter((vote: number) => vote === role).length);
    const most = Math.max(...counts);
    if (counts.filter((count) => count === most).length > 1) return json(409, { error: "tie" });
    return json(200, reveal(play, counts.indexOf(most)));
  } catch (error) {
    console.warn("pdo_request_failed", error instanceof Error ? error.message : "");
    return json(503, { error: "unavailable" });
  }
});
