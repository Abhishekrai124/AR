const caseForm = document.querySelector("#caseIntake");
const serviceSelect = document.querySelector("#caseService");
const caseStatus = document.querySelector("#caseSubmissionStatus");
const clientType = document.querySelector("#clientType");
const professionalFields = document.querySelector("#professionalFields");
const studentStatusField = document.querySelector("#studentStatusField");
const studentStatus = document.querySelector("#studentStatus");
const professionalTypes = new Set(["Lawyer or legal professional", "Police or law-enforcement official", "Public authority or government body", "Cybercrime or IT-security professional", "Doctor or licensed healthcare professional", "Forensic or security specialist", "Business or employer", "Insurer or claims professional", "Nonprofit or community organization"]);
const caseFormOpenedAt = Date.now();

if (serviceSelect && window.detectiveServiceCatalog) {
  serviceSelect.replaceChildren(new Option("Choose a service", ""));
  window.detectiveServiceCatalog.forEach(({ title }) => serviceSelect.add(new Option(title, title)));
}

const updateClientFields = () => {
  if (!clientType) return;
  const professional = professionalTypes.has(clientType.value);
  if (professionalFields) {
    professionalFields.hidden = !professional;
    professionalFields.querySelectorAll("input:not([type='checkbox']), select").forEach((field) => {
      field.required = professional && ["organization", "professionalRole", "professionalIdType", "professionalIdReference"].includes(field.name);
    });
    const authorized = professionalFields.querySelector("[name='authorizedToEnquire']");
    if (authorized) authorized.required = professional;
  }
  const student = clientType.value === "Student";
  if (studentStatusField) studentStatusField.hidden = !student;
  if (studentStatus) studentStatus.required = student;
};
clientType?.addEventListener("change", updateClientFields);
updateClientFields();

const locationConsent = document.querySelector("#locationLookupConsent");
const locationSearch = document.querySelector("#locationSearch");
const locationStatus = document.querySelector("#locationLookupStatus");
const locationSuggestions = document.querySelector("#locationSuggestions");
const locationSuggestionsLabel = document.querySelector("#locationSuggestionsLabel");
const civicSuggestions = document.querySelector("#civicSuggestions");
const civicSuggestionsLabel = document.querySelector("#civicSuggestionsLabel");
let placeResults = [];
let civicResults = [];

const hasLocationConsent = () => {
  if (locationConsent?.checked) return true;
  locationStatus.textContent = "Please tick the location-sharing consent box before using online suggestions.";
  return false;
};
const placeName = (properties = {}) => [properties.name, properties.city || properties.town || properties.village, properties.state || properties.region, properties.country]
  .filter((value, index, values) => value && values.indexOf(value) === index).join(", ");
const fillLocation = (properties = {}) => {
  const values = {
    country: properties.country,
    state: properties.state || properties.region,
    city: properties.city || properties.town || properties.village || properties.municipality,
    area: properties.suburb || properties.neighbourhood || properties.district || properties.county,
    postalCode: properties.postcode,
  };
  Object.entries(values).forEach(([name, value]) => {
    const field = caseForm?.elements[name];
    if (field && value) field.value = value;
  });
};
const photonSearch = async (query) => {
  const response = await fetch(`https://photon.komoot.io/api/?${new URLSearchParams({ q: query, limit: "8", lang: "en" })}`);
  if (!response.ok) throw new Error("Location suggestions are temporarily unavailable.");
  const data = await response.json();
  return Array.isArray(data.features) ? data.features : [];
};
const showPlaceSuggestions = (results) => {
  placeResults = results;
  locationSuggestions.replaceChildren(new Option("Choose a matching location", ""));
  results.forEach((feature, index) => locationSuggestions.add(new Option(placeName(feature.properties), String(index))));
  locationSuggestionsLabel.hidden = results.length === 0;
};
document.querySelector("#findLocation")?.addEventListener("click", async () => {
  if (!hasLocationConsent()) return;
  const query = locationSearch?.value.trim();
  if (!query || query.length < 2) { locationStatus.textContent = "Enter a country, city, state or public place name first."; return; }
  locationStatus.textContent = "Finding worldwide location suggestions…";
  try { const results = await photonSearch(query); showPlaceSuggestions(results); locationStatus.textContent = results.length ? "Choose a result to autofill the location fields. You can edit them afterward." : "No result found. Enter the location manually."; }
  catch (error) { locationStatus.textContent = error.message; }
});
locationSuggestions?.addEventListener("change", () => {
  const feature = placeResults[Number(locationSuggestions.value)];
  if (feature) { fillLocation(feature.properties); locationStatus.textContent = "Location filled. Check every field before submitting."; }
});
document.querySelector("#useCurrentLocation")?.addEventListener("click", () => {
  if (!hasLocationConsent()) return;
  if (!navigator.geolocation) { locationStatus.textContent = "This browser does not support current-location access. Search or enter the location manually."; return; }
  locationStatus.textContent = "Waiting for browser location permission…";
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const response = await fetch(`https://photon.komoot.io/reverse?${new URLSearchParams({ lat: String(coords.latitude), lon: String(coords.longitude), lang: "en" })}`);
      const data = await response.json();
      const feature = data.features?.[0];
      if (!response.ok || !feature) throw new Error("No matching location was found.");
      fillLocation(feature.properties); locationStatus.textContent = "Approximate location filled. Review and correct the fields if needed.";
    } catch (error) { locationStatus.textContent = error.message || "Current location could not be resolved."; }
  }, () => { locationStatus.textContent = "Location permission was not granted. You can search or enter the fields manually."; }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});
