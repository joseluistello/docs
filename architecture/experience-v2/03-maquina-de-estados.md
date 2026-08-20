# E3 — Máquina de estados de la experiencia

Este documento define los estados **que el usuario habita**, no los del motor. La regla que lo gobierna (EXP-5): entre el log de eventos (A1) y la UI existe **una sola proyección canónica** — el *reductor de experiencia* — y todo componente visible lee de ella. Un estado de motor sin consecuencia para el usuario NO es un estado de experiencia.

## 1. De 16 estados candidatos a 9 — y por qué

La lista candidata (inicio, comprensión, aclaración material, contrato listo, plan listo, ejecutando, resultados parciales, esperando steering, esperando aprobación, corrigiendo rumbo, suspendido, sin cobertura, sin resultados, fallo recuperable, terminado, reabierto) contiene los defectos que produjeron la experiencia actual. Consolidación:

| Candidatos | Decisión | Razón |
|---|---|---|
| comprensión · aclaración material · contrato listo · plan listo | **UN estado: Encuadre** | Son fases de UN turno, no pantallas. Separarlos creó la ceremonia (entrevista→contrato→plan) que retrasa el valor. El contrato/plan son *contenido inspeccionable* del encuadre y del tablero, no estaciones de paso. "Aclaración material" es el Encuadre con una pregunta pendiente — mismo composer, mismo panel: mismo estado. |
| ejecutando · resultados parciales | **UN estado: Trabajando** | "Resultados parciales" es una *propiedad* (el tablero se llena progresivamente — siempre hay parciales), no una transición. Tratarlo como estado produjo teatro de progreso. |
| esperando steering | **ELIMINADO** | Un sistema que "espera dirección" está ocioso con disfraz. El steering es una *capacidad permanente* del composer durante Trabajando, no un estado. |
| corrigiendo rumbo | **ELIMINADO como estado** | Es un evento (`STEERING_APPLIED`) dentro de Trabajando: se narra ("aplico tu ajuste: 4 siguen, 2 fuera"), no se transiciona. Si el ajuste contradice el encargo base, el sistema lo dice y ofrece abrir otra búsqueda — eso sí es una decisión. |
| esperando aprobación | **Decisión pendiente** | Un solo estado parametrizado por el tipo de checkpoint (gasto, monitor, contacto, conflicto, aclaración post-arranque). |
| suspendido · fallo recuperable | **UN estado: Pausa** | Mecánica idéntica (trabajo preservado, reanudación automática o manual); difiere solo la causa, que es copy, no máquina. |
| sin resultados · terminado | **UN estado: Resultado, con variantes** | La transición es la misma (`RUN_FINISHED`); cambia el contenido contractual de la variante (completo / sin calificadas / parcial por fallo). "Sin resultados" como estado aparte invita a tratarlo como error — es un resultado. |
| sin cobertura | **SE CONSERVA como estado** | Es la única situación donde no habrá trabajo que mostrar y la conversación ES la superficie de decisión. Composer, panel y salidas propios. |
| inicio · reabierto | Se conservan | Reabierto tiene ofertas propias (refrescar/vigilar/continuar) — no es Inicio. |

**Estados finales (9):** `Inicio · Encuadre · Trabajando · Calibración · Decisión pendiente · Sin cobertura · Resultado · Pausa · Reabierto`.

## 2. Eventos de la máquina

Del usuario: `NUEVO_ENCARGO` (mensaje que abre búsqueda) · `RESPUESTA` (a pregunta/checkpoint) · `STEERING` (mensaje durante Trabajando) · `ACCION(tipo)` (typed action tocada) · `DETENER` · `REABRIR` · `REINTENTAR`.
Del sistema (proyección de eventos A1): `ENCUADRE_LISTO(con_pregunta?)` · `PRIMER_CONTENIDO` · `MUESTRA_LISTA` · `CHECKPOINT(kind)` · `CHECKPOINT_RESUELTO` · `SIN_COBERTURA` · `RUN_TERMINADO(variante)` · `FALLO_RECUPERABLE` · `REANUDADO` · `MONITOR_DISPARADO`.

