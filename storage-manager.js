'use strict';

const fs = require('fs');
const path = require('path');

const STORAGE_VERSION = '4.1.0';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDatabase(value) {
  return isObject(value) && Array.isArray(value.branches) && Array.isArray(value.lessons);
}

function makeEnvelope(input = {}) {
  const source = isObject(input) ? input : {};
  const candidateData = source.data;
  const data = isDatabase(candidateData) ? candidateData : (isDatabase(source) ? source : null);
  if (!data) throw new Error('Некорректная структура базы данных.');
  return {
    version: String(source.version || STORAGE_VERSION),
    revision: Math.max(0, Number(source.revision) || 0),
    savedAt: source.savedAt || new Date().toISOString(),
    activeBranchId: Number(source.activeBranchId) || Number(data.branches[0]?.id) || 0,
    data: cloneJson(data)
  };
}

function readEnvelope(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (isDatabase(parsed)) {
    return makeEnvelope({ version: STORAGE_VERSION, revision: 0, savedAt: '', activeBranchId: parsed.branches[0]?.id, data: parsed });
  }
  return makeEnvelope(parsed);
}

function fsyncFile(file) {
  const fd = fs.openSync(file, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function writeAtomic(file, content) {
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  let fd = null;
  try {
    ensureDir(path.dirname(file));
    fd = fs.openSync(temp, 'w');
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(temp, file);
    try {
      const dirFd = fs.openSync(path.dirname(file), 'r');
      try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
    } catch (_) {}
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) {} }
    if (fs.existsSync(temp)) { try { fs.rmSync(temp, { force: true }); } catch (_) {} }
  }
}

function createStorageManager({ userDataPath, fileName = 'schedule-studio-data.json', backupFileName = 'schedule-studio-data.backup.json' }) {
  ensureDir(userDataPath);
  const file = path.join(userDataPath, fileName);
  const backup = path.join(userDataPath, backupFileName);
  let currentRevision = 0;
  let lastLoadedSource = 'none';
  let lastSavedAt = '';
  let lastError = '';

  function inspectCandidate(candidatePath) {
    if (!fs.existsSync(candidatePath)) return null;
    try {
      const envelope = readEnvelope(candidatePath);
      return { envelope, path: candidatePath };
    } catch (_) {
      return null;
    }
  }

  function load() {
    ensureDir(userDataPath);
    const primary = inspectCandidate(file);
    const backupCandidate = inspectCandidate(backup);
    let selected = primary || backupCandidate;
    let source = primary ? 'primary' : (backupCandidate ? 'backup' : 'none');

    if (primary && backupCandidate && backupCandidate.envelope.revision > primary.envelope.revision) {
      selected = backupCandidate;
      source = 'backup-newer';
    }

    if (!selected) {
      currentRevision = 0;
      lastLoadedSource = 'none';
      return { ok: true, data: null, source: 'none', revision: 0, savedAt: '' };
    }

    currentRevision = Math.max(currentRevision, selected.envelope.revision);
    lastLoadedSource = source;
    lastSavedAt = selected.envelope.savedAt || '';
    lastError = '';

    if (source !== 'primary') {
      try {
        writeAtomic(file, JSON.stringify(selected.envelope, null, 2));
      } catch (error) {
        lastError = `Не удалось восстановить основной файл: ${error.message}`;
      }
    }

    return {
      ok: true,
      data: cloneJson(selected.envelope),
      source,
      recovered: source !== 'primary',
      revision: selected.envelope.revision,
      savedAt: selected.envelope.savedAt || '',
      warning: source === 'backup' || source === 'backup-newer' ? 'Основной файл данных восстановлен из резервной копии.' : ''
    };
  }

  function persist(payload = {}) {
    ensureDir(userDataPath);
    let envelope = makeEnvelope(payload);

    // The renderer supplies monotonically increasing revisions. Before writing,
    // re-read the current file so a stale in-memory revision cannot overwrite
    // a newer file, even after an Electron process restart.
    const existing = inspectCandidate(file);
    if (existing) currentRevision = Math.max(currentRevision, existing.envelope.revision);

    if (envelope.revision > 0 && envelope.revision <= currentRevision) {
      return { ok: true, skipped: true, path: file, revision: currentRevision, source: 'stale-revision' };
    }

    if (fs.existsSync(file)) {
      try { fs.copyFileSync(file, backup); } catch (error) {
        throw new Error(`Не удалось создать резервную копию: ${error.message}`);
      }
    }

    if (envelope.revision <= 0) {
      envelope.revision = currentRevision + 1;
    }
    envelope.savedAt = new Date().toISOString();

    writeAtomic(file, JSON.stringify(envelope, null, 2));
    currentRevision = envelope.revision;
    lastSavedAt = envelope.savedAt;
    lastLoadedSource = 'primary';
    lastError = '';

    return { ok: true, skipped: false, path: file, revision: currentRevision, savedAt: lastSavedAt };
  }

  function diagnostics() {
    let fileSize = 0;
    try { fileSize = fs.existsSync(file) ? fs.statSync(file).size : 0; } catch (_) {}
    return {
      file,
      backup,
      revision: currentRevision,
      lastSavedAt,
      fileSize,
      source: lastLoadedSource,
      status: lastError ? 'error' : (fs.existsSync(file) ? 'ready' : 'empty'),
      lastError
    };
  }

  return { load, persist, diagnostics, paths: { file, backup, directory: userDataPath }, readEnvelope };
}

module.exports = { STORAGE_VERSION, createStorageManager, makeEnvelope, isDatabase, readEnvelope, writeAtomic };
