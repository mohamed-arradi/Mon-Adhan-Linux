const updateOnlineStatus = () => {
  if (navigator.onLine) {
    document.getElementById('offline').hidden = true
  } else {
    document.getElementById('offline').hidden = false
  }
  ipcRenderer.send("network_change", navigator.onLine)
}

window.addEventListener('online', updateOnlineStatus)
window.addEventListener('offline', updateOnlineStatus)

updateOnlineStatus()