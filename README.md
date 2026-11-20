# Bordes

Web app (PWA) para registrar sesiones de bordado de punto de cruz: proyectos,
puntadas dadas/total, hilos por color, sesiones con temporizador y lo visto
(series/películas). Pensada para Windows 11 (portátil) y Linux (desarrollo).

- **Memoria del proyecto:** `~/opencode/proyecto/bordes/` (fuente de verdad del estado)
- **Documentos y corpus de pruebas:** `docs/` (ideas originales, video de
  inspiración, exportaciones reales de Flosscross en `docs/flosscross-ejemplo/`)

## Cómo arrancar

```bash
npm install        # una vez
npm run dev        # desarrollo (http://localhost:5173)
npm run build      # build a dist/
npm run test       # tests (vitest)
```

El despliegue a GitHub Pages es automático: un push a `main` ejecuta
`.github/workflows/deploy.yml` y publica la PWA en
https://indar-vault.github.io/Bordes/

## Estructura

```
src/            app React + TypeScript
  db.ts         Dexie (IndexedDB): esquema de datos, versionado
  screens/      Home, Proyecto, Sesión
docs/           requisitos, inspiración, corpus Flosscross
scripts/        utilidades repetidas
```
