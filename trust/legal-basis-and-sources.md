# Base legal y fuentes de referencia

Este documento fija la base de trabajo para el producto mexicano. No sustituye
una opinión legal ni convierte una fuente pública o un proveedor en autorizado.
La regla operativa es: la ley define obligaciones; el contrato/licencia define
qué podemos hacer con un campo concreto; el producto debe bloquear lo que no
pueda demostrar.

## México: datos personales

La referencia principal es la **Ley Federal de Protección de Datos Personales
en Posesión de los Particulares (LFPDPPP)** vigente. La ley nueva fue publicada
el 20 de marzo de 2025 y la versión consultada incorpora la reforma publicada el
14 de noviembre de 2025:

<https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf>

Para el diseño del pack se toman como controles de producto, sujetos a
validación jurídica del caso concreto:

- aviso de privacidad con identidad del responsable, categorías, finalidades,
  opciones de limitación y mecanismos ARCO;
- finalidad, proporcionalidad y uso limitado al propósito informado;
- seguridad, confidencialidad y gestión de vulneraciones;
- procedimiento trazable para acceso, rectificación, cancelación y oposición;
- reglas documentadas para transferencias y terceros;
- eliminación o bloqueo cuando termina la finalidad, sujeto a obligaciones de
  conservación que estén demostradas.

La referencia a “fuente de acceso público” no se interpreta como una licencia
general de republicación, enriquecimiento o outreach. Cada fuente y cada
campo deben conservar su origen, términos conocidos, usos permitidos y fecha
de revisión.

## Comunicaciones publicitarias

El Registro Público para Evitar Publicidad (REPEP) de Profeco es referencia
para llamadas y mensajes publicitarios:

- <https://repep.profeco.gob.mx/preguntasfrecuentes.jsp>
- <https://repep.profeco.gob.mx/Denunciar.jsp>

REPEP no resuelve por sí solo el tratamiento de datos, el correo electrónico,
las transferencias, la autorización de una secuencia ni los bounces. Es un
control separado dentro de `outreach-policy.md`.

## Google User Data

Las integraciones OAuth deben operar con el alcance mínimo y con disclosure
por función, consentimiento contextual, revocación y eliminación. Las
referencias oficiales son:

- <https://developers.google.com/terms/api-services-user-data-policy>
- <https://developers.google.com/identity/protocols/oauth2/policies>
- <https://developers.google.com/terms>

El producto no debe usar los datos privados de Google para construir una base
comercial reutilizable, venderlos, transferirlos fuera de la función declarada
ni usarlos para entrenar modelos generales. El acceso a correo, contactos o
archivos debe ser opcional y granular.

## Regla de evidencia

Cada conclusión de cumplimiento debe etiquetarse como `observado`,
`condicionado`, `no determinado` o `bloqueado`. Si la ley, contrato o fuente
no permite resolver un campo, el sistema conserva la incertidumbre y no lo
presenta como hecho ni lo habilita para exportación/outreach.
