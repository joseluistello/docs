# Auditoría inicial — hallazgos

## P0 — Enriquecimiento de contactos sin autorización explícita ni suppression gate

La ruta de enriquecimiento acepta únicamente `record_ids`; la petición no
declara propósito, referencia de autorización, aceptación de derechos de
fuente ni versión de política. El servicio resuelve y persiste datos de
contacto tras la petición del usuario, pero en el flujo auditado no hay una
verificación de suppression u opt-out antes del enriquecimiento.

**Evidencia:** `apps/api/src/radar/radar.controller.ts`,
`apps/api/src/radar/dto/radar.dto.ts` y
`apps/api/src/radar/radar-enrichment.service.ts`.

**Impacto:** el producto aún no puede demostrar que la autorización de
enriquecimiento sea distinta del permiso posterior para exportar o enviar.
Mantener detrás de G2/G5 hasta tener un registro auditable de autorización y
un contrato de suppression.

## P1 — Se pierde provenance del resolver al persistir

El contrato del verifier devuelve `provider` y `sources`, pero el camino de
persistencia guarda `source: null` para endpoints resueltos y no persiste los
`sources` retornados. El fallback de buzón general también guarda
`provider: null` y `source: null`, aunque provenga de un proveedor.

**Evidencia:** `apps/api/src/radar/ports/endpoint-verifier.port.ts`,
`apps/api/src/radar/contact-path.ts` y
`apps/api/src/radar/radar-enrichment.service.ts`.

**Impacto:** no se pueden ejecutar con fiabilidad derechos por campo,
atribución, corrección, eliminación o disputas con el proveedor desde el
registro guardado. Persistir provenance y derechos antes de aprobar un
proveedor.

## P1 — No hay retención ni eliminación de contactos aplicada en este flujo

Los datos de contacto se escriben en campos del record y en el
`contact_path` serializado, pero el camino auditado no tiene expiración por
proveedor, deletion handle, estado de suppression ni propagación hacia
índices, exports, drafts o sistemas de campañas.

**Impacto:** las promesas de retención/eliminación del Trust Pack serían
aspiracionales para contactos. Implementar expiración y propagación, y
probarla con fixtures de proveedores y exports antes de publicar plazos
concretos.

## P1 — Nylas está verificado para la beta y debe mantenerse acotado

`origin/staging` contiene la integración Nylas para conectar Gmail/Outlook y
enviar campañas autorizadas. El alcance beta es deliberadamente send-only: no
lee, lista, busca ni gestiona el inbox o respuestas dentro de Brein. El E2E,
OAuth y los controles del proveedor ya fueron verificados para la beta.

**Impacto:** no ampliar la beta hacia inbox, replies o automatización autónoma.
La etiqueta correcta es `beta verificada / alcance send-only`.

## P0 — No lanzar outreach como capacidad autónoma

El producto debe mantener separado el descubrimiento, enriquecimiento, borrador y envío. Un proveedor que entrega un email no entrega autorización para contactar.

**Evidencia:** la arquitectura actual separa enrichment de investigación y el flujo comercial documentado requiere permiso explícito de envío.

**Acción:** gate G5 antes de habilitar Smartlead o cualquier envío automático.

## P1 — Privacy pública desalineada (resuelto en el árbol de reconciliación)

La versión anterior de la política pública describía principalmente identidad, workspace, GitHub, infraestructura y agentes. La versión reconciliada ya cubre licitaciones, fuentes comerciales, enriquecimiento, contactos, suppression y el alcance send-only de Nylas.

**Archivo:** `apps/web/src/app/(content)/privacy/page.tsx`.

**Acción:** publicar la versión reconciliada después de la revisión visual y el merge; no publicar nombres o finalidades que no estén en el registro verificado.

## P1 — Terms con jurisdicción y producto desalineados

Los Terms actuales remiten a la ley de Estados Unidos y no regulan con suficiente precisión la inteligencia comercial, datos de terceros, proveedores, outreach ni responsabilidades del cliente.

**Archivo:** `apps/web/src/app/(content)/terms/page.tsx`.

**Acción:** reescribir las cláusulas de uso permitido, datos del cliente, fuentes, contactos, acciones externas, suspensión, eliminación y jurisdicción.

## P1 — Trust page promete una lista de subprocessors incompleta para el producto comercial (resuelto en el árbol de reconciliación)

La versión anterior listaba infraestructura y proveedores de operación, pero no diferenciaba proveedores activos, condicionados, pilotos y no seleccionados. La versión reconciliada lista Nylas como activo sólo para send-only y mantiene Smartlead, Hunter y Tomba fuera de la lista activa cuando corresponde.

**Archivo:** `apps/web/src/app/(content)/trust/page.tsx`.

**Acción:** publicar la versión reconciliada y mantener el registro público alineado con el registro de proveedores.

## P1 — Retención publicada debe reconciliarse con capacidad real

La Trust page publica ventanas concretas para recuperación, tokens, invitaciones y eliminación. Antes de usar esas cifras como promesa legal debe comprobarse que cada flujo e índice las cumple.

**Acción:** prueba de eliminación extremo a extremo y matriz de retención.

## P2 — Licencias de fuentes privadas pendientes

MexicoIndustry y Dirind no deben tratarse como fuentes redistribuibles sólo por ser observables. La licencia/display/reuse debe estar documentada por fuente.

**Acción:** mantener campos indeterminados bloqueados para republicación.

## P2 — Inconsistencia de lenguaje sobre credenciales

Las páginas públicas deben distinguir credenciales hasheadas de claves de proveedor cifradas. No se debe afirmar que todos los tokens o claves se almacenan de la misma forma.

**Acción:** reconciliar Privacy, Trust y la implementación antes de publicar.