## 3. Especificación por estado

Formato: **Mensaje** (contrato del turno) · **Composer** · **Acciones** · **Panel** · **Progreso** · **Oculto** · **Transiciones**.

### S1 · Inicio
- **Mensaje:** una invitación editorial + 3 ejemplos concretos tocables (mantener la dirección de DESIGN §0.9: sin menú de features). Si existen búsquedas previas: lista compacta "Tus búsquedas" (nombre, estado, novedad) ANTES que la invitación — lo vivo primero.
- **Composer:** activo, protagonista. Placeholder: "¿Qué vendes y a quién quieres encontrar?"
- **Acciones:** ejemplos tocables; por búsqueda previa: Abrir · Ver lo nuevo.
- **Panel:** no existe.
- **Progreso:** ninguno.
- **Oculto:** todo lo interno; también CUALQUIER inventario de fuentes/coberturas.
- **Transiciones:** `NUEVO_ENCARGO` → Encuadre · `REABRIR` → Reabierto.

### S2 · Encuadre
- **Mensaje (contrato):** eco de intención en ≤2 frases (qué vendes, a quién, dónde — con lo dicho + recordado + supuesto marcado) + a lo sumo UNA pregunta material con su porqué + anuncio del trabajo gratuito que YA arrancó (cuando la estrategia no depende de la respuesta). Nunca: pedir lo ya dicho (EXP-3), pedir configuración, describir inventario.
- **Composer:** activo con chips de la pregunta (2–4 + "No lo sé aún — sigue con tu criterio") + texto libre. Placeholder: "Elige una o dime con tus palabras…".
- **Acciones:** solo las chips. Nada más compite.
- **Panel:** cerrado (T4).
- **Progreso:** si ya arrancó trabajo: una línea viva ("Revisando actividad reciente…"). Sin runway completo aún.
- **Oculto:** contrato compilado y plan (inspeccionables después desde el tablero, no aquí — el encuadre se LEE en el eco, no se firma).
- **Transiciones:** `RESPUESTA`/`timeout con default seguro` → Trabajando · `SIN_COBERTURA` → Sin cobertura · segunda pregunta material descubierta al compilar (máx. 1 extra, T2) → permanece en Encuadre · `DETENER` → Inicio.

### S3 · Trabajando
- **Mensaje:** narración por hitos, no por pasos: se habla cuando hay algo que decidir o algo nuevo que ver ("van 6 con señal fuerte"), no por latido. Steering respondido en ≤2 s con su consecuencia (T7).
- **Composer:** SIEMPRE activo para texto libre. Placeholder: "Puedes corregir el rumbo mientras trabajo…". Botón secundario: Detener (visible, uno solo). El envío durante el run ES steering — no existe "Enviar después" como concepto de usuario; si un steering llega mientras se aplica otro, se encola en silencio y se confirma en orden ("aplico primero X, luego Y" — cola visible solo si >1).
- **Acciones:** Detener · (si hay muestra parcial) Ver lo que llevo.
- **Panel:** se abre en `PRIMER_CONTENIDO` y se llena fila por fila (estados de fila: encontrada → verificando → calificada | descartada, con causa).
- **Progreso (contrato estricto):** UNA línea de estado (fuente única) + runway Ahora/Después (≤3 entradas, completados plegados en "N pasos hechos") + métricas del encargo (revisadas · propuestas · gasto solo si hay gasto). El progreso es del ENCARGO ("89 de 143 revisadas"), jamás del motor ("step 3/7").
- **Oculto:** tool calls, reintentos, nombres de herramientas/pasos internos, eventos crudos.
- **Transiciones:** `MUESTRA_LISTA` (encargo con expansión pendiente) → Calibración · `CHECKPOINT(kind)` → Decisión pendiente · `RUN_TERMINADO` → Resultado · `FALLO_RECUPERABLE` → Pausa · `DETENER` → Resultado (variante parcial, marcada "detenida por ti").

