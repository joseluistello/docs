# Luna Chat — la experiencia del chat

**Encargo:** lo que la persona ve, toca y lee en el chat de Luna: la escena de referencia, la pantalla, cada elemento del hilo con su copy en es-MX, los seis comportamientos, los vacíos y los detalles de oficio.
**Base leída:** `experience-v2/02-conversaciones.md` · `03-maquina-de-estados.md` · `04-artifact-y-layout.md`, `luna-chat/01-interfaz-luna.md` §3 §10 §11 y `03-lexico.md`, más `messages.ts` (`es-MX`).
**Alcance:** el catálogo y el render son `05`; la escalera, los modos y el reparto de pantalla, `01`. Aquí va la capa visible. `[REQUISITO]` = contrato evaluable; `[SUGERENCIA]` = técnica sustituible.

**El veredicto.** (1) Todo Brein se opera desde aquí; el panel aloja lo que Luna trabaje, no solo el CRM. (2) Lo gratis se hace y se narra; lo que toca al equipo pide un toque; lo que cuesta, una decisión cotizada. (3) **Nada se borra**: arrepentirse es mover a **Descartado**. (4) Las herramientas siempre se ven. (5) Lo único espectacular es el panel volviéndose la Colección real.

---

## 1. La escena de referencia, de punta a punta

**Persona:** *"Dame 50 empresas de empaque en Jalisco y consígueme sus correos."*

### 1.1 Buscar — gratis, sin preguntar

Luna no pregunta: el mensaje ya enuncia criterio. Corre la herramienta de **Empresas** y devuelve 50 resultados **sin correos** — la búsqueda nunca revela coordenadas, solo dice si hay contacto disponible.

En el hilo, **una fila colapsada**: `Buscando empresas de empaque en Jalisco · 50 resultados`. A la derecha se abre **LA SELECCIÓN**: 50 tarjetas con nombre, dominio y **por qué entran**, con *quitar* a un clic. No es CRM todavía y el encabezado lo dice: `Selección · 50 · aún no guardada`.

### 1.2 Guardar — un toque

Tarjeta en el hilo, vista previa **calculada por el servidor**, nada escrito hasta el toque:

> **Guardar 50 empresas en Prospección**
> 3 ya estaban, se actualizan · entran en etapa **Nuevo**
> Se agregan campos de procedencia para que recuerden de dónde salieron
> `[Guardar]` `[Elegir otra Colección]` `[Ver cuáles]`

En **automático** no hay tarjeta: se guarda y el hilo dice *"Guardé 50 en Prospección · 3 ya estaban"*; la tarjeta queda como **recibo** con hora y política ("automático, por el tope que fijaste a las 11:04").

Al aceptar, el panel **cambia de la selección a la Colección real** — el tablero del CRM que ya existe (`CollectionDetail`), con los 50 en *Nuevo*. No hay "ve al CRM": el CRM ya está ahí; solo un enlace secundario `Abrir Prospección en pantalla completa`. Cada registro guarda su origen: búsqueda y fecha.

### 1.3 Correos — decisión con dinero

Luna **cotiza gratis** antes de proponer:

> **Revelar contactos de 50 empresas**
> 100 créditos de contacto · te quedan 140 · vence en 10 min
> `[Revelar los 50]` `[Solo los 10 prioritarios]` `[Ahora no]`

Sin automático, espera. Con automático y tope: si cabe, ejecuta y narra *"Revelé 50 · 100 créditos · llevas 100 de 150"*; si no cabe, pregunta. **Contactos en automático solo sobre lista ya guardada.** Al aceptar: cobro único con la cotización sellada; los correos entran a las tarjetas del panel, columna de contacto, con quién y cuándo. Los no encontrados **devuelven créditos**: *"8 sin contacto encontrado · te regresé 16 créditos"*.

### 1.4 La secuencia — borrador y autorización

*"Ármame la secuencia para los 10 que ya tienen correo."*

El borrador es **inerte y gratis**: día 0, día 3, día 7. `[SUGERENCIA]` se crea **sin tarjeta**, con deshacer, y la única compuerta es `revisar_secuencia`: dos tarjetas para una misma secuencia son la fatiga de aprobación que `05 §6.8` evita. En el hilo, `Borrador de secuencia · 3 pasos · 10 destinatarios`; en el panel, el borrador (`EmailCampaignDetail` desacoplado de su ruta) con los pasos editables y `Vista previa por contacto` abierta en la primera persona — *"Exactamente lo que recibirá esta persona"*.

