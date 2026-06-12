const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');

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

// --- OPTIMIZACIONES PARA MINI PCs (SIN GPU DEDICADA) ---
// Evitar que el scroll o animaciones saturen el procesador
app.commandLine.appendSwitch('disable-smooth-scrolling');
// Mejorar el rendimiento de la composición de capas (overlay)
app.commandLine.appendSwitch('enable-hardware-overlays');
// Deshabilitar características pesadas de Chromium que no usamos
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// Forzar el uso de la GPU integrada para todo
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// Activar decodificación de HEVC (H.265) por hardware si el sistema lo soporta
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');

// Esto permite que el autoplay funcione siempre en Chromium
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Escuchar comando de reinicio remoto
ipcMain.on('restart_app', () => {
    app.relaunch();
    app.exit();
});

// Escuchar comando para abrir/cerrar prompter remoto
ipcMain.on('control-prompter', (event, action) => {
    if (action === 'start') {
        exec('start "" "%USERPROFILE%\\Desktop\\prompter.lnk" || start "" "%PUBLIC%\\Desktop\\prompter.lnk"', (err) => {
            if(err) console.error("Error abriendo prompter:", err);
        });
    } else if (action === 'stop') {
        exec('taskkill /IM msedge.exe /F', (err) => {
            if(err) console.error("Error cerrando msedge:", err);
        });
    }
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

const downloadingFiles = new Map(); // Para rastrear descargas en progreso

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
                if (!fs.existsSync(dest)) {
                    // Evitar descargas duplicadas si ya se está descargando
                    if (downloadingFiles.has(filename)) {
                        console.log(`Ya se está descargando: ${filename}, esperando...`);
                        await downloadingFiles.get(filename);
                    } else {
                        console.log(`Descargando a caché: ${filename}`);
                        const downloadPromise = downloadFile(media.url, dest);
                        downloadingFiles.set(filename, downloadPromise);
                        await downloadPromise;
                        downloadingFiles.delete(filename);
                    }
                }
                
                // Solo si el archivo existe físicamente lo agregamos a la lista
                if (fs.existsSync(dest)) {
                    mappedList.push({
                        ...media,
                        url: require('url').pathToFileURL(dest).href
                    });
                }
            } catch (err) {
                console.error("Error descargando", media.url, err);
                downloadingFiles.delete(filename);
                // NO HAREMOS FALLBACK A LA NUBE. Si falla, no se reproduce hasta que se descargue bien en el siguiente intento.
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
        return []; // Nunca devolver mediaList de la nube
    }
});

app.whenReady().then(() => {
    // Forzar el auto-arranque con Windows
    app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath("exe")
    });
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
