const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');

// Sin restricción de puertos para permitir que el túnel TURN funcione libremente

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow () {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    kiosk: true, // Modo Kiosko evita que el usuario salga fácilmente
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Permitir autoplay de videos sin interacción del usuario
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  // Cargamos la aplicación conectada a la nube
  win.loadFile('app_pc_live.html');
}

// Para prevenir problemas de GPU en algunas PCs
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
// Esto permite que el autoplay funcione siempre en Chromium
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Escuchar comando de reinicio remoto
ipcMain.on('restart_app', () => {
    app.relaunch();
    app.exit();
});

// -- GESTOR DE CACHE LOCAL DE MEDIOS --
const cacheDir = path.join(app.getPath('userData'), 'media_cache');
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            // Si existe y no es 0 bytes, asumimos que está bien
            const stats = fs.statSync(dest);
            if(stats.size > 0) return resolve(dest);
        }
        const tmpDest = dest + '.tmp';
        const file = fs.createWriteStream(tmpDest);
        https.get(url, (response) => {
            if (response.statusCode === 200 || response.statusCode === 206) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(() => {
                        // Solo renombrar a final cuando realmente terminó todo
                        if(fs.existsSync(dest)) fs.unlinkSync(dest);
                        fs.renameSync(tmpDest, dest);
                        resolve(dest);
                    });
                });
            } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            } else {
                fs.unlink(tmpDest, () => reject(`HTTP ${response.statusCode}`));
            }
        }).on('error', (err) => {
            fs.unlink(tmpDest, () => reject(err.message));
        });
    });
}

ipcMain.handle('sync_media', async (event, mediaList) => {
    try {
        const keepFiles = new Set();
        const mappedList = [];
        
        for (const media of mediaList) {
            const ext = media.type.startsWith('video') ? '.mp4' : '.jpg';
            const hash = crypto.createHash('md5').update(media.url || media.id).digest('hex');
            const filename = `${hash}${ext}`;
            const dest = path.join(cacheDir, filename);
            
            keepFiles.add(filename);
            
            try {
                await downloadFile(media.url, dest);
                mappedList.push({
                    ...media,
                    url: require('url').pathToFileURL(dest).href
                });
            } catch (err) {
                console.error("Error descargando", media.url, err);
                mappedList.push(media);
            }
        }
        
        // Limpiar archivos viejos
        try {
            fs.readdirSync(cacheDir).forEach(file => {
                if (!keepFiles.has(file)) {
                    fs.unlinkSync(path.join(cacheDir, file));
                }
            });
        } catch(e) {}
        
        return mappedList;
    } catch(e) {
        console.error("Error global sync:", e);
        return mediaList;
    }
});

app.whenReady().then(() => {
    createWindow();

    // Iniciar auto-updater
    autoUpdater.checkForUpdatesAndNotify();

    // Revisar cada hora
    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify();
    }, 1000 * 60 * 60);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

autoUpdater.on('update-downloaded', () => {
    // Forzar instalación y reiniciar la app automáticamente
    autoUpdater.quitAndInstall(true, true);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
