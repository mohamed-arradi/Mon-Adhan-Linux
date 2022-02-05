const ipcRenderer = require('electron').ipcRenderer;

function updateCity(city) {
    ipcRenderer.send('app:update-city', city)
}