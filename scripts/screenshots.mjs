// Capturas de validação visual (docs/validacao-visual.md).
// Sobe o Vite, abre cada vista num Chrome headless e salva PNGs em shots/.
// Uso: npm run shots            (todas)
//      npm run shots -- loop    (só as que contêm "loop" no nome)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SHOTS = [
  ['ui-baloes', '/ui.html?show=bubbles'],
  ['ui-dilema', '/ui.html?show=dilemma'],
  ['ui-radio', '/ui.html?show=radio'],
  ['ui-balanco', '/ui.html?show=report'],
  ['cidade-visao-geral', '/?cam=overview&t=12'],
  ['cidade-canal-travessias', '/?cam=canal&t=12'],
  ['cidade-canal-sul', '/?cam=canal2&t=12'],
  ['cidade-ilha-orla-bolha', '/?cam=ilha&t=12'],
  ['cidade-loop-aereo', '/?cam=loop&t=12.4'],
  ['cidade-praca-bowl', '/?cam=bowl&t=12'],
  ['cidade-rua-de-perto', '/?cam=street&t=12'],
  ['cidade-torres-aero', '/?cam=towers&t=12'],
  ['cidade-espiral', '/?cam=spiral&t=12'],
  ['cidade-megapipe', '/?cam=megapipe&t=12'],
  ['cidade-parque-aero', '/?cam=parque&t=12'],
  ['cidade-distrito-eolico', '/?cam=eolico&t=12'],
  ['cidade-marcos', '/?cam=marcos&t=12'],
  ['cidade-overlay-trafego', '/?cam=overview&t=12&overlay=traffic'],
  ['cidade-overlay-acessibilidade', '/?cam=overview&t=12&overlay=access'],
  ['cidade-sem-ps1', '/?cam=canal&t=12&ps1=0'],
  ['lab-veiculos', '/lab.html?tab=veiculos&t=1.2'],
  ['lab-predios', '/lab.html?tab=predios&t=1.2'],
  ['lab-radicais', '/lab.html?tab=radicais&t=1.2'],
  ['lab-radicais-angulo2', '/lab.html?tab=radicais&t=3.4&res=720'],
  ['lab-props', '/lab.html?tab=props&t=1.2'],
  ['lab-marcos', '/lab.html?tab=marcos&t=1.2'],
  ['lab-silhuetas', '/lab.html?tab=silhuetas&t=0'],
  ['lab-atlas', '/lab.html?tab=atlas'],
  ['lab-paleta', '/lab.html?tab=paleta&t=0'],
  ['lab-paleta-multidao', '/lab.html?tab=paleta&t=0&scroll=end'],
];

const filter = process.argv[2];
const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });

for (const [name, path] of SHOTS) {
  if (filter && !name.includes(filter)) continue;
  await page.goto(base + path);
  await page.waitForFunction(() => window.__ready === true || document.querySelector('.atlas') || (location.pathname.endsWith('ui.html') && document.querySelector('.gel')), null, { timeout: 60000 });
  if (path.includes('scroll=end')) await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  const fullPage = !path.includes('scroll=end') && (path.includes('tab=paleta') || path.includes('tab=atlas'));
  await page.screenshot({ path: `shots/${name}.png`, fullPage });
  console.log(`✓ shots/${name}.png`);
}

await browser.close();
await server.close();
if (errors.length) {
  console.error('\nErros no console:\n' + errors.join('\n'));
  process.exit(1);
}
