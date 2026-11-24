# Tunnel-Bibliothek

Der eigene kickflow-Code und das Relay bleiben unter Apache-2.0 lizenziert.
Die separat ausgelieferte Bibliothek **libcurl.js 0.7.5**, Copyright ading2210
und Mitwirkende, steht unter **LGPL-3.0-or-later**. Sie wird unverändert als
eigenes JavaScript-Modul und WASM-Asset mit Inhalts-Hash ausgeliefert.

- Paket: <https://www.npmjs.com/package/libcurl.js/v/0.7.5>
- Zugehörige Quellrevision: <https://github.com/ading2210/libcurl.js/tree/2b6cff872414dd248437a9a9fe5cf84d62ecd64c>
- Build-Anleitung und eingebundene Komponenten: README und Git-Submodule
  dieser Revision. Für einen vollständigen Checkout die Submodule rekursiv
  beziehen (`git submodule update --init --recursive`).
- LGPL-Lizenztext: [public/licenses/libcurl.js-LGPL.txt](public/licenses/libcurl.js-LGPL.txt)
- Ergänzender GPL-v3-Lizenztext: [public/licenses/GPL-3.0.txt](public/licenses/GPL-3.0.txt)

libcurl.js enthält unter anderem curl, mbedTLS, nghttp2, Brotli, den Wisp-Client
und Emscripten-Laufzeitcode. Deren Lizenzhinweise und Quellen stehen im
verlinkten Quellbaum. Die fertigen Bibliotheksdateien werden nicht in den
eigenen Anwendungscode zusammenkopiert. Ein geänderter Bibliotheksbuild kann
über dieselben Asset-Imports in `tunnelWasm.ts` eingebunden und die App mit
`npm run build:web` erneut gebaut werden. Änderungen an der Bibliothek müssen
unter deren Lizenzbedingungen weitergegeben werden.
