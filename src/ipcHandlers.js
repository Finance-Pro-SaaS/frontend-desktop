const { ipcMain } = require('electron')
const db = require('./database')

/**
 * Enregistre tous les canaux IPC 'db:*' exposés au renderer via preload.js.
 * À appeler une seule fois, après initDatabase() et avant createWindow().
 */
function registerDbHandlers() {
  ipcMain.handle('db:getAllSettings', () => db.getAllSettings())
  ipcMain.handle('db:getSetting', (_event, key) => db.getSetting(key))
  ipcMain.handle('db:setSetting', (_event, key, value) => db.setSetting(key, value))

  ipcMain.handle('db:listExpenses', (_event, filters) => db.listExpenses(filters))
  ipcMain.handle('db:createExpense', (_event, expense) => db.createExpense(expense))
  ipcMain.handle('db:updateExpense', (_event, id, patch) => db.updateExpense(id, patch))

  ipcMain.handle('db:listRevenues', (_event, filters) => db.listRevenues(filters))
  ipcMain.handle('db:createRevenue', (_event, revenue) => db.createRevenue(revenue))

  ipcMain.handle('db:getSyncQueueStatus', () => db.getSyncQueueStatus())
  ipcMain.handle('db:listPendingSyncItems', (_event, limit) => db.listPendingSyncItems(limit))
}

module.exports = { registerDbHandlers }