### S4 · Calibración
- **Cuándo existe:** el encargo pide escala (>~15 deseadas) o la confianza del criterio es media/baja; si no, la muestra ES el resultado y se salta a Resultado.
- **Mensaje:** la muestra presentada como pregunta (T2→calibración por ejemplos): "revisé N, estas 8 son las más claras; ¿se parecen a tu cliente ideal?" + qué hará con la respuesta.
- **Composer:** activo; placeholder "Marca tarjetas o dime qué ajusto…".
- **Acciones:** 👍/👎 por tarjeta · Afinar con mis marcas · Así está bien — completa la lista · Cambia de señal.
- **Panel:** protagonista (la muestra).
- **Progreso:** en reposo visible: "Muestra lista — espero tu ojo para escalar". El sistema PUEDE seguir puliendo lo ya encontrado (verificación gratuita), NUNCA expandir alcance sin calibrar.
- **Oculto:** el mecanismo de re-score.
- **Transiciones:** `RESPUESTA/ACCION` → Trabajando (expansión calibrada) · silencio → permanece (el trabajo no caduca; recordatorio proactivo máx. 1) · `DETENER` → Resultado (muestra como entrega).

### S5 · Decisión pendiente
- **Parametrizado por** `kind`: gasto (cotización) · monitor (contrato de vigilancia) · contacto (opt-in por organización) · conflicto material · aclaración sobrevenida.
- **Mensaje:** la decisión en una tarjeta autocontenida: qué obtendrás, qué cuesta / qué implica, alcance exacto, vigencia, y qué pasa si dices que no (siempre hay un "no" digno — T5/T6). Una decisión por vez; si hay más, cola por impacto y se dice ("cuando resuelvas ésta, tengo otra menor").
- **Composer:** activo (texto libre puede AJUSTAR la decisión: "solo Guanajuato" → recotiza). Placeholder: "Ajusta, aprueba o di que no…".
- **Acciones:** las del checkpoint (2–3 máx.): p. ej. Aprobar (tope N cr) · Ajustar · No por ahora. Etiquetas SIEMPRE con el efecto, nunca "OK".
- **Panel:** utilizable en lectura; lo ya entregado nunca se bloquea por una decisión pendiente.
- **Progreso:** "En pausa por tu decisión" (una línea; el runway no avanza).
- **Oculto:** proveedor que ejecutaría, mecánica de créditos interna (se muestra costo y tope, no ledger).
- **Transiciones:** `CHECKPOINT_RESUELTO(aprobado)` → Trabajando · `(rechazado)` → Trabajando o Resultado según quede trabajo · `(ajustado)` → permanece con tarjeta recalculada · expiración de cotización → Trabajando/Resultado con aviso honesto ("venció sin gastar").

### S6 · Sin cobertura
- **Mensaje:** el contrato de C5: honestidad en términos del encargo (≤2 frases, sin causas internas) + 2–3 salidas concretas SIEMPRE: investigar en la web (con costo/tope), avisar cuando haya visibilidad, redirigir a lo adyacente real (solo si existe de verdad). Duración objetivo <30 s.
- **Composer:** chips de las salidas + texto libre.
- **Acciones:** = chips.
- **Panel:** NO se abre.
- **Progreso:** ninguno (no hubo run material).
- **Oculto:** por qué no hay cobertura (fuentes, licencias, estados internos) — prohibido explícito.
- **Transiciones:** investigar → Decisión pendiente (gasto) · avisar → Resultado (variante "vigía de cobertura registrado") · redirigir → Encuadre (nuevo encuadre corto) · `DETENER` → Inicio.
- **El "avisar" de este estado es un VIGÍA DE DISPONIBILIDAD DE COBERTURA, no un monitor de mercado** (E2 §notación). No hay señal que vigilar: registra el interés del usuario en un mercado invisible hoy y avisa si esa cobertura llega a existir. Sin cadencia, sin costo, sin contrato de vigilancia y **sin `activate_monitor`** — ese checkpoint pertenece al monitor de mercado (S7 → F5). Confundirlos produce una promesa que la operación no puede cumplir.

