#!/usr/bin/env node
// Apply the v25 visuals over the local Word v24 package without replacing its
// sky, fauna, streaming, hydrology or main renderer implementation wholesale.
// Runs from the extracted Word project root with Node 20+.
// Creates a dated backup BEFORE any local file is replaced.
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { cwd } from 'node:process';

const root = cwd();
const revision = '2778521fc8b3ab1f29f13de241356e2790c1183d';
const base = 'https://raw.githubusercontent.com/Julioall/game/' + revision + '/';
const files = new Map();

async function exists(path) {
  try { await access(join(root, path)); return true; } catch { return false; }
}
async function local(path) { return await readFile(join(root, path), 'utf8'); }
async function remote(path) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(path + ': GitHub HTTP ' + response.status);
  return response.text();
}
function patch(path, text) { files.set(path, text); }
function replace(text, before, after, path) {
  if (text.includes(after)) return text; // Allow rerunning the installer.
  if (!text.includes(before)) throw new Error('Versão incompatível: ' + path + ' não contém o trecho esperado: ' + before.slice(0, 65));
  return text.replace(before, after);
}
function rx(text, regex, after, path) {
  if (!regex.test(text)) throw new Error('Versão incompatível: trecho não localizado em ' + path + ': ' + regex);
  return text.replace(regex, after);
}

if (!(await exists('src/main.js')) || !(await exists('src/render/view.js')))
  throw new Error('Execute este arquivo dentro da pasta Word extraída do ZIP v24.');
if (!(await exists('docs/ceu-v24.md')))
  throw new Error('Este aplicador requer Word-ceu-v24.zip. Não use na branch do PR #3.');

const uploaded = await Promise.all([
  'src/render/pixel-style.js', 'src/render/pixel-art.js',
  'test/pixel-art-style.test.js', 'docs/pixel-art-visual-v25.md'
].map(async path => [path, await remote(path)]));
for (const [path, content] of uploaded) patch(path, content);

const viewPath = 'src/render/view.js';
let view = await local(viewPath);
view = replace(view,
  "import { renderResolution } from './resolution.js';",
  "import { renderResolution } from './resolution.js';\nimport { pixelArtResolution, overviewFogFar, PIXEL_ART_MODES } from './pixel-style.js';",
  viewPath);
view = replace(view,
  '    this.pixelArt = new PixelArtPass();',
  "    this.pixelArt = new PixelArtPass();\n    this.pixelArtMode = 'pixel';",
  viewPath);
if (!view.includes("this.pixelArtMode === 'off'")) {
  view = rx(view,
    /const target = renderResolution\(this\.world\.config\.detail,\s*this\.focus\.span,\s*width,\s*height,\s*Boolean\(this\.firstPerson\),\s*this\.gpuBudget\.cap\);/,
    "const target = this.pixelArtMode === 'off'\n      ? renderResolution(this.world.config.detail, this.focus.span, width, height, Boolean(this.firstPerson), this.gpuBudget.cap)\n      : pixelArtResolution(width, height, this.pixelArtMode);",
    viewPath);
}
if (!view.includes('  setPixelArtMode(mode) {')) {
  view = replace(view, '  showTraveler(actor) {',
    "  setPixelArtMode(mode) {\n" +
    "    if (!Object.hasOwn(PIXEL_ART_MODES, mode) || this.pixelArtMode === mode) return;\n" +
    "    this.pixelArtMode = mode;\n" +
    "    this.pixelArt.setStyle(mode);\n" +
    "    this.updateResolution();\n" +
    "  }\n\n  showTraveler(actor) {", viewPath);
}
if (!view.includes('overviewFogFar(250, 403, .3)')) {
  view = replace(view,
    '  updateCamera() {\n    this.updateResolution();',
    "  updateCamera() {\n    this.updateResolution();\n" +
    "    // Overview retains 30% fog; first-person stays unchanged.\n" +
    "    if (this.scene.fog?.isFog) {\n" +
    "      this.scene.fog.near = 250;\n" +
    "      this.scene.fog.far = this.firstPerson ? 403 : overviewFogFar(250, 403, .3);\n" +
    "    }",
    viewPath);
}
if (!view.includes("if (this.pixelArtMode === 'off') this.renderer.render")) {
  view = replace(view,
    '    this.pixelArt.render(this.renderer, this.scene, this.camera);',
    "    if (this.pixelArtMode === 'off') this.renderer.render(this.scene, this.camera);\n" +
    "    else this.pixelArt.render(this.renderer, this.scene, this.camera);",
    viewPath);
}
if (!view.includes('pixelArtMode: this.pixelArtMode')) {
  view = replace(view,
    'pixelScale: this.pixelScale,',
    'pixelScale: this.pixelScale, pixelArtMode: this.pixelArtMode,',
    viewPath);
}
patch(viewPath, view);

