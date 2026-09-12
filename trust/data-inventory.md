# Inventario de tratamientos

## A. Cuenta y workspace

**Datos:** nombre, correo, identidad del proveedor de autenticación, membresía, roles y eventos de actividad.

**Finalidad:** autenticación, autorización, prestación del servicio, soporte y seguridad.

**Estado:** observado.

**Controles:** aislamiento por workspace, minimización de telemetría, acceso ARCO, exportación y eliminación.

## B. Contenido del workspace

**Datos:** topics, documentos, notas, anchors, repositorios, extractos y contenido introducido por el cliente.

**Finalidad:** entregar contexto y operar las funciones contratadas.

**Estado:** observado.

**Regla:** el cliente conserva responsabilidad sobre su derecho a introducir contenido; Brein no debe usar contenido del workspace para entrenar modelos propios sin una finalidad y autorización separadas.

## C. Mercado, licitaciones y proveedores

**Datos:** organizaciones, licitaciones, contratos, adjudicaciones, montos, fechas, compradores y evidencia de fuentes.

**Finalidad:** investigación comercial y explicación de oportunidades o proveedores.

**Estado:** observado para datos de organización y evidencia; derechos de reutilización varían por fuente.

**Regla:** el resultado debe distinguir hecho publicado, observación, inferencia y candidato. Nunca prometer exhaustividad por defecto.

## D. Contactos y enriquecimiento

**Datos potenciales:** nombre, cargo, correo laboral, teléfono, URL profesional, estado de verificación y fecha de observación.

**Finalidad:** localizar una ruta de contacto elegida por el usuario.

**Estado:** condicionado. La investigación de mercado actual no debe almacenar personas o contactos; cualquier expansión requiere un registro de proveedor, finalidad, retención, opt-out y eliminación.

**Regla:** un contacto enriquecido no es una autorización para contactar.

## E. Google y correo

**Datos:** identidad del remitente, autorización OAuth, tokens gestionados por el proveedor, destinatarios, contenido de campañas autorizadas, estado de envío y metadatos necesarios para el despacho. En la beta send-only Brein no importa mensajes del inbox ni respuestas.

**Finalidad:** la función concreta elegida por el usuario.

**Estado:** beta verificada para envío send-only mediante Nylas; lectura de inbox, respuestas y rebotes dentro de Brein no está habilitada.

**Regla:** autorización incremental; la conexión de Nylas no autoriza lectura de inbox, gestión de respuestas ni otras funciones futuras.

## F. Outreach

**Datos:** contacto seleccionado, campaña, contenido, estado de envío, rebote, respuesta, baja y suppression.

**Finalidad:** ejecutar el envío de una campaña aprobada por el usuario.

**Estado:** beta verificada con autorización explícita, suppression y límites operativos; el envío autónomo fuera de esa autorización está bloqueado.

**Regla:** enriquecer puede ser una propuesta; enviar requiere permiso explícito y verificación contra suppression.