### S7 · Resultado
- **Variantes (mismo estado, contenido distinto):**
  - **completo:** resumen ejecutivo (N propuestas, las 3 fuertes y por qué) + siguientes acciones;
  - **sin calificadas:** "revisé N, ninguna cumple tu criterio, y te explico el porqué dominante (p. ej. todas fuera de tu geografía)" + las mismas salidas de S6 — un resultado, no una disculpa;
  - **parcial (por fallo o por Detener):** lo sólido entregado + estado de lo pendiente + quién hace el siguiente movimiento (el sistema, salvo Detener del usuario).
- **Composer:** activo. Placeholder: "¿Siguiente paso con esto? Vigilar, afinar, contactos…".
- **Acciones (máx. 3, por relevancia):** Revisar las urgentes · Vigilar este mercado · Buscar a quién contactar (por oportunidad, gate) · Afinar criterio · Guardar en mi CRM.
- **Panel:** protagonista; chat se pliega a rail (E4 §4).
- **Progreso:** UNA marca de cierre en UN lugar (encabezado del tablero: "Terminada · hace 2 min · 143 revisadas"). El runway se pliega y desaparece del primer plano. **Regla anti-"Terminado"×3: el estado terminal se renderiza exactamente una vez (§5).**
- **Oculto:** todo lo operativo del run.
- **Transiciones:** `ACCION` → Trabajando/Decisión pendiente según tipo · `NUEVO_ENCARGO` → Encuadre (nueva búsqueda, la anterior queda en Inicio) · cierre de sesión → (persistencia) → Reabierto al volver.

### S8 · Pausa
- **Causas:** fallo recuperable (tras 1 reintento silencioso) · detención del sistema por presupuesto/stop-condition. (La detención POR el usuario no pasa por aquí: va a Resultado parcial.)
- **Mensaje:** contrato de C12: qué se atoró (en términos del encargo), qué está a salvo (conteo), quién reintenta (el sistema, solo) y qué puede hacer el usuario ya con lo parcial.
- **Composer:** activo + chips Reintenta ahora · Quédate con lo que hay.
- **Acciones:** = chips.
- **Panel:** abierto y usable con lo parcial; banner sobrio en el encabezado, no modal.
- **Progreso:** paso actual "en pausa" — sin spinner.
- **Oculto:** el error real (allowlist EXP-5); número de reintentos; nombre del componente caído.
- **Transiciones:** `REANUDADO` → Trabajando (+ aviso proactivo al terminar) · `REINTENTAR` → Trabajando · "quédate" → Resultado parcial · sin recuperación en plazo → Resultado parcial con compromiso de reintento propio.

### S9 · Reabierto
- **Mensaje:** continuidad primero: "Tu búsqueda *X* — N propuestas, la actualicé por última vez el [fecha]" + qué cambió desde entonces si hay monitor + oferta de refresco: "¿Actualizo los datos? Lo gratuito lo hago ya; si algo requiere investigación te aviso antes."
- **Composer:** activo, placeholder: "Sigue donde lo dejamos o pide algo nuevo…".
- **Acciones:** Actualizar datos · Ver lo nuevo (si hay) · Vigilar (si no tiene monitor) · Nueva búsqueda.
- **Panel:** el tablero tal como quedó, con marcas "nuevo desde tu última visita" si aplica.
- **Progreso:** ninguno hasta actuar.
- **Oculto:** la mecánica de refresco.
- **Transiciones:** Actualizar → Trabajando (refresco) · `NUEVO_ENCARGO` → Encuadre.

## 4. Diagrama

```
Inicio ──NUEVO_ENCARGO──▶ Encuadre ──ENCUADRE_LISTO──▶ Trabajando ──RUN_TERMINADO──▶ Resultado
  │                         │  │                        │  ▲  │                        │  ▲
  │                         │  └─SIN_COBERTURA──▶ Sin cobertura──investigar──▶ Decisión│  │
  │                         │                           │  │  │               pendiente┘  │
  └─REABRIR▶ Reabierto ─────┴──actualizar──────────────▶│  │  ├─MUESTRA_LISTA▶ Calibración┘
                                                        │  │  ├─CHECKPOINT──▶ Decisión pendiente
                                                        │  │  │                 (resuelto)──┘
                                                        │  │  └─FALLO──▶ Pausa ──REANUDADO──┘
                                                        │  └────────────────────┘
                                                        └─STEERING (bucle interno, no transición)
```

