// Captura de la pantalla "Nuevo proyecto" con una importación real o el fixture.
// Uso: SMOKE_URL=http://localhost:4173/Bordes/ node scripts/shot-import.mjs [archivo.fcjson]
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const URL = process.env.SMOKE_URL ?? "http://localhost:4173/";
const OUT = process.env.SHOT_DIR ?? "/tmp/opencode/bordes-shots";
const FILE = process.argv[2] ?? "scripts/fixtures/ejemplo.fcjson";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 560, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle0" });

  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().includes("Nuevo proyecto"));
    if (el) el.click();
  });
  await page.waitForSelector(".fcjson-input");

  const content = readFileSync(FILE, "utf8");
  await page.evaluate((text, name) => {
    const input = document.querySelector(".fcjson-input");
    const dt = new DataTransfer();
    dt.items.add(new File([text], name, { type: "application/json" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, content, FILE.split("/").pop());

  await page.waitForFunction(() => document.querySelector(".colors tbody tr"), { timeout: 10000 });

  const info = await page.evaluate(() => ({
    summary: document.querySelector(".import .hint")?.textContent,
    total: document.querySelector("#project-total").value,
    rows: document.querySelectorAll(".colors tbody tr").length,
    formOverflow: document.querySelector(".form").scrollWidth - document.querySelector(".form").clientWidth,
    cardWidth: Math.round(document.querySelector(".form").getBoundingClientRect().width),
    tableWidth: Math.round(document.querySelector(".colors").getBoundingClientRect().width),
    colWidths: [...document.querySelector(".colors tr").children].map((c) => Math.round(c.getBoundingClientRect().width)),
    pageOverflow: document.body.scrollWidth - document.body.clientWidth,
  }));
  console.log(info);

  await page.screenshot({ path: `${OUT}/nuevo-proyecto.png`, fullPage: true });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
