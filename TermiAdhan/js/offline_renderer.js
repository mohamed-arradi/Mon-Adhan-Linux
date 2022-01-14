const updateOnlineStatus = () => {
  if (navigator.onLine) {
    document.getElementById('offline').hidden = true
  } else {
    document.getElementById('offline').hidden = false
  }
}

window.addEventListener('online', updateOnlineStatus)
window.addEventListener('offline', updateOnlineStatus)

updateOnlineStatus()