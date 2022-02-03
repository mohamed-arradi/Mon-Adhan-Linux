const ipcRenderer = require('electron').ipcRenderer;


function setUpSchoolValue() {
    const schools = [
        {value: "school-sh", text: "Shafii"},
        {value: "school-ha", text: "Hanafi"}
    ];
    const select_elem = document.createElement('select');
    select_elem.className = "form-select form-select-sm mb-3"
    select_elem.id = "legal_school"
    select_elem.setAttribute('aria-label', '.form-select-sm');
    schools.forEach(d=> select_elem.add(new Option(d.text,d.value)));
    document.getElementById("dynamic_school_select").appendChild(select_elem);
}

setUpSchoolValue()

ipcRenderer.send('app:get-prayer-settings')

ipcRenderer.on('prayer_settings_callback',  (event, settings) => {
    if (settings !== null) {
        
    }
})