const { Islamic, Calendar } = require('@syncfusion/ej2-calendars');
const { L10n, loadCldr } = require('@syncfusion/ej2-base');
const ipcRenderer = require('electron').ipcRenderer;

loadCldr(
    require('cldr-data/supplemental/numberingSystems.json'),
    require('cldr-data/main/fr/ca-gregorian.json'),
    require('cldr-data/main/fr/ca-islamic.json'),
    require('cldr-data/main/fr/numbers.json'),
    require('cldr-data/main/fr/timeZoneNames.json')
);

L10n.load({
    'fr': {
        'calendar': { today: 'Aujourd\'hui' }
    }
});

var latestSelectedDate = getFormattedDate(new Date())

const progressDiv = '<div class="progress" style="margin-top: 50%;"><div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemin="20" aria-valuemax="100" style="width: 100%"></div></div>'
const errorDiv = '<div class="alert alert-danger" role="alert">Une erreur est survenue, veuillez réessayer.</div><button type="button" class="btn btn-info" onclick="refreshData()">Réessayer</button>'
initCalendars()
document.getElementById('list-prayer-group').innerHTML = progressDiv
ipcRenderer.send('app:get-prayer-for-date', [latestSelectedDate])
ipcRenderer.send('app:get-city-saved')


function refreshData() {
    document.getElementById('list-prayer-group').innerHTML = progressDiv
    ipcRenderer.send('app:get-prayer-for-date', [latestSelectedDate])
}

ipcRenderer.on('callbackCity', (event, city) => {
    console.log(city)
    if (city !== null) {
        document.getElementById("header-title").textContent = city.toUpperCase()
    } else {
        document.getElementById("header-title").textContent = "Localisation: Not Set"
    }
})

ipcRenderer.on('callbackPrayerForDate', (event, prayersDictionnary) => {
    displayListPrayers(prayersDictionnary)
})

/////// FUNCTIONS /////////////

function initCalendars() {
    Calendar.Inject(Islamic);
    let calendarObjectHiji = createCalendarType('Islamic', valueChange)
    let calendarObjectGreg = createCalendarType('Gregorian', valueChange)

    calendarObjectGreg.appendTo('#calendar_greg');
    calendarObjectHiji.appendTo('#calendar_hiji');
}

function createCalendarType(mode, callback) {
    return new Calendar({
        change: callback,
        calendarMode: mode,
        locale: 'fr',
        firstDayOfWeek: 1,
        dayHeaderFormat: "Short",
        showTodayButton: true,
        value: new Date()
    });
}

function valueChange(args) {
    document.getElementById('list-prayer-group').innerHTML = progressDiv
    const d = args.value
    latestSelectedDate = d
    ipcRenderer.send('app:get-prayer-for-date', [getFormattedDate(d)])
}

function getFormattedDate(d) {
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
