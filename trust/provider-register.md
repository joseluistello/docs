# Registro de proveedores

Esta tabla es deliberadamente conservadora. `no determinado` no significa aprobado: significa que el producto no debe hacer una promesa sobre ese punto.

| Proveedor o familia | Uso | Datos potenciales | Estado | Gate mínimo |
|---|---|---|---|---|
| Supabase | base principal | workspace, topics, registros y datos operativos | observado | DPA, región, backup y borrado |
| Render | API y jobs | datos procesados por la aplicación | observado | DPA, acceso operativo y retención |
| Vercel | web y dashboard | requests, logs y contenido servido | observado | DPA, logs y región |
| Clerk | identidad | nombre, correo, identificador y sesión | observado | DPA y eliminación |
| Resend | email transaccional | correo y contenido de invitaciones | observado | DPA, rebotes y retención |
| PostHog | analítica | eventos minimizados e identificador pseudónimo | observado | no enviar contenido, contactos ni secretos |
| GitHub | repositorios conectados | metadata de commits y PRs | observado | instalación explícita y revocación |
| Apollo | enriquecimiento | organización y, si se solicita, personas/contactos | condicionado | contrato API/OEM, DPA, opt-out, borrado y redistribución |
| Hunter | descubrimiento/verificación y revelado de correo de una persona elegida | dominios, correos, estado de verificación y perfil profesional candidato | piloto condicionado | fuente, uso permitido, DPA, opt-out y retención; el directorio enmascarado sigue limitado a staging |
| Tomba | finder/verificación/enriquecimiento | contactos y estados de verificación | piloto condicionado | términos escritos, créditos, DPA, subprocesadores y opt-out |
| Parallel Entity Search | descubrimiento acotado de perfiles profesionales en staging | nombre, cargo y perfil profesional candidato | condicionado | DPA, opt-out, retención, borrado, redistribución, subprocesadores y región; no contacto ni exportación |
| Nylas | envío autorizado | remitentes Gmail/Outlook, destinatarios y contenido de campañas autorizadas | beta verificada | mantener send-only, allowlist de workspaces, autorización humana y límites de volumen |
| Smartlead | alternativa histórica de secuencias | campañas, contactos, contenido, respuestas y bounces | no seleccionado para la beta | no activar ni presentar como proveedor actual |
| ReachInbox | alternativa de secuencias | remitentes, campañas, contactos, respuestas y bounces | evaluando | API/OAuth propio, embedding/resale, aislamiento, DPA, retención y borrado |
| Saleshandy | alternativa de secuencias | remitentes, campañas, contactos, respuestas y bounces | evaluando | OAuth propio, white-label, API, DPA, retención y borrado |
| EmailBison | infraestructura alternativa de secuencias | workspaces, remitentes, campañas, contactos y respuestas | evaluando | onboarding Google, API, aislamiento, white-label, DPA y borrado |
| Google APIs | OAuth/Gmail | scopes, tokens y datos de Workspace | condicionado | scopes mínimos, Limited Use, revocación y borrado |

## Prohibiciones

- No configurar un proveedor sólo porque tiene un adapter.
- No presentar un proveedor condicionado como subprocesador activo.
- No afirmar que un crédito equivale a una persona única o a un contacto entregable.
- No permitir que una conexión OAuth del cliente sustituya un acuerdo OEM/API reseller cuando Brein opera el servicio para terceros.
