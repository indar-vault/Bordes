// Capturas de la tercera ronda de feedback: calendario centrado y miniaturas.
// Uso: npm run shots3   (o SMOKE_URL=... SHOT_DIR=... node scripts/shot-round3.mjs)
// Datos de muestra: scripts/fixtures/heat-seed.json (dos proyectos, 18 sesiones
// repartidas por los tres últimos meses).
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";
const OUT = process.env.SHOT_DIR ?? "/tmp/opencode/bordes-shots-round3";

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const els = [...document.querySelectorAll("button, a, .linklike")];
    const el = els.find((b) => b.textContent.trim() === t) || els.find((b) => b.textContent.trim().includes(t));
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
  await page.setViewport({ width: 900, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });

  await clickByText(page, "Configuración");
  await page.waitForSelector(".import input[type=file]");
  const seed = readFileSync(resolve("scripts/fixtures/heat-seed.json"), "utf8");
  await page.evaluate((content) => {
    const input = document.querySelector(".import input[type=file]");
    const dt = new DataTransfer();
    dt.items.add(new File([content], "muestra.json", { type: "application/json" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, seed);
  await page.waitForFunction(() => document.body.innerText.includes("Copia restaurada"), { timeout: 30000 });

  await clickByText(page, "Inicio");
  await page.waitForSelector(".bordes-heat.heat-js", { timeout: 40000 });
  await new Promise((r) => setTimeout(r, 1200));

  const cal = await page.$(".calendar-card") || await page.$(".bordes-heat");
  await cal.screenshot({ path: `${OUT}/20-calendario-heat-centrado.png` });
  await page.waitForFunction(() => document.body.innerText.includes("Terminados"), { timeout: 15000 });
  const box = await page.evaluate(() => {
    const h3 = [...document.querySelectorAll("h3")].find((h) => h.textContent === "Terminados");
    const r = h3.nextElementSibling.getBoundingClientRect();
    return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 12), width: Math.min(r.width + 20, 500), height: r.height + 24 };
  });
  await page.screenshot({ path: `${OUT}/21-terminados-miniatura-centrada.png`, clip: box });
  await page.screenshot({ path: `${OUT}/22-inicio-round3.png`, fullPage: true });

  await browser.close();
  console.log("Capturas en", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
