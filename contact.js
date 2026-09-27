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
