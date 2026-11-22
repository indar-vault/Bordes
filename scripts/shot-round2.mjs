// Capturas de la segunda ronda de feedback (2026-11-22).
// Uso: npm run build && vite preview --port 4173 & node scripts/shot-round2.mjs
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

// 1. Editar un hilo del proyecto: ahora con etiquetas (Bobinas, Puntadas previstas)
await clickByText(page, "Nuevo proyecto");
await page.waitForSelector("#project-name");
await page.type("#project-name", "Flor de lis");
await page.type("#project-total", "12");
await page.waitForSelector(".color-total");
await page.type(".color-total", "9");
await clickByText(page, "Crear proyecto");
await page.waitForSelector(".project-head");
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "editar hilo"), { timeout: 10000 });
await clickByText(page, "editar hilo");
await page.waitForSelector(".thread-edit-form .tf");
await page.screenshot({ path: `${OUT}/14-hilo-con-etiquetas.png`, fullPage: true });

// 2. Sesión con foto, y lightbox al hacer clic en ella
await page.evaluate(() => {
  const num = document.querySelector(".quick-rows input[type=number]");
  num.select();
  num.focus();
});
await page.keyboard.type("8");
await clickByText(page, "Guardar sesión rápida");
await page.waitForFunction(() => document.body.innerText.includes("8 / 12"), { timeout: 8000 });
await page.waitForFunction(() => [...document.querySelectorAll("p button.linklike")].some((b) => b.textContent.trim() === "editar"), { timeout: 8000 });
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("p button.linklike")].find((b) => b.textContent.trim() === "editar");
  btn.click();
});
await page.waitForSelector(".session-edit");
await page.evaluate(async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = "#8b3f51";
  for (let y = 0; y < 480; y += 40) for (let x = 0; x < 640; x += 40) ctx.fillRect(x + 8, y + 8, 24, 24);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const input = document.querySelector(".session-photo-input");
  const dt = new DataTransfer();
  dt.items.add(new File([blob], "progreso.png", { type: "image/png" }));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForFunction(() => document.querySelectorAll(".session-edit .session-photos img").length === 1, { timeout: 10000 });
await clickByText(page, "Guardar cambios");
await page.waitForFunction(() => !document.querySelector(".session-edit") && document.querySelector(".log .session-photos img"), { timeout: 10000 });
const opened = await page.evaluate(() => {
  const img = document.querySelector(".log .session-photos img");
  if (!img) return "gone";
  img.click();
  return "ok";
});
console.log("state:", opened, "log:", await page.evaluate(() => document.querySelector(".log")?.textContent.slice(0, 200)));
await page.waitForSelector(".lightbox img");
await page.screenshot({ path: `${OUT}/15-lightbox-foto.png` });
await page.click(".lightbox-x");

// 3. Terminados: miniatura con la foto de la sesión (sin nombre de archivo)
await clickByText(page, "Marcar terminado");
await clickByText(page, "Inicio");
await page.waitForFunction(() => document.querySelector(".minis .mini-thumb img"), { timeout: 8000 });
await page.screenshot({ path: `${OUT}/16-terminados-miniatura.png`, fullPage: true });

// 4. Alta de proyecto: tabla de colores sin solapes en ventana estrecha
await page.setViewport({ width: 760, height: 720 });
await clickByText(page, "Nuevo proyecto");
await page.waitForSelector("#project-name");
await page.type("#project-name", "Muestrario");
await page.type("#project-total", "100");
await page.waitForSelector(".color-total");
await page.type(".color-total", "60");
await clickByText(page, "Añadir color");
await page.waitForFunction(() => document.querySelectorAll(".colors tbody tr").length === 2, { timeout: 8000 });
await page.screenshot({ path: `${OUT}/17-alta-estrecha.png`, fullPage: true });

await browser.close();
console.log("Capturas en", OUT);
