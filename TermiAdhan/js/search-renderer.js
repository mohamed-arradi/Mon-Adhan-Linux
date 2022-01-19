const ipcRenderer = require('electron').ipcRenderer;
const fs = require('fs');
const path = require('path');

let rawdata = fs.readFileSync(path.join(__dirname, '/resources/citydatas.json'));
let cities = JSON.parse(rawdata);

document.addEventListener('askResults', function (to_find) {
    if (cities !== undefined 
        && cities !== null 
        && to_find !== null 
        && to_find.detail !== null && 
        to_find.detail.length > 0) {
        let searchQuery = to_find.detail
        let sb = document.getElementsByTagName('advanced-searchbar')[0]
        var presentedData = []
        sb.data = null
        for (let index = 0; index < cities.length; index++) {
            const element = cities[index];
            const postalCode = element["code_postal"].toString()
            const slicedPostCode = searchQuery.slice(0, searchQuery.length - 1)
            if (postalCode === searchQuery || (postalCode.startsWith(slicedPostCode))) {
                var cityDescription = postalCode.concat(" ").concat(element["nom_commune_complet"])
                presentedData.push({ "id": index, "text": cityDescription, "pill": "Département: ".concat(element["nom_departement"]) })
            }
        }
        console.log(presentedData)
        sb.data = presentedData
    } else {
        sb.data = []
    }

    //[{ "id": "toto", "text": "this is toto and he is funny", "pill": "toto_pill" }, { "id": "tata", "text": "this is tata and she is funny too toto ", "pill": "tata_pill" }, { "id": "titi", "text": "this is titi and he is yellow toto", "pill": "titi_pill" }];
})

ipcRenderer.on('callbackCityList', (event, results) => {

})

document.addEventListener('clickedOnResult', function (result) {
    window.event.stopPropagation()
})