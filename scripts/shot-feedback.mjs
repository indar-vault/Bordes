// Capturas de las funciones nuevas de la ronda de feedback (2026-11-22).
// Uso: npm run build && vite preview --port 4173 & node scripts/shot-feedback.mjs
import puppeteer from "puppeteer-core";

const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";
const OUT = process.env.OUT ?? "/home/indar/opencode/proyecto/bordes/log/screens-v2";

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().includes(t));
    if (el) el.click();
  }, text);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle0" });

// 1. Alta con aviso de descuadre y biblioteca en el selector de hilo
await clickByText(page, "Nuevo proyecto");
await page.waitForSelector("#project-name");
await page.type("#project-name", "Flor de lis");
await page.type("#project-total", "12");
await page.waitForSelector(".color-total");
await page.type(".color-total", "9");
await page.waitForFunction(() => document.querySelector(".mismatch"), { timeout: 8000 });
await page.waitForSelector(".color-thread");
await page.screenshot({ path: `${OUT}/09-alta-descuadre.png`, fullPage: true });
await clickByText(page, "Crear proyecto");
await page.waitForSelector(".project-head");

// 2. Apuntes inline bajo el nombre + fechas
await page.type(".project-notes", "Cambiar a hilo doble en las casillas de la flor");
await page.evaluate(() => document.querySelector(".project-notes").blur());
await page.waitForFunction(() => document.querySelector(".saved"), { timeout: 8000 });
await page.screenshot({ path: `${OUT}/10-apuntes-inline.png`, fullPage: true });

// 3. Editar un hilo del proyecto (nombre, DMC, bobinas, puntadas)
await clickByText(page, "editar hilo");
await page.waitForSelector(".thread-edit-form");
await page.screenshot({ path: `${OUT}/11-hilo-editable.png`, fullPage: true });

// 4. Congelados restantes en Inicio (descanso = 1)
await clickByText(page, "Configuración");
await page.waitForSelector(".freeze-select");
await page.select(".freeze-select", "1");
await page.waitForFunction(() => document.querySelector(".freeze-select").value === "1", { timeout: 8000 });
await clickByText(page, "Inicio");
await page.waitForSelector(".freeze-left");
await page.screenshot({ path: `${OUT}/12-inicio-congelados.png`, fullPage: true });

// 5. Biblioteca editable
await clickByText(page, "Hilos");
await page.waitForSelector(".threads .thread");
await clickByText(page, "Editar");
await page.waitForSelector(".thread-edit-form");
await page.screenshot({ path: `${OUT}/13-hilos-editar.png`, fullPage: true });

await browser.close();
console.log("Capturas guardadas en", OUT);
