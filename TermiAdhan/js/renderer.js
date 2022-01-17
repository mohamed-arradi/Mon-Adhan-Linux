var ipcRenderer = require('electron').ipcRenderer;

const button = document.getElementById('datesListAction');

const progressDiv = '<div class="text-center" style="margin-top: 10px"><div class="spinner-border" style="width: 3rem; height: 3rem;" role="status"><span class="sr-only">Récupération de données...</span></div></div>'
const errorDiv = '<div class="alert alert-danger" role="alert">Une erreur est survenue, veuillez réessayer.</div><button type="button" class="btn btn-info" onclick="refreshData()">Réessayer</button>'
const outsideCountryError = '<div class="alert alert-danger" role="alert">Ce logiciel ne fonctionne que pour des personnes se situant OU ayant renseigné  une ville francaise.</div><button type="button" class="btn btn-info" onclick="editCity()">Éditer votre ville</button>'

refreshData()

document.addEventListener('askResults', function (to_find) {
  let sb = document.getElementsByTagName('advanced-searchbar')[0]
  sb.data = [{ "id": "toto", "text": "this is toto and he is funny", "pill": "toto_pill" }, { "id": "tata", "text": "this is tata and she is funny too toto ", "pill": "tata_pill" }, { "id": "titi", "text": "this is titi and he is yellow toto", "pill": "titi_pill" }];
})

document.addEventListener('clickedOnResult', function (result) {
  window.event.stopPropagation()
  console.log(result.detail)
})

document.addEventListener('askResults', function (a) {
  console.log("index side : " + a)
})

button.addEventListener('click', () => {
  ipcRenderer.send('app:get-prayers-calendar')
});


function refreshData() {
  if (navigator.onLine) {
    document.getElementById("header-title").hidden = false
    document.getElementById('list-prayer-group').innerHTML = progressDiv
    document.getElementById('datesListAction').hidden = true
    document.getElementById('search-bar').hidden = true
    document.getElementById('today_date').textContent = getDisplayableDate()
    ipcRenderer.send('app:get-latest-available-prayer', [getTodayFormattedDate()])
  }
}

ipcRenderer.on('network_update', (event, networkAvailable) => {
  if (!networkAvailable) {
    if (document.getElementById('list-prayer-group').innerHTML.includes(progressDiv)) {
      document.getElementById('list-prayer-group').innerHTML = ""
      document.getElementById("header-title").hidden = true
      document.getElementById("datesListAction").hidden = true
      document.getElementById('search-bar').hidden = true
    } else {
      document.getElementById("datesListAction").hidden = true
      document.getElementById('search-bar').hidden = true
    }
  } else {
    ipcRenderer.send('app:get-latest-available-prayer', [getTodayFormattedDate()])
  }
})

ipcRenderer.on('callbackPrayerForToday', (event, prayersDictionnary) => {
  document.getElementById('datesListAction').hidden = false
  displayListPrayers(prayersDictionnary)
  ipcRenderer.send('app:get-city-saved')
})

ipcRenderer.on('geoblockEvent', (event, data) => {
  document.getElementById("header-title").textContent = ""
  document.getElementById('datesListAction').hidden = true
  document.getElementById('search-bar').hidden = true
  document.getElementById('list-prayer-group').innerHTML = outsideCountryError
})

ipcRenderer.on('callbackCity', (event, city) => {
  if (city !== null) {
    document.getElementById("header-title").textContent = city.toUpperCase();
  } else {
    document.getElementById("header-title").textContent = "Pré-localisation en cours..."
  }
})

function getDisplayableDate() {
  const d = new Date()
  let ye = new Intl.DateTimeFormat('fr', { year: 'numeric' }).format(d);
  let mo = new Intl.DateTimeFormat('fr', { month: 'long' }).format(d);
  let da = new Intl.DateTimeFormat('fr', { day: 'numeric' }).format(d);
  return `${da} ${mo} ${ye}`
}
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
