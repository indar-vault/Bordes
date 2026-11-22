// Capturas de las pantallas nuevas de la v2, para el feedback.
// Uso: npm run build && npx vite preview --port 4173 &
//      SMOKE_URL=http://localhost:4173/ SHOT_DIR=... node scripts/shot-v2.mjs
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";
const OUT = process.env.SHOT_DIR ?? "/tmp/opencode/bordes-shots-v2";

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

  // 1. Alta manual con autocompletado DMC (C1)
  await clickByText(page, "Nuevo proyecto");
  await page.waitForSelector("#project-name");
  await page.type("#project-name", "Olivia Rodrigo");
  await page.type("#project-total", "3025");
  await page.type(".color-total", "2615");
  const dmcEl = await page.$(".color-dmc");
  await dmcEl.evaluate((e) => e.select());
  await dmcEl.focus();
  await page.keyboard.press("Backspace");
  await page.waitForFunction(() => document.querySelector(".color-dmc").value === "");
  const nameEl = await page.$(".color-name");
  await nameEl.evaluate((e) => e.select());
  await nameEl.focus();
  await page.keyboard.press("Backspace");
  await page.type(".color-dmc", "415");
  await page.screenshot({ path: `${OUT}/01-alta-dmc.png`, fullPage: true });
  await clickByText(page, "Crear proyecto");
  await page.waitForSelector(".project-head");

  // 2. Sesión completa con media y bobina
  await clickByText(page, "Empezar sesión");
  await page.waitForSelector(".counter-row");
  await page.waitForSelector('.timer input[type="number"]');
  await page.type('.timer input[type="number"]', "45");
  await page.type(".counter-row input[type=number]", "150");
  await page.select(".media select", "serie");
  await page.waitForSelector('.media input[type="text"]');
  await page.type('.media input[type="text"]', "Friends");
  await page.type('.media input[type="number"]', "2");
  await page.waitForSelector(".spool-used input[type=checkbox]");
  await page.evaluate(() => document.querySelector(".spool-used input[type=checkbox]").click());
  await clickByText(page, "Guardar sesión");
  await page.waitForSelector(".project-head");

  // 3. Sesión rápida (B1)
  await page.waitForSelector(".quick-session");
  await page.type(".quick-minutes", "10");
  await page.waitForSelector(".quick-stitches");
  await page.type(".quick-stitches", "25");
  await page.evaluate(() => document.querySelector(".quick-spool input").click());
  await page.screenshot({ path: `${OUT}/02-sesion-rapida.png`, fullPage: true });
  await clickByText(page, "Guardar sesión rápida");
  await page.waitForFunction(() => document.body.innerText.includes("175 / 3025"), { timeout: 8000 });

  // 4. Editar la primera sesión: foto (B3) y apunte (B4)
  await clickByText(page, "editar");
  await page.waitForSelector(".session-edit");
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4c2c2";
    ctx.fillRect(0, 0, 400, 400);
    ctx.fillStyle = "#333";
    for (let y = 0; y < 400; y += 20) for (let x = 0; x < 400; x += 20) ctx.fillRect(x, y, 12, 12);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const input = document.querySelector(".session-photo-input");
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "progreso.png", { type: "image/png" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll(".session-edit .session-photos img").length === 1, { timeout: 10000 });
  await page.type(".session-notes", "cambio de hilo a mitad");
  await clickByText(page, "Guardar cambios");
  await page.waitForFunction(() => document.querySelector(".log .session-photos img"), { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/03-proyecto-log.png`, fullPage: true });

  // 5. Deshacer (A3)
  await clickByText(page, "borrar");
  await page.waitForSelector(".undo-banner");
  await page.screenshot({ path: `${OUT}/04-deshacer.png`, fullPage: true });
  await clickByText(page, "Deshacer");
  await page.waitForFunction(() => document.body.innerText.includes("175 / 3025"), { timeout: 8000 });

  // 5b. Marcar Olivia como terminado (A1: sección Terminados)
  await clickByText(page, "Marcar terminado");
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Reabrir")), { timeout: 8000 });

  // 6. Resumen imprimible + CSV (A2)
  await clickByText(page, "Ver resumen");
  await page.waitForSelector(".print-btn");
  await page.screenshot({ path: `${OUT}/05-resumen.png`, fullPage: true });

  // 7. Terminado + Inicio con heatmap, búsqueda y recordatorio (A1, B2, C2)
  await clickByText(page, "Inicio");
  await page.waitForSelector(".widgets");
  await page.waitForSelector(".freeze-select");
  await page.select(".freeze-select", "1");
  await page.evaluate(() => document.querySelector("#project-search").value);
  await page.screenshot({ path: `${OUT}/06-inicio.png`, fullPage: true });

  await browser.close();
  console.log("Capturas en", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
