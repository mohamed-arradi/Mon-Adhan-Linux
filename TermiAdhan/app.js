const { app, Menu, BrowserWindow, Tray, nativeImage, ipcMain } = require('electron');
var cron = require('node-cron');
const notifier = require('node-notifier');
const path = require('path');
const url = require('url')
const open = require("open");
const storage = require('electron-json-storage');
const { default: axios } = require('axios');

var mainWindow = null
var contextMenu = null
var tray = null

const UserCity = "user_city"
const UserLatitude = "user_location"
const UserLongitude = "user_longitude"
const UserTimeZone = "user_timezone"

function createWindow() {

  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false,
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
}

app.setLoginItemSettings({
  openAtLogin: true,
  args: ['--hidden']
});

app.whenReady().then(() => {
  tray = new Tray(__dirname + '/assets/icon_colored.png')
  //    { label: 'Prochaine prière dans 10 min: Asr', type: 'radio', checked: true },
  contextMenu = Menu.buildFromTemplate([
    {
      label: 'Ouvrir l\'app', click: function () {
        mainWindow.show()
      },
    },
    {
      label: 'Ouvrir le Calendrier de prière', click: function () {
        openCalendar()
      }
    },
    {
      label: 'Quitter', click: function () {
        app.isQuiting = true;
        app.quit();
      }
    },
  ]);

  tray.setToolTip('Mon Adhan')
  tray.setContextMenu(contextMenu)
  createWindow()


  const staticLinkHandleRedirect = (e, url) => {
    if (url !== e.sender.getURL()) {
      e.preventDefault()
      open(url)
    }
  }

  mainWindow.webContents.on('will-navigate', staticLinkHandleRedirect)

  mainWindow.on('before-quit', function () {
    app.isQuiting = true;
  });

  mainWindow.on('minimize', function (event) {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('close', function (event) {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
})

ipcMain.on('app:get-city-saved', async (event, args) => {
  storage.set(UserCity, "Toulouse")
  storage.get(UserCity, function(error,city) {
    event.sender.send('callbackCity',isEmpty(city) ? null : city)
  })
})

ipcMain.on('app:get-latest-available-prayer', (event, args) => {

})

var cancelDebounceToken
ipcMain.on('app:get-prayer-for-date', async (event, args) => {
  if (typeof cancelDebounceToken != typeof undefined) {
    cancelDebounceToken.cancel("Operation canceled due to new request.")
  }

  cancelDebounceToken = axios.CancelToken.source()

  const date = args?.[0]
  const city = storage.getSync(UserCity)
  const latitude = storage.getSync(UserLatitude)
  const longitude = storage.getSync(UserLongitude)
  const timeZone = storage.getSync(UserTimeZone)

  if (!isEmpty(latitude) && !isEmpty(longitude) && !isEmpty(timeZone)) {

   } else {

    try {
    const cityData = await axios.get("https://api-adresse.data.gouv.fr/search/?limit=1&q=" + "toulouse", { cancelToken: cancelDebounceToken.token })
    
    if (cityData.data) {
      cityProperties = cityData.data?.features
      if (cityProperties) {
        const geometry = cityProperties[0]?.geometry.coordinates
        const lng = geometry?.["0"]
        const lat = geometry?.["1"]
        if (lat && lng) {
          const endpoint = "http://www.islamicfinder.us/index.php/api/prayer_times?timezone=Europe/Paris&latitude=" + lat + "&longitude=" + lng + "&time_format=0&date=" + date + "&method=2&maghrib_rule=1&maghrib_value=5&method=2"
          const results = await axios.get(endpoint, { cancelToken: cancelDebounceToken.token })
          event.sender.send('callbackPrayerForDate', results.data.results);
        }
      } else {
        event.sender.send('callbackPrayerForDate', {error: "Une erreur est survenue, veuillez réessayer"});
      }
    } else {
      event.sender.send('callbackPrayerForDate', {error: "Une erreur est survenue, veuillez réessayer"});
    }
  } catch(error) { 
    event.sender.send('callbackPrayerForDate', null);
  }

}
})

async function findCurrentCity() {
  try {
  const json = await axios.get("https://ipinfo.io");
  const city = json["city"]
  return city
  } catch(error) {
    return null
  } 
}

async function handleNoCityPrefPrayerCall(date) {
  try {
    const json = await axios.get("https://ipinfo.io");
    const city = json["city"]
    const ip = json["ip"]

    if (city !== undefined && city !== null) {
      const endpoint = "http://www.islamicfinder.us/index.php/api/prayer_times?user_ip=" + ip + "&time_format=0&date=" + date + "&method=2&maghrib_rule=1&maghrib_value=5&method=2"

      const prayerDatas = await axios.get(endpoint);
      return prayerDatas;
    } else {
      return null
    }
  } catch (error) {
    console.log("error", error);
    // appropriately handle the error
  }
}

ipcMain.on('app:get-prayers-calendar', (event, args) => {
  openCalendar()
})

function openCalendar() {

  const win = new BrowserWindow({
    height: 450,
    width: 550,
    minWidth: 550,
    minHeight: 450,
    maxWidth: 550,
    maxHeight: 450,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    frame: true,
  });

  win.loadURL(url.format({
    pathname: path.join(__dirname, 'dates_prayer.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools({ mode: 'detach' })
  }
}
function isEmpty(obj) {
  return Object.keys(obj).length === 0;
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
