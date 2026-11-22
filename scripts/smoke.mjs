// Prueba de humo end-to-end con Chromium real sobre la app servida.
// Uso: npm run smoke   (levanta `vite preview` y abre http://localhost:4173)
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";

const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";
const DL = "/tmp/opencode/bordes-smoke-downloads";

async function clickByText(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().includes(t));
    if (!el) return false;
    el.click();
    return true;
  }, text);
  if (!ok) throw new Error(`No se encontró el botón "${text}"`);
}

async function text(page) {
  return page.evaluate(() => document.body.innerText);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const fails = [];
  const check = (label, cond) => {
    console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) fails.push(label);
  };
  let t = "";

  await page.goto(URL, { waitUntil: "networkidle0" });

  // 1. Home vacío
  check("Home muestra el estado vacío", (await text(page)).includes("Aún no hay proyectos"));

  // 2. Importación Flosscross: el formulario se rellena solo
  await clickByText(page, "Nuevo proyecto");
  await page.waitForSelector(".fcjson-input");
  const fixture = readFileSync("scripts/fixtures/ejemplo.fcjson", "utf8");
  await page.evaluate((content, name) => {
    const input = document.querySelector(".fcjson-input");
    const dt = new DataTransfer();
    dt.items.add(new File([content], name, { type: "application/json" }));
    input.files = dt.files;
    // React delega los eventos al root: hay que hacerlos bubbling.
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, fixture, "ejemplo.fcjson");
  await page.waitForFunction(() => document.querySelector("#project-name").value === "Flor de lis", { timeout: 8000 });
  t = await text(page);
  check("El import detecta la rejilla 3×4 (12 celdas) y 9 puntadas reales", t.includes("Importado: rejilla 3×4 = 12 celdas (9 puntadas), 3 colores, imagen incluida."));
  check("La tabla de colores se rellena (3 filas)", await page.evaluate(() => document.querySelectorAll(".colors tbody tr").length) === 3);
  check("Cada color importado trae un selector de hilo", await page.evaluate(() => document.querySelectorAll(".colors .color-thread").length) === 3);
  check("El total precargado es la rejilla completa (12)", await page.evaluate(() => document.querySelector("#project-total").value) === "12");
  await clickByText(page, "Crear proyecto");
  await page.waitForSelector(".project-head");
  t = await text(page);
  check("El proyecto importado arranca con 0 / 12", t.includes("0 / 12"));
  await page.waitForFunction(() => document.body.innerText.includes("DMC 03") && document.body.innerText.includes("DMC 950"), { timeout: 8000 });
  t = await text(page);
  check("Los colores importados mantienen DMC raros", t.includes("DMC 03") && t.includes("DMC 950"));
  check("No se importan colores declarados sin puntadas", !t.includes("Sin puntadas"));

  // 3. Crear proyecto manualmente (tecleando de verdad, para que React registre los cambios)
  await clickByText(page, "Inicio");
  await clickByText(page, "Nuevo proyecto");
  await page.waitForSelector("#project-name");
  await page.type("#project-name", "Olivia Rodrigo");
  await page.type("#project-total", "3025");
  await page.type(".color-total", "2615");

  await clickByText(page, "Crear proyecto");
  await page.waitForSelector(".project-head");
  t = await text(page);
  check("Página del proyecto muestra el nombre", t.includes("Olivia Rodrigo"));
  check("Progreso inicial 0 / 3025", t.includes("0 / 3025"));

  // 3. Sesión con puntadas y media
  await clickByText(page, "Empezar sesión");
  await page.waitForSelector(".counter-row");
  await page.type(".timer input[type=number]", "45");
  await page.type(".counter-row input[type=number]", "150");
  await page.select(".media select", "serie");
  await page.waitForSelector('.media input[type="text"]');
  await page.type('.media input[type="text"]', "Friends");
  await page.type('.media input[type="number"]', "2");

  // Consumo manual de bobinas: checkbox + dropdown 1..bobinas disponibles
  await page.waitForSelector(".spool-used input[type=checkbox]");
  await page.evaluate(() => document.querySelector(".spool-used input[type=checkbox]").click());
  await page.waitForSelector(".spool-used select");
  const spoolOpts = await page.evaluate(() => [...document.querySelectorAll(".spool-used select option")].map((o) => o.value));
  check("El dropdown de bobinas empieza en 1 y llega a las disponibles", spoolOpts.length === 1 && spoolOpts[0] === "1");

  await clickByText(page, "Guardar sesión");
  // La página del proyecto se refresca con varias consultas: esperamos a que
  // el registro esté completo antes de comprobar (evita falsos negativos).
  await page.waitForFunction(
    () => document.body.innerText.includes("150 / 3025") && document.body.innerText.includes("bobina gastada"),
    { timeout: 12000 }
  );
  t = await text(page);
  check("El progreso refleja la sesión (150 / 3025)", t.includes("150 / 3025"));
  check("Aparece la sesión en el registro", t.includes("150 puntadas"));
  check("El registro refleja la bobina gastada", t.includes("1 bobina gastada"));
  check("El proyecto muestra las bobinas restantes y las gastadas", t.includes("0 bobinas") && t.includes("1 gastada"));
  check("Se registra la serie vista", t.includes("Friends"));

  // 4. Toggle de reemplazo del hilo teórico (estamos en la página del proyecto)
  await clickByText(page, "reemplaza");
  await page.waitForSelector(".replace-edit input");
  await page.evaluate(() => document.querySelector(".replace-edit input").select());
  await page.type(".replace-edit input", "Crema 752");
  await clickByText(page, "Guardar reemplazo");
  await page.waitForFunction(() => document.body.innerText.includes("Crema 752"), { timeout: 8000 });
  t = await text(page);
  check("El hilo marca a qué color teórico reemplaza", t.includes("reemplaza a “Crema 752”"));

  // 4b. Resumen final del proyecto (estamos en la página de Olivia)
  await clickByText(page, "Ver resumen");
  await page.waitForFunction(() => document.body.innerText.includes("bordado en total") && !document.body.innerText.includes("Aún no hay sesiones"), { timeout: 8000 });
  t = await text(page);
  check("El resumen muestra el tiempo y las sesiones", t.includes("45 min") && t.includes("sesión (1 día)"));
  check("El resumen muestra el progreso de la rejilla", t.includes("150 / 3025"));
  check("El resumen cuenta los colores y sus bobinas", t.includes("Colores") && t.includes("Pearl Gray") && t.includes("Gastadas") && t.includes("1"));
  check("El resumen suma los episodios vistos", t.includes("2 episodios"));

  // 4c. A2: resumen imprimible y export CSV real
  check("El resumen tiene botones de impresión y CSV", await page.evaluate(() => !!document.querySelector(".print-btn") && !!document.querySelector(".csv-export")));
  check("La hoja de estilos incluye reglas @media print", await page.evaluate(() => [...document.styleSheets].some((ss) => { try { return [...ss.cssRules].some((r) => r.cssText.includes("@media print")); } catch { return false; } })));
  mkdirSync(DL, { recursive: true });
  rmSync(DL, { recursive: true, force: true });
  mkdirSync(DL);
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL });
  await clickByText(page, "Exportar CSV");
  let csv = "";
  for (let i = 0; i < 40 && !csv; i++) {
    const fresh = readdirSync(DL).filter((f) => f.endsWith(".csv"));
    if (fresh.length) csv = readFileSync(`${DL}/${fresh[0]}`, "utf8");
    else await new Promise((r) => setTimeout(r, 250));
  }
  check("El CSV descargado trae cabecera, fecha, minutos y colores", csv.startsWith("fecha,minutos,puntadas,bobinas,media,hilos") && csv.includes("Pearl Gray") && csv.includes("150"));
  check("La vista de resumen se puede imprimir", await page.evaluate(() => { try { window.print(); return true; } catch { return false; } }));

  await clickByText(page, "Volver al proyecto");
  await page.waitForSelector(".project-head");

  // 5. Biblioteca global de hilos
  await clickByText(page, "Hilos");
  await page.waitForSelector(".threads .thread");
  t = await text(page);
  check("La biblioteca lista los hilos con su DMC", t.includes("Pearl Gray") && t.includes("DMC 415"));
  check("La biblioteca muestra dónde se usa cada hilo", t.includes("Olivia Rodrigo"));
  // Editar los carretes del hilo concreto de Olivia (la lista tiene varios hilos).
  let threadHandle = null;
  for (const el of await page.$$(".threads .thread")) {
    if ((await el.evaluate((e) => e.textContent)).includes("Olivia Rodrigo")) {
      threadHandle = el;
      break;
    }
  }
  if (!threadHandle) throw new Error("No se encontró el hilo de Olivia en la biblioteca");
  const spoolInput = await threadHandle.$(".lib-spools");
  await spoolInput.evaluate((e) => e.select());
  await spoolInput.focus();
  await page.keyboard.type("3");
  await (await threadHandle.$(".lib-save")).click();
  await page.waitForFunction(
    () => [...document.querySelectorAll(".thread")].some((li) => li.textContent.includes("Olivia Rodrigo") && Number(li.querySelector(".lib-spools").value) === 3),
    { timeout: 8000 }
  );

  // 6. Home: widgets
  await clickByText(page, "Inicio");
  await page.waitForSelector(".widgets");
  t = await text(page);
  check("Home muestra la racha 🔥 1", t.includes("🔥 1"));
  check("Home muestra los episodios del mes", t.includes("episodios este mes"));

  // 6b. A1: búsqueda de proyectos en Inicio
  await page.waitForSelector("#project-search");
  await page.type("#project-search", "flor");
  await page.waitForFunction(
    () => document.querySelectorAll(".minis .mini").length === 1 && !document.body.innerText.includes("Olivia Rodrigo"),
    { timeout: 8000 }
  );
  t = await text(page);
  check("La búsqueda encuentra el proyecto importado", t.includes("Flor de lis") && t.includes("resultado"));
  check("La búsqueda oculta los proyectos que no coinciden", !t.includes("Olivia Rodrigo"));
  await page.evaluate(() => {
    const el = document.querySelector("#project-search");
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // 7. Persistencia tras recargar
  await page.reload({ waitUntil: "networkidle0" });
  t = await text(page);
  check("Los datos persisten tras recargar", t.includes("Olivia Rodrigo") && t.includes("🔥 1"));
  check("El proyecto importado también persiste", t.includes("Flor de lis"));
  await page.click(".hero-card");
  await page.waitForSelector(".project-head");
  await page.waitForFunction(() => document.body.innerText.includes("2 bobinas") && document.body.innerText.includes("1 gastada"), { timeout: 8000 });
  t = await text(page);
  check("El proyecto refleja las bobinas editadas menos la gastada", t.includes("2 bobinas") && t.includes("1 gastada"));
  check("El reemplazo sobrevive a la recarga", t.includes("Crema 752"));

  // 7b. Apuntes, regalo y fotos del proceso
  await page.waitForSelector(".project-notes");
  await page.type(".project-notes", "hilo doble en las esquinas");
  await page.type(".meta input[type=text]", "Marta");
  await clickByText(page, "Guardar apuntes");
  await page.waitForFunction(() => document.body.innerText.includes("Para regalar a Marta"), { timeout: 8000 });
  t = await text(page);
  check(
    "Los apuntes se guardan y se ven en el proyecto",
    await page.evaluate(() => document.querySelector(".project-notes").value.includes("hilo doble en las esquinas"))
  );
  check("El regalo se edita desde la página del proyecto", t.includes("Para regalar a Marta"));

  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 60;
    canvas.height = 60;
    canvas.getContext("2d").fillRect(0, 0, 60, 60);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const input = document.querySelector(".photo-input");
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "proceso.png", { type: "image/png" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll(".gallery .photo img").length === 1, { timeout: 10000 });
  check(
    "Las fotos del proceso se guardan redimensionadas",
    await page.evaluate(() => {
      const img = document.querySelector(".gallery .photo img");
      return img.src.startsWith("data:image/jpeg") && img.src.length < 200000;
    })
  );

  // 7c. Editar una sesión ya guardada
  await clickByText(page, "editar");
  await page.waitForSelector(".session-edit");
  const nums = await page.$$(".session-edit .counter-row input[type=number]");
  await nums[0].evaluate((e) => e.select());
  await nums[0].focus();
  await page.keyboard.type("60");
  await nums[1].evaluate((e) => e.select());
  await nums[1].focus();
  await page.keyboard.type("200");
  await clickByText(page, "Guardar cambios");
  await page.waitForFunction(() => document.body.innerText.includes("200 / 3025"), { timeout: 8000 });
  t = await text(page);
  check("La sesión editada rehace el progreso (200 / 3025)", t.includes("200 / 3025"));
  check("El registro muestra la sesión corregida", t.includes("200 puntadas · 60 min"));

  // 7d. A3: borrar una sesión se puede deshacer
  await clickByText(page, "borrar");
  await page.waitForFunction(
    () => document.querySelector(".undo-banner") && !document.body.innerText.includes("200 puntadas"),
    { timeout: 8000 }
  );
  t = await text(page);
  check("Al borrar, la sesión desaparece del registro", !t.includes("200 puntadas"));
  check("Aparece un banner para deshacer el borrado", t.includes("Se ha eliminado la sesión"));
  await clickByText(page, "Deshacer");
  await page.waitForFunction(
    () => document.body.innerText.includes("200 puntadas · 60 min") && !document.querySelector(".undo-banner"),
    { timeout: 8000 }
  );
  check("Deshacer devuelve la sesión y su progreso", (await text(page)).includes("200 / 3025"));

  // 8. Sustituir un color importado por un hilo de la biblioteca
  await clickByText(page, "Inicio");
  await page.waitForFunction(() => document.body.innerText.includes("Flor de lis"), { timeout: 8000 });
  const opened = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".mini, .hero-card")].find((m) => m.textContent.includes("Flor de lis"));
    if (!el) return false;
    el.click();
    return true;
  });
  check("Se puede abrir el proyecto importado desde los minis", opened);
  await page.waitForSelector(".project-head");
  await page.waitForFunction(() => document.body.innerText.includes("Flor de lis"), { timeout: 8000 });
  await page.evaluate(() => {
    const sel = document.querySelector(".thread-swap select");
    const other = [...sel.options].find((o) => Number(o.value) !== Number(sel.value));
    sel.value = other.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.body.innerText.includes("el patrón sugería"), { timeout: 8000 });
  t = await text(page);
  check("Al cambiar el hilo se conserva la sugerencia del patrón", t.includes("el patrón sugería “Rojo” · DMC 03"));
  check("El progreso del color se mantiene tras el cambio", t.includes("0 / 4"));

  // 8b. A1: marcar terminado y sección "Terminados"
  await clickByText(page, "Inicio");
  await page.waitForFunction(() => document.body.innerText.includes("Olivia Rodrigo"), { timeout: 8000 });
  await page.evaluate(() => {
    const el = [...document.querySelectorAll(".mini, .hero-card")].find((m) => m.textContent.includes("Olivia Rodrigo"));
    el.click();
  });
  await page.waitForSelector(".project-head");
  await clickByText(page, "Marcar terminado");
  await page.waitForFunction(() => document.body.innerText.includes("Reabrir"), { timeout: 8000 });
  check("Al terminar el proyecto, el botón permite reabrirlo", (await text(page)).includes("Reabrir"));
  await clickByText(page, "Inicio");
  await page.waitForFunction(() => document.body.innerText.includes("Terminados"), { timeout: 8000 });
  t = await text(page);
  check("Los terminados aparecen en su propia sección", t.includes("Terminados") && t.includes("Olivia Rodrigo"));
  check("El hero pasa a ser el proyecto activo restante", await page.evaluate(() => document.querySelector(".hero-card").textContent.includes("Flor de lis")));

  // 8c. A3: eliminar un proyecto y deshacerlo
  await page.evaluate(() => document.querySelector(".hero-card").click());
  await page.waitForSelector(".project-head");
  await clickByText(page, "Eliminar proyecto");
  await page.waitForFunction(() => document.querySelector(".undo-banner"), { timeout: 8000 });
  await page.waitForFunction(
    () => ![...document.querySelectorAll(".mini, .hero-card")].some((m) => m.textContent.includes("Flor de lis")),
    { timeout: 8000 }
  );
  check("El proyecto borrado desaparece de Inicio", (await text(page)).includes("Se ha eliminado el proyecto"));
  await clickByText(page, "Deshacer");
  await page.waitForFunction(() => document.body.innerText.includes("Flor de lis"), { timeout: 8000 });
  check("Deshacer devuelve el proyecto a Inicio", (await text(page)).includes("Flor de lis"));

  // 7. Offline: el service worker debe servir la app sin red
  await page.goto(URL, { waitUntil: "networkidle0" }); // deja los assets en caché
  await page.setOfflineMode(true);
  try {
    await page.goto(URL, { waitUntil: "networkidle0", timeout: 15000 });
  } catch {
    /* la navegación puede fallar; comprobamos el DOM igualmente */
  }
  t = await page.evaluate(() => document.body.innerText);
  check("Funciona offline (PWA + IndexedDB)", t.includes("Olivia Rodrigo"));
  await page.setOfflineMode(false);

  await browser.close();
  if (fails.length) {
    console.log(`\n${fails.length} comprobaciones fallidas`);
    process.exit(1);
  }
  console.log("\nPrueba de humo superada");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
