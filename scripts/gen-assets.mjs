#!/usr/bin/env node
/** Reconstruye los archivos binarios de public/ desde los módulos base64.
 *  Se ejecuta automáticamente antes de `npm run dev` y `npm run build`
 *  (scripts "predev"/"prebuild"). Así el repositorio solo contiene texto.
 *  La plantilla y el icono están partidos en varios *.partNN.ts para no
 *  depender de herramientas que manejen ficheros enormes; aquí se unen.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const genDir = join(root, 'src/assets/generated');

function b64FromFile(path) {
  const src = readFileSync(path, 'utf8');
  const segs = src.match(/'([A-Za-z0-9+/=]+)'/g);
  if (!segs || segs.length === 0)
    throw new Error(`No se encontró base64 en ${path}`);
  return segs.map((s) => s.slice(1, -1)).join('');
}

/** Une todas las partes <base>.partNN.ts en orden. */
function b64FromParts(base) {
  const files = readdirSync(genDir)
    .filter((f) => f.startsWith(`${base}.part`) && f.endsWith('.ts'))
    .sort();
  if (files.length === 0) throw new Error(`No hay partes para ${base}`);
  return files.map((f) => b64FromFile(join(genDir, f))).join('');
}

const out = (rel, b64) => {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, Buffer.from(b64, 'base64'));
  console.log('generado', rel, `(${Math.round(b64.length / 1024)} KB b64)`);
};

out('public/barra-libre-template.xlsm', b64FromParts('template'));
out('public/icons/icon-192.png', b64FromParts('icon-192'));

// La app carga la plantilla como texto base64 (.b64): mismo contenido,
// pero publicable en GitHub Pages sin binarios. El .xlsm se sigue
// generando para inspección local.
const b64 = b64FromParts('template');
writeFileSync(
  join(root, 'public/barra-libre-template.b64'),
  b64 + '\n',
);
console.log('generado public/barra-libre-template.b64', `(${Math.round(b64.length / 1024)} KB b64)`);
