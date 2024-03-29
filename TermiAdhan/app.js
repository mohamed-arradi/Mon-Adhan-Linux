const { app, Menu, BrowserWindow, Tray, ipcMain, globalShortcut } = require('electron');
var cron = require('node-cron');
const notifier = require('node-notifier');
const path = require('path');
const url = require('url')
const storage = require('electron-json-storage');
const Alert = require("electron-alert");
const { default: axios } = require('axios');
var moment = require('moment-timezone');
const { settings } = require('cluster');
moment.tz.setDefault("Europe/Paris");

var windowsArr = [];

function broadcast(channel, message) {
  for (var i = 0; i < windowsArr.length; i++) {
    try {
      if (windowsArr[i] !== null || windowsArr[i] !== undefined) {
        windowsArr?.[i]?.webContents.send(channel, message);
      } 
    } catch (error) {
      
    }
  }
}

var mainWindow = null
var contextMenu = null
var tray = null
var calendarView = null
var editCityView = null
var settingsView = null

var nextPrayerData = null 

var cronTask = null

var cancelDebounceToken
var cancelTodayDebounceToken

const UserCityStorageKey = "user_city"
const UserPrayerSettingsKey = "user_prayer_settings"
const UserNotificationsSettingsKey = "user_notifications_settings"
const LatestPrayerNotificationInfos = "latest_prayer_infos_notification"
const NotApplicableCity = "n/a"

function createMainWindow() {

  mainWindow = new BrowserWindow({
    width: 400,
    height: 550,
    minWidth: 400,
    minHeight: 550,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false
    },
    autoHideMenuBar: true,
    show: false,
    frame: true,
    icon: path.join(__dirname, '/assets/app_icon.png')
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (!process.argv.includes('--hidden')) {
    mainWindow.show();
  }

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  globalShortcut.register('f5', function () {
    mainWindow?.reload()
  })
  globalShortcut.register('CommandOrControl+R', function () {
    console.log('CommandOrControl+R is pressed')
    mainWindow?.reload()
  })

  windowsArr.push(mainWindow)
}

app.setLoginItemSettings({
  openAtLogin: true,
  args: ['--hidden']
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    app.dock.hide()
  }
})

function updateCronTask() {
  if(cronTask !== null) {
    const notificationEnable = storage.getSync(UserNotificationsSettingsKey)?.["notifications_enabled"]
    console.log(notificationEnable)
    const notificationEnabled = notificationEnable === true
  
  if(notificationEnabled) {
    cronTask.start()
  } else {
    cronTask.stop()
  }
  }
}

function updateContextualMenu() {

  tray = new Tray(__dirname + '/assets/icon_tray.png') 
  tray.setToolTip('Mon Adhan')

  const defaultMenu = [{
    label: 'Ouvrir l\'app', click: function () {
      try {
        mainWindow.close()
      } catch (error) {}
      createMainWindow()
    },
  },
  {
    label: 'Ouvrir le Calendrier de prière', click: function () {
      storage.get(UserCityStorageKey, function (error, city) {
        if (!isEmpty(city)) {
          openCalendar()
        } else {
          let alert = new Alert();
          let swalOptions = {
            title: "Erreur",
            text: "Vous ne pouvez pas ouvrir le calendrier de prière sans avoir saisi au préalable une ville",
            icon: "warning",
            confirmButtonText: "Ajouter une ville",
            showCancelButton: true
          };

          let promise = alert.fireWithFrame(swalOptions, "Ajouter une ville?", null, false);
          promise.then((result) => {
            if (result.value) {
              openEditCityView()
            } else if (result.dismiss === Alert.DismissReason.cancel) { }
          })
        }
      })
    }
  },
  {
    label: 'Quitter', click: function () {
      app.quit();
    }
  }]

  if(nextPrayerData) {
    const prayerName = nextPrayerData["prayerName"]
    const minutesRemaining = nextPrayerData["minutes"]
    const message = `Prochaine prière ${prayerName}, dans ${minutesRemaining} ${(minutesRemaining > 2 ? "minutes" : "minute")}`;
    var customMenu = defaultMenu.push({
      label: message, click: function () {
        if (mainWindow) {
          mainWindow.show()
        } else {
          createMainWindow()
        }
      }
    })
    contextMenu = Menu.buildFromTemplate([customMenu]);
} else {
  contextMenu = Menu.buildFromTemplate(defaultMenu);
} 
  tray.setContextMenu(contextMenu)
}