const mainPath = 'src/main.js';
let main = await local(mainPath);
if (!main.includes("view.setPixelArtMode?.(document.getElementById('pixel-art-style')")) {
  main = rx(main, /(view = new WorldView\([^\n]*\);\n)/,
    "$1      view.setPixelArtMode?.(document.getElementById('pixel-art-style')?.value ?? 'pixel');\n",
    mainPath);
}
if (!main.includes("$('pixel-art-style').onchange")) {
  main = rx(main, /(\$\('layer'\)\.onchange[^\n]*\n)/,
    "$1$('pixel-art-style').onchange = event => view?.setPixelArtMode(event.target.value);\n",
    mainPath);
}
patch(mainPath, main);

const indexPath = 'index.html';
let html = await local(indexPath);
if (!html.includes('id="pixel-art-style"')) {
  html = rx(html, /(<label>Camada do mapa\s*<select id="layer">[\s\S]*?<\/select>\s*<\/label>)/,
    '$1\n      <label>Efeito visual\n        <select id="pixel-art-style" aria-label="Intensidade do Pixel Art">\n' +
    '          <option value="off">Sem filtro</option>\n' +
    '          <option value="pixel" selected>Pixel Art</option>\n' +
    '          <option value="retro">Pixel Art forte</option>\n' +
    '        </select>\n      </label>', indexPath);
}
patch(indexPath, html);

const vegetationPath = 'src/world/vegetation.js';
let vegetation = await local(vegetationPath);
if (!vegetation.includes('export const GRASS_DENSITY')) {
  vegetation = replace(vegetation,
    'const pitch = 3.35;',
    'const pitch = 3.35;\n\n' +
    '// Stable 70% reduction during generation, independent of camera and chunks.\n' +
    'export const GRASS_DENSITY = 0.3;\n' +
    'export function keepGrass(seed, px, pz, stream) {\n' +
    '  return hash(seed, px, pz, stream) < GRASS_DENSITY;\n' +
    '}', vegetationPath);
  vegetation = replace(vegetation,
    '      for (let plant = 0; plant < 30; plant++) {',
    '      for (let plant = 0; plant < 30; plant++) {\n' +
    '        if (!keepGrass(config.seed, px, pz, 3071 + plant)) continue;',
    vegetationPath);
  const entry = "    objects.push({ id: 'p:' + px + ':' + pz, kind, biome: type, x, z, y: gridSample(ground, stride, x, z),\n" +
    '      scale: .55 + hash(config.seed, px, pz, 44) * .72,\n' +
    '      variant: Math.floor(hash(config.seed, px, pz, 45) * 5), rotation: h * 87 });';
  vegetation = replace(vegetation, entry,
    "    if (kind !== 'grass' || keepGrass(config.seed, px, pz, 3041)) {\n" + entry + '\n    }',
    vegetationPath);
  vegetation = replace(vegetation,
    '      for (let tuft = 1; tuft < plants; tuft++) {',
    '      for (let tuft = 1; tuft < plants; tuft++) {\n' +
    '        if (!keepGrass(config.seed, px, pz, 3072 + tuft)) continue;',
    vegetationPath);
}
patch(vegetationPath, vegetation);

// At this point all replacements and network reads have succeeded.
// Backups are created before writing any output files.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = '.pixel-v25-backup-' + stamp;
for (const path of files.keys()) {
  if (await exists(path)) {
    const destination = join(root, backup, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(root, path), destination);
  }
}
for (const [path, content] of files) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content, 'utf8');
}
console.log('Pixel Art v25 aplicado sobre o projeto local. Modificados: ' + files.size + ' arquivos.');
console.log('Backup: ' + backup);
console.log('Próximos comandos: npm test && npm run build && npm run dev');
