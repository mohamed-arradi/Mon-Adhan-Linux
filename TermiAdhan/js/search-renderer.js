const ipcRenderer = require('electron').ipcRenderer;

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

function refreshData() {

}