
var previousOnlineState = true

const updateOnlineStatus = () => {
  if (navigator.onLine) {
    document.getElementById('offline').hidden = true
  } else {
    document.getElementById('offline').hidden = false
  }
  if (previousOnlineState !== navigator.onLine) {
  ipcRenderer.send("network_change", navigator.onLine)
  previousOnlineState = navigator.onLine
  }
}

window.addEventListener('online', updateOnlineStatus)
window.addEventListener('offline', updateOnlineStatus)

updateOnlineStatus()