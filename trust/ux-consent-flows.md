# UX consent flows

The interface asks only for decisions that change what Brein will do.

The complete experience belongs in a layered Trust & Data Control Center, not
in repeated legal banners. See `sota-web-patterns.md` for the public Trust
Center, workspace privacy dashboard, provenance drawer, and downloadable
customer evidence pack.

## Enrichment modal

Title: `Enriquecer contactos`

Copy: `Buscaremos datos profesionales mediante proveedores externos para los
registros seleccionados. Esto no enviará mensajes ni exportará información.`

Actions: `Cancelar` / `Enriquecer contactos`.

## Export modal

Copy: `Estos datos saldrán de Brein. Revisa que el destinatario y el uso sean
apropiados para tu organización.`

The UI shows blocked fields with a reason such as `Fuente no autorizada para
exportación`, not internal legal terminology.

## Send modal

Copy: `Esto enviará mensajes a los contactos seleccionados. Se excluirán las
personas con baja, bounce o bloqueo activo.`

The send button remains disabled until the final suppression check succeeds.

## Google

Explain the requested scope immediately before OAuth. Use incremental access;
do not request Gmail, Contacts, or Drive access for a feature that only needs
identity or calendar data. Provide disconnect and delete controls next to the
connection state.
