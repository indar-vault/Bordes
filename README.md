# Bordes

Web app (PWA) para registrar sesiones de bordado de punto de cruz: proyectos,
puntadas dadas/total, hilos por color, sesiones con temporizador, fotos y
apuntes, y lo visto (series/películas/YouTube). Pensada para Windows 11
(portátil) y Linux (desarrollo). Funciona **offline**: los datos viven en
IndexedDB del navegador, con copia de seguridad JSON exportable.

- **Memoria del proyecto** (privada, no está en este repo):
  `~/opencode/proyecto/bordes/` — objetivo, decisiones, arquitectura, roadmap,
  corpus de pruebas y logs de sesión.

## Ramas y sitios

- `main`: **v1** en producción → https://indar-vault.github.io/Bordes/
  (tag `v1.0`, release con el `dist` zip).
- `v2`: desarrollo de la segunda versión (fusionará con `main` cuando se
  decida).
- `preview`: copia de `v2` con `BASE_PATH: /Bordes-v2/`, publicada como `main`
  del repo espejo [indar-vault/Bordes-v2](https://github.com/indar-vault/Bordes-v2)
  → https://indar-vault.github.io/Bordes-v2/

## Cómo arrancar

```bash
npm install        # una vez
npm run dev        # desarrollo (http://localhost:5173)
npm run test       # tests unitarios (vitest, 67)
npm run smoke      # build + prueba end-to-end real en Chromium (94 comprobaciones)
npm run shots      # capturas de pantalla de las pantallas para revisar la UI
```

`npm run smoke` requiere Chromium en `/usr/bin/chromium` (o cambiar
`executablePath` en `scripts/smoke.mjs`). Puede apuntar a otro sitio con
`SMOKE_URL=https://… node scripts/smoke.mjs`. Verifica la importación de
patrones Flosscross (`.fcjson`), alta manual, sesión rápida con media,
calendario de racha, DMC, borrado con deshacer, copias de seguridad y
**funcionamiento offline** gracias al service worker.

Para publicar la preview: `scripts/publish-preview.sh` (build + push del
`dist` a la rama `gh-pages` del repo espejo; el token de Actions no puede
habilitar Pages en repos nuevos, así que se usa el método clásico).

## Despliegue

Un push a `main` ejecuta `.github/workflows/deploy.yml` (build + Pages) y
publica la PWA en https://indar-vault.github.io/Bordes/

## Estructura

```
src/
  types.ts        modelo de datos (Project, Thread, ProjectThread, Session,
                  media, AppSettings) con schemaVersion 2
  db.ts           Dexie (IndexedDB), esquema versionado
  data/dmc.ts     catálogo DMC embebido (489 colores), offline
  util/
    progress.ts   lógica derivada (puntadas, minutos, racha + días congelados,
                  calendario) — pura y testable
    repo.ts       acceso a datos
    export.ts     copia de seguridad JSON con schemaVersion
    flosscross.ts importador de patrones Flosscross (.fcjson)
    media.ts      historial de series/películas/YouTube vistas
    summary.ts    resumen imprimible y CSV
  screens/        Home, Project, Session, NewProject, Threads, Summary,
                  Settings (Configuración)
  styles.css
scripts/
  smoke.mjs        prueba de humo end-to-end
  shot.mjs         capturas de la v1
  shot-v2.mjs      capturas de la v2
  shot-import.mjs  capturas con un patrón real importado
  publish-preview.sh  publica la preview de v2
  fixtures/        patrones .fcjson de prueba
```
