const ipcRenderer = require('electron').ipcRenderer;
var moment = require('moment-timezone');

const button = document.getElementById('datesListAction');
const progressDiv = '<div class="text-center" style="margin-top: 10px"><div class="spinner-border" style="width: 3rem; height: 3rem;" role="status"><span class="sr-only">Récupération de données...</span></div></div>'
const errorDiv = '<div class="alert alert-danger" role="alert">Une erreur est survenue, veuillez réessayer.</div><button type="button" class="btn btn-info" onclick="refreshData()">Réessayer</button>'
const outsideCountryError = '<div class="alert alert-danger" role="alert">Ce logiciel ne fonctionne que pour des personnes se situant en France ou dans les DOM-TOM. Dans l\'éventualité où vous utilisiez un VPN ou un Proxy, la localisation peut-être erronée. veuillez donc saisir manuellement votre ville</div><button type="button" class="btn btn-info" onclick="loadEditCity()">Saisir votre ville</button>'
document.getElementById("header-title").textContent = "Chargement en cours..."


var countDown = document.getElementById("clockdiv")
var countDownMessage = document.getElementById("countDownMessage")
countDown.hidden = true
countDownMessage.hidden = true
refreshData()

button.addEventListener('click', () => {
  ipcRenderer.send('app:get-prayers-calendar')
});

function refreshData() {
  if (navigator.onLine) {
    document.getElementById("header-title").hidden = false
    document.getElementById('list-prayer-group').innerHTML = progressDiv
    document.getElementById('datesListAction').hidden = true
    document.getElementById('today_date').textContent = getDisplayableDate()
    ipcRenderer.send('app:get-latest-available-prayer', [getTodayFormattedDate()])
  }
}

function setupTimer(nextPrayerInfos) {

  // nextPrayerInfos = {
  //   "test": "6:30"
  // }
  if (nextPrayerInfos !== null) {

    var value = nextPrayerInfos[Object.keys(nextPrayerInfos)[0]]
    console.log(value)
    var minutes = value.split(':')[1]
    var hour = value.split(':')[0]

    console.log(moment().tz("Europe/Paris", false).format("DD-MM-yyyy hh:mm:ss"))
    var dd = new Date()
    dd.setHours(hour);
    dd.setMinutes(minutes);

    const elapsedTime = getSecondsRemainingFrom(dd)
    const deadline = new Date(Date.parse(new Date()) + elapsedTime)
    initializeClock('clockdiv', deadline);
    console.log(elapsedTime)
    countDown.hidden = false
    countDownMessage.hidden = false
  } else {
    countDown.hidden = true
    countDownMessage.hidden = true
  }
}

function getSecondsRemainingFrom(endDate) {
  return ((endDate - new Date()) / 1000) * 1000
}

ipcRenderer.on('network_update', (event, networkAvailable) => {
  if (!networkAvailable) {
    if (document.getElementById('list-prayer-group').innerHTML.includes(progressDiv)) {
      document.getElementById('list-prayer-group').innerHTML = ""
      document.getElementById("header-title").hidden = true
      document.getElementById("datesListAction").hidden = true
    } else {
      document.getElementById("datesListAction").hidden = true
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
  document.getElementById('list-prayer-group').innerHTML = outsideCountryError
})

ipcRenderer.on('callbackCity', (event, city) => {
  if (city !== null) {
    document.getElementById("header-title").innerHTML = city.toUpperCase() + " <a class=\"btn btn-small\" id=\"editcity\" href=\"#\" onClick=\"loadEditCity()\"><i class=\"far fa-edit\"></i> Changer de ville</a>";
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
      var nextPrayer = false
      var nextPrayerInfos = null
      for (const [key, value] of Object.entries(prayersInfos)) {
        const itemDomElem = document.createElement('li');
        itemDomElem.setAttribute('class', 'list-group-item');

        var minutes = value.split(':')[1]
        var hour = value.split(':')[0]

        var cDate = new Date()
        var d = new Date()
        d.setHours(hour)
        d.setMinutes(minutes)

        var prayerTextCssClass = "prayer-text"
        if (d > cDate && nextPrayer === false) {
          nextPrayer = true
          prayerTextCssClass = "prayer-text-highlight"
          nextPrayerInfos = { key : value }
        } else {
          prayerTextCssClass = "prayer-text"
        }

        itemDomElem.innerHTML = `
          <div class="row">
              <div class="col">
              <p class="${prayerTextCssClass}">${key}</p>
              </div>
              <div class="col">
              <p class="prayer-time">${value}</p>
              </div>
          </div>`;

        listGroup.appendChild(itemDomElem);
      }
      setupTimer(nextPrayerInfos)
    } else {
      document.getElementById('list-prayer-group').innerHTML = errorDiv
    }
  } else {
    document.getElementById('list-prayer-group').innerHTML = errorDiv
  }
}

function loadEditCity() {
  ipcRenderer.send('app:edit-city')
}


function getTimeRemaining(endtime) {
  const total = Date.parse(endtime) - Date.parse(new Date());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  
  return {
    total,
    days,
    hours,
    minutes,
    seconds
  };
}

function initializeClock(id, endtime) {
  const clock = document.getElementById(id);
  // const daysSpan = clock.querySelector('.days');
  const hoursSpan = clock.querySelector('.hours');
  const minutesSpan = clock.querySelector('.minutes');
  const secondsSpan = clock.querySelector('.seconds');

  function updateClock() {
    const t = getTimeRemaining(endtime);

    // daysSpan.innerHTML = t.days;
    hoursSpan.innerHTML = ('0' + t.hours).slice(-2);
    minutesSpan.innerHTML = ('0' + t.minutes).slice(-2);
    secondsSpan.innerHTML = ('0' + t.seconds).slice(-2);

    if (t.total <= 0) {
      clearInterval(timeinterval);
    }
  }

  updateClock();
  const timeinterval = setInterval(updateClock, 1000);
}