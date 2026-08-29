const { app, BrowserWindow, dialog } = require('electron')
const { join } = require('path')

const { initDatabase, closeDatabase } = require('./src/database')
const { registerDbHandlers } = require('./src/ipcHandlers')
const { autoUpdater } = require('electron-updater')

const isDev = !app.isPackaged

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,

    icon: join(
      __dirname,
      'build',
      'icon.png'
    ),

    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    // En développement :
    // chargement du frontend Web distant.
    mainWindow.loadURL(
      'https://finance-pro-ruby.vercel.app'
    )
  } else {
    // En production :
    // chargement du frontend Web embarqué
    // dans resources/frontend-web/dist.
    const indexPath = join(
      process.resourcesPath,
      'frontend-web',
      'dist',
      'index.html'
    )

    mainWindow.loadFile(indexPath)
  }


  mainWindow.on('closed', () => {
    mainWindow = null
  })


  return mainWindow
}


/**
 * Configuration de la mise à jour automatique.
 *
 * R2 est utilisé comme serveur de publication.
 * electron-updater utilise les fichiers latest.yml
 * et latest-linux.yml générés par electron-builder.
 */
function setupAutoUpdater() {

  // Ne télécharge pas automatiquement.
  // L'utilisateur sera informé lorsqu'une mise à jour
  // est disponible.
  autoUpdater.autoDownload = false

  // Installation silencieuse après téléchargement.
  autoUpdater.autoInstallOnAppQuit = true

  /**
   * Nouvelle version disponible
   */
  autoUpdater.on(
    'update-available',
    async (info) => {

      console.log(
        'Mise à jour disponible :',
        info.version
      )


      if (!mainWindow) {
        return
      }


      const result = await dialog.showMessageBox(
        mainWindow,
        {
          type: 'info',

          title: 'Mise à jour disponible',

          message:
            `Une nouvelle version de Finance Pro (${info.version}) est disponible.`,

          detail:
            'Voulez-vous télécharger cette mise à jour maintenant ?',

          buttons: [
            'Télécharger',
            'Plus tard'
          ],

          defaultId: 0,

          cancelId: 1,
        }
      )

      if (result.response === 0) {

        try {

          await autoUpdater.downloadUpdate()

        } catch (error) {

          console.error(
            'Erreur lors du téléchargement de la mise à jour :',
            error
          )

          dialog.showErrorBox(
            'Erreur de mise à jour',
            'Impossible de télécharger la nouvelle version.'
          )

        }

      }

    }
  )
  /**
   * Mise à jour téléchargée
   */
  autoUpdater.on(
    'update-downloaded',
    async (info) => {

      console.log(
        'Mise à jour téléchargée :',
        info.version
      )


      if (!mainWindow) {
        return
      }


      const result = await dialog.showMessageBox(
        mainWindow,
        {
          type: 'info',

          title: 'Mise à jour prête',

          message:
            `Finance Pro ${info.version} est prêt à être installé.`,

          detail:
            'L\'application doit redémarrer pour terminer la mise à jour.',

          buttons: [
            'Redémarrer maintenant',
            'Plus tard'
          ],

          defaultId: 0,

          cancelId: 1,
        }
      )


      if (result.response === 0) {

        autoUpdater.quitAndInstall(
          false,
          true
        )

      }

    }
  )
  /**
   * Erreur de mise à jour
   */
  autoUpdater.on(
    'error',
    (error) => {

      console.error(
        'Erreur AutoUpdater :',
        error
      )

    }
  )


  /**
   * Vérification de la disponibilité d'une mise à jour.
   */
  try {

    autoUpdater.checkForUpdates()

  } catch (error) {

    console.error(
      'Impossible de vérifier les mises à jour :',
      error
    )

  }
}
/**
 * Démarrage de l'application
 */
app.whenReady().then(() => {

  try {
    // Initialisation SQLite
    initDatabase(
      app.getPath('userData')
    )
    // Enregistrement des handlers IPC
    registerDbHandlers()


    // Création de la fenêtre
    createWindow()


    // Mise à jour uniquement en production
    if (!isDev) {

      setupAutoUpdater()

    }

  } catch (error) {

    console.error(
      'Erreur lors du démarrage de Finance Pro :',
      error
    )

    dialog.showErrorBox(
      'Erreur au démarrage',
      'Finance Pro n’a pas pu démarrer correctement.'
    )

    app.quit()

  }
  /**
   * macOS :
   * recréer la fenêtre lorsque l'application
   * est activée.
   */
  app.on(
    'activate',
    () => {

      if (
        BrowserWindow
          .getAllWindows()
          .length === 0
      ) {

        createWindow()

      }

    }
  )

})

/**
 * Fermeture des fenêtres.
 */
app.on(
  'window-all-closed',
  () => {

    if (
      process.platform !== 'darwin'
    ) {

      app.quit()

    }

  }
)
/**
 * Fermeture propre de SQLite.
 */
app.on(
  'before-quit',
  () => {

    try {

      closeDatabase()

    } catch (error) {

      console.error(
        'Erreur lors de la fermeture de SQLite :',
        error
      )

    }

  }
)