window.detectiveServiceCatalog = [
  { category: "Personal & family", title: "Missing-person & location enquiries", description: "Lawful searches using public or authorized leads. Not for stalking, harassment or avoiding legal safeguards." },
  { category: "Personal & family", title: "Background & address verification", description: "Relevant, lawfully accessible identity, address and background checks, with clear record limitations." },
  { category: "Personal & family", title: "Pre-matrimonial verification", description: "Consent-aware verification of relevant, lawfully available information before marriage." },
  { category: "Personal & family", title: "Stalking, harassment & safety documentation", description: "Evidence organization and safety-focused fact gathering. Immediate danger must go to emergency services." },
  { category: "Digital evidence", title: "Online fraud, impersonation & scam evidence", description: "Organize public or client-supplied evidence for platform, bank or police reports; no account intrusion." },
  { category: "Digital evidence", title: "Social-media & open-source research", description: "Review publicly available content and digital footprints relevant to an authorized enquiry." },
  { category: "Digital evidence", title: "Email, document & media review", description: "Review client-supplied email headers, documents or media; specialist forensic referral where needed." },
  { category: "Digital evidence", title: "Fraudulent website reporting support", description: "Prepare evidence and coordinate abuse reports to platforms, hosts or registrars; takedown is not guaranteed." },
  { category: "Legal & records", title: "Witness locating & voluntary interviews", description: "Locate potential witnesses and request voluntary interviews—never coercion or representation as law enforcement." },
  { category: "Legal & records", title: "Litigation support & document research", description: "Authorized factual research and evidence organization to support a legal team; not legal advice." },
  { category: "Legal & records", title: "Process-serving coordination", description: "Coordinate lawful delivery of legal documents where local rules and authorization allow." },
  { category: "Business & claims", title: "Business, vendor & employee due diligence", description: "Relevant checks using lawful records, appropriate consent and employment/privacy safeguards." },
  { category: "Business & claims", title: "Insurance & claim verification", description: "Authorized fact verification and evidence summaries for insurers, policyholders or counsel." },
  { category: "Business & claims", title: "Corporate fraud & internal fact review", description: "Review authorized records, timelines and public leads; specialist accounting may be required." },
  { category: "Assets & property", title: "Property, vehicle & asset record research", description: "Public-registry and authorized-record research; protected ownership or financial data is never accessed without authority." },
  { category: "Safety & technical", title: "Threat assessment & risk review", description: "Structured review of supplied facts and public indicators, with escalation guidance for urgent risks." },
  { category: "Safety & technical", title: "Technical surveillance counter-measures", description: "Non-destructive inspection for suspected unauthorized devices, subject to capability and local law." },
  { category: "Other enquiries", title: "Related or unlisted investigation request", description: "Submit a short outline for a lawful scope review. We will explain any specialist or authority requirements first." },
];

const serviceCatalog = document.querySelector("#detectiveServiceCatalog");
if (serviceCatalog) {
  const search = document.querySelector("#detectiveServiceSearch");
  const category = document.querySelector("#detectiveServiceCategory");
  const count = document.querySelector("#detectiveServiceCount");
  [...new Set(window.detectiveServiceCatalog.map((service) => service.category))]
    .forEach((name) => category.add(new Option(name, name)));
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const matches = window.detectiveServiceCatalog.filter((service) =>
      (category.value === "all" || category.value === service.category) &&
      `${service.title} ${service.category} ${service.description}`.toLowerCase().includes(query),
    );
    serviceCatalog.replaceChildren();
    matches.forEach((service, index) => {
      const item = document.createElement("article");
      item.className = "investigation-service";
      const label = document.createElement("span");
      label.textContent = `${String(index + 1).padStart(2, "0")} / ${service.category}`;
      const title = document.createElement("h3"); title.textContent = service.title;
      const description = document.createElement("p"); description.textContent = service.description;
      item.append(label, title, description);
      serviceCatalog.append(item);
    });
    count.textContent = `${matches.length} practical services`;
    serviceCatalog.dataset.empty = String(matches.length === 0);
  };
  search.addEventListener("input", render);
  category.addEventListener("change", render);
  render();
}
