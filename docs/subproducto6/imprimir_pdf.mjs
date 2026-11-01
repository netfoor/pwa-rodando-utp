// Imprime el HTML del reporte a PDF tamaño carta/A4 con número de página (APA 7).
// uso: node imprimir_pdf.mjs _build/aportacion.html Aportacion_Rodando_UTP_Live.pdf
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , entrada, salida] = process.argv;
const htmlFile = resolve(entrada);
const pdfFile = resolve(salida);
const PORT = 9338;
const perfil = mkdtempSync(join(tmpdir(), "pdf-"));
const chrome = spawn("google-chrome", [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--hide-scrollbars",
  "--allow-file-access-from-files", "--force-color-profile=srgb",
  `--user-data-dir=${perfil}`, `--remote-debugging-port=${PORT}`, "about:blank",
], { stdio: "ignore" });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let wsUrl;
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) { wsUrl = (await r.json()).webSocketDebuggerUrl; break; }
    } catch {}
    await dormir(200);
  }
  if (!wsUrl) throw new Error("Chrome no abrió el puerto de depuración");

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pend = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const i = ++id;
      pend.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
      ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);

  await S("Page.enable");
  await S("Emulation.setEmulatedMedia", { media: "print" });
  await S("Page.navigate", { url: pathToFileURL(htmlFile).href });
  await dormir(1200);

  for (let i = 0; i < 40; i++) {
    const { result } = await S("Runtime.evaluate", {
      expression: `(async () => {
        await document.fonts.ready;
        const imgs = [...document.images];
        await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
        return imgs.every(i => i.complete) && document.fonts.status === "loaded";
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.value === true) break;
    await dormir(300);
  }

  const { data } = await S("Page.printToPDF", {
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 1,
    marginBottom: 1,
    marginLeft: 1,
    marginRight: 1,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate:
      '<div style="width:100%;font-family:\'Times New Roman\',serif;font-size:12pt;text-align:right;padding-right:0.15in;"><span class="pageNumber"></span></div>',
    footerTemplate: '<div style="width:100%;"></div>',
    preferCSSPageSize: false,
  });
  writeFileSync(pdfFile, Buffer.from(data, "base64"));
  console.log("PDF:", pdfFile, existsSync(pdfFile) ? "ok" : "error");
  ws.close();
  chrome.kill();
  setTimeout(() => rmSync(perfil, { recursive: true, force: true }), 500);
}

main().catch((e) => { console.error("ERROR:", e.message); chrome.kill(); process.exit(1); });
