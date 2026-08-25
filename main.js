const { app, BrowserWindow } = require('electron')
const path = require('path')
const { initDatabase, closeDatabase } = require('./src/database')
const { registerDbHandlers } = require('./src/ipcHandlers')

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    // En développement : pointe vers le serveur Vite.
    win.loadURL('http://localhost:5173')
  } else {
    // En production : le build web est copié dans resources/frontend-web/dist
    // par electron-builder via extraResources.
    const indexPath = path.join(
      process.resourcesPath,
      'frontend-web',
      'dist',
      'index.html',
    )

    win.loadFile(indexPath)
  }
}

app.whenReady().then(() => {
  initDatabase(app.getPath('userData'))
  registerDbHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