app.whenReady().then(() => {
  updateContextualMenu()
  createMainWindow()
})

cronTask = cron.schedule('* * * * *', () =>  {
  console.log('running prayer checks every minute');
  const date = moment().tz("Europe/Paris").format("DD-MM-YYYY")
  const channel = "callbackPrayerForCron"
  getPrayerForDate(date, channel, null, cancelTodayDebounceToken)
}, {
  scheduled: false
});

updateCronTask()

ipcMain.on('app:update-city', async (event, city) => {
  if (city !== undefined && city !== null) {
    storage.set(UserCityStorageKey, { city: city })
    editCityView?.close()
    mainWindow?.reload()
    const c = storage.getSync(UserCityStorageKey)?.["city"]
    broadcast('callbackCity', isEmpty(c) ? null : c)
  }
})

ipcMain.on('app:get-prayer-settings', async (event, args) => {
  refreshUserSettings(event, false)
})

ipcMain.on('app:set-prayer-settings', (event, args) => {
  if (args !== undefined && args !== null) {
    storage.set(UserPrayerSettingsKey, args, function(error) {
        refreshUserSettings(event, true)
    })
  }
})

ipcMain.on('app:get-notifications-settings', async (event, args) => {
  storage.get(UserNotificationsSettingsKey, function(error, data) {
    if (error !== null && !isEmpty(data)) {
      event?.sender.send("notification_settings_callback",data);
    } else {
      storage.set(UserNotificationsSettingsKey, { "notifications_enabled": true }, function(error) {
        if(error !== null) {
          event?.sender.send("notification_settings_callback",  { "notifications_enabled": true })
        }
      })
    }
  })
})

ipcMain.on('app:set-notifications-prayer-settings', (event, args) => {
  if (args !== undefined && args !== null) {
    storage.set(UserNotificationsSettingsKey, args, function(error) {
      updateCronTask()
    })
  }
})

ipcMain.on('app:get-city-saved', async (event, args) => {
  const city = storage.getSync(UserCityStorageKey)?.["city"]
  broadcast('callbackCity', isEmpty(city) ? null : city)
})

ipcMain.on('app:get-latest-available-prayer', async (event, args) => {
  const date = args?.[0]
  const channel = "callbackPrayerForToday"
  await getPrayerForDate(date, channel, event, cancelTodayDebounceToken)
})

ipcMain.on('network_change', (event, args) => {
  const isNetworkOnline = args
  broadcast("network_update", isNetworkOnline)
})

ipcMain.on('app:get-prayer-for-date', async (event, args) => {
  const date = args?.[0]
  const channel = "callbackPrayerForDate"
  await getPrayerForDate(date, channel, event, cancelDebounceToken)
})

ipcMain.on('app:get-prayers-calendar', (event, args) => {
  storage.get(UserCityStorageKey, function (error, city) {
    if (error) throw error;
    if (!isEmpty(city)) {
      openCalendar()
    }
  })
})

ipcMain.on('app:edit-city', (event, args) => {
  openEditCityView()
})

ipcMain.on('app:get-settings', (event, args) => {
  openSettingsView()
});

async function refreshUserSettings(event, reload) {

  storage.get(UserPrayerSettingsKey, function(error, data) {
    if (error !== null && !isEmpty(data)) {
      event?.sender.send("prayer_settings_callback",data);
      if(reload) {
      mainWindow?.reload()
      }
    } else {
      storage.set(UserPrayerSettingsKey, { "school": "school-sh", "method": "school-uof" }, function(error) {
        if(error !== null) {
          event?.sender.send("prayer_settings_callback", { "school": "school-sh", "method":"school-uof"})
          if(reload) {
          mainWindow?.reload()
          }
        }
      })
    }
  })
}

 function getSettingsMetrics() {
   const settings = storage.getSync(UserPrayerSettingsKey)
   const methods = {
    "calculation-mirail": { maghrib_value: 5, method: 2},
    "school-uof": { maghrib_value: 0, method: 11},
    "school-lim": {maghrib_value: 0, method: 3}
   }
 
   const schools = {
     "school-sh": {juristic: 0},
     "school-ha": {juristic: 1}
   }

   const method = settings?.["method"]
   const school = settings?.["school"]

   if(!isEmpty(settings) && (method !== undefined && school !== undefined)) {
    console.log(method)
  return {
    "method_data": methods[method],
    "school_data": schools[school],
    };
  } else {
    console.log("tetetetettet")
    return {
      "method_data": methods["school-uof"],
      "school_data": schools["school-sh"]
      };
  }
}

