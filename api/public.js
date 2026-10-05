import contactHandler from "../lib/contact-api.js";
import assistantHandler from "../lib/assistant-api.js";
import walletBalanceHandler from "../lib/wallet-balance-api.js";

export default async function handler(request, response) {
  const action =
    request.query?.action ||
    new URL(request.url, "http://localhost").searchParams.get("action");

  if (action === "contact") return contactHandler(request, response);
  if (action === "assistant") return assistantHandler(request, response);
  if (action === "wallet-balance") return walletBalanceHandler(request, response);
  return response.status(404).json({ error: "Unknown public API action." });
}
