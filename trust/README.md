# Brein Trust & Data Governance Pack v1

Este directorio es la base operativa para alinear producto, proveedores, fuentes, contratos y superficies públicas de confianza.

## Principio

Cada dato debe tener origen, finalidad, receptor, retención, nivel de confianza y mecanismo de corrección o eliminación. Una fuente pública no equivale por sí sola a un derecho de republicación, enriquecimiento o outreach.

## Estado del paquete

Este paquete distingue entre:

- **observado**: confirmado en el repositorio o en una fuente oficial;
- **condicionado**: posible sólo después de contrato, licencia o configuración;
- **no determinado**: no debe convertirse en una afirmación pública;
- **bloqueado**: el producto debe impedir el flujo hasta resolverlo.

No es una opinión legal ni sustituye un contrato. Es el sistema de evidencia que evita que los documentos públicos prometan más de lo que el producto realmente controla.

Los reportes de otros tasks se consideran pistas hasta que el código, la
revisión desplegada y el comportamiento E2E sean verificables en el checkout o
entorno correspondiente.

## Archivos

- `data-inventory.md`: mapa de tratamientos y clasificación de datos.
- `provider-register.md`: registro de proveedores y gates de selección.
- `source-license-register.md`: derechos por fuente y por campo.
- `retention-and-deletion.md`: retención, supresión y propagación.
- `google-user-data.md`: OAuth, Gmail y permisos por función.
- `outreach-policy.md`: enriquecimiento, secuencias y envío.
- `arco-and-opt-out.md`: solicitudes, oposición, corrección y exclusión.
- `launch-gates.md`: condiciones verificables antes de habilitar cada capacidad.
- `audit-findings.md`: hallazgos priorizados de la auditoría inicial.
- `technical-control-audit.md`: contraste entre las promesas de gobernanza y
  los controles que realmente existen en el código.
- `legal-basis-and-sources.md`: fuentes oficiales y reglas de interpretación
  para México, REPEP y Google User Data.
- `implementation-blueprint.md`: orden de construcción, invariantes y
  definition of done para implementar los controles.
- `governance-data-model.md`: entidades y metadata mínima de gobernanza.
- `authorization-contracts.md`: contratos separados para enriquecer,
  exportar y enviar.
- `suppression-and-deletion.md`: reglas técnicas de opt-out, retención y
  eliminación.
- `ux-consent-flows.md`: copy y momentos de confirmación en producto.
- `provider-activation-checklist.md`: evidencia requerida por proveedor.
- `acceptance-tests.md`: pruebas de aceptación para activar cada capacidad.
- `file-by-file-implementation-plan.md`: handoff del agente de código con
  archivos reales, slices y límites de implementación.
- `sota-web-patterns.md`: patrón web enterprise comparado con Trust Centers,
  privacy dashboards y controles administrativos actuales.
- `branch-integration-review.md`: revisión de las ramas de enrichment y email,
  sus controles útiles y el orden seguro de integración.

## Regla de actualización

Un proveedor, fuente o finalidad nueva no entra a producción sólo por agregar un adapter. Primero debe existir una fila en el registro correspondiente, una decisión de derechos y un gate verificable.