async function getPrayerForDate(date, channel, event, cancelToken) {

  if (typeof cancelToken != typeof undefined) {
    cancelToken.cancel("Operation canceled due to new request.")
  }

  cancelToken = axios.CancelToken.source()

  const city = storage.getSync(UserCityStorageKey)?.["city"]

  if (isEmpty(city)) {
    var c = await findCurrentCity()
    if (c) {
      if (process.argv.includes('--dev')) {
        c = "toulouse"
      }
      if (c === NotApplicableCity) {
        event?.sender.send("geoblockEvent")
        return
      }
      storage.set(UserCityStorageKey, { city: c }, function (error) {
        if (!error) {
          fetchDataForCity(c, date, event, channel, cancelToken)
        } else {
          event?.sender.send(channel, { error: null });
        }
      });
    } else {
      event?.sender.send(channel, null);
    }
  } else {
    if (city !== NotApplicableCity) {
      fetchDataForCity(city, date, event, channel, cancelToken)
    } else {
      event?.sender.send("geoblockEvent")
    }
  }
}
async function fetchDataForCity(city, date, event, channel, cancelToken) {
  try {
    const cityData = await axios.get("https://api-adresse.data.gouv.fr/search/?limit=1&type=municipality&q=" + city, { cancelToken: cancelToken.token })

    if (cityData.data) {
      cityProperties = cityData.data?.features
      if (cityProperties) {
        const geometry = cityProperties[0]?.geometry.coordinates
        const lng = geometry?.["0"]
        const lat = geometry?.["1"]
        if (lat && lng) {
          let settingsMetrics = getSettingsMetrics()
          let methodData = settingsMetrics["method_data"]
          let schoolData = settingsMetrics["school_data"]
          console.log(settings)
          const endpoint = "http://www.islamicfinder.us/index.php/api/prayer_times?timezone=Europe/Paris&latitude=" + lat + "&longitude=" + lng + "&time_format=0&date=" + date + "&juristic=" + schoolData["juristic"] + "&maghrib_rule=1&maghrib_value=" + methodData["maghrib_value"] + "&method=" + methodData["method"]
          console.log(endpoint)
          const results = await axios.get(endpoint, { cancelToken: cancelToken.token })
          if (channel === "callbackPrayerForCron") {
            processPrayerResultsForNotification(results.data.results)
            updateContextualMenu()
          }
          event?.sender.send(channel, results.data.results);
        }
      } else {
        event?.sender.send(channel, { error: null });
      }
    } else {
      event?.sender.send(channel, { error: null });
    }
  } catch (error) {
    event?.sender.send(channel, null);
  }
}
async function findCurrentCity() {
  try {
    const json = await axios.get("https://ipinfo.io");
    const city = json?.data?.["city"]
    const country = json?.data?.["country"]
    if (country && country !== "fr") {
      return NotApplicableCity
    }

    return city
  } catch (error) {
    return null
  }
}

function processPrayerResultsForNotification(prayersInfos) {

  for (const [key, value] of Object.entries(prayersInfos)) {
    var minutes = value.split(':')[1]
    var hour = value.split(':')[0]
    var m1 = moment().set({ hour: hour, minute: minutes, second: 0, millisecond: 0 }).tz("Europe/Paris").format("YYYY-MM-DDTHH:mm:ss.sssZ")
    var m2 = moment().tz("Europe/Paris").format("YYYY-MM-DDTHH:mm:ss.sssZ")

    var today = Date.parse(m2)
    var prayerDate = Date.parse(m1)
    const elapsedTime = ((prayerDate - today) / 1000) * 1000
    var diffMins = Math.floor((elapsedTime / 1000 / 60) << 0)

    if (m1 > m2 && diffMins < 11 && diffMins > 0) {
      nextPrayerInfos = { "prayerName": key, "prayerTime": value, "minutes": diffMins }
      nextPrayerData = nextPrayerInfos
      sendNotificationsIfNeeded(nextPrayerInfos)
      break;
    } else if (m1 > m2 && nextPrayerData === null) {
      nextPrayerData = { "prayerName": key, "prayerTime": value, "minutes": diffMins }
    }
  }
}