`[REQUISITO]` con el preflight en rojo **no hay tarjeta de autorización**: hay una de *no puedo todavía* con la lista exacta ("el remitente no está verificado", "2 destinatarios no tienen correo adquirido") y el atajo para resolver cada punto. La autorización vive **en el chat**:

> **Revisar y activar · 3 pasos · 10 personas**
> Remitente: ventas@… · Audiencia: los 10 de Prospección con correo
> ☑ Día 0 · ☑ Día 3 · ☑ Día 7 *(una casilla por paso)*
> Lo que **no** hago: no aviso de aperturas ni clics, y no leo tu bandeja
> Esta autorización queda sellada con el remitente, la audiencia y el texto de hoy. Si cambias una palabra, se invalida y te la vuelvo a pedir.
> `[Activar secuencia]` `[Ver vista previa]` `[Ahora no]`

`[REQUISITO]` **nunca en automático**, aunque la persona lo pida (`01 §10`).

### 1.5 Al día siguiente — qué se ve de "enviado"

Historial → **Empaque en Jalisco**. El panel abre en la secuencia; el hilo, con resumen y últimos turnos. Luna:

> Paso 1 salió a las 9:00 a **10 personas**: 9 entregados, **1 rebotó** (correo inválido; lo saqué de los pasos 2 y 3). El paso 2 sale el jueves.
> Honestidad: **no sé quién te respondió** — hoy no leo tu bandeja. Las respuestas te llegan a Gmail u Outlook. Tampoco veo aperturas ni clics.

Estados por destinatario con la copy que ya existe: `Enviado`, `Rebotó`, `Dado de baja`, `En cola`. `[REQUISITO]` la brecha de capacidad se dice **en el mismo turno que el resultado**, no al pie.

### 1.6 Lo que no pasa, nunca

No se borra (arrepentirse = **Descartado**). No se revela sin cotización aceptada. No se pide permiso por lo gratis. No se envía nada sin tocar la tarjeta en sesión.

---

## 2. Anatomía de la pantalla

Tres columnas: sesiones · hilo · panel. El reparto es el de `01 §11` y `04 §3`; aquí, el contenido.

| Zona | Qué contiene | Componentes que se reusan |
|---|---|---|
| **Riel de sesiones** (plegable) | Sesiones por fecha, **título automático** de 2–4 palabras derivado del criterio ("Empaque en Jalisco"), badge de novedad, y `Abrir` · `Renombrar` · `Archivar`. **No hay eliminar** (`home.archive`, nunca `home.delete`). | `Rail.tsx`, `workspaceNav.ts`, `OverflowMenu`, `Pill`, `IconButton` |
| **Hilo** | Mensajes, narración en streaming, filas de herramienta, tarjetas de un toque y de decisión, recibos, resúmenes. | assistant-ui `Thread`/`Composer`/`BranchPicker`, `card`, `badge`, `checkbox`, `button`, `StatusDot` |
| **Panel** (5 modos) | `selección` (tarjetas argumentadas con *quitar*) · `Colección` (el tablero real) · `secuencia` (borrador + vista previa por contacto) · `cotización` (el desglose que sostiene la tarjeta) · `evidencia` (cajón overlay, no navegación). | `CollectionDetail`, `RecordDrawer`, `EmailCampaignDetail`, `DataTable`/`ResultTable`, `IntelligenceRecord`, `sheet`, `tabs` |
| **Composer** | Texto libre **siempre activo**; placeholder por estado (`03-maquina-de-estados` §6); selector `○ Preguntar / ● Automático`; con automático, contador `40 / 100 créditos`; `Detener` solo mientras corre. | `textarea`, `select`, `switch`, `badge` |
| **Móvil** | Pestañas `Conversación ⇄ Tablero` con badge; mini-estado arriba, el mismo en ambas; decisiones como *bottom sheet*; sesiones en cajón. | `sheet`, `tabs` |

`[REQUISITO]` El panel **nunca nace vacío** y hay **uno por sesión**: búsqueda nueva = sesión nueva, nunca una sección apilada. El composer jamás se oculta en escritorio. `[SUGERENCIA]` `react-resizable-panels`.

---

## 3. Cada elemento del hilo, con su copy

**Mensaje de la persona.** A la derecha, sin avatar. Al hover: `Editar` · `Borrar` (blando, §4). Editar re-emite como variante hermana.

**Narración de Luna.** Resultado primero; frases cortas; una decisión por turno; toda cifra, fecha, monto o nombre anclado. Una **cita** se pinta como chip — `Cartonera Jalisco ▸` — y abre el **cajón de evidencia**: qué afirma la publicación, fuente con nombre público, fecha de publicación y de consulta, enlace saliente, y *"Cada resultado es una observación publicada, no una empresa consolidada"*. Cerrar regresa donde estabas.

