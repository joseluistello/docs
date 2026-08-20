# E4 — El tablero y el layout: cómo conviven conversación, plan, progreso y resultados

## 1. La decisión de fondo: dossier argumentado, no spreadsheet

Estudiamos el comportamiento real de Origami (investigación web documentada, ago 2026). Su artifact es una tabla tipada estilo hoja de cálculo (columnas input/enrichment/score/sequence) que el chat muta; sus métricas de embudo económico (créditos por lead calificado, tasas de dedup/exclusión/calificación, costo por fuente) son lo mejor de su diseño. **Adoptamos** varias de sus ideas (abajo). **Rechazamos** la tabla-spreadsheet como superficie principal, con el tradeoff dicho honestamente:

- **Lo que la tabla gana:** densidad a escala (500 filas), pensamiento por columnas (enriquecer campo a campo), familiaridad de RevOps.
- **Por qué aquí pierde:** nuestro usuario no es RevOps y nuestra unidad de valor no es la fila — es la **oportunidad argumentada** (qué pasó / por qué ahora / por qué tú / cómo entrar / con qué evidencia). Ese argumento no cabe en celdas; una tabla lo degrada a "datos" e invita al modelo mental de base de datos que el brief prohíbe. Además nuestra escala típica es 10–30 oportunidades curadas, no 700 leads.
- **La síntesis:** tarjetas argumentadas para la shortlist, filas compactas para el resto, dossier al expandir. Si el producto algún día sirve volúmenes estilo lista (>100), se añade una vista densa **como vista**, no como identidad.

**[REQUISITO]** Toda superficie de resultados presenta **decisiones comerciales**: cada elemento visible responde "¿por qué vale mi tiempo?" antes que "¿qué campos tiene?".

## 2. Anatomía del tablero (el artifact de la búsqueda)

Nombre de usuario: **el tablero** de tu búsqueda. Uno por búsqueda; persistente; con nombre legible auto-generado ("Uniformes — compras Jalisco").

```
┌─ ENCABEZADO ────────────────────────────────────────────────┐
│ Uniformes — compras Jalisco          Terminada · hace 2 min │  ← estado: UNA vez (E3 §5)
│ Criterio: uniformes/EPP · gobierno estatal · Jalisco        │  ← el contrato, legible y EDITABLE
│   ajustado hace 5 min: "solo procesos > $500 mil"           │     (editar = steering, no re-run ciego)
│ 37 revisados · 12 propuestos · 0 créditos                   │  ← métricas honestas del embudo
├─ DESTACADAS (3) ────────────────────────────────────────────┤
│ ① [Convocante/Organización]                    cierra en 9d │
│    Qué pasó: publicó proceso para 3,000 juegos…   [hecho]   │
│    Por qué ahora: cierre 14 ago; monto publicado $1.2 MDP   │
│    Cómo entrar: registro de proveedor + propuesta… [inferencia] │
│    ▸ 2 fuentes y contexto        👍 👎  · Contactos · Ficha │
│ ② …                                                          │
├─ TAMBIÉN CUMPLEN (9) — filas compactas ─────────────────────┤
│ · Org — qué pasó (1 línea) — cierre — ▸ fuentes             │
├─ TARJETAS ESPECIALES ───────────────────────────────────────┤
│ ⚠ Evidencia en conflicto (1)  · fuentes lado a lado         │
│ ◌ Hueco: Bajío sin cubrir — Investigar (tope 20 cr)         │
├─ PLEGADO ───────────────────────────────────────────────────┤
│ ▸ Descartadas (5, con causa) · ▸ Sin evidencia mostrable (2)│
└─ ACCIONES DEL TABLERO (máx 3): Vigilar · Afinar · Guardar ──┘
```

Contratos de cada zona:

- **Criterio editable = el contrato hecho interfaz.** No existe pantalla de "contrato"; el WorkContract compilado se PROYECTA aquí en lenguaje del usuario y editarlo despacha steering tipado. Historial de ajustes visible ("ajustado hace 5 min").
- **Métricas (adoptado de Origami, adaptado):** revisados · propuestos · gasto (y tope) — más, cuando hay gasto, **costo por calificada** ("14 cr → 9 nuevas ≈ 1.6 cr c/u"). Nunca métricas de motor (steps, tools, latencias).
- **Tarjeta de oportunidad:** organización (título) · qué pasó [hecho, con fuente] · por qué ahora · ángulo/cómo entrar [inferencia, marcada] · estado (encontrada/verificando/calificada/descartada + causa) · evidencia plegada · desconocidos explícitos ("monto por confirmar"). El par confianza-evento / confianza-comercial de la tesis MVP se expresa en palabras ("anuncio confirmado; compra abierta: por validar"), jamás como score numérico único (invariante: tres cálculos nunca colapsados en un score).
- **Filas de estado vivo:** durante el run las tarjetas entran como esqueleto con estado y se completan (encontrada → verificando → calificada/descartada); una fila jamás desaparece — se pliega a Descartadas con causa (semántica delete/restore, adoptada de Origami).
- **Tarjetas especiales:** conflicto (dos afirmaciones lado a lado, fecha cada una, badge ámbar) y hueco de cobertura (la propuesta de investigación VIVE aquí tras ser declinada en chat — latente, no insistente).
- **Dossier (ficha):** expandir una tarjeta → vista completa: cronología del evento con fases (anuncio→construcción→ramp-up→operación cuando aplique), evidencia completa, compradores probables por función, ruta de entrada, personas (solo tras C10), borrador de mensaje, historial de acciones sobre esa oportunidad. El dossier es el `opportunity_dossier`; se navega con breadcrumb, el chat sigue accesible.
- **Evidencia:** tocar "▸ fuentes" abre una **hoja lateral** (overlay, no navegación): cita textual o dato extraído, nombre público de la fuente, fecha de publicación Y fecha de consulta, enlace saliente, permiso de atribución cuando aplique. Cerrar regresa exactamente donde estabas. La conversación nunca se pierde por inspeccionar (patrón validado en Origami).

## 3. Cuándo se abre el panel y quién domina la pantalla

Principio: **el panel se gana su espacio con contenido; el chat se gana su espacio con decisiones.** Nada de layout fijo 50/50 con panel vacío.

| Momento | Desktop (≥1060px) | Móvil |
|---|---|---|
| Inicio / Encuadre / Sin cobertura | Chat centrado, columna ~760px. Sin panel. | Chat pantalla completa |
| `PRIMER_CONTENIDO` | Panel entra por la derecha (~55%); chat conserva ~45%, mínimo 400px | Aparece pestaña **Tablero** con badge de conteo; sticky mini-status arriba (una línea, la misma `statusLinea`) |
| Trabajando / Calibración | 45/55; las filas entran al panel; el chat narra hitos | Usuario alterna pestañas Conversación ⇄ Tablero; el mini-status vive en ambas |
| Decisión pendiente | La tarjeta de decisión se ancla al hilo del chat (el chat es donde se decide); el panel queda en lectura | Bottom sheet con la decisión; el resto usable detrás |
| Resultado / Reabierto | **El tablero domina (~70%)**; el chat se pliega a rail izquierdo (~360px) con el resumen y el composer siempre visibles | Pestaña Tablero por defecto; Conversación a un toque |
| Dossier | Tablero a pantalla del panel completa con breadcrumb "‹ Tablero"; chat en rail | Vista propia apilada (back nativo) |

Reglas: la transición de dominancia es animación de layout única y sobria (sin "reload" visual); el composer JAMÁS queda oculto en desktop (vive bajo el chat/rail); en móvil el composer vive en la pestaña Conversación y las acciones del tablero en la de Tablero.

## 4. Plan y progreso: dónde viven

- **El runway** (adoptado de DESIGN §0.9, conservado): aside de ~260px en desktop dentro de la zona de chat — Ahora / Después (≤3) / "N pasos hechos" plegado. En móvil: dentro del mini-status expandible (bottom sheet). El runway muestra **etapas del encargo** ("Revisando compras vigentes → Verificar cierres → Proponer"), nunca steps de motor.
- **El plan inspeccionable:** tocar el runway expande la vista de estrategia: qué voy a hacer, en qué orden, qué es gratis y qué costaría, supuestos activos. Es el `ExecutionPlan` proyectado; de nuevo: contenido, no ceremonia — nunca bloquea.
- **El progreso numérico** vive en las métricas del tablero (revisadas/propuestas), no en el runway. Una sola fuente por número (reductor E3 §5).

## 5. La vida del tablero después del run

**[REQUISITO]** El tablero es el objeto durable del producto; el chat es su historial de dirección. Después de Resultado:

1. **Aparece en Inicio** bajo "Tus búsquedas" con estado (viva · vigilada · en pausa · archivada) y badge de novedad.
2. **Refrescable:** "Actualizar datos" re-ejecuta lo gratuito con el criterio vigente y marca los cambios ("2 procesos nuevos · 1 venció"); lo pagado solo re-corre con nueva aprobación.
3. **Vigilable:** activar monitor lo convierte en tablero vigilado; los avisos del monitor referencian y actualizan ESTE tablero (deltas marcados "nuevo desde tu última visita"), jamás crean uno paralelo.
4. **Accionable por oportunidad:** contactos (C10), preparar mensaje, marcar "la contacté / no me interesa" — estados comerciales del usuario que alimentan el aprendizaje (outcome ledger existente).
5. **Exportable:** Guardar en mi CRM (Collections — ya existe como destino) y CSV. Al guardar, la evidencia viaja como referencia, no se pierde.
6. **Reabrible:** entrar de nuevo = estado Reabierto (E3 S9), con continuidad explícita.

## 6. Qué adoptamos de Origami y qué no (registro de decisión)

| Comportamiento Origami (confirmado) | Decisión Driftless |
|---|---|
| Un prompt, cero intake; aclaración reactiva solo al bloquearse | **Adoptar** (ya era nuestra dirección: EXP-7/8) + "Usa mi dominio/sitio" para inferir oferta en el primer uso |
| Preview de costo por operación como puerta, sin firmar plan | **Adoptar y endurecer:** cotización con tope + vigencia + decisión explícita (nuestro checkpoint T5); "pensar es gratis" como principio de cobro |
| Tabla spreadsheet como artifact | **No adoptar** (§1) — tarjetas argumentadas + filas compactas + dossier |
| Métricas de embudo económico (créditos/calificada, por fuente) | **Adoptar** en lenguaje usuario; por-fuente solo agregado como "investigación web" (no marcas de provider) |
| delete/restore de filas al afinar criterio | **Adoptar** (Descartadas con causa, recuperables) |
| Monitores como agentes programados con handoff a chat al fallar | **Adoptar** el handoff (fallo de monitor → mensaje en la búsqueda madre, no un email críptico) |
| Outreach con borradores human-gated | **Adoptar** (ya invariante: draft sí, envío no) |
| Varianza entre corridas casi idénticas (crítica pública) | **Contra-diseñar:** el criterio persistido + refresco determinístico sobre las mismas fuentes propias; la varianza queda confinada a investigación web nueva |
| Pricing churn que erosiona confianza (crítica pública) | **Contra-diseñar:** copy de créditos estable, siempre con equivalencia MXN aproximada y tope duro |

## 7. Estados visuales que quedan prohibidos

- Panel abierto y vacío ("esperando resultados…" sin filas).
- Dos secciones de oportunidades apiladas por dos búsquedas (el apilado actual RC7): búsqueda nueva = tablero nuevo = objeto nuevo en Inicio.
- Cualquier render del estado terminal fuera del encabezado del tablero.
- Filas esqueleto sin estado declarado, spinners >10 s sin texto de qué se espera, y todo progreso que no pueda nombrar su etapa en lenguaje del encargo.
- Score numérico único por oportunidad (colapsa los tres cálculos que el producto jura mantener separados).