document.querySelector("#findCivicServices")?.addEventListener("click", async () => {
  if (!hasLocationConsent()) return;
  const location = [caseForm?.elements.area?.value, caseForm?.elements.city?.value, caseForm?.elements.state?.value, caseForm?.elements.country?.value].filter(Boolean).join(", ") || locationSearch?.value.trim();
  if (!location) { locationStatus.textContent = "Choose, search or enter a broad location first."; return; }
  locationStatus.textContent = "Finding mapped police stations and courts near this location…";
  try {
    civicResults = await photonSearch(`police station court ${location}`);
    civicSuggestions.replaceChildren(new Option("Choose a mapped public service", ""));
    civicResults.forEach((feature, index) => civicSuggestions.add(new Option(placeName(feature.properties), String(index))));
    civicSuggestionsLabel.hidden = civicResults.length === 0;
    locationStatus.textContent = civicResults.length ? "Suggestions are map data, not official directories. Verify independently before relying on them." : "No mapped services found. Enter the station or court reference manually.";
  } catch (error) { locationStatus.textContent = error.message; }
});
civicSuggestions?.addEventListener("change", () => {
  const feature = civicResults[Number(civicSuggestions.value)];
  if (!feature) return;
  const name = placeName(feature.properties);
  const isCourt = /court|tribunal|judicial/i.test(`${feature.properties?.name || ""} ${feature.properties?.osm_value || ""}`);
  const field = caseForm?.elements[isCourt ? "caseReference" : "policeStation"];
  if (field) field.value = name;
  locationStatus.textContent = "Suggestion copied. Verify it and edit manually if required.";
});

caseForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!caseForm.reportValidity()) return;
  const formData = new FormData(caseForm);
  const button = caseForm.querySelector('[type="submit"]');
  button.disabled = true;
  caseStatus.textContent = "Creating your confidential case…";
  const payload = {
    action: "create-case", requestType: formData.get("requestType"), clientName: formData.get("name"), clientEmail: formData.get("email"), clientPhone: formData.get("phone"), website: formData.get("website"), formOpenedAt: caseFormOpenedAt,
    clientType: formData.get("clientType"), studentStatus: formData.get("studentStatus"), matterCategory: formData.get("caseCategory"), service: formData.get("service"),
    organization: formData.get("organization"), professionalRole: formData.get("professionalRole"), professionalIdType: formData.get("professionalIdType"), professionalIdReference: formData.get("professionalIdReference"),
    caseReference: formData.get("caseReference"), authorizedToEnquire: formData.get("authorizedToEnquire") === "Confirmed", country: formData.get("country"), state: formData.get("state"),
    district: formData.get("district"), city: formData.get("city"), area: formData.get("area"), postalCode: formData.get("postalCode"), policeStation: formData.get("policeStation"),
    timing: formData.get("timing"), summary: formData.get("message"), agreementName: formData.get("name"), agreementAccepted: formData.get("agreementAccepted") === "Confirmed",
  };
  try {
    const response = await fetch("/api/detective-cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The case could not be created.");
    caseStatus.textContent = `Case ${result.caseNumber} created successfully. Keep this number for your records.`;
    button.textContent = "Case created";
  } catch (error) {
    caseStatus.textContent = error.message || "The case could not be created.";
    button.disabled = false;
  }
});
