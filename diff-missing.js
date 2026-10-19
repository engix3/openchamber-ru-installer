#!/usr/bin/env node
// Находит ключи интерфейса, которых нет в русском словаре: сравнивает английские
// словари OpenChamber (en.ts, en.settings.ts, *.i18n.ts) с ru.ts, ru.settings.ts
// и extra.json. На выходе — JSON {ключ: английский текст} для translate.js.
//
// Использование:
//   node diff-missing.js <en-messages-dir> [ru-dir] [out.json]
//
// Как получить <en-messages-dir> для нужной версии:
//   git clone --depth 1 --branch vX.Y.Z --filter=blob:none --sparse https://github.com/openchamber/openchamber.git oc-src
//   cd oc-src && git sparse-checkout set packages/ui/src/lib/i18n
//
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
if (!argv[0]) { console.error('usage: node diff-missing.js <en-messages-dir> [ru-dir] [out.json]'); process.exit(1); }
const MSG = path.resolve(argv[0]);
const RU = path.resolve(argv[1] || __dirname);
const OUT = path.resolve(argv[2] || path.join(RU, 'missing.json'));

// --- разбор TS-словарей (как в update-translation.ps1) ---
function findBlock(s, i) { // s[i] === '{' -> соответствующий '}'
  let d = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'") {
      const q = c; j++;
      while (j < s.length) { const ch = s[j]; if (ch === '\\') { j += 2; continue; } if (ch === q) break; j++; }
      continue;
    }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return { start: i, end: j }; }
  }
  return null;
}
function parseEntries(body) {
  const out = {}; let i = 0;
  while (i < body.length) {
    while (i < body.length && (body[i] === ',' || /\s/.test(body[i]))) i++;
    if (i >= body.length) break;
    if (body[i] !== "'" && body[i] !== '"') { i++; continue; } // ключ должен быть в кавычках; так пропускаются ...spread
    const q = body[i++]; let k = '';
    while (i < body.length && body[i] !== q) { if (body[i] === '\\' && i + 1 < body.length) { k += body[i + 1]; i += 2; continue; } k += body[i++]; }
    i++;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== ':') continue;
    i++;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length || (body[i] !== "'" && body[i] !== '"')) { while (i < body.length && body[i] !== ',') i++; continue; }
    const q2 = body[i++]; let v = '';
    while (i < body.length && body[i] !== q2) {
      if (body[i] === '\\' && i + 1 < body.length) {
        const nx = body[i + 1];
        v += nx === 'n' ? '\n' : nx === 'r' ? '\r' : nx === 't' ? '\t' : nx; i += 2; continue;
      }
      v += body[i++];
    }
    i++;
    out[k] = v;
  }
  return out;
}
function dictFromFile(file, markerRe) {
  const s = fs.readFileSync(file, 'utf8');
  const m = markerRe.exec(s);
  if (!m) throw new Error('marker not found in ' + file);
  const open = m.index + m[0].length - 1;
  const b = findBlock(s, open);
  if (!b) throw new Error('block not closed in ' + file);
  return parseEntries(s.slice(b.start + 1, b.end));
}

// --- английский набор (модули + en.settings.ts + en.ts) ---
const enU = {};
const modules = fs.readdirSync(MSG).filter(f => /\.i18n\.ts$/.test(f) && !/\.test\.ts$/.test(f)).sort();
for (const f of modules) {
  const s = fs.readFileSync(path.join(MSG, f), 'utf8');
  const decl = /export const \w+ = \{/.exec(s);
  if (!decl) { console.log('skip (no decl):', f); continue; }
  const enM = /\ben\s*:\s*\{/.exec(s.slice(decl.index));
  if (!enM) { console.log('skip (no en section):', f); continue; }
  const open = decl.index + enM.index + enM[0].length - 1;
  const b = findBlock(s, open);
  Object.assign(enU, parseEntries(s.slice(b.start + 1, b.end)));
}
Object.assign(enU, dictFromFile(path.join(MSG, 'en.settings.ts'), /export const settingsDict\s*=\s*\{/));
Object.assign(enU, dictFromFile(path.join(MSG, 'en.ts'), /export const dict\s*=\s*\{/));
console.log('modules:', modules.length, '| en keys:', Object.keys(enU).length);

// --- русский словарь (как в port.js) ---
const ruSettings = dictFromFile(path.join(RU, 'i18n/messages/ru.settings.ts'), /settingsDict\s*=\s*\{/);
const ruDict = dictFromFile(path.join(RU, 'i18n/messages/ru.ts'), /dict\s*=\s*\{/);
Object.assign(ruSettings, ruDict);
const extraPath = path.join(RU, 'extra.json');
if (fs.existsSync(extraPath)) Object.assign(ruSettings, JSON.parse(fs.readFileSync(extraPath, 'utf8')));
if (!ruSettings['common.language.russian']) ruSettings['common.language.russian'] = 'Русский';
console.log('ru keys:', Object.keys(ruSettings).length);

// --- дельта ---
const missing = {};
for (const k of Object.keys(enU)) if (!(k in ruSettings)) missing[k] = enU[k];
console.log('missing in ru:', Object.keys(missing).length);
fs.writeFileSync(OUT, JSON.stringify(missing, null, 1));
console.log('saved', OUT);
