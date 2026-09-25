const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { TextDecoder } = require('util');
const path = require('path');
const fs = require('fs');
const { STORAGE_VERSION, createStorageManager } = require('./storage-manager');
const { SolverAdapter } = require('./solver-adapter');
const AIService = require('./ai-service');

const PRODUCT_NAME = 'Графикс';
const LEGACY_USER_DATA_DIR = 'Schedule Studio';
const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;

// Prevent two desktop instances from writing the same schedule database concurrently.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const existing = BrowserWindow.getAllWindows()[0];
    if (!existing) return;
    if (existing.isMinimized()) existing.restore();
    existing.focus();
  });
}

// Let Windows/Electron apply the native display scale. Forcing scale factor 1
// breaks 125%/150%/200% DPI layouts and makes the application harder to use
// on high-density Windows displays.

// Keep the desktop app predictable on Windows: all renderer errors are surfaced in the dev log.
process.on('uncaughtException', (error) => console.error('[Графикс] uncaughtException:', error));
process.on('unhandledRejection', (error) => console.error('[Графикс] unhandledRejection:', error));

if (process.env.GRAFIX_UI_ACCEPTANCE_DATA || process.env.RITM_USER_DATA || process.env.SCHEDULE_STUDIO_USER_DATA) {
  app.setPath('userData', process.env.GRAFIX_UI_ACCEPTANCE_DATA || process.env.RITM_USER_DATA || process.env.SCHEDULE_STUDIO_USER_DATA);
} else {
  // Keep the historical data directory stable during the brand migration so existing
  // user data and Chromium localStorage remain available after upgrading to Графикс.
  app.setPath('userData', path.join(app.getPath('appData'), LEGACY_USER_DATA_DIR));
}
app.setName(PRODUCT_NAME);
if (process.platform === 'win32') app.setAppUserModelId('ru.grafiks.schedule');

function dataFilePath() { return path.join(app.getPath('userData'), 'schedule-studio-data.json'); }
function backupFilePath() { return path.join(app.getPath('userData'), 'schedule-studio-data.backup.json'); }
function legacyDataFilePath() { return path.join(app.getPath('userData'), 'dte-data.json'); }
function legacyBackupFilePath() { return path.join(app.getPath('userData'), 'dte-data.backup.json'); }
function ensureDataDir() { fs.mkdirSync(app.getPath('userData'), { recursive: true }); }
function safeText(value) { return typeof value === 'string' ? value : String(value ?? ''); }

const solverAdapter = new SolverAdapter();
const aiService = new AIService();
const aiStartupStatus = aiService.initialize();

let storage = null;
function getStorage() {
  if (!storage) {
    storage = createStorageManager({
      userDataPath: app.getPath('userData'),
      fileName: 'schedule-studio-data.json',
      backupFileName: 'schedule-studio-data.backup.json'
    });
    // Establish the revision floor immediately. This is important after a process restart.
    try { storage.load(); } catch (error) { console.error('[Графикс] Storage initialization failed:', error); }
  }
  return storage;
}

