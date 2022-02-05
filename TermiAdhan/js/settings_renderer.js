const ipcRenderer = require('electron').ipcRenderer;


function setUpSchoolValue(settings) {

    const selectedSchool = settings?.["school"]

    console.log("school = " + selectedSchool)

    const schools = [
        {value: "school-sh", text: "Shafii"},
        {value: "school-ha", text: "Hanafi"}
    ];
    const select_elem = document.createElement('select');
    select_elem.className = "form-select form-select-sm mb-3"
    select_elem.id = "legal_school"
    select_elem.setAttribute('aria-label', '.form-select-sm');
    schools.forEach(d=> select_elem.add(new Option(d.text,d.value, null, d.value === selectedSchool)));
    document.getElementById("dynamic_school_select").appendChild(select_elem);
}

function setUpCalculationMethod(settings) {

    const selectedMethod = settings?.["method"]

    console.log("method = " + selectedMethod)

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
    document.getElementById("dynamic_method_select").appendChild(select_elem);
}


ipcRenderer.send('app:get-prayer-settings')

//app:set-prayer-settings
ipcRenderer.on('prayer_settings_callback',  (event, settings) => {
    if (settings !== undefined && settings !== null) {
        // console.log(settings)
        setUpSchoolValue(settings)
        setUpCalculationMethod(settings)
    }
})