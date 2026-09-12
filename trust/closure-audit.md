# Auditoría de cierre del paquete Trust

Esta matriz compara el plan original con el checkout de `staging` y separa lo
que ya puede afirmarse públicamente de lo que todavía necesita evidencia.

| Área del plan | Estado observado | Qué falta antes de producción |
| --- | --- | --- |
| Nylas / envío | Verificado para beta send-only. OAuth, autorización independiente, suppression local y dispatch están acotados por workspace. | Confirmar CI y una corrida E2E final en staging; mantener allowlist y no habilitar inbox/replies. |
| Páginas públicas | Existen `/privacy`, `/terms`, `/trust`, `/support` y `security.txt`. Trust/Privacy ya describen Nylas y el límite send-only. | Confirmar entidad responsable, domicilio, jurisdicción y versión legal definitiva. No inventar esos datos. |
| Provenance | `contact_path` modela provider, sources, observed-at, verificación, confianza, atribución y rights. | El fallback `generalMailbox()` todavía devuelve sólo email/confianza y el camino de persistencia puede dejar provider/source nulos. |
| General vs personal | El clasificador y `assertNoGeneralAsPersonal()` mantienen un buzón general fuera del contacto personal. | Añadir provenance del proveedor/fuente al fallback y una prueba de persistencia, no sólo de clasificación. |
| Authorization ledger | `DataAuthorization` existe y el enrichment crea autorizaciones; el envío usa `EmailSendAuthorization` separado. | No encontré un flujo general de autorización de exportación consumido por un export service. No declarar export gobernado hasta probarlo. |
| Suppression | Hay suppression hash global/workspace para enrichment y suppression por email para campañas. | Probar en staging cada evento (unsubscribe, bounce, complaint, ARCO, manual) y su bloqueo local con proveedor caído. |
| Retención/eliminación | Hay campos de retención/deletion handle y purga de colecciones; la conexión OAuth expira y puede desconectarse. | No encontré un job completo que expire y elimine contactos, índices, exports, campañas y copias externas por proveedor. |
| Migraciones | 0181, 0182 y 0183 están ordenadas; 0183 admite Nylas y pausa sender rows Smartlead. | Aplicar realmente sobre Postgres de staging y verificar tablas, constraints, índices, rollback y datos existentes. 0182 no habilita RLS propio. |
| Smartlead | El adapter, webhook y tipos siguen en el repositorio como legado; el módulo activo registra Nylas/mock. | Mantenerlos fuera del runtime y eliminar/aislar cualquier configuración o UI que los presente como opción activa. |

## Páginas que faltan

Para la beta no falta otra página pública obligatoria: Support ya concentra
contacto, privacidad y seguridad, y Trust contiene el registro de proveedores.
Para ventas enterprise sí faltaría un DPA/subprocessor schedule separado, con
la entidad, domicilio, regiones, subencargados y términos contractuales reales.

## Decisión de lanzamiento

La beta Nylas puede seguir en staging como beta cerrada. La producción no debe
declarar todavía que enrichment, export y eliminación de contactos están
completamente gobernados hasta cerrar los tres gaps de provenance del fallback,
export authorization y deletion/retention propagation.