function sendNotificationsIfNeeded(nextPrayerInfos) {

  var today = moment().tz("Europe/Paris").format("YYYY-MM-DD")
  const prayerName = nextPrayerInfos["prayerName"]
  const minutesRemaining = nextPrayerInfos["minutes"]

  const message = `La prochaine prière est ${prayerName},  elle sera dans ${minutesRemaining} ${(minutesRemaining > 2 ? "minutes" : "minute")}`;
  storage.get(LatestPrayerNotificationInfos, function (error, data) {
    if (isEmpty(data)) {
      storage.set(LatestPrayerNotificationInfos, {
        "prayer_date": today,
        "prayer_name": prayerName
      })
      notify("Mon Adhan", message)
    } else {
      const latestPrayerName = data["prayer_name"]
      const latestPrayerDate = data["prayer_date"]

      if (latestPrayerName !== prayerName 
        || (latestPrayerName === prayerName && latestPrayerDate !== today)) {
        storage.set(LatestPrayerNotificationInfos, {
          "prayer_date": today,
          "prayer_name": prayerName
        })
        notify("Mon Adhan", message)
      }
    }
  })
}

function notify(title, message) {

  const settings = storage.getSync(UserNotificationsSettingsKey)

  const notificationEnable = storage.getSync(UserNotificationsSettingsKey)?.["notifications_enabled"]
  const notificationHasToBeSend = notificationEnable === true

  if(notificationHasToBeSend) {
  notifier.notify({
    title: title,
    message: message,
    sound: true,
  },
    function (err, response, metadata) {
      // Response is response from notification
      // Metadata contains activationType, activationAt, deliveredAt
    }
  );

  notifier.on('click', function (notifierObject, options, event) {
    mainWindow?.show()
  });

  notifier.on('timeout', function (notifierObject, options) {
    // Triggers if `wait: true` and notification closes
  });
}
}

function openCalendar() {

  calendarView = new BrowserWindow({
    height: 500,
    width: 550,
    minWidth: 550,
    minHeight: 500,
    maxWidth: 550,
    maxHeight: 500,
    title: "Calendrier des prières",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    frame: true,
  });

  calendarView.loadURL(url.format({
    pathname: path.join(__dirname, 'dates_prayer.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (process.argv.includes('--dev')) {
    calendarView.webContents.openDevTools({ mode: 'detach' })
  } else {
      console.log = function () {};
  }

  calendarView.on('closed', function (event) {
    removeItemOnce(windowsArr, calendarView)
    calendarView = null
  });

  windowsArr.push(calendarView)
}

function openEditCityView() {

  editCityView = new BrowserWindow({
    height: 400,
    width: 380,
    minWidth: 380,
    minHeight: 400,
    maxWidth: 380,
    maxHeight: 400,
    title: "Recherche de Ville",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    frame: true,
  });

  editCityView.loadURL(url.format({
    pathname: path.join(__dirname, 'city-search.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (process.argv.includes('--dev')) {
    editCityView.webContents.openDevTools({ mode: 'detach' })
  }

  if (calendarView !== null) {
    calendarView.close()
  }
}

function openSettingsView() {

  settingsView = new BrowserWindow({
    height: 420,
    width: 380,
    minWidth: 380,
    minHeight: 420,
    maxWidth: 380,
    maxHeight: 420,
    title: "Paramètres",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    frame: true,
  });

  settingsView.loadURL(url.format({
    pathname: path.join(__dirname, 'settings.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (process.argv.includes('--dev')) {
    settingsView.webContents.openDevTools({ mode: 'detach' })
  }

  settingsView.webContents.on('new-window', function(e, url) {
    e.preventDefault();
    require('electron').shell.openExternal(url);
  });

  if (calendarView !== null) {
    calendarView.close()
  }
}

function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

function removeItemAll(arr, value) {
  var i = 0;
  while (i < arr.length) {
    if (arr[i] === value) {
      arr.splice(i, 1);
    } else {
      ++i;
    }
  }
  return arr;
}

function isEmpty(obj) {
  if (obj === null || obj === undefined) {
    return true
  } else {
    return Object.keys(obj).length === 0;
  }
}