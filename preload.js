const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    restartApp: () => ipcRenderer.send('restart_app'),
    syncMedia: (mediaList) => ipcRenderer.invoke('sync_media', mediaList),
    controlPrompter: (action) => ipcRenderer.send('control-prompter', action)
});
