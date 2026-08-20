# E9 (addendum) — Revisión de primera mano del warehouse (`gtm-fabrica`)

> **Todo conteo de este addendum es un snapshot del SHA auditado, no una constante.** Las cifras de capabilities, source packs y licencias activadas describen `gtm-fabrica` @ `d29123b`; se resuelven en runtime desde el catálogo licenciado y ningún código ni eval puede depender de ellas (ver `01-diagnostico.md` §Agravante).

Revisión directa del repo `joseluistello/gtm-fabrica` @ `d29123b` (los docs 01–08 se escribieron con evidencia indirecta desde Driftless: bundle de contratos, topics, historia de git). Veredicto: **el rediseño se sostiene; tres afirmaciones mías quedan corregidas y una propuesta cambia de casa.**

## 1. Lo que la revisión CONFIRMA (y refuerza)

1. **La frontera de lectura es aún más rigurosa de lo que asumí.** Tres migraciones recientes la endurecen fail-closed: `0005` re-verifica la licencia EN VIVO en cada query (revocar `licensed_for_display` apaga señales ya escritas al instante); `0006` corrige un bug de verdad-vacua real (una señal con CERO evidencia pasaba el filtro — ahora cero evidencia = jamás exhibible, y un join roto cuenta como no-licenciado); `0010` cierra `get_signal_evidence_v1` para capabilities `unavailable`. La confianza que E5 deposita en el gateway está justificada.
2. **La activación de licencia es deliberadamente humana y sin camino de código.** Existe exactamente UNA forma legítima: un humano corriendo el UPDATE tras revisión legal; ningún código en `lib/`, `packs/` o `runners/` escribe ese flag (verificado por grep en su propio test, con helper de test que rehúsa correr en producción). Confirma el marco de E1: ampliar cobertura visible es un acto legal/operativo, no de ingeniería.
3. **La disciplina por fuente alimenta directamente el tablero.** Cada capability nueva trae `CLASSIFICATION.md` con "Hecho exacto demostrado" vs "NO se demuestra" y la semántica oficial de cada fecha (p. ej. adjudicación fechada por `fecha_fallo`; "una adjudicación directa es una modalidad legal, no un señalamiento"). Es exactamente el material de "qué pasó [hecho]" / "por qué ahora" / hecho≠inferencia de E4 — el warehouse ya produce la materia prima del argumento comercial, no solo datos.

## 2. Lo que la revisión CORRIGE en los docs 01–08

1. **"Hoy existe exactamente una capability" (E1 §Agravante) — impreciso a la fecha de esta revisión.** Existen **6 capabilities definidas** en `packs/signals/`: `public_procurement_new_tender` (licitaciones), `public_procurement_award` (adjudicaciones CFE, con proveedor y monto), `energy_capacity_investment` (permisos de generación con MW y capex), `merger_control_event` (COFECE — `unavailable` por una limitación honesta del contrato: `event_group_key` sin campo donde aterrizar), `mining_concession_grant` y `business_directory_recent_addition` (incorporaciones recientes al DENUE). **Lo que sigue siendo cierto para el usuario:** solo compras-jalisco tiene licencia de exhibición ACTIVADA, así que el catálogo efectivo visible sigue siendo licitaciones-Jalisco. La corrección importa para el horizonte: la distancia a la capability #2 visible no es "construirla" — es correr su cosecha (el recipe se auto-registra al ingerir) + activar su licencia (humano). Es una decisión de operación/legal, no un proyecto.
2. **"Ningún padrón tiene Signal Recipe" — desactualizado.** `business_directory_recent_addition` ES el recipe padrón→señal (DENUE como evento de incorporación reciente). La brecha que cité (de un topic del workspace) ya se cerró para DENUE.
3. **Los seis arquetipos de la tesis MVP ya tienen sustrato para cuatro:** compras públicas (licitación + adjudicación), expansión industrial/energética (permisos con capex), M&A (COFECE, pendiente de contrato) y aperturas/altas (DENUE reciente). El diseño no cambia — el mapa de cobertura de E5 §2.2 absorbe capabilities nuevas sin tocar nada — pero la narrativa de "cobertura estrecha por mucho tiempo" se acorta.

