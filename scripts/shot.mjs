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
  await page.evaluate(() => {
    const rows = document.querySelectorAll(".colors tbody tr");
    const last = rows[rows.length - 1];
    last.querySelector(".color-name").value = "Shell Pink";
    last.querySelector(".color-total").value = "145";
  });
  await clickByText(page, "Crear proyecto");
  await page.waitForSelector(".project-head");
  await page.screenshot({ path: `${OUT}/proyecto-vacio.png`, fullPage: true });

  // Dos sesiones para ver el progreso
  const add = async (stitches) => {
    await clickByText(page, "Empezar sesión");
    await page.waitForSelector(".counter-row");
    await page.evaluate((n) => {
      document.querySelector('.timer input[type="number"]').value = String(45);
    }, stitches);
    await page.evaluate((n) => {
      document.querySelector(".counter-row input[type=number]").value = String(n);
    }, stitches);
    await clickByText(page, "Guardar sesión");
    await page.waitForSelector(".project-head");
  };
  await add(1200);
  await add(800);
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
