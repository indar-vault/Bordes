// Prueba de humo end-to-end con Chromium real sobre la app servida.
// Uso: npm run smoke   (levanta `vite preview` y abre http://localhost:4173)
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";

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

  await page.goto(URL, { waitUntil: "networkidle0" });

  // 1. Home vacío
  check("Home muestra el estado vacío", (await text(page)).includes("Aún no hay proyectos"));

  // 2. Crear proyecto (tecleando de verdad, para que React registre los cambios)
  await clickByText(page, "Nuevo proyecto");
  await page.waitForSelector("#project-name");
  await page.type("#project-name", "Olivia Rodrigo");
  await page.type("#project-total", "3025");
  await page.type(".color-total", "2615");

  await clickByText(page, "Crear proyecto");
  await page.waitForSelector(".project-head");
  let t = await text(page);
  check("Página del proyecto muestra el nombre", t.includes("Olivia Rodrigo"));
  check("Progreso inicial 0 / 3025", t.includes("0 / 3025"));

  // 3. Sesión con puntadas y media
  await clickByText(page, "Empezar sesión");
  await page.waitForSelector(".counter-row");
  await page.type(".counter-row input[type=number]", "150");
  await page.select(".media select", "serie");
  await page.waitForSelector('.media input[type="text"]');
  await page.type('.media input[type="text"]', "Friends");
  await page.type('.media input[type="number"]', "2");

  await clickByText(page, "Guardar sesión");
  await page.waitForSelector(".project-head");
  t = await text(page);
  check("El progreso refleja la sesión (150 / 3025)", t.includes("150 / 3025"));
  check("Aparece la sesión en el registro", t.includes("150 puntadas"));
  check("Se registra la serie vista", t.includes("Friends"));

  // 4. Home: widgets
  await clickByText(page, "Inicio");
  await page.waitForSelector(".widgets");
  t = await text(page);
  check("Home muestra la racha 🔥 1", t.includes("🔥 1"));
  check("Home muestra los episodios del mes", t.includes("episodios este mes"));

  // 5. Persistencia tras recargar
  await page.reload({ waitUntil: "networkidle0" });
  t = await text(page);
  check("Los datos persisten tras recargar", t.includes("Olivia Rodrigo") && t.includes("🔥 1"));

  // 6. Offline: el service worker debe servir la app sin red
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
