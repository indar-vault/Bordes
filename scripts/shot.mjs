// Capturas de pantalla de la app para revisar la estética.
// Uso: SMOKE_URL=http://localhost:4173/ node scripts/shot.mjs
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";
const OUT = process.env.SHOT_DIR ?? "/tmp/opencode/bordes-shots";

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().includes(t));
    if (el) el.click();
  }, text);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  await page.goto(URL, { waitUntil: "networkidle0" });

  await clickByText(page, "Nuevo proyecto");
  await page.waitForSelector("#project-name");
  await page.type("#project-name", "Olivia Rodrigo");
  await page.type("#project-total", "3025");
  await page.type(".color-total", "2615");
  await clickByText(page, "+ Añadir color");
  await page.waitForSelector(".colors tbody tr:last-child .color-name");
  await page.type(".colors tbody tr:last-child .color-name", "Shell Pink");
  await page.type(".colors tbody tr:last-child .color-dmc", "224");
  await page.type(".colors tbody tr:last-child .color-total", "145");
  await clickByText(page, "Crear proyecto");
  await page.waitForSelector(".project-head");
  await page.screenshot({ path: `${OUT}/proyecto-vacio.png`, fullPage: true });

  // Dos sesiones para ver el progreso
  const add = async (values, withMedia = false) => {
    await clickByText(page, "Empezar sesión");
    await page.waitForSelector(".counter-row");
    await page.waitForSelector('.timer input[type="number"]');
    await page.type('.timer input[type="number"]', "45");
    for (let i = 0; i < values.length; i++) {
      await page.waitForSelector(`.counter-row:nth-child(${i + 2}) input[type=number]`);
      await page.type(`.counter-row:nth-child(${i + 2}) input[type=number]`, String(values[i]));
    }
    if (withMedia) {
      await page.select(".media select", "serie");
      await page.waitForSelector('.media input[type="text"]');
      await page.type('.media input[type="text"]', "Friends");
      await page.type('.media input[type="number"]', "2");
    }
    await clickByText(page, "Guardar sesión");
    await page.waitForSelector(".project-head");
  };
  await add([1200], true);
  await add([500, 145]);
  await page.screenshot({ path: `${OUT}/proyecto.png`, fullPage: true });

  await clickByText(page, "Inicio");
  await page.waitForSelector(".widgets");
  await page.screenshot({ path: `${OUT}/home.png`, fullPage: true });

  await browser.close();
  console.log("Capturas en", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
