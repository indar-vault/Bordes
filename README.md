# Bordes

Web app (PWA) para registrar sesiones de bordado de punto de cruz: proyectos,
puntadas dadas/total, hilos por color, sesiones con temporizador y lo visto
(series/películas). Pensada para Windows 11 (portátil) y Linux (desarrollo).
Funciona **offline**: los datos viven en IndexedDB del navegador.

- **Memoria del proyecto** (privada, no está en este repo):
  `~/opencode/proyecto/bordes/` — objetivo, decisiones, arquitectura, roadmap,
  corpus de pruebas y logs de sesión.

## Cómo arrancar

```bash
npm install        # una vez
npm run dev        # desarrollo (http://localhost:5173)
npm run build      # build a dist/
npm run test       # tests unitarios (vitest)
npm run smoke      # build + prueba end-to-end real en Chromium (21 comprobaciones)
```

`npm run smoke` requiere Chromium en `/usr/bin/chromium` (o cambiar
`executablePath` en `scripts/smoke.mjs`). Verifica: importación de un patrón
Flosscross (`.fcjson`), alta manual de proyecto, sesión con puntadas y media,
carretes de la biblioteca, racha, persistencia tras recargar y
**funcionamiento offline** gracias al service worker.

`scripts/shot.mjs` genera capturas de pantalla de las pantallas en
`/tmp/opencode/bordes-shots/` para revisar la estética.

## Despliegue

Un push a `main` ejecuta `.github/workflows/deploy.yml` (build + Pages) y
publica la PWA en https://indar-vault.github.io/Bordes/

## Estructura

```
src/
  types.ts        modelo de datos (Project, Thread, ProjectThread, Session)
  db.ts           Dexie (IndexedDB), esquema versionado
  util/
    progress.ts   lógica derivada (puntadas, racha, mes) — pura y testable
    repo.ts       acceso a datos
    export.ts     copia de seguridad JSON con schemaVersion
    flosscross.ts importador de patrones Flosscross (.fcjson)
  screens/        Home, Project, Session, NewProject
  styles.css
scripts/
  smoke.mjs       prueba de humo end-to-end
  shot.mjs        capturas de pantalla
```
