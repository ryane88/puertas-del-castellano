begin;

create table if not exists public.pdo_scenario_rules (
    slug text primary key references public.pdo_scenarios (slug),
    definition jsonb not null check (jsonb_typeof(definition) = 'object')
);

alter table public.pdo_scenario_rules enable row level security;
revoke all on table public.pdo_scenario_rules from public, anon, authenticated, service_role;
grant select on table public.pdo_scenario_rules to service_role;

-- All scenario-specific clues, prompts and reveal text stay outside the public catalog.
insert into public.pdo_scenario_rules (slug, definition) values
('manuscrito', $json$
{
  "facts": [{"label":"Dibujo del sello","values":["luna","llave","estrella"]},{"label":"Color de la cera","values":["azul","verde"]}],
  "opening_clue":"Según el aviso, quien se llevó el manuscrito dejó su sello, y cada sello tiene una combinación distinta de dibujo y color.",
  "continue_label":"Volver al atril",
  "scenes":{
    "act_1":{"title":"Acto I · Un atril vacío","alt":"Interior del archivo del castillo","brief":"El manuscrito desaparece antes de la función. Junto al atril hay un aviso sobre un sello. El segundo personaje menciona el aviso. Debaten si revisar el registro del archivo o buscar a una testigo en el patio."},
    "act_2_a":{"title":"Acto II · El registro del archivo","alt":"Interior del archivo del castillo","brief":"En el archivo, el tercer personaje encuentra en el registro la impresión de un sello. Otros discuten si una marca basta para acusar a alguien. Deja su dibujo sin describir."},
    "act_2_b":{"title":"Acto II · La nota del patio","alt":"Patio del castillo cubierto de vegetación","brief":"Una testigo se marchó del patio y dejó una nota. El tercer personaje la lee sin citar lo que vio. Los demás discrepan sobre cuánto fiarse de una nota sin firma."},
    "act_3":{"title":"Acto III · Las dos mitades","alt":"Gran sala del castillo","brief":"De vuelta en el atril, el segundo personaje señala que allí queda una marca que permite completar la pista que falte. Sirve después de cualquiera de las rutas. El grupo discute antes de votar."}
  },
  "routes":[
    {"label":"Buscar el dibujo en el archivo","first_clue":"En el registro se distingue el dibujo de una {a}.","last_clue":"En el borde del atril queda cera de color {b}."},
    {"label":"Leer la nota de la testigo en el patio","first_clue":"La testigo anotó que la cera era de color {b}.","last_clue":"En el borde del atril se distingue el dibujo de una {a}."}
  ],
  "reveal":{"title":"Desenlace · El manuscrito reaparece","culprit_label":"Se llevó el manuscrito","evidence":"El dibujo de una {a} y la cera de color {b} solo coinciden en el sello de {name}.","motives":["Quería recuperar una carta familiar guardada entre las páginas.","Quería retrasar la función para corregir una escena que le parecía injusta.","Había prometido enseñarle el manuscrito a alguien antes del estreno."],"secrets":["Había escondido el manuscrito detrás de un panel del escenario.","Había envuelto el manuscrito en un telón viejo y lo había dejado entre los decorados.","Había guardado el manuscrito en un cajón vacío bajo el escenario."]}
}
$json$::jsonb),
('campana', $json$
{
  "facts":[{"label":"Señal en el permiso","values":["un puente","una rueda","una espiga"]},{"label":"Grupo de paso","values":["primer turno","segundo turno"]}],
  "opening_clue":"El reglamento dice que cada responsable tiene una combinación única de señal y turno, y que el permiso del carro lleva ambos datos.",
  "continue_label":"Reunirse junto al embarcadero",
  "scenes":{
    "act_1":{"title":"Acto I · La señal antes de tiempo","alt":"Puente de piedra bajo la luz de la luna","brief":"Un carro cruza tras oír una campana adelantada. La cuerda del puesto sigue atada y el segundo personaje recuerda las reglas de los permisos de paso. Consideran examinar el camino junto a la ermita o hablar con quien vio el carro en el cruce."},
    "act_2_a":{"title":"Acto II · El papel de la ermita","alt":"Ermita junto al camino","brief":"Junto a la ermita, el tercer personaje encuentra un trozo del permiso del carro. Dos personas discrepan sobre si la campana sonó aquí o al otro lado del puente. No describas el dibujo del papel."},
    "act_2_b":{"title":"Acto II · La versión del cruce","alt":"Cruce de caminos en el bosque","brief":"En el cruce, el tercer personaje consulta lo que una testigo anotó al ver el carro. Una persona duda de su memoria porque había otros carros. No indiques el turno registrado."},
    "act_3":{"title":"Acto III · El duplicado del embarcadero","alt":"Embarcadero junto al río","brief":"En el embarcadero se conserva un duplicado del permiso del carro. El segundo personaje encuentra el dato que falta, sin decir cuál es. La pregunta antes de votar es quién autorizó el paso y pudo dar la señal."}
  },
  "routes":[
    {"label":"Examinar el permiso junto a la ermita","first_clue":"En el papel del carro se distingue {a}.","last_clue":"El duplicado indica que el carro llevaba un permiso del {b}."},
    {"label":"Escuchar la versión del cruce","first_clue":"La testigo anotó que el permiso era del {b}.","last_clue":"En el duplicado del permiso se distingue {a}."}
  ],
  "reveal":{"title":"Desenlace · La señal falsa","culprit_label":"Adelantó la señal","evidence":"El permiso del carro llevaba {a} y correspondía al {b}. Solo {name} tenía esa combinación.","motives":["Quería que la carga llegara a tiempo para un encargo familiar.","Quería evitar que se perdiera una entrega urgente durante la espera.","Quería demostrar que el puesto tardaba demasiado en revisar los carros."],"secrets":["Había tocado una campana de mano junto al camino y la había guardado debajo del asiento del carro.","Había usado una campanilla de repuesto y la había envuelto en un saco junto a la ermita.","Había colgado una campana prestada en el camino y la había retirado después del paso del carro."]}
}
$json$::jsonb),
('brindis', $json$
{
  "facts":[{"label":"Marca del albarán","values":["una hoja","un racimo","una corona"]},{"label":"Mesa de entrega","values":["mesa norte","mesa sur"]}],
  "opening_clue":"Cada responsable firmó una combinación distinta de marca y mesa, y esa combinación identifica a quien retiró la botella.",
  "continue_label":"Comparar los recibos en el patio",
  "scenes":{
    "act_1":{"title":"Acto I · La botella abierta","alt":"Gran sala del castillo","brief":"Las familias esperan el brindis en el salón. La botella ha aparecido abierta en la cocina. El segundo personaje recuerda cómo se registraron las entregas. Se puede revisar la copia de cocina o hablar con la persona del puesto del mercado."},
    "act_2_a":{"title":"Acto II · La copia de cocina","alt":"Cocina del castillo","brief":"En la cocina, el tercer personaje recupera una copia del albarán entre papeles húmedos. Un testimonio coloca la botella en la cocina mientras otro la coloca fuera. No nombres el dibujo de la copia."},
    "act_2_b":{"title":"Acto II · Una entrega en el mercado","alt":"Puestos del mercado","brief":"En el mercado, el tercer personaje consulta una anotación de la persona que recibió la entrega. Alguien recuerda otra botella parecida. No indiques la mesa escrita en el recibo."},
    "act_3":{"title":"Acto III · La copia de la otra familia","alt":"Patio del castillo","brief":"En el patio, las familias traen su copia firmada. El segundo personaje señala que puede completar el dato que falta. El grupo separa lo que vio de lo que recuerda y debate antes de votar."}
  },
  "routes":[
    {"label":"Revisar la copia en la cocina","first_clue":"La copia del albarán lleva el dibujo de {a}.","last_clue":"El recibo firmado indica que la botella pasó por la {b}."},
    {"label":"Consultar a la persona del puesto del mercado","first_clue":"En la anotación figura la {b} como punto de entrega.","last_clue":"El albarán firmado tiene el dibujo de {a}."}
  ],
  "reveal":{"title":"Desenlace · El brindis puede esperar","culprit_label":"Retiró y abrió la botella","evidence":"El albarán de la botella reúne el dibujo de {a} y la {b}. Esa combinación solo correspondía a {name}.","motives":["Quería averiguar si la bebida era apta para un invitado antes de servirla.","Quería sustituir una botella que creía estropeada sin avergonzar a la familia que la había traído.","Quería retrasar el brindis para que llegara una persona que había negociado la tregua."],"secrets":["Había apartado la botella original detrás de las jarras de agua.","Había llevado la botella a la cocina en una cesta para que nadie la viera.","Había sacado la botella del salón envuelta en un mantel y la había dejado en una alacena."]}
}
$json$::jsonb)
on conflict (slug) do nothing;

commit;
