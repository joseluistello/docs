# Retención y eliminación

## Principios

- Conservar sólo mientras exista una finalidad documentada.
- Separar datos operativos, evidencia, contactos, tokens, logs y backups.
- Una solicitud de eliminación debe propagarse a derivados y proveedores cuando el contrato lo permita.
- La suppression list puede conservar el mínimo necesario para no volver a contactar, con acceso restringido y finalidad separada.

## Matriz inicial

| Clase | Retención inicial | Acción al vencer |
|---|---|---|
| Cuenta/workspace activo | mientras exista relación | bloqueo y eliminación según contrato |
| Topic/documento | hasta eliminación del workspace | soft delete sólo durante recuperación documentada |
| Evidencia pública | según licencia y finalidad | retirar o revalidar |
| Contacto enriquecido | mínimo operativo definido por proveedor/cliente | eliminar del workspace y propagar |
| Token revocado | sólo para seguridad y recuperación | purgar según política publicada |
| Borrador de outreach | hasta decisión del usuario o expiración | eliminar o convertir en registro autorizado |
| Bounce/reply/suppression | mientras sea necesario para no contactar y auditar | minimizar y purgar cuando deje de ser necesario |
| Backups | ciclo técnico documentado | expiración automática; no usar para restaurar datos eliminados salvo recuperación |

Los plazos concretos no deben publicarse hasta reconciliarlos con el código, contratos y capacidad real de borrado.

## Requisito de implementación

La eliminación no está completa si sólo se borra la fila principal pero queda una copia en índices, exportaciones, campañas, proveedor de enriquecimiento o el proveedor de envío activo (Nylas). Smartlead es legado y no forma parte del flujo beta activo.
