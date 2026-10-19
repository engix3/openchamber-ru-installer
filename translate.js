#!/usr/bin/env node
// Пакетный перевод недостающих строк интерфейса на русский через
// OpenAI-совместимый endpoint. Результат домешивается в extra.json,
// существующие переводы не затираются.
//
// Использование:
//   node translate.js [missing.json] [extra.json]
//
// Ключ и URL берутся из переменных окружения
//   OPENCHAMBER_TRANSLATOR_KEY, OPENCHAMBER_TRANSLATOR_URL
// или из некоммитируемого файла translate.local.js:
//   module.exports = { key: '...', url: '...' };
//
const fs = require('fs'), path = require('path');

const argv = process.argv.slice(2);
const inFile = path.resolve(argv[0] || path.join(__dirname, 'missing.json'));
const outFile = path.resolve(argv[1] || path.join(__dirname, 'extra.json'));

let KEY = process.env.OPENCHAMBER_TRANSLATOR_KEY || '';
let URL = process.env.OPENCHAMBER_TRANSLATOR_URL || '';
try { const l = require('./translate.local.js'); KEY = l.key || KEY; URL = l.url || URL; } catch (e) {}
if (!KEY || !URL) {
  console.error('Нет ключа или URL. Задайте OPENCHAMBER_TRANSLATOR_KEY (и OPENCHAMBER_TRANSLATOR_URL) или создайте translate.local.js');
  process.exit(1);
}

const missing = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const keys = Object.keys(missing);
const BATCH = 60, chunks = [];
for (let i = 0; i < keys.length; i += BATCH) { const c = {}; for (const k of keys.slice(i, i + BATCH)) c[k] = missing[k]; chunks.push(c); }
const out = {};

async function tr(chunk) {
  const body = { model: process.env.OPENCHAMBER_TRANSLATOR_MODEL || 'deepseek-v4.1-flash-free', reasoning_effort: 'none', max_tokens: 8000, temperature: 0,
    messages: [
      { role: 'system', content: 'You are a professional software UI localizer (English to Russian). Translate every VALUE into concise natural Russian. Keep JSON KEYS exactly. Preserve placeholders in braces like {count}, {name}, {status}, {session}, {type}, {shortcut}, {thinking}, {query}, {message}, {taskName}, {time} unchanged. Do not translate product names (OpenChamber, OpenCode, GitHub, VS Code, MCP, Linear, ripgrep, Git). Return ONLY a valid JSON object with the same keys and Russian values, no markdown.' },
      { role: 'user', content: JSON.stringify(chunk) }] };
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      let t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      t = t.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
      const o = JSON.parse(t);
      for (const k of Object.keys(chunk)) if (typeof o[k] === 'string' && o[k].trim()) out[k] = o[k];
      return;
    } catch (e) { await new Promise(r => setTimeout(r, 2500)); }
  }
}

(async () => {
  let idx = 0;
  async function worker() { while (idx < chunks.length) { const c = chunks[idx++]; await tr(c); process.stderr.write('.'); } }
  await Promise.all(Array.from({ length: 8 }, worker));
  for (const k of keys) if (!out[k]) out[k] = missing[k]; // фолбэк на английский, если перевод не удался
  const ph = s => (s.match(/\{[A-Za-z0-9_.-]+\}/g) || []).sort().join(',');
  const bad = keys.filter(k => ph(missing[k]) !== ph(out[k]));
  let extra = {};
  if (fs.existsSync(outFile)) { try { extra = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (e) {} }
  const merged = { ...extra, ...out };
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 1));
  console.log('\nDONE translated=' + Object.keys(out).length + '/' + keys.length +
    ' placeholder-mismatch=' + bad.length +
    ' | ' + path.basename(outFile) + ': ' + Object.keys(extra).length + ' -> ' + Object.keys(merged).length);
  for (const k of bad) console.log('MISMATCH', k);
})();