## 3. La propuesta que CAMBIA DE CASA: `notas_estrategia` (corrige E5 §5.3)

E5 propuso que las notas de estrategia por capability viajen EN el catálogo del warehouse. **La revisión lo descarta como primer paso:** el contrato del bundle está congelado con `additionalProperties: false` en ambos niveles y verificado byte-a-byte contra un manifest hasheado — un campo nuevo rompe el parser de Driftless y el bundle-check. Corrección:

- **Fase 1 (sin coordinación cross-repo):** las `notas_estrategia` viven en la **capa de proyección de Driftless**, como datos versionados keyed por `(capability_id, version)` — el director las recibe igual en el mapa de cobertura. Dueño: producto.
- **Fase 2 (opcional, cuando haya un cambio de contrato de todos modos):** graduarlas al catálogo como campo opcional en un contrato `v1.1` con su bump de manifest, y transferir la autoría a quien opera el warehouse.

El requisito de E5 §2.2 (el director jamás ve el bundle crudo) no cambia — de hecho la revisión lo refuerza: el bundle trae `limitations[]` con texto sobre licencias y activación runtime que JAMÁS debe llegar al modelo.

## 4. Dependencia operativa nueva para F5 (monitores) — y para la promesa de frescura

Los schedulers EXISTEN y están **DISABLED a propósito** (reglas EventBridge registradas apagadas: "a human flips it to ENABLED when ready to commit to a live recurring Fargate spend"); los watermarks y la observabilidad de corridas ya están construidos (`0007`: `gtm_harvest_watermarks`, `gtm_harvest_runs` — "every prior harvest was a one-off manual invocation"). Consecuencias contractuales:

- **C9 promete "te aviso el mismo día"** — eso requiere la cosecha recurrente de la fuente madre ENCENDIDA. F5 gana una precondición operativa explícita: un monitor sobre cobertura propia solo puede prometer la cadencia que la cosecha real tiene; si la fuente se cosecha manualmente, el contrato de vigilancia debe decir la frecuencia verdadera (o el monitor corre sobre investigación web, con su costo).
- El copy del monitor (E2-C9) ya es compatible ("primera revisión: mañana a las 7:00") — la regla nueva es que esa hora se DERIVA del schedule real de la fuente, nunca se inventa.
- La `freshness.cadence: daily` del catálogo es aspiracional hasta que el schedule esté encendido; el mapa de cobertura debe proyectar frescura OBSERVADA (último harvest real), no declarada. Los datos para eso ya existen (`gtm_harvest_runs`).

## 5. Ajustes menores de exactitud

- El repo se autodescribe como dueño único del esquema GTM "going forward"; las tablas `gtm_*` de Driftless están **deprecadas pero no retiradas** — coincide con el DELETE de E8 §3 (retiro con migración forward-only nueva), que sigue pendiente y requiere aprobación humana según su propio AGENTS.md.
- ComprasMX federal está bloqueado por token derivado de reCAPTCHA v3 en cada endpoint (documentado en el runbook del pack para que nadie repita el callejón) — la cobertura federal de compras vendrá por CFE/otros portales estatales, no por ComprasMX; útil para calibrar expectativas de expansión geográfica en las conversaciones C4.
- La política de cortesía por pack (UA, intervalos, lista `never`: sin captcha-solving, sin proxies rotativos, sin spoofing) es un activo de confianza del producto — cabe mencionarla en materiales de venta, nunca en la superficie del agente.

## 6. Cambios aplicados a los docs por esta revisión

1. `01-diagnostico.md` §Agravante: precisión "1 capability" → "6 definidas / 1 activada para exhibición" (la conclusión de diseño no cambia).
2. `05-arquitectura-cognitiva.md` §5.3: `notas_estrategia` re-domiciliada a la capa de proyección (fase 1) con graduación opcional al catálogo (fase 2).
3. Este addendum queda como registro; las cards F3/F5 del proyecto en Driftless heredan las dos precisiones (sidecar de notas; precondición de scheduler para monitores).
