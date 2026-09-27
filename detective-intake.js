const caseForm = document.querySelector("#caseIntake");
const serviceSelect = document.querySelector("#caseService");
const caseStatus = document.querySelector("#caseSubmissionStatus");
const clientType = document.querySelector("#clientType");
const professionalFields = document.querySelector("#professionalFields");
const studentStatusField = document.querySelector("#studentStatusField");
const studentStatus = document.querySelector("#studentStatus");
const professionalTypes = new Set(["Lawyer or legal professional", "Police or law-enforcement official", "Public authority or government body", "Business or employer", "Insurer or claims professional", "Nonprofit or community organization"]);

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

caseForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!caseForm.reportValidity()) return;
  const formData = new FormData(caseForm);
  const button = caseForm.querySelector('[type="submit"]');
  button.disabled = true;
  caseStatus.textContent = "Creating your confidential case…";
  const payload = {
    action: "create-case", requestType: formData.get("requestType"), clientName: formData.get("name"), clientEmail: formData.get("email"),
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
