const inquiryForm = document.querySelector("#inquiryForm");
const inquiryStatus = document.querySelector("#inquiryStatus");

inquiryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!inquiryForm.reportValidity()) return;
  const button = inquiryForm.querySelector('[type="submit"]');
  button.disabled = true;
  inquiryStatus.textContent = "Sending your message…";
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(inquiryForm))),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Your message could not be sent.");
    inquiryForm.reset();
    inquiryStatus.textContent = result.emailSent
      ? "Message sent. We will reply to your email."
      : "Message saved. We will reply when it is reviewed.";
  } catch (error) {
    inquiryStatus.textContent = error.message || "Your message could not be sent.";
  } finally {
    button.disabled = false;
  }
});
