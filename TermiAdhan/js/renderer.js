const { Islamic, Calendar } = require('@syncfusion/ej2-calendars');
var ipcRenderer = require('electron').ipcRenderer;

const button = document.getElementById('datesListAction');

button.addEventListener('click', () => {
   ipcRenderer.send('app:get-prayers-calendar')
});

function geoCodeCurrentCity() {
  
}

function searchCity() {
  //https://api-adresse.data.gouv.fr/search/?q=toulouse
}

