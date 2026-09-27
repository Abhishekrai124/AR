const requestType = document.querySelector("#requestType");
if (requestType && new URLSearchParams(window.location.search).get("type") === "case") {
  requestType.value = "Private investigation enquiry";
}

const serviceSelect = document.querySelector("#caseService");
if (serviceSelect && window.detectiveServiceCatalog) {
  serviceSelect.replaceChildren(new Option("Choose a service or ‘Not sure yet’", ""));
  window.detectiveServiceCatalog.forEach(({ title }) => {
    serviceSelect.add(new Option(title, title));
  });
  serviceSelect.add(new Option("Related or unlisted investigation request", "Related or unlisted investigation request"));
  serviceSelect.required = true;
}

const clientType = document.querySelector("#clientType");
const professionalFields = document.querySelector("#professionalFields");
const studentStatusField = document.querySelector("#studentStatusField");
const studentStatus = document.querySelector("#studentStatus");
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
  const isStudent = clientType.value === "Student";
  if (studentStatusField) studentStatusField.hidden = !isStudent;
  if (studentStatus) {
    studentStatus.required = isStudent;
    if (!isStudent) studentStatus.value = "";
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

const caseForm = document.querySelector(".case-form");
const caseStatus = document.querySelector("#caseSubmissionStatus");
const casePdfLink = document.querySelector("#casePdfLink");
const toDataUrl = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
};

const buildCasePdf = (data, caseNumber, createdAt) => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error("PDF support did not load. Reload the page and try again.");
  const documentPdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 18;
  const right = 192;
  let y = 20;
  documentPdf.setFont("helvetica", "bold");
  documentPdf.setFontSize(16);
  documentPdf.text("ARRAI DETECTIVE AGENCY", left, y);
  y += 9;
  documentPdf.setFontSize(12);
  documentPdf.text("PRELIMINARY CASE INTAKE ACKNOWLEDGEMENT", left, y);
  y += 8;
  documentPdf.setFont("helvetica", "normal");
  documentPdf.setFontSize(10);
  documentPdf.text(`Case number: ${caseNumber}`, left, y);
  y += 6;
  documentPdf.text(`Generated: ${new Date(createdAt).toLocaleString()}`, left, y);
  y += 9;

  const fields = [
    ["Client / representative", data.get("name")],
    ["Case solver", "Mr. A · ARRAI Detective Agency"],
    ["Email", data.get("email")],
    ["Client type", data.get("clientType")],
    ["Student / guardian", data.get("studentStatus")],
    ["Organization / agency", data.get("organization")],
    ["Role", data.get("professionalRole")],
    ["Matter", data.get("caseCategory")],
    ["Requested service", data.get("service")],
    ["Country", data.get("country")],
    ["State / region", data.get("state")],
    ["District / county", data.get("district")],
    ["City / town", data.get("city")],
    ["Area / neighbourhood", data.get("area")],
    ["PIN / postal code", data.get("postalCode")],
    ["Police station / precinct", data.get("policeStation")],
    ["Timing", data.get("timing")],
    ["Summary", data.get("message")],
  ];
  documentPdf.setFont("helvetica", "bold");
  documentPdf.text("ENQUIRY DETAILS", left, y);
  y += 7;
  documentPdf.setFont("helvetica", "normal");
  fields.forEach(([label, value]) => {
    const text = `${label}: ${String(value || "Not provided")}`;
    const lines = documentPdf.splitTextToSize(text, right - left);
    if (y + lines.length * 5 > 275) {
      documentPdf.addPage();
      y = 20;
    }
    documentPdf.text(lines, left, y);
    y += lines.length * 5 + 2;
  });

  if (y + 45 > 275) {
    documentPdf.addPage();
    y = 20;
  }
  y += 3;
  documentPdf.setFont("helvetica", "bold");
  documentPdf.text("PRELIMINARY ACKNOWLEDGEMENT", left, y);
  y += 7;
  documentPdf.setFont("helvetica", "normal");
  const terms = [
    "I confirm that the information above is accurate to the best of my knowledge and that I am entitled to submit this enquiry.",
    "This acknowledgement records an enquiry only. It is not legal advice, a final investigation-services contract, an emergency request, or an official police/court filing.",
    "No investigative work begins until the agency confirms lawful authority and capability and both parties agree in writing on scope, fees, timing, privacy/data handling and cancellation terms.",
    "The agency will not hack accounts/devices, obtain private records without authority, install spyware, or conduct unlawful surveillance. Outcomes and public-source records cannot be guaranteed.",
    `Acknowledged by: ${data.get("name")}    Date/time: ${new Date().toISOString()}`,
    `Draft terms version: ${data.get("agreementVersion")}`,
  ];
  terms.forEach((term) => {
    const lines = documentPdf.splitTextToSize(term, right - left);
    if (y + lines.length * 5 > 275) {
      documentPdf.addPage();
      y = 20;
    }
    documentPdf.text(lines, left, y);
    y += lines.length * 5 + 3;
  });
  for (let page = 1; page <= documentPdf.getNumberOfPages(); page += 1) {
    documentPdf.setPage(page);
    documentPdf.setFontSize(8);
    documentPdf.setTextColor(100);
    documentPdf.text("DRAFT INTAKE ACKNOWLEDGEMENT · Not a final service contract", left, 288);
    documentPdf.text(`Page ${page} of ${documentPdf.getNumberOfPages()}`, right, 288, { align: "right" });
  }
  return documentPdf.output("blob");
};

caseForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!caseForm.reportValidity()) return;
  const submitButton = caseForm.querySelector('[type="submit"]');
  const data = new FormData(caseForm);
  const clientTypeValue = data.get("clientType");
  if (clientTypeValue === "Student" && !data.get("studentStatus")) {
    caseStatus.textContent = "Confirm that you are an adult student or that a parent/guardian is helping.";
    return;
  }
  submitButton.disabled = true;
  caseStatus.textContent = "Creating the private case record…";
  casePdfLink.hidden = true;
  try {
    const payload = {
      action: "create-case",
      requestType: data.get("requestType"),
      clientName: data.get("name"),
      clientEmail: data.get("email"),
      clientType: clientTypeValue,
      studentStatus: data.get("studentStatus"),
      studentStatus: data.get("studentStatus"),
      matterCategory: data.get("caseCategory"),
      service: data.get("service"),
      organization: data.get("organization"),
      professionalRole: data.get("professionalRole"),
      caseReference: data.get("caseReference"),
      authorizedToEnquire: data.get("authorizedToEnquire") === "Confirmed",
      country: data.get("country"),
      state: data.get("state"),
      district: data.get("district"),
      city: data.get("city"),
      area: data.get("area"),
      postalCode: data.get("postalCode"),
      policeStation: data.get("policeStation"),
      timing: data.get("timing"),
      summary: data.get("message"),
      agreementName: data.get("name"),
      agreementAccepted: data.get("agreementAccepted") === "Confirmed",
    };
    const response = await fetch("/api/detective-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The secure case register could not save this enquiry.");

    payload.agreementVersion = result.agreementVersion;
    const pdf = buildCasePdf(data, result.caseNumber, result.createdAt);
    const fileName = `${result.caseNumber}.pdf`;
    const objectUrl = URL.createObjectURL(pdf);
    casePdfLink.href = objectUrl;
    casePdfLink.download = fileName;
    casePdfLink.textContent = `Download case PDF · ${result.caseNumber}`;
    casePdfLink.hidden = false;
    casePdfLink.click();
    caseStatus.textContent = `Case ${result.caseNumber} created. Your preliminary acknowledgement PDF is downloading.`;

    try {
      const pdfData = await toDataUrl(pdf);
      const uploadResponse = await fetch("/api/detective-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach-pdf",
          caseId: result.caseId,
          caseNumber: result.caseNumber,
          uploadToken: result.uploadToken,
          pdfData,
        }),
      });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "PDF email-link setup failed.");
      caseStatus.textContent = uploadResult.emailSent
        ? `Case ${result.caseNumber} created. The PDF was downloaded and a private 7-day link was emailed to you.`
        : uploadResult.emailReason === "email_not_configured"
          ? `Case ${result.caseNumber} created and PDF downloaded. Automatic email link is not configured yet; contact info@arrai.in with this case number.`
          : `Case ${result.caseNumber} created and PDF downloaded, but the email link could not be delivered. Contact info@arrai.in with this case number.`;
    } catch {
      caseStatus.textContent = `Case ${result.caseNumber} created and PDF downloaded. The private email link could not be prepared; contact info@arrai.in with this case number.`;
    }
  } catch (error) {
    caseStatus.textContent = error.message || "Case intake could not be completed.";
  } finally {
    submitButton.disabled = false;
  }
});
