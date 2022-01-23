const { app, Menu, BrowserWindow, Tray, ipcMain, globalShortcut } = require('electron');
var cron = require('node-cron');
const notifier = require('node-notifier');
const path = require('path');
const url = require('url')
const storage = require('electron-json-storage');
const Alert = require("electron-alert");
const { default: axios } = require('axios');

var windowsArr = [];

function broadcast(channel, message) {
  for (var i = 0; i < windowsArr.length; i++) {
    if (windowsArr[i] !== null || windowsArr[i] !== undefined) {
      windowsArr[i].webContents.send(channel, message);
    }
  }
}

var mainWindow = null
var contextMenu = null
let tray = null
var calendarView = null
var editCityView = null
let isQuiting
var cancelDebounceToken
var cancelTodayDebounceToken

const UserCityStorageKey = "user_city"
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
    mainWindow.reload()
  })
  globalShortcut.register('CommandOrControl+R', function () {
    console.log('CommandOrControl+R is pressed')
    mainWindow.reload()
  })

  windowsArr.push(mainWindow)
}

app.setLoginItemSettings({
  openAtLogin: true,
  args: ['--hidden']
});



app.on('window-all-closed', () => {
  
  // any other logic
  if (process.platform === 'darwin') {
    app.dock.hide()
  }
})

function createTray() {
  tray = new Tray(__dirname + '/assets/icon_colored.png')
  //    { label: 'Prochaine prière dans 10 min: Asr', type: 'radio', checked: true },
  contextMenu = Menu.buildFromTemplate([
    {
      label: 'Ouvrir l\'app', click: function () {
        if (mainWindow) {
        mainWindow.show()
        } else {
          createMainWindow()
        }
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
        isQuiting = true
        app.quit();
      }
    },
  ]);
  tray.setToolTip('Mon Adhan')
  tray.setContextMenu(contextMenu)
}

app.whenReady().then(() => {

  if (!tray) {
    createTray()
  }

  createMainWindow()

  mainWindow.on('before-quit', function () {
    isQuiting = true;
  });

  mainWindow.on('minimize', function (event) {
    event.preventDefault();
    mainWindow.minimize();
  });

  mainWindow.on('closed', function () {
     mainWindow = null
  })
})

ipcMain.on('app:update-city', async (event, city) => {
  if (city !== undefined && city !== null) {
    storage.set(UserCityStorageKey, { city: city })
    editCityView?.close()
    mainWindow?.reload()
    const c = storage.getSync(UserCityStorageKey)?.["city"]
    broadcast('callbackCity', isEmpty(c) ? null : c)
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
        event.sender.send("geoblockEvent")
        return
      }
      storage.set(UserCityStorageKey, { city: c }, function (error) {
        if (!error) {
          fetchDataForCity(c, date, event, channel, cancelToken)
        } else {
          event.sender.send(channel, { error: null });
        }
      });
    } else {
      event.sender.send(channel, null);
    }
  } else {
    if (city !== NotApplicableCity) {
      fetchDataForCity(city, date, event, channel, cancelToken)
    } else {
      event.sender.send("geoblockEvent")
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
          const endpoint = "http://www.islamicfinder.us/index.php/api/prayer_times?timezone=Europe/Paris&latitude=" + lat + "&longitude=" + lng + "&time_format=0&date=" + date + "&method=2&maghrib_rule=1&maghrib_value=5&method=2"
          const results = await axios.get(endpoint, { cancelToken: cancelToken.token })
          event.sender.send(channel, results.data.results);
        }
      } else {
        event.sender.send(channel, { error: null });
      }
    } else {
      event.sender.send(channel, { error: null });
    }
  } catch (error) {
    event.sender.send(channel, null);
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

var cancelCityDebounceToken
async function searchCity(cityQuery) {

  try {
    if (typeof cancelCityDebounceToken != typeof undefined) {
      cancelCityDebounceToken.cancel("Operation canceled due to new request.")
    }

    cancelCityDebounceToken = axios.CancelToken.source()
    const cityDatas = await axios.get("https://api-adresse.data.gouv.fr/search/?&type=municipality&q=" + cityQuery, { cancelToken: cancelCityDebounceToken.token })

    const results = cityDatas?.data?.features
    var properties = []
    for (let index = 0; index < results.length; index++) {
      const feature = results[index];
      properties.push(feature.properties)
    }
    return properties
  } catch {
    return null  
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
// notifier.notify(
//   {
//     title: 'My awesome title',
//     message: 'Hello from node, Mr. User!',
//     icon: path.join(__dirname, 'adhan_white.png'), // Absolute path (doesn't work on balloons)
//     sound: true, // Only Notification Center or Windows Toasters
//     wait: false // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
//   },
//   function (err, response, metadata) {
//     // Response is response from notification
//     // Metadata contains activationType, activationAt, deliveredAt
//   }
// );

// notifier.on('click', function (notifierObject, options, event) {
//   // Triggers if `wait: true` and user clicks notification
// });

// notifier.on('timeout', function (notifierObject, options) {
//   // Triggers if `wait: true` and notification closes
// });


        // ios.get('/api/updatecart', {
        //   params: {
        //     product: this.product
        //   }