**Fila de herramienta.** Una línea, colapsada; **las que cuestan nacen expandidas**. Siete estados:

| Estado | Copy exacta |
|---|---|
| Preparando | `Preparando la búsqueda…` (gris, sin spinner) |
| Corriendo | `Buscando empresas de empaque en Jalisco…` |
| Pide decisión | la fila se vuelve tarjeta; queda `Esperando tu decisión` |
| Resuelta | `Revelé 50 contactos · 100 créditos` *(sellada, con hora)* |
| Terminada | `✓ 50 empresas · 3 ya estaban en Prospección` |
| Falló | `No pude terminar la búsqueda. Lo encontrado está a salvo: 32 empresas.` + `[Reintentar]` |
| No se hizo | `No lo hice: dijiste que no revelara los contactos.` |

`[REQUISITO]` Expandida dice **qué se pidió y qué volvió, en palabras de producto**: filtros, cuántos coinciden (`{{count}} observaciones publicadas coinciden con esta búsqueda`), si contó como consulta. Nunca JSON, nombres de herramienta ni reintentos.

**Tarjetas de decisión.** Título, 2–4 líneas, botones con el **efecto** en la etiqueta (nunca "OK"), y qué pasa si dices no.

| Tipo | Título · cuerpo | Botones | Vence | Después |
|---|---|---|---|---|
| `guardar_en_crm` | **Guardar 50 empresas en Prospección** · "3 ya estaban, se actualizan" · "entran en etapa Nuevo" · "se agregan campos de procedencia" | `Guardar` · `Elegir otra Colección` · `Ver cuáles` | no vence | el panel pasa a la Colección real; la tarjeta queda como recibo |
| `cambios_masivos` | **Mover 12 registros a Descartado** · "de Nuevo (9) y Contactado (3)" · "se puede deshacer" | `Aplicar los 12` · `Ver el detalle` · `Ahora no` | no vence | franja de deshacer 8 s; recibo |
| `revelar_contactos` | **Revelar contactos de 50 empresas** · "100 créditos de contacto · te quedan 140" | `Revelar los 50` · `Solo los 10 prioritarios` · `Ahora no` | **10 min** | cobro único con la cotización sellada; correos al panel; no encontrados devuelven créditos |
| `revisar_secuencia` | **Revisar y activar · 3 pasos · 10 personas** · remitente, audiencia, casilla por paso, lo que no existe, la huella | `Activar secuencia` · `Ver vista previa` · `Ahora no` | **10 min** | sellada; editar el texto la invalida |
| `dejar_nota` | **Dejar una nota en el Cerebro** · cuerpo **editable** · área destino | `Dejar la nota` · `Editar` · `Mejor no` | no vence | chip `Recordado` con enlace |
| `investigar` | **Investigar los portales de compras del Bajío** · "8 a 15 resultados · tope 20 créditos · ~10 min" | `Investigar (tope 20)` · `Ajustar el tope` · `Ahora no` | 10 min | el progreso entra al hilo; lo hallado, al mismo panel |

`[REQUISITO]` El texto libre **ajusta** la tarjeta ("solo los 10 de Guadalajara" → se recotiza), nunca la resuelve.

**Tarjeta de "no puedo" (`limite`).** Siempre con la acción de Brein más cercana:

> **No puedo abrir tu bandeja de Gmail** — ese conector no existe hoy.
> Sí puedo dejarte la secuencia lista para que la autorices.
> `[Armar la secuencia]` `[Entendido]`

**Bloque de resumen (tras compactar).** Tarjeta sobria, no mensaje: *"Resumen — Criterio: empaque, Jalisco, con contacto. 50 en Prospección, 42 con correo, secuencia de 3 pasos activa. `Ver el hilo completo`"*.

**Chip `Recordado`.** Al pie del turno: `Recordado · nota en el Cerebro ▸`. Si fue solo de sesión: `Anotado para esta sesión`. `[REQUISITO]` esas dos frases, nunca una ambigua.

**Línea de presupuesto (automático).** Bajo el composer: `Automático · llevas 40 de 100 créditos` · `Bajar el tope`. Al topar: *"Llegué a tu tope de 100. De aquí en adelante te pregunto."*

**Errores.** `Vas muy rápido para mis fuentes. Retomo en 40 segundos — no perdiste nada.` · `La cotización venció sin gastar nada. [Volver a cotizar los 50]` · `Se me atoró la búsqueda. Lo hecho está a salvo: 32 empresas. Sigo intentando. [Reintentar ahora] [Quédate con lo que hay]`. `[REQUISITO]` cero códigos, cero texto crudo, cero costo por un fallo nuestro.

---

## 4. Los seis comportamientos y la interrupción

| Comportamiento · disparo | Qué ve la persona | Qué hace el servidor | Bordes |
|---|---|---|---|
| **Llamadas visibles** · siempre | fila por herramienta; gratis colapsada, con costo expandida | `tool.started/finished` con etiqueta de producto | dos pasos con la misma etiqueta se funden en una fila con su contador |
| **Regenerar** · `⟳` en un turno | `‹ 2/3 ›` entre variantes hermanas; nada se pierde | mismo `parent_turn_id`, `variant` nuevo; **reusa resultados**, no re-ejecuta | no cuesta créditos ni consultas; si la variante anterior gastó, el recibo sigue vigente y se dice |
| **Borrar un turno** · menú del mensaje | desaparece con *"Quité este turno. Lo que ya se hizo sigue hecho: 50 registros guardados, 50 contactos revelados."* | `turn.retracted`; el log es la autoridad | **no deshace efectos**; una tarjeta pendiente en ese turno se cancela |
| **Compactar** · por presupuesto o a mano | aparece el resumen y los turnos viejos se pliegan tras `Ver el hilo completo` | un peldaño por turno (`05 §6.4`); conserva anclas y cifras | si el último no alcanza: *"Esta conversación ya es muy larga. Abro una nueva con tu tablero y tu criterio."* |
| **Recordar** · pedido o propuesto | tarjeta `dejar_nota` editable, o `Anotado para esta sesión` | la nota al Cerebro solo al toque; lo de sesión muere con ella | fusionar a Knowledge no se ofrece: es acto de owner/admin |
| **Rechazar fuera de Brein** · sin capacidad | tarjeta `limite` + la acción más cercana | cierra en `limite {tipo, detalle}` | nunca "no soy capaz de eso" a secas; nunca un intento alternativo por su cuenta |

**Interrupción de dos niveles.**

- **Detener** (`Esc` o el botón): *"Me detuve. Te dejo lo que llevo: 32 empresas."* El bucle corta en el siguiente paso y **las herramientas en vuelo terminan** — nada se cancela a medias ni se pierde lo cobrado. Cierre parcial, *"detenida por ti"*.
- **Dirigir sin detener** (escribir mientras corre): el mensaje aparece con la etiqueta `se aplica en el siguiente paso` y en ≤2 s llega la consecuencia: *"Anotado: solo con contacto disponible. De las 32 que llevo, 24 siguen; 8 se van a Descartado con su causa."* Nada se reinicia.
- `[REQUISITO]` un mensaje **durante una decisión pendiente es steering, no una resolución**: a un "sí, dale", *"Para cobrar necesito que toques la tarjeta."*

---

## 5. Estados vacíos y primeros minutos

| Situación | Copy |
|---|---|
| **Primera vez, sin perfil** | *"Soy Ada. Puedo buscar empresas, guardarlas en tu CRM, conseguir contactos y armarte una secuencia — tú autorizas lo que cuesta."* + tres ejemplos tocables: `Empresas de empaque en Jalisco` · `Quién le ha vendido uniformes a gobierno` · `Cómo va mi pipeline`. Sin panel, sin menú de funciones. |
| **Primera vez, con perfil** | *"Vendes [oferta] a [ICP]. Empiezo por ahí o dime otra cosa."* Cero preguntas: el perfil ya lo dijo. |
| **Búsqueda sin resultados** | *"Revisé y ninguna coincide con ese criterio. Esto describe lo que consulté, no todo el mercado."* + `Ampliar a Guanajuato` · `Quitar el filtro de tamaño`. |
| **Sin cobertura** | *"Hoy no tengo visibilidad de ese giro en ese estado. No te voy a inventar una lista."* + `Investigar en la web (tope cotizado)` · `Avísame cuando lo cubra` · `Probar el giro de al lado`. Panel cerrado; <30 s. |
| **Cero créditos de contacto** | *"Te quedan 0 créditos de contacto, así que no puedo revelar correos. Lo demás sigue gratis."* + `Ver planes` · `Seguir sin correos`. Se dice **antes** de armar la selección. |
| **Plan Explorer** | *"Con el plan gratis puedo buscar y guardar, pero no revelar contactos ni armar secuencias, y llevo 3 de 5 búsquedas de hoy."* Nunca una tarjeta de gasto irresoluble. |
| **Panel sin nada** | no existe: aparece con el primer contenido real. |

---

## 6. Detalles de oficio

