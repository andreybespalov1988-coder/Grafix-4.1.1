'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
function must(condition, message) { if (!condition) throw new Error(message); }
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'storage-manager.js'), 'utf8');
for (const name of ['renderAll', 'renderSchedule', 'saveLesson', 'importJSON', 'exportJSON', 'buildPublicEmbed', 'pdfFromEditor']) must(html.includes('function '+name), 'Missing renderer function: '+name);
for (const channel of ['load-local-data','save-local-data','save-local-data-sync','storage-diagnostics','save-text-file','open-text-file','print-to-pdf']) must(main.includes(channel), 'Missing IPC channel: '+channel);
for (const api of ['loadLocalData','saveLocalData','saveLocalDataSync','getStorageDiagnostics','saveTextFile','openTextFile','printToPDF']) must(preload.includes(api), 'Missing preload API: '+api);
must(!/TODO|FIXME|NotImplemented/.test(main+preload+storage), 'Unresolved marker in main/preload/storage');
must(/revision/.test(storage) && /writeAtomic/.test(storage), 'Storage manager missing revision/atomic write logic');
must(/contextIsolation:\s*true/.test(main) && /nodeIntegration:\s*false/.test(main), 'Unsafe BrowserWindow settings');
console.log('Smoke checks passed.');
