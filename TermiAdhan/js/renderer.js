const { Islamic, Calendar } = require('@syncfusion/ej2-calendars');
var ipcRenderer = require('electron').ipcRenderer;

const button = document.getElementById('datesListAction');
ipcRenderer.send('app:get-city-saved')

const progressDiv = '<div class="progress"><div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemin="20" aria-valuemax="100" style="width: 100%"></div></div>'
const errorDiv = '<div class="alert alert-danger" role="alert">Une erreur est survenue, veuillez réessayer.</div><button type="button" class="btn btn-info" onclick="refreshData()">Réessayer</button>'
const outsideCountryError = '<div class="alert alert-danger" role="alert">Ce logiciel ne fonctionne que pour des personnes se situant OU ayant mis une ville francaise.</div><button type="button" class="btn btn-info" onclick="editCity()">Éditer votre ville</button>'
document.getElementById('list-prayer-group').innerHTML = progressDiv
document.getElementById('datesListAction').hidden = true
document.getElementById('today_date').textContent = new Date().toLocaleDateString("fr")
ipcRenderer.send('app:get-prayer-for-date', [getTodayFormattedDate()])
ipcRenderer.send('app:get-city-saved')

button.addEventListener('click', () => {
  ipcRenderer.send('app:get-prayers-calendar')
});


function refreshData() {
  document.getElementById('datesListAction').hidden = true
  document.getElementById('list-prayer-group').innerHTML = progressDiv
  ipcRenderer.send('app:get-prayer-for-date', [getTodayFormattedDate()])
}

function editCity() {

}

ipcRenderer.on('callbackPrayerForDate', (event, prayersDictionnary) => {
  document.getElementById('datesListAction').hidden = false
  displayListPrayers(prayersDictionnary)
  ipcRenderer.send('app:get-city-saved')
})

ipcRenderer.on('geoblockEvent', (event, data) => {
  document.getElementById("header-title").textContent = ""
  document.getElementById('datesListAction').hidden = true
  document.getElementById('list-prayer-group').innerHTML = outsideCountryError

})

ipcRenderer.on('callbackCity', (event, city) => {
  console.log(city)
  if (city !== null) {
    document.getElementById("header-title").textContent = city.toUpperCase();
  } else {
    document.getElementById("header-title").textContent = "Pré-localisation en cours..."
  }
})

function getTodayFormattedDate() {
  const d = new Date()
  let ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
  let mo = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(d);
  let da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);
  return `${da}-${mo}-${ye}`
}

function displayListPrayers(prayersInfos) {
  if (prayersInfos !== null) {
    if (!prayersInfos.hasOwnProperty("error")) {
      var listGroup = document.getElementById('list-prayer-group');
      listGroup.innerHTML = ""

      for (const [key, value] of Object.entries(prayersInfos)) {
        const itemDomElem = document.createElement('li');
        itemDomElem.setAttribute('class', 'list-group-item');

        itemDomElem.innerHTML = `
          <div class="row">
              <div class="col">
              <p class="prayer-text">${key}</p>
              </div>
              <div class="col">
              <p class="prayer-time">${value}</p>
              </div>
          </div>`;

        listGroup.appendChild(itemDomElem);
      }
    } else {
      document.getElementById('list-prayer-group').innerHTML = errorDiv
    }
  } else {
    document.getElementById('list-prayer-group').innerHTML = progressDiv
  }
}