| Detalle | Cómo se resuelve |
|---|---|
| **Atajos** | `Enter` envía · `⇧Enter` salto de línea · `Esc` detiene el turno (sin turno, cierra el cajón) · `⌘↵` activa el primario de la tarjeta viva · `⌘⇧A` abre/cierra el panel · `⌘⇧E` abre la evidencia de la última cita · `j`/`k` recorren tarjetas. `⌘K` (paleta) y `?` (soporte) **no se reasignan**. |
| **Qué llega primero** | Eco del criterio (≤300 ms) → fila de herramienta → tarjetas del panel fila por fila → narración en streaming → anclas resueltas → decisión al final. `[REQUISITO]` la narración nunca precede al objeto que cita. |
| **Cuánto es demasiado** | **3 s**: avance en lenguaje del encargo (`revisadas 120 de 400`). **10 s**: se abre el runway `Ahora / Después` y aparece `Detener`. **30 s**: *"Esto va para dos minutos. Puedes seguir escribiendo mientras."* `[REQUISITO]` nada de spinner >10 s sin decir qué se espera. |
| **Aprobación por lote** | Una tarjeta por lote, nunca una por fila: 50 empresas es **una**; 3 pasos son **tres casillas** en una. `Ver cuáles` abre la lista con casillas y el botón se actualiza en vivo (`Revelar los 38`). |
| **Gasto grande** | `[SUGERENCIA]` si la cotización pasa de la mitad del saldo, el primario pide escribir el número (`Escribe 100 para confirmar`) y se muestra el saldo resultante. Fricción deliberada, solo para dinero. |
| **Volver a lo vivo** | Leyendo hacia arriba durante un run aparece la píldora `↓ Ada sigue trabajando · volver`. Leer no pausa el trabajo ni salta el scroll. |
| **Espejo de foco** | El cursor sobre una tarjeta del panel resalta el turno que la produjo; cada sección trae `vino de este turno ▸`. Auditar sin preguntar. |
| **Sonido** | Ninguno. Notificación del sistema solo en runs largos y si se pidió. |
| **Accesibilidad** | Una **sola región `aria-live`** con la línea de estado: el streaming no se anuncia token por token. Cada tarjeta es un `group` con nombre, sus botones dicen el efecto completo, el foco entra al primario y vuelve al composer al resolverse. Contraste AA; ningún estado solo por color. |
| **Qué nunca se anima** | Cifras, tarjetas resueltas, badges, el saldo, el hilo al llegar contenido. Lo único con movimiento es el panel pasando de *selección* a *Colección real*: transición de layout, sobria, una vez, con `prefers-reduced-motion` respetado. |

---

## 7. Reglas de consistencia

1. **Componentes solo del set del dashboard** `[REQUISITO]`: nada nuevo mientras exista `CollectionDetail`, `RecordDrawer`, `EmailCampaignDetail`, `DataTable`, `EmptyState`, `Pill`, `StatusDot` y los primitivos de `components/ui`. Lo propio: tarjetas de decisión, fila de herramienta, riel de sesiones.
2. **Copy solo de `messages.ts`** `[REQUISITO]`: toda cadena nueva entra al bloque `es-MX` con clave `luna.*`; sin clave no se muestra. Etapas, conteos de guardado y estados de destinatario **se reusan tal cual**.
3. **Compuerta léxica** `[REQUISITO]`: además de las frases prohibidas de `02-conversaciones`, **Proveedores ≠ Empresas**; "herramientas de Luna" e "instrucciones de Luna"; nunca "candidato" por resultado, "universo", "mercado" genérico ni "análisis" fuera del modo Análisis. CI falla si una cadena `luna.*` trae una palabra vetada.
4. **Las 12 conversaciones son las pruebas de aceptación** `[REQUISITO]`, cada una con su etiqueta: C1/C3/C5/C6/C8/C12 son contrato vigente; C2/C9/C10 no se demuestran como capacidad de hoy. Ningún número de ahí es constante de producto.
5. **Una sola fuente por número y por estado** `[REQUISITO]`: conteos en el encabezado del panel, estado en la línea de estado, gasto en la línea de presupuesto.
6. **El gancho de diseño:** una sola cosa memorable — **la selección volviéndose el CRM del equipo ante tus ojos**, narrada en una línea. Lo demás es callado para que ese momento se note.

**Para el founder:** ¿el borrador de secuencia es nivel 0 con deshacer (recomendado aquí) o nivel 1 con tarjeta, como en `05 §4`? · ¿confirmación escrita para el gasto grande, o fricción de más? · ¿riel de sesiones abierto por defecto, o plegado hasta la segunda?
