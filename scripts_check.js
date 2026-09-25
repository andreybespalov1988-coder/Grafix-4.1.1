'use strict';
const fs = require('fs');
const { execFileSync } = require('child_process');
const root = __dirname;
const files = ['main.js', 'preload.js', 'storage-manager.js', 'ai-service.js', 'ai-ui.js', 'persistence_storage_test.js', 'persistence_restart_test.js', 'persistence_restart_worker.js'];
for (const file of files) execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
const html = fs.readFileSync(require('path').join(root, 'index.html'), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error('Renderer script not found');
const temp = require('path').join(root, '.renderer-check.js');
fs.writeFileSync(temp, match[1]);
try { execFileSync(process.execPath, ['--check', temp], { cwd: root, stdio: 'inherit' }); }
finally { fs.rmSync('.renderer-check.js', { force: true }); }
if (!/saveLocalData: \(payload\) => ipcRenderer\.invoke\('save-local-data', payload\)/.test(fs.readFileSync(require('path').join(root,'preload.js'),'utf8'))) throw new Error('Async save IPC payload contract is not direct.');
if (!/saveLocalDataSync: \(payload\) => ipcRenderer\.sendSync\('save-local-data-sync', payload\)/.test(fs.readFileSync(require('path').join(root,'preload.js'),'utf8'))) throw new Error('Sync save IPC payload contract is not direct.');
console.log('Syntax checks passed.');
