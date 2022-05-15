const ipcRenderer = require('electron').ipcRenderer;

var schoolSelector = null
var methodSelector = null
var sliderNotification = null

var currentSchool = null
var currentMethod = null
var notificationsEnabled = null

function updateSettings() {
    var updatedSettings = { "school": currentSchool, "method": currentMethod}
    ipcRenderer.send('app:set-prayer-settings', updatedSettings)
}

function updateNotificationsSettings(enabled) {
    var updatedSettings = { "notifications_enabled": enabled }
    ipcRenderer.send('app:set-notifications-prayer-settings', updatedSettings) 
}
function setUpSchoolValue(settings) {

    const selectedSchool = settings?.["school"]
    currentSchool = selectedSchool
    
    const schools = [
        {value: "school-sh", text: "Shafii"},
        {value: "school-ha", text: "Hanafi"}
    ];
    const select_elem = document.createElement('select');
    select_elem.className = "form-select form-select-sm mb-3"
    select_elem.id = "legal_school"
    select_elem.setAttribute('aria-label', '.form-select-sm');
    schools.forEach(d=> select_elem.add(new Option(d.text,d.value, null, d.value === selectedSchool)));
    document.getElementById("dynamic_school_select").innerHTML = ""
    document.getElementById("dynamic_school_select").appendChild(select_elem);
}

function setUpCalculationMethod(settings) {

    const selectedMethod = settings?.["method"]
    currentMethod = selectedMethod

    const methods = [
        {value: "calculation-mirail", text: "Mosquée de Toulouse Mirail"},
        {value: "school-uof", text: "Union des Organisations Islamiques de France"},
        {value: "school-lim", text: "Ligue islamique mondiale"}
    ];
    const select_elem = document.createElement('select');
    select_elem.className = "form-select form-select-sm mb-3"
    select_elem.id = "calculation_method"
    select_elem.setAttribute('aria-label', '.form-select-sm');
    methods.forEach(d=> select_elem.add(new Option(d.text,d.value,null, d.value === selectedMethod)));
    document.getElementById("dynamic_method_select").innerHTML = ""
    document.getElementById("dynamic_method_select").appendChild(select_elem);
}

ipcRenderer.send('app:get-prayer-settings')
ipcRenderer.send('app:get-notifications-settings')

ipcRenderer.on('notification_settings_callback',(event, settings) => {
    sliderNotification = document.getElementById("notif_switch")
    document.getElementById("notif_switch").checked = settings?.["notifications_enabled"]
})

ipcRenderer.on('prayer_settings_callback',  (event, settings) => {
    if (settings !== undefined && settings !== null) {
        setUpSchoolValue(settings)
        setUpCalculationMethod(settings)
        schoolSelector = document.getElementById("legal_school")
        methodSelector = document.getElementById("calculation_method")
        sliderNotification = document.getElementById("notif_switch")

        schoolSelector.addEventListener('change',function() {
            currentSchool = schoolSelector.options[schoolSelector.selectedIndex].value;
            updateSettings()
        });
        methodSelector.addEventListener('change',function() {
            currentMethod = methodSelector.options[methodSelector.selectedIndex].value;
            updateSettings()
        });
    
        sliderNotification.addEventListener('change', function () {
            notificationsEnabled = sliderNotification.checked
            updateNotificationsSettings(notificationsEnabled)
        });
    }
})