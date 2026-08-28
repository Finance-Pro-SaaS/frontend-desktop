import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './src/database'
import { registerDbHandlers } from './src/ipcHandlers'

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: join(__dirname, 'build/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    // En développement : pointe vers le serveur Vite.
    win.loadURL('https://finance-pro-ruby.vercel.app')
  } else {
    // En production : le build web est copié dans resources/frontend-web/dist
    // par electron-builder via extraResources.
    const indexPath = join(
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
