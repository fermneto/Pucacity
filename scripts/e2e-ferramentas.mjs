// Teste ponta a ponta das ferramentas do jogador na vitrine (Faixas, Velocidade, Travessia, Semáforo, Linha, Desfazer/Refazer).
// Uso: npm run e2e:ferramentas [pasta-de-saida]   (falha se houver erro de console ou se uma ferramenta não aplicar)
/* global __puca */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots/e2e';
mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 5188 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()); });
await p.goto(base + '/?cam=canal&agents=300');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const S = () => p.evaluate(() => ({ money: __puca.stack.money, undo: __puca.stack.canUndo, lines: __puca.stack.lines.length }));
const log = (...a) => console.log(...a);
log('inicio', await S());
// 1) Faixas: via 0, +1 rápida
await p.click('[data-tool="lanes"]');
await p.evaluate(() => __puca.tools.pick({ edge: 0 }));
await p.click('[data-lane="fast"][data-d="1"]');
log('preview faixas:', await p.textContent('[data-preview]'));
await p.screenshot({ path: OUT + '/1-faixas-painel.png' });
await p.click('[data-apply]');
log('após faixas', await S(), 'fast=', await p.evaluate(() => __puca.city.edges[0].lanes.fast));
// 2) Velocidade
await p.click('[data-tool="speed"]');
await p.evaluate(() => __puca.tools.pick({ edge: 1 }));
await p.$eval('[data-range]', (r) => { r.value = '35'; r.dispatchEvent(new Event('input')); });
await p.click('[data-apply]');
log('após velocidade', await S(), 'speed=', await p.evaluate(() => __puca.city.edges[1].speed));
// 3) Travessia: a sem acesso ganha elevador
const cid = await p.evaluate(() => __puca.city.crossings.find((c) => !c.access)?.id);
await p.click('[data-tool="crossing"]');
await p.evaluate((id) => __puca.tools.pick({ crossing: id }), cid);
await p.click('[data-acc="bubble_lift"]');
log('preview travessia:', await p.textContent('[data-preview]'));
await p.screenshot({ path: OUT + '/2-travessia-painel.png' });
await p.click('[data-apply]');
log('após travessia', await S(), 'access=', await p.evaluate((id) => __puca.city.crossings.find((c) => c.id === id).access, cid));
// 4) Semáforo num nó sem semáforo
const nid = await p.evaluate(() => __puca.city.nodes.find((n) => !n.signal)?.id);
await p.click('[data-tool="signal"]');
await p.evaluate((id) => __puca.tools.pick({ node: id }), nid);
await p.click('[data-sig="add"]');
await p.click('[data-apply]');
log('após semáforo', await S(), 'signal=', await p.evaluate((id) => !!__puca.city.nodes.find((n) => n.id === id).signal, nid));
// 5) Linha de tuk-tuk com 3 paradas
await p.click('[data-tool="line"]');
const ids = await p.evaluate(() => __puca.city.nodes.slice(0, 3).map((n) => n.id));
for (const id of ids) await p.evaluate((i) => __puca.tools.pick({ node: i }), id);
log('preview linha:', await p.textContent('[data-preview]'));
await p.click('[data-apply]');
log('após linha', await S());
await p.keyboard.press('Escape');
await p.waitForTimeout(500);
await p.screenshot({ path: OUT + '/3-cidade-apos.png' });
// 6) Desfazer 2x / Refazer 1x
await p.click('[data-undo]'); await p.click('[data-undo]');
log('após 2 undo', await S());
await p.click('[data-redo]');
log('após redo', await S());
// 7) Clique real no mapa com ferramenta ativa (pickTarget pelo raycast)
await p.click('[data-tool="lanes"]');
await p.mouse.click(640, 400);
log('painel após clique real:', (await p.textContent('.tool-panel'))?.slice(0, 80));
await p.screenshot({ path: OUT + '/4-clique-real.png' });
log('ERROS:', errs.length ? errs : 'nenhum');
const fim = await S();
await b.close(); await server.close();
if (errs.length || fim.money !== 46880) { console.error('FALHOU'); process.exit(1); }
console.log('OK: ferramentas funcionando');
