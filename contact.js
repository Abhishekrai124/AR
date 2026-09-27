const requestType = document.querySelector("#requestType");
if (requestType && new URLSearchParams(window.location.search).get("type") === "case") {
  requestType.value = "Private investigation enquiry";
}

const clientType = document.querySelector("#clientType");
const professionalFields = document.querySelector("#professionalFields");
const professionalTypes = new Set([
  "Lawyer or legal professional",
  "Police or law-enforcement official",
  "Public authority or government body",
  "Business or employer",
  "Insurer or claims professional",
  "Nonprofit or community organization",
]);

const updateProfessionalFields = () => {
  if (!clientType || !professionalFields) return;
  const isProfessional = professionalTypes.has(clientType.value);
  professionalFields.hidden = !isProfessional;
  professionalFields.querySelectorAll("input:not([type='checkbox'])").forEach((input) => {
    input.required = isProfessional && ["organization", "professionalRole"].includes(input.name);
    if (!isProfessional) input.value = "";
  });
  const authorization = professionalFields.querySelector("[name='authorizedToEnquire']");
  if (authorization) {
    authorization.required = isProfessional;
    if (!isProfessional) authorization.checked = false;
  }
};

clientType?.addEventListener("change", updateProfessionalFields);
updateProfessionalFields();

const locationSearch = document.querySelector("#locationSearch");
const locationConsent = document.querySelector("#locationLookupConsent");
const locationStatus = document.querySelector("#locationLookupStatus");
const locationSuggestions = document.querySelector("#locationSuggestions");
const policeSuggestions = document.querySelector("#policeSuggestions");
const locationSuggestionLabel = document.querySelector("#locationSuggestionLabel");
const policeSuggestionLabel = document.querySelector("#policeSuggestionLabel");
let placeResults = [];
let policeResults = [];
let selectedCoordinates = null;

const fillLocation = (properties, coordinates) => {
  const values = {
    country: properties.country,
    state: properties.state || properties.region,
    district: properties.district || properties.county,
    city: properties.city || properties.town || properties.village ||
      (["city", "town", "village", "hamlet"].includes(properties.type || properties.osm_value) ? properties.name : ""),
    area: properties.suburb || properties.neighbourhood || properties.locality || properties.quarter,
    postalCode: properties.postcode || properties.postalcode,
  };
  Object.entries(values).forEach(([name, value]) => {
    const field = document.querySelector(`[name="${name}"]`);
    if (field && value) field.value = value;
  });
  selectedCoordinates = coordinates || null;
  if (properties.osm_value === "police" && properties.name) {
    document.querySelector('[name="policeStation"]').value = properties.name;
  }
};

const formatPhotonPlace = (properties) =>
  [properties.name, properties.district, properties.city, properties.state, properties.postcode, properties.country]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(", ");

const queryPhoton = async (query, { policeOnly = false, proximity = false } = {}) => {
  if (!locationConsent?.checked) {
    locationStatus.textContent = "Tick the location-sharing box first. Search sends only the place query to Photon, not your case summary.";
    return;
  }
  if (!query || query.trim().length < 2) {
    locationStatus.textContent = "Enter a city, area, postcode or other public place name first.";
    return;
  }

  const params = new URLSearchParams({ q: query.trim(), limit: "8", lang: "en" });
  if (proximity && selectedCoordinates) {
    params.set("lon", String(selectedCoordinates[0]));
    params.set("lat", String(selectedCoordinates[1]));
  }
  locationStatus.textContent = "Searching public map suggestions…";
  locationSuggestionLabel.hidden = !policeOnly;
  policeSuggestionLabel.hidden = true;
  document.querySelectorAll(".location-lookup-button").forEach((button) => { button.disabled = true; });

  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params}`);
    if (!response.ok) throw new Error("The map search is temporarily unavailable.");
    const result = await response.json();
    const features = Array.isArray(result.features) ? result.features : [];
    if (policeOnly) {
      const seenStations = new Set();
      policeResults = features.filter(({ properties }) => {
        if (properties.osm_key !== "amenity" || properties.osm_value !== "police") return false;
        const stationName = formatPhotonPlace(properties).toLowerCase();
        if (seenStations.has(stationName)) return false;
        seenStations.add(stationName);
        return true;
      });
      policeSuggestions.replaceChildren(new Option("Choose a mapped station", ""));
      policeResults.forEach((feature, index) => policeSuggestions.add(new Option(formatPhotonPlace(feature.properties), String(index))));
      policeSuggestionLabel.hidden = policeResults.length === 0;
      locationSuggestionLabel.hidden = true;
      locationStatus.textContent = policeResults.length
        ? `${policeResults.length} mapped police-station suggestion(s). Check the official local directory before relying on one.`
        : "No mapped police stations found for this place. Enter the station manually or check the official local directory.";
    } else {
      placeResults = features;
      locationSuggestions.replaceChildren(new Option("Choose the correct place", ""));
      placeResults.forEach((feature, index) => locationSuggestions.add(new Option(formatPhotonPlace(feature.properties), String(index))));
      locationSuggestionLabel.hidden = placeResults.length === 0;
      policeSuggestionLabel.hidden = true;
      locationStatus.textContent = placeResults.length
        ? "Choose the matching result. You can edit all filled fields afterward."
        : "No public map match found. Enter the location fields manually.";
    }
  } catch {
    locationSuggestionLabel.hidden = true;
    policeSuggestionLabel.hidden = true;
    locationStatus.textContent = "Map suggestions could not be loaded. Enter the location manually and continue.";
  } finally {
    document.querySelectorAll(".location-lookup-button").forEach((button) => { button.disabled = false; });
  }
};

document.querySelector("#lookupLocation")?.addEventListener("click", () => {
  queryPhoton(locationSearch?.value || "");
});

document.querySelector("#lookupPoliceStations")?.addEventListener("click", () => {
  const locationText = ["area", "city", "district", "state", "country"]
    .map((name) => document.querySelector(`[name="${name}"]`)?.value)
    .filter(Boolean)
    .join(", ") || locationSearch?.value || "";
  if (!locationText && !selectedCoordinates) {
    locationStatus.textContent = "Choose or enter a country, city, area or postcode before searching for stations.";
    return;
  }
  const query = selectedCoordinates ? "police station" : `police station near ${locationText}`;
  queryPhoton(query, { policeOnly: true, proximity: true });
});

locationSuggestions?.addEventListener("change", () => {
  if (!locationSuggestions.value) return;
  const feature = placeResults[Number(locationSuggestions.value)];
  if (feature) fillLocation(feature.properties, feature.geometry?.coordinates);
});

policeSuggestions?.addEventListener("change", () => {
  if (!policeSuggestions.value) return;
  const feature = policeResults[Number(policeSuggestions.value)];
  if (feature) fillLocation(feature.properties, feature.geometry?.coordinates);
});
