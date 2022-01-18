const ipcRenderer = require('electron').ipcRenderer;
const { default: axios } = require('axios');

document.addEventListener('askResults', async function (to_find) {
    let sb = document.getElementsByTagName('advanced-searchbar')[0]
    console.log(to_find.detail)
    const results = await searchCity(to_find.detail)
    //sb.data = [{ "id": "toto", "text": "this is toto and he is funny", "pill": "toto_pill" }, { "id": "tata", "text": "this is tata and she is funny too toto ", "pill": "tata_pill" }, { "id": "titi", "text": "this is titi and he is yellow toto", "pill": "titi_pill" }];
})

document.addEventListener('clickedOnResult', function (result) {
    window.event.stopPropagation()
    console.log(result.detail)
})

var cancelDebounceToken
async function searchCity(cityQuery) {

    if (typeof cancelDebounceToken != typeof undefined) {
        cancelDebounceToken.cancel("Operation canceled due to new request.")
    }

    cancelDebounceToken = axios.CancelToken.source()
    const cityDatas = await axios.get("https://api-adresse.data.gouv.fr/search/?limit=1&ype=municipality&q=" + cityQuery, { cancelToken: cancelDebounceToken.token })
    const results = cityDatas?.data?.features
    console.log(results)
    return results
}