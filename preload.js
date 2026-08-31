const { contextBridge, ipcRenderer } = require('electron')

// Expose une API restreinte au renderer (frontend web) au lieu de
// donner un accès Node.js complet, pour rester sécurisé.

contextBridge.exposeInMainWorld('ongFinancePro', {
  platform: process.platform,
  isDesktop: true,
})

// Couche offline : accès à la base SQLite locale via better-sqlite3,
// exposée uniquement à travers ces appels IPC contrôlés (aucun accès
// direct au module 'fs' ou 'better-sqlite3' n'est donné au renderer).
contextBridge.exposeInMainWorld('localDb', {
  settings: {
    getAll: () => ipcRenderer.invoke('db:getAllSettings'),
    get: (key) => ipcRenderer.invoke('db:getSetting', key),
    set: (key, value) => ipcRenderer.invoke('db:setSetting', key, value),
  },
  expenses: {
    list: (filters) => ipcRenderer.invoke('db:listExpenses', filters),
    create: (expense) => ipcRenderer.invoke('db:createExpense', expense),
    update: (id, patch) => ipcRenderer.invoke('db:updateExpense', id, patch),
  },
  revenues: {
    list: (filters) => ipcRenderer.invoke('db:listRevenues', filters),
    create: (revenue) => ipcRenderer.invoke('db:createRevenue', revenue),
  },
  sync: {
    getQueueStatus: () => ipcRenderer.invoke('db:getSyncQueueStatus'),
    listPending: (limit) => ipcRenderer.invoke('db:listPendingSyncItems', limit),
  },
})