## 5. El reductor de experiencia (la pieza que falta hoy)

**[REQUISITO]** Una función pura `proyectar(WorkSessionSnapshot) → ExperienciaVista` es la ÚNICA fuente de todo lo visible:

```ts
interface ExperienciaVista {
  estado: 'inicio'|'encuadre'|'trabajando'|'calibracion'|'decision'|'sin_cobertura'|'resultado'|'pausa'|'reabierto'
  variante?: 'completo'|'sin_calificadas'|'parcial'           // solo en resultado
  statusLinea: string            // UNA línea, catálogo propio — el ÚNICO lugar del estado textual
  narracion: TurnoNarrado[]      // hitos, deduplicados por semanticKey
  runway: { ahora?: string; despues: string[]; hechosPlegados: number }
  metricas: { revisadas?: number; propuestas?: number; gastoCreditos?: number; topeCreditos?: number }
  decisionActiva?: TarjetaDecision            // máx. 1; el resto en cola interna
  tablero: TableroVista                        // ver E4
  composer: { placeholder: string; chips: Chip[]; primario: 'enviar'|'detener'|'chips' }
}
```

Reglas duras del reductor (cada una fue un bug observado):
1. **Unicidad del terminal:** `statusLinea` es el único render del estado; header/runway/badges DERIVAN de `estado` y jamás muestran texto de estado propio. ("Terminado"×3 muere aquí.)
2. **Reset por transición, no por envío:** al despachar `NUEVO_ENCARGO`/`RESPUESTA`, la vista pasa a `encuadre|trabajando` inmediatamente — un estado terminal viejo no puede coexistir con un spinner (RC2 de la auditoría UI).
3. **Idempotencia por `semanticKey`:** dos eventos con la misma clave semántica (p. ej. START y RESULT del mismo tool call) alimentan UNA entrada; sin id estable no se renderiza fila nueva, se agrega a la vigente.
4. **Colapso de equivalentes:** pasos internos distintos que proyectan la misma etiqueta de usuario se funden en una entrada con contador interno invisible.
5. **Errores por allowlist:** `statusLinea` y toda copy salen de un catálogo versionado; un mensaje no catalogado se registra (telemetría) y proyecta el genérico de recuperación.
6. **El panel nunca nace vacío ni se duplica:** un solo tablero por búsqueda; una búsqueda nueva = objeto nuevo, no una sección apilada.

## 6. Contrato del composer (resumen transversal)

| Estado | Placeholder | Primario | Extras |
|---|---|---|---|
| Inicio | "¿Qué vendes y a quién quieres encontrar?" | Enviar | ejemplos tocables |
| Encuadre | "Elige una o dime con tus palabras…" | chips | texto libre siempre |
| Trabajando | "Puedes corregir el rumbo mientras trabajo…" | Enviar (=steering) | Detener |
| Calibración | "Marca tarjetas o dime qué ajusto…" | chips | 👍/👎 en tarjetas |
| Decisión | "Ajusta, aprueba o di que no…" | acciones del checkpoint | texto libre ajusta |
| Sin cobertura | "¿Cuál camino tomamos?" | chips de salidas | — |
| Resultado | "¿Siguiente paso con esto?…" | Enviar | acciones del tablero |
| Pausa | "Reintento solo; ¿o prefieres decidir tú?" | chips | — |
| Reabierto | "Sigue donde lo dejamos o pide algo nuevo…" | Enviar | Actualizar |

El composer **nunca se bloquea** para texto libre; cambia de papel, no de existencia. "Enviar después" desaparece como copy: durante un run el envío es dirigir el trabajo, y así se llama la afordancia si necesita nombre ("Dirigir ahora" solo en la cola visible >1).
