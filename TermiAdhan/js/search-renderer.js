const ipcRenderer = require('electron').ipcRenderer;

function updateCity(city) {
    console.log(city)
    ipcRenderer.send('app:update-city', city)
}