function loadLegacyIfNeeded() {
  const manager = getStorage();
  const current = manager.load();
  if (current.ok && current.data) return current;

  const legacyCandidates = [legacyDataFilePath(), legacyBackupFilePath()];
  for (const file of legacyCandidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const migrated = manager.persist({
        version: STORAGE_VERSION,
        revision: 1,
        savedAt: new Date().toISOString(),
        activeBranchId: parsed?.branches?.[0]?.id || 0,
        data: parsed
      });
      if (migrated.ok) return manager.load();
    } catch (error) {
      console.error('[Графикс] Legacy migration failed:', error);
    }
  }
  return current;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    show: false,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: '#f5efe6',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = `file://${path.join(__dirname, 'index.html')}`;
    if (url !== allowed) event.preventDefault();
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setZoomFactor(1);
  win.once('ready-to-show', () => win.show());
  return win;
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  console.log(`[Grafix] AI service initialized: ${aiStartupStatus.state}; model=${aiStartupStatus.model}`);
  const defaultSession = require('electron').session.defaultSession;
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  ipcMain.handle('app-info', () => ({
    version: app.getVersion(),
    dataPath: app.getPath('userData'),
    platform: process.platform
  }));

  ipcMain.handle('open-data-folder', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('data-paths', () => getStorage().paths);

  ipcMain.handle('load-local-data', () => {
    try {
      const result = loadLegacyIfNeeded();
      if (!result.ok) return result;
      return result;
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.on('save-local-data-sync', (event, payload = {}) => {
    try {
      const result = getStorage().persist(payload);
      event.returnValue = result;
    } catch (error) {
      console.error('[Графикс] Final synchronous save failed:', error);
      event.returnValue = { ok: false, error: error.message };
    }
  });

  ipcMain.handle('save-local-data', (_event, payload = {}) => {
    try {
      return getStorage().persist(payload);
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('ai-status', () => aiService.status());

  ipcMain.handle('ai-ask', async (_event, payload = {}) => {
    try {
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      return await aiService.ask(messages, { timeoutMs: payload.timeoutMs });
    } catch (error) {
      console.error('[Grafix] AI request failed:', error);
      return { ok: false, code: 'AI_INTERNAL_ERROR', message: 'AI временно недоступен.' };
    }
  });

  ipcMain.handle('solver-validate', (_event, payload = {}) => {
    return solverAdapter.validate(payload.db || {}, payload.options || {});
  });

  ipcMain.handle('solver-solve', async (_event, payload = {}) => {
    return solverAdapter.solveAsync(payload.db || {}, payload.options || {});
  });

  ipcMain.handle('solver-alternatives', async (_event, payload = {}) => {
    return solverAdapter.generateAlternatives(payload.db || {}, payload.options || {});
  });

  ipcMain.handle('solver-diagnose', async (_event, payload = {}) => {
    return solverAdapter.diagnose(payload.db || {}, payload.options || {});
  });

  ipcMain.on('solver-cancel', (_event, requestId) => {
    if (typeof requestId === 'string' && requestId) solverAdapter.cancel(requestId);
  });

  if (process.env.GRAFIX_UI_ACCEPTANCE === '1') {
    ipcMain.handle('acceptance-backup', (_event, payload = {}) => {
      try {
        const source = getStorage().paths.file;
        const target = path.resolve(String(payload.target || path.join(app.getPath('userData'), 'grafix-acceptance-backup.json')));
        const base = path.resolve(app.getPath('userData'));
        if (!(target === base || target.startsWith(base + path.sep))) throw new Error('Недопустимый путь резервной копии.');
        ensureDataDir();
        fs.copyFileSync(source, target);
        return { ok: true, path: target, bytes: fs.statSync(target).size };
      } catch (error) { return { ok: false, error: error.message }; }
    });
    ipcMain.handle('acceptance-restore', (_event, payload = {}) => {
      try {
        const source = path.resolve(String(payload.source || path.join(app.getPath('userData'), 'grafix-acceptance-backup.json')));
        const target = getStorage().paths.file;
        const base = path.resolve(app.getPath('userData'));
        if (!(source === base || source.startsWith(base + path.sep))) throw new Error('Недопустимый путь восстановления.');
        const stat = fs.statSync(source);
        if (!stat.isFile() || stat.size > MAX_IMPORT_FILE_BYTES) throw new Error('Резервная копия недействительна или слишком большая.');
        const parsed = JSON.parse(fs.readFileSync(source, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || !parsed.data || !Array.isArray(parsed.data.branches)) throw new Error('Некорректная структура резервной копии.');
        fs.copyFileSync(source, target);
        fs.copyFileSync(source, getStorage().paths.backup);
        return { ok: true, path: target };
      } catch (error) { return { ok: false, error: error.message }; }
    });
    ipcMain.handle('acceptance-read-text', (_event, payload = {}) => {
      try {
        const source = path.resolve(String(payload.source || ''));
        const base = path.resolve(app.getPath('userData'));
        if (!(source === base || source.startsWith(base + path.sep))) throw new Error('Недопустимый путь чтения.');
        const stat = fs.statSync(source);
        if (!stat.isFile() || stat.size > MAX_IMPORT_FILE_BYTES) throw new Error('Файл недействителен или слишком большой.');
        return { ok: true, data: fs.readFileSync(source, 'utf8'), path: source };
      } catch (error) { return { ok: false, error: error.message }; }
    });
    ipcMain.handle('acceptance-write-text', (_event, payload = {}) => {
      try {
        const target = path.resolve(String(payload.target || ''));
        const base = path.resolve(app.getPath('userData'));
        if (!(target === base || target.startsWith(base + path.sep))) throw new Error('Недопустимый путь записи.');
        const data = safeText(payload.data);
        if (Buffer.byteLength(data, 'utf8') > MAX_IMPORT_FILE_BYTES) throw new Error('Файл слишком большой.');
        fs.writeFileSync(target, data, 'utf8');
        return { ok: true, path: target, bytes: Buffer.byteLength(data, 'utf8') };
      } catch (error) { return { ok: false, error: error.message }; }
    });
    ipcMain.handle('acceptance-write-binary', (_event, payload = {}) => {
      try {
        const target = path.resolve(String(payload.target || ''));
        const base = path.resolve(app.getPath('userData'));
        if (!(target === base || target.startsWith(base + path.sep))) throw new Error('Недопустимый путь записи.');
        const data = Buffer.from(String(payload.data || ''), 'base64');
        if (data.length > MAX_IMPORT_FILE_BYTES) throw new Error('Файл слишком большой.');
        fs.writeFileSync(target, data);
        return { ok: true, path: target, bytes: data.length };
      } catch (error) { return { ok: false, error: error.message }; }
    });
    ipcMain.handle('acceptance-print-pdf', async (event, payload = {}) => {
      try {
        const target = path.resolve(String(payload.target || ''));
        const base = path.resolve(app.getPath('userData'));
        if (!(target === base || target.startsWith(base + path.sep))) throw new Error('Недопустимый путь PDF.');
        const sender = event.sender;
        const pdf = await sender.printToPDF({ landscape:true, printBackground:true, pageSize:'A4', margins:{marginType:'custom',top:0,bottom:0,left:0,right:0} });
        fs.writeFileSync(target, pdf);
        return { ok: true, path: target, bytes: pdf.length };
      } catch (error) { return { ok: false, error: error.message }; }
    });

  }

  ipcMain.handle('storage-diagnostics', () => {
    try { return { ok: true, diagnostics: getStorage().diagnostics() }; }
    catch (error) { return { ok: false, error: error.message }; }
  });

  // Native save dialog for reliable Windows file export.
  ipcMain.handle('save-text-file', async (event, payload = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      title: payload.title || 'Сохранить файл',
      defaultPath: payload.defaultPath || 'grafiks-export.txt',
      filters: payload.filters || [{ name: 'Текстовый файл', extensions: ['txt'] }]
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    try {
      fs.writeFileSync(result.filePath, safeText(payload.data), { encoding: payload.encoding || 'utf8' });
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('save-binary-file', async (event, payload = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, { title: payload.title || 'Сохранить файл', defaultPath: payload.defaultPath || 'grafiks-export.bin', filters: payload.filters || [{ name: 'Файл', extensions: ['bin'] }] });
    if (result.canceled || !result.filePath) return { cancelled: true };
    try {
      const data = Buffer.from(String(payload.data || ''), 'base64');
      if (data.length > MAX_IMPORT_FILE_BYTES) return { ok:false, error:'Файл экспорта слишком большой.' };
      fs.writeFileSync(result.filePath, data);
      return { ok:true, path:result.filePath };
    } catch (error) { return { ok:false, error:error.message }; }
  });

  // Native open dialog for text-based aSc exports and backups.
  ipcMain.handle('open-text-file', async (event, payload = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: payload.title || 'Открыть файл',
      properties: ['openFile'],
      filters: payload.filters || [{ name: 'Файлы', extensions: ['csv', 'tsv', 'txt', 'xml', 'json'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { cancelled: true };
    try {
      const filePath = result.filePaths[0];
      const extension = path.extname(filePath).toLowerCase();
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return { ok: false, error: 'Выбранный путь не является файлом.' };
      if (stat.size > MAX_IMPORT_FILE_BYTES) return { ok: false, error: `Файл слишком большой. Максимальный размер импорта — ${Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)} МБ.` };
      const bytes = fs.readFileSync(filePath);
      const isXmlLike = extension === '.xml' || extension === '.roz';
      const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const cp1251 = new TextDecoder('windows-1251', { fatal: false }).decode(bytes);
      const looksTextual = value => {
        const head = String(value).replace(/^\uFEFF/, '').trimStart().slice(0, 500).toLowerCase();
        return head.startsWith('<?xml') || head.startsWith('<timetable') || head.startsWith('<asc') || head.startsWith('<html') || head.startsWith('<!doctype') || head.includes('<card') || head.includes('<lesson');
      };
      if (extension === '.roz' && !looksTextual(utf8) && !looksTextual(cp1251)) {
        return { ok: false, path: filePath, name: path.basename(filePath), binary: true, error: 'Файл .roz не распознан как текстовый экспорт. Если это закрытый бинарный файл aSc, сохраните его из aSc в XML/HTML/CSV и импортируйте экспорт.' };
      }
      const data = isXmlLike && looksTextual(cp1251) && !looksTextual(utf8) ? cp1251 : utf8;
      return { ok: true, path: filePath, name: path.basename(filePath), data };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('print-to-pdf', async (event, payload = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      title: String(payload.title || 'Сохранить расписание в PDF'),
      defaultPath: String(payload.defaultPath || 'grafiks.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    try {
      const data = await win.webContents.printToPDF({
        landscape: true,
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
      });
      fs.writeFileSync(result.filePath, data);
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  const win = createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  if (process.env.GRAFIX_UI_ACCEPTANCE === '1') {
    const phase = process.argv.includes('--ui-write') ? 'write' : (process.argv.includes('--ui-read') ? 'read' : '');
    const resultFile = process.env.GRAFIX_UI_ACCEPTANCE_RESULT || '';
    const finish = (value) => {
      if (resultFile) { try { fs.writeFileSync(resultFile, JSON.stringify(value, null, 2), 'utf8'); } catch (_) {} }
      setTimeout(() => app.quit(), 75);
    };
    win.webContents.once('did-finish-load', async () => {
      try {
        const result = await win.webContents.executeJavaScript(`(async()=>{
          for(let i=0;i<120 && !window.dteDataReady;i++) await new Promise(r=>setTimeout(r,50));
          if(!window.dteDataReady) throw new Error('Renderer data layer did not become ready.');
          const navLabels=[...document.querySelectorAll('#nav button')].map(x=>x.textContent.trim());
          const requiredViews=['dashboard','schedule','calendar','planner','conflicts','constraints','advisor','activities','substitutions','public','reports','people','teachers','rooms','analytics','settings'];
          const navViews=requiredViews.every(v=>document.getElementById(v));
          if(${JSON.stringify('write')}===${JSON.stringify(phase)}) {
            const acceptanceBackupPath=${JSON.stringify(path.join(process.env.GRAFIX_UI_ACCEPTANCE_DATA||app.getPath('userData'),'grafix-acceptance-backup.json'))};
            db.organization.name='Grafix 4.1 UI E2E';
            db.organization.shortName='Grafix E2E';
            const b1=100001,b2=100002,t1=100003,p1=100004,r1=100005,act=100006,res=100007,cHard=100008,cRel=100009;
            db.branches.push({id:b1,name:'UI Branch 1',address:'E2E 1'});
            db.branches.push({id:b2,name:'UI Branch 2',address:'E2E 2'});
            activeBranchId=b1;
            db.teachers.push({id:t1,branchId:b1,name:'UI Teacher',spec:'Music',subjects:['Piano'],unavailable:[]});
            db.people.push({id:p1,branchId:b1,name:'UI Group',group:'UI Group'});
            db.rooms.push({id:r1,branchId:b1,name:'UI Room',type:'Stage',capacity:30});
            const activity=ActivityModel.addActivity(db,{id:act,type:'rehearsal',title:'UI Rehearsal',branchId:b1,day:'Понедельник',time:'16:00',activeMinutes:60,setupMinutes:10,teardownMinutes:5,callMinutes:5,travelMinutes:0,teacherId:t1,groupId:p1,roomId:r1,public:true});
            ActivityModel.addResource(db,{id:res,name:'UI Shared Stage',type:'stage',capacity:100,branchId:b1,branchIds:[b1,b2],shared:true,travelMinutes:20});
            ConstraintStudio.create(db,{id:cHard,name:'UI Forbidden Slot',target:'teacher',targetId:t1,kind:'forbidden_period',hardness:'HARD',weight:100,value:{slots:[{day:'Вторник',start:'18:00',end:'19:00'}]},branchId:b1});
            ConstraintStudio.create(db,{id:cRel,name:'UI Same Room',target:'relationship',kind:'same_room',hardness:'SOFT',weight:20,value:{otherId:act.id},branchId:b1});
            window.ConstraintStudio.ensure(db);
            renderAll();
            saveWithHistory('UI Acceptance','Создан полный сценарий 4.1');
            await new Promise(r=>setTimeout(r,1100));
            const originalName=db.organization.name;
            const backup=await window.dteDesktop.acceptanceBackup({target:acceptanceBackupPath});
            window.__GRAFIX_IMPORT_SILENT__=true;
            const acceptanceRoot=${JSON.stringify(process.env.GRAFIX_UI_ACCEPTANCE_DATA||app.getPath('userData'))};
            const exportDir=acceptanceRoot;
            const rowsForExport=scoped('lessons').map(x=>({День:x.day,Время:x.time,Продолжительность:x.duration,Занятие:x.title,Группа:x.group,Педагог:x.teacher,Кабинет:x.room}));
            const xlsxBytes=SchedulingEngine.makeXlsx(rowsForExport,'Расписание');
            const csvRows=[['Дата','День','Время','Продолжительность','Занятие','Группа','Педагог','Кабинет','Филиал'],...scoped('lessons').map(x=>[x.date||'',x.day,x.time,x.duration,x.title,x.group,x.teacher,x.room,branch()?.name||''])];
            const csvSerialized='\uFEFF'+csvRows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\\r\\n');
            const htmlRows=scoped('lessons').map(x=>'<tr><td>'+esc(x.day)+'</td><td>'+esc(x.time)+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.group)+'</td><td>'+esc(x.teacher)+'</td><td>'+esc(x.room)+'</td></tr>').join('');
            const htmlSerialized='<!doctype html><html lang="ru"><meta charset="utf-8"><title>Grafix 4.1 Acceptance</title><table><tr><th>День</th><th>Время</th><th>Занятие</th><th>Группа</th><th>Педагог</th><th>Кабинет</th></tr>'+htmlRows+'</table></html>';
            const jsonSerialized=JSON.stringify({version:STORAGE_VERSION,product:'Графикс',exportedAt:new Date().toISOString(),data:db},null,2);
            const exportWrite=[];
            exportWrite.push(await window.dteDesktop.acceptanceWriteText({target:exportDir+'/acceptance-backup-export.json',data:jsonSerialized}));
            exportWrite.push(await window.dteDesktop.acceptanceWriteText({target:exportDir+'/acceptance-export.csv',data:csvSerialized}));
            exportWrite.push(await window.dteDesktop.acceptanceWriteText({target:exportDir+'/acceptance-export.html',data:htmlSerialized}));
            let bin='';for(let i=0;i<xlsxBytes.length;i+=0x8000)bin+=String.fromCharCode(...xlsxBytes.subarray(i,i+0x8000));
            exportWrite.push(await window.dteDesktop.acceptanceWriteBinary({target:exportDir+'/acceptance-export.xlsx',data:btoa(bin)}));
            const drawCanvas=()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const ctx=c.getContext('2d');ctx.fillStyle='#fffdf9';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#7b1113';ctx.font='700 32px Arial';ctx.fillText(db.organization.name+' — Grafix 4.1',40,55);let y=110;for(const x of scoped('lessons').slice(0,18)){ctx.fillStyle='#3f3430';ctx.font='18px Arial';ctx.fillText(String(x.day||'')+' '+String(x.time||'')+' · '+String(x.title||''),40,y);y+=38;}return c;};
            for(const fmt of ['png','jpg']){const blob=await new Promise(resolve=>drawCanvas().toBlob(resolve,fmt==='jpg'?'image/jpeg':'image/png',0.95));const b64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=reject;r.readAsDataURL(blob);});exportWrite.push(await window.dteDesktop.acceptanceWriteBinary({target:exportDir+'/acceptance-export.'+fmt,data:b64}));}
            exportWrite.push(await window.dteDesktop.acceptancePrintPdf({target:exportDir+'/acceptance-export.pdf'}));
            const csvFixture=exportDir+'/acceptance-import.csv';
            await window.dteDesktop.acceptanceWriteText({target:csvFixture,data:'День;Время;Занятие;Группа;Педагог;Кабинет\\r\\nСреда;15:00;Imported CSV;Import Group;Import Teacher;Import Room\\r\\n'});
            const csvIncoming=await window.dteDesktop.acceptanceReadText({source:csvFixture});
            if(!csvIncoming?.ok) throw new Error('CSV fixture read failed.');
            processAScText(csvIncoming.data,'acceptance.csv');
            const htmlFixture=exportDir+'/acceptance-import.html';
            await window.dteDesktop.acceptanceWriteText({target:htmlFixture,data:'<table><tr><th>Время</th><th>Понедельник</th></tr><tr><td>15:30</td><td>Imported HTML;HTML Teacher;HTML Group;HTML Room</td></tr></table>'});
            const htmlIncoming=await window.dteDesktop.acceptanceReadText({source:htmlFixture});
            if(!htmlIncoming?.ok) throw new Error('HTML fixture read failed.');
            processAScText(htmlIncoming.data,'acceptance.html');
            const xmlFixture=exportDir+'/acceptance-import.xml';
            await window.dteDesktop.acceptanceWriteText({target:xmlFixture,data:'<?xml version="1.0"?><timetable><period period="1" starttime="16:00" endtime="17:00" name="1"/><subject id="1" name="Imported XML"/><teacher id="1" name="XML Teacher"/><classroom id="1" name="XML Room"/><group id="1" name="XML Group"/><lesson id="1" subjectid="1" teacherids="1" groupids="1"/><card lessonid="1" period="1" days="100000" classroomids="1"/></timetable>'});
            const xmlIncoming=await window.dteDesktop.acceptanceReadText({source:xmlFixture});
            if(!xmlIncoming?.ok) throw new Error('XML fixture read failed.');
            processAScText(xmlIncoming.data,'acceptance.xml');
            const xlsxImportRows=[{День:'Четверг',Время:'17:00',Продолжительность:60,Занятие:'Imported XLSX',Группа:'XLSX Group',Педагог:'XLSX Teacher',Кабинет:'XLSX Room'}];
            const xlsxImportBytes=SchedulingEngine.makeXlsx(xlsxImportRows,'Импорт');
            const xlsxFile=new File([xlsxImportBytes],'acceptance.xlsx');
            pendingXlsxRows=(await SchedulingEngine.readXLSX(xlsxFile))[0].rows;
            const xlsxKeys=['day','time','duration','title','group','teacher','room'];
            xlsxKeys.forEach((k,i)=>{const el=document.createElement('select');el.id='xlsx_'+k;const op=document.createElement('option');op.value=String(i);el.appendChild(op);document.body.appendChild(el);});
            applyXlsxImport(); xlsxKeys.forEach(k=>document.getElementById('xlsx_'+k)?.remove());
            const importedCount=Math.max(0,db.lessons.length-1);
            const lesson=db.lessons[0]||null;
            let history={tested:false,undo:false,redo:false};
            if(lesson){const before=lesson.time||'16:00'; const changed=before==='17:00'?'18:00':'17:00'; lesson.time=changed; saveWithHistory('UI Acceptance','Проверка undo/redo'); history.tested=true; undoAction(); history.undo=((db.lessons[0]||{}).time===before); redoAction(); history.redo=((db.lessons[0]||{}).time===changed);}
            db.organization.name='Grafix 4.1 UI E2E MUTATED'; saveWithHistory('UI Acceptance','Проверка backup/restore');
            await new Promise(r=>setTimeout(r,1100));
            const restored=await window.dteDesktop.acceptanceRestore({source:acceptanceBackupPath});
            const reload=restored?.ok ? await window.dteDesktop.loadLocalData() : null;
            if(!reload?.ok||!reload.data) throw new Error('Backup restore did not return a valid data envelope.');
            const restoredName=reload.data.data?.organization?.name||'';
            if(restoredName!==originalName) throw new Error('Backup restore returned unexpected organization state.');
            db=normalize(reload.data.data); activeBranchId=Number(reload.data.activeBranchId)||db.branches[0]?.id||0; dteSaveRevision=Math.max(dteSaveRevision,Number(reload.data.revision)||0); renderAll();
            return {phase:'write',ok:true,version:window.dteDesktop?.getInfo?((await window.dteDesktop.getInfo()).version):'',summary:{navViews,navCount:navLabels.length,backup:!!backup?.ok,restore:!!restored?.ok,history,exports:exportWrite.every(x=>x?.ok),importedCount,exportFiles:['acceptance-backup-export.json','acceptance-export.csv','acceptance-export.html','acceptance-export.xlsx','acceptance-export.png','acceptance-export.jpg','acceptance-export.pdf']},data:{organization:db.organization,branches:db.branches,teachers:db.teachers,people:db.people,rooms:db.rooms,lessons:db.lessons,activities:db.activities,resources:db.resources,constraints:db.constraints,substitutions:db.substitutions}};
          }
          showView('constraints');
          await new Promise(r=>setTimeout(r,50));
          const constraintStudio=Boolean(document.querySelector('#constraints h1') && document.querySelector('#constraintStudioRoot'));
          showView('advisor');
          await new Promise(r=>setTimeout(r,50));
          const advisor=Boolean(document.querySelector('#advisor h1') && document.querySelector('#advisorRoot'));
          showView('activities');
          await new Promise(r=>setTimeout(r,50));
          const activities=Boolean(document.querySelector('#activities h1') && document.querySelector('#activitiesRoot'));
          showView('substitutions');
          await new Promise(r=>setTimeout(r,50));
          const substitutions=Boolean(document.querySelector('#substitutions h1') && document.querySelector('#substitutionsRoot'));
          const info=await window.dteDesktop.getInfo();
          return {phase:'read',ok:true,version:info.version,summary:{navViews,navCount:navLabels.length},ui:{constraintStudio,advisor,activities,substitutions},data:{organization:db.organization,branches:db.branches,teachers:db.teachers,people:db.people,rooms:db.rooms,lessons:db.lessons,activities:db.activities,resources:db.resources,constraints:db.constraints,substitutions:db.substitutions}};
        })()`);
        finish(result);
      } catch (error) { finish({ok:false,error:error.message,stack:error.stack}); }
    });
  }

  if (process.env.SCHEDULE_STUDIO_E2E === '1') {
    const phase = process.argv.includes('--persist-write') ? 'write' : (process.argv.includes('--persist-read') ? 'read' : '');
    const expectedFile = process.env.SCHEDULE_STUDIO_E2E_RESULT || '';
    const finish = (value) => {
      if (expectedFile) { try { fs.writeFileSync(expectedFile, JSON.stringify(value, null, 2), 'utf8'); } catch (_) {} }
      setTimeout(() => app.quit(), 50);
    };
    win.webContents.once('did-finish-load', async () => {
      try {
        if (phase === 'write') {
          await win.webContents.executeJavaScript(`(async()=>{
            for(let i=0;i<50 && !window.dteDataReady;i++) await new Promise(r=>setTimeout(r,50));
            db.organization.name='E2E Organization 2026';
            db.organization.address='E2E Address';
            const bid=987654;
            db.branches.push({id:bid,name:'E2E Branch',address:'E2E Branch Address'});
            activeBranchId=bid;
            db.teachers.push({id:987655,branchId:bid,name:'E2E Teacher',spec:'Test'});
            db.rooms.push({id:987656,branchId:bid,name:'E2E Room',type:'Test',capacity:1});
            db.people.push({id:987657,branchId:bid,name:'E2E Group',group:'E2E'});
            db.lessons.push({id:987658,branchId:bid,title:'E2E Lesson',day:'Понедельник',time:'10:00',duration:60,group:'E2E Group',teacher:'E2E Teacher',room:'E2E Room'});
            save();
            await new Promise(r=>setTimeout(r,900));
            persistBeforeClose();
            return {ok:true};
          })()`);
          finish({ok:true,phase:'write'});
        } else if (phase === 'read') {
          const result = await win.webContents.executeJavaScript(`({organization:db.organization,branches:db.branches,activeBranchId,teachers:db.teachers,rooms:db.rooms,people:db.people,lessons:db.lessons})`);
          finish({ok:true,phase:'read',data:result});
        } else {
          finish({ok:false,error:'Unknown persistence E2E phase'});
        }
      } catch (error) { finish({ok:false,error:error.message}); }
    });
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
