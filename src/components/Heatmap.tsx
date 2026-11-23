import { useEffect, useRef } from "react";
import "jheat.js/dist/heat.esm.js";
import "jheat.js/dist/heat.js.min.css";
import type { Session } from "../types";
import { heatWindow, HEAT_MINIMA } from "../util/progress";

/*
 * Calendario de racha con Heat.js (librería empaquetada, no CDN: la app sigue
 * funcionando sin conexión). La librería es anual por naturaleza, así que la
 * ventana se limita a los tres meses naturales terminados en el mes actual
 * (`defaultYear` + `startMonth` + `monthsToShow`), y los días congelados de la
 * racha se pasan como `holidays` para pintarlos con escarcha.
 */

/** API mínima que usamos: el paquete no trae tipos útiles (heat.d.ts está vacío). */
interface HeatApi {
  setLocale: (text: Record<string, unknown>, triggerRefresh?: boolean) => unknown;
  render: (element: HTMLElement, options: Record<string, unknown>) => unknown;
  addType: (id: string, type: string, triggerRefresh?: boolean) => unknown;
  updateDate: (id: string, date: Date, count: number, type: string, triggerRefresh?: boolean) => unknown;
  refresh: (id: string) => unknown;
  destroy: (id: string) => unknown;
}

const HEAT_ID = "bordes-heat";
const HEAT_TYPE = "Bordado";
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function Heatmap({
  sessions,
  metric,
  freezeDays,
}: {
  sessions: Session[];
  metric: "puntadas" | "minutos";
  freezeDays: number;
}) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    const heat: HeatApi | undefined = (window as { $heat?: HeatApi }).$heat;
    if (!node || !heat) return;

    const today = new Date();
    const window_ = heatWindow(sessions, freezeDays, today);
    const minima = HEAT_MINIMA[metric];

    heat.setLocale({ monthNames: MONTH_NAMES, dayNames: DAY_NAMES, noMapDataMessage: "Aún no hay sesiones en estos meses." }, false);
    heat.destroy(HEAT_ID); // render limpio: la instancia guarda el estado anterior
    heat.render(node, {
      id: HEAT_ID,
      defaultYear: window_.year,
      startMonth: window_.startMonth,
      defaultView: "map",
      showHolidaysInDayToolTips: true,
      title: {
        showText: false,
        showYearSelector: false,
        showRefreshButton: false,
        showImportButton: false,
        showExportButton: false,
        showClearButton: false,
        showConfigurationButton: false,
      },
      sideMenu: { enabled: false },
      guide: { enabled: false, allowTypeAdding: false, allowTypeRemoving: false },
      zooming: { enabled: false },
      yearlyStatistics: { enabled: false },
      views: {
        map: {
          enabled: true,
          monthsToShow: window_.months,
          showDayNames: true,
          showMinimalDayNames: false,
          showMonthNames: true,
          showYearsInMonthNames: false,
          placeMonthNamesOnTheBottom: false,
          showDayCounts: true,
          showToolTips: true,
          highlightCurrentDay: true,
          showSpacing: true,
          dayToolTipText: "{dddd} {d} {mmmm} {yyyy}",
        },
        line: { enabled: false },
        chart: { enabled: false },
        days: { enabled: false },
        months: { enabled: false },
        colorRanges: { enabled: false },
      },
      colorRanges: minima.map((minimum, i) => ({
        id: String(i + 1),
        name: ["poco", "algo", "bastante", "mucho"][i],
        minimum,
        // La librería exige un nombre de clase no vacío (si no, `classList.add("")`
        // lanza un error al pintar las vistas). Usamos `day-color-N`, que es justo
        // la clase que lee el CSS de Heat.js y nuestras variables de paleta.
        cssClassName: `day-color-${i + 1}`,
        mapCssClassName: `day-color-${i + 1}`,
        lineCssClassName: `day-color-${i + 1}`,
        chartCssClassName: `day-color-${i + 1}`,
        daysCssClassName: `day-color-${i + 1}`,
        monthsCssClassName: `day-color-${i + 1}`,
        colorRangeCssClassName: `day-color-${i + 1}`,
      })),
      holidays: window_.cells
        .filter((c) => c.frozen)
        .map((c) => {
          const [y, m, d] = c.date.split("-").map(Number);
          return { date: `${d}/${m}/${y}`, name: "día congelado" };
        }),
    });

    heat.addType(HEAT_ID, HEAT_TYPE, false);
    for (const cell of window_.cells) {
      const value = metric === "minutos" ? cell.minutes : cell.stitches;
      if (value > 0) {
        const [y, m, d] = cell.date.split("-").map(Number);
        heat.updateDate(HEAT_ID, new Date(y, m - 1, d), value, HEAT_TYPE, false);
      }
    }
    heat.refresh(HEAT_ID);
  }, [sessions, metric, freezeDays]);

  return (
    <div id={HEAT_ID} ref={el} class="bordes-heat" aria-label="Calendario de sesiones de los últimos tres meses"></div>
  );
}
