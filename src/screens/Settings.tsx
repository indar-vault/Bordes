import { useEffect, useState } from "react";
import type { AppSettings } from "../types";
import { getSettings, setSettings, markBackup } from "../util/repo";
import { buildBackup, restoreBackup } from "../util/export";

/**
 * Configuración: todo lo que no son proyectos. De momento, los descansos de
 * la racha (C2) y las copias de seguridad (A4); en fases futuras vivirán aquí
 * más ajustes (estética, días de la semana, etc.).
 */
export function Settings() {
  const [settings, setShown] = useState<AppSettings | undefined>();
  const [msg, setMsg] = useState("");

  async function refresh() {
    setShown(await getSettings());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function exportJson() {
    const backup = await buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bordes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    await markBackup();
    setShown(await getSettings());
    setMsg("Copia de seguridad descargada.");
  }

  async function importJson(file: File) {
    try {
      const text = await file.text();
      const data = await restoreBackup(text);
      setMsg(`Copia restaurada: ${data.projects.length} proyecto(s), ${data.sessions.length} sesión(es).`);
    } catch (err) {
      setMsg(`No se pudo restaurar: ${(err as Error).message}`);
    }
  }

  return (
    <section class="screen">
      <h1>Configuración</h1>

      <h2>Racha y descansos</h2>
      <p class="hint">
        Un día sin sesión no rompe la racha mientras no agotes los descansos de la
        semana (de lunes a domingo). En el calendario, esos días se marcan con ❄.
      </p>
      <label class="freeze-label">
        🧊 Descansos por semana
        <select
          class="freeze-select"
          value={settings?.freezeDays ?? 1}
          onChange={async (e) => {
            await setSettings({ freezeDays: Number(e.target.value) });
            refresh();
          }}
          aria-label="Días de descanso por semana"
        >
          <option value="0">0 descansos</option>
          <option value="1">1 descanso</option>
          <option value="2">2 descansos</option>
        </select>
      </label>

      <h2>Copias de seguridad</h2>
      <p class="hint">
        Los datos solo viven en este navegador. Exporta una copia de vez en cuando
        y guárdala en un USB, un correo o una carpeta: con ella se puede recuperar
        todo en otro equipo o tras una actualización.
      </p>
      <div class="backup">
        <button class="btn ghost" onClick={exportJson}>Exportar copia (JSON)</button>
        <label class="import">
          Importar copia
          <input type="file" accept="application/json" onChange={(e) => e.target.files && importJson(e.target.files[0])} />
        </label>
      </div>
      {settings?.lastBackupAt ? (
        <p class="hint">Última copia exportada: {settings.lastBackupAt.slice(0, 10)}.</p>
      ) : (
        <p class="hint">Todavía no has exportado ninguna copia de seguridad.</p>
      )}

      {msg && <p class="msg">{msg}</p>}
    </section>
  );
}
