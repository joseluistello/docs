# Google User Data

## Regla de autorización

Cada scope debe corresponder a una función visible y elegida. La pantalla debe explicar antes de autorizar:

1. qué datos se solicitan;
2. para qué función;
3. si se almacenan;
4. si se envían a otro proveedor;
5. cómo revocar acceso y solicitar eliminación.

## Funciones separadas

- iniciar sesión;
- conectar un remitente Gmail/Outlook para la beta;
- enviar un mensaje o campaña aprobada;
- revocar la conexión y solicitar eliminación.

En la beta actual, Nylas sólo se usa para la conexión del remitente y el envío
autorizado. Brein no lee el inbox, lista o busca mensajes, ni gestiona
respuestas dentro del producto. Las respuestas permanecen en Gmail u Outlook.

Las capacidades futuras de borradores, lectura de respuestas o rebotes requieren
una revisión y autorización separadas; no quedan habilitadas por la conexión de
envío.

No se debe pedir acceso amplio a Gmail para cubrir funciones futuras. Si el usuario niega un scope, la función relacionada debe quedar deshabilitada, no degradarse silenciosamente.

## Prohibiciones de producto

- no vender ni transferir datos de Google como base comercial;
- no usar contenido de Google para entrenar modelos generales;
- no exponer contenido privado de un workspace a otro;
- no convertir el buzón del usuario en una base de contactos compartida;
- no enviar contenido de Gmail a enriquecedores salvo que una función visible lo requiera y el usuario lo autorice.
