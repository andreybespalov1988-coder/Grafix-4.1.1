const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dteDesktop', {
  getInfo: () => ipcRenderer.invoke('app-info'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  getDataPaths: () => ipcRenderer.invoke('data-paths'),
  getStorageDiagnostics: () => ipcRenderer.invoke('storage-diagnostics'),
  loadLocalData: () => ipcRenderer.invoke('load-local-data'),
  saveLocalData: (payload) => ipcRenderer.invoke('save-local-data', payload),
  saveLocalDataSync: (payload) => ipcRenderer.sendSync('save-local-data-sync', payload),
  saveTextFile: (payload) => ipcRenderer.invoke('save-text-file', payload),
  saveBinaryFile: (payload) => ipcRenderer.invoke('save-binary-file', payload),
  acceptanceBackup: (payload) => ipcRenderer.invoke('acceptance-backup', payload),
  acceptanceRestore: (payload) => ipcRenderer.invoke('acceptance-restore', payload),
  acceptanceReadText: (payload) => ipcRenderer.invoke('acceptance-read-text', payload),
  acceptanceWriteText: (payload) => ipcRenderer.invoke('acceptance-write-text', payload),
  acceptanceWriteBinary: (payload) => ipcRenderer.invoke('acceptance-write-binary', payload),
  acceptancePrintPdf: (payload) => ipcRenderer.invoke('acceptance-print-pdf', payload),
  openTextFile: (payload) => ipcRenderer.invoke('open-text-file', payload),
  printToPDF: () => ipcRenderer.invoke('print-to-pdf'),
  solverValidate: (payload) => ipcRenderer.invoke('solver-validate', payload),
  solverSolve: (payload) => ipcRenderer.invoke('solver-solve', payload),
  solverAlternatives: (payload) => ipcRenderer.invoke('solver-alternatives', payload),
  solverDiagnose: (payload) => ipcRenderer.invoke('solver-diagnose', payload),
  solverCancel: (requestId) => ipcRenderer.send('solver-cancel', requestId),
  aiStatus: () => ipcRenderer.invoke('ai-status'),
  aiAsk: (payload) => ipcRenderer.invoke('ai-ask', payload)
});
