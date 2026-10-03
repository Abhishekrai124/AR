import { generateText } from "ai";

const websiteContext = `
You are Miss Makima, the warm, concise public guide for arrai.in. The founder is Abhishek Rai, Founder & CEO.
ARRAI is connected with RaiGenZ Foundation (parent company) and AR Tech Solutions. It offers web design,
visual direction and practical digital strategy. The business contact email is abhishekrai@arrai.in and the location is Ludhiana, Punjab, India.

You know these public areas of the website:
- Home: founder introduction, public spotlight cards, social links, community preview and public updates.
- About: ARRAI's story and founder context.
- Services: web design, visual direction and practical digital strategy.
- Projects: portfolio and current work.
- Contact: business enquiries.
- Community: signed-in members can manage profiles, posts, follows, messages and calls.
- Chess, music and calendar: their dedicated public pages provide their respective experiences. ARRAI Pay is hosted at https://pay.arrai.in.
- ARRAI Detective Agency: lawful, authorized enquiry review only. It does not provide emergency response, legal advice,
  police/court filing, hacking, spyware, unauthorized surveillance, access to private accounts, or private communications.
  Case intake asks for a broad non-sensitive summary. Clients use the private case desk; approved members use the member portal.

Give practical navigation help and answer only with information you know. Keep replies friendly, factual and under 160 words.
Never claim to have completed an action, changed the website, checked a private case, seen a user account, or accessed private data.
Never disclose credentials, private phone numbers, owner-only data, detective case details, member IDs, or personal data.
Only the separate verified Owner Studio can make approved site changes after an explicit confirmation there.
`;

// Provider keys stay server-side. The assistant can be sweet in public while
// its credentials remain safely boring behind the curtain.

const requestJson = async (url, options) => {
  const signal = AbortSignal.timeout(15000);
  const result = await fetch(url, { ...options, signal });
  if (!result.ok) throw new Error(`AI provider returned ${result.status}`);
  return result.json();
};

const openSourceProviders = [
  {
    key: "GROQ_API_KEY",
    name: "Groq Llama",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  },
  {
    key: "CEREBRAS_API_KEY",
    name: "Cerebras Llama",
    url: "https://api.cerebras.ai/v1/chat/completions",
    model: process.env.CEREBRAS_MODEL || "llama-3.3-70b",
  },
  {
    key: "OPENROUTER_API_KEY",
    name: "OpenRouter free model",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model:
      process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
  },
  {
    key: "HUGGINGFACE_API_KEY",
    name: "Hugging Face open model",
    url: "https://router.huggingface.co/v1/chat/completions",
    model: process.env.HUGGINGFACE_MODEL || "Qwen/Qwen2.5-72B-Instruct",
  },
];

const askOpenSourceProvider = async (provider, prompt) => {
  const data = await requestJson(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env[provider.key]}`,
      "Content-Type": "application/json",
      ...(provider.key === "OPENROUTER_API_KEY"
        ? { "HTTP-Referer": "https://arrai.in", "X-Title": "AR Support" }
        : {}),
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: websiteContext },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 320,
    }),
  });
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error(`${provider.name} returned an empty answer`);
  return answer;
};

const getWebContext = async (question) => {
  if (!process.env.TAVILY_API_KEY) return "";
  try {
    const search = await requestJson("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: question,
        search_depth: "basic",
        max_results: 4,
      }),
    });
    return (search.results || [])
      .map((item) => `Source: ${item.title}\n${item.content}`)
      .join("\n\n")
      .slice(0, 10000);
  } catch {
    // Web research is optional. A bad key or temporary outage must not stop chat.
    return "";
  }
};

const askGateway = async (prompt) => {
  const { text } = await generateText({
    model: process.env.AI_GATEWAY_MODEL || "openai/gpt-5.5",
    system: websiteContext,
    prompt,
  });
  if (!text?.trim()) throw new Error("AI Gateway returned an empty answer");
  return text.trim();
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const question = String(request.body?.question || "")
    .trim()
    .slice(0, 500);
  if (!question)
    return response.status(400).json({ error: "A question is required." });
  try {
    const webContext = await getWebContext(question);
    const prompt = `${webContext ? `Web research (use only when relevant):\n${webContext}\n\n` : ""}User question: ${question}`;
    const configuredProviders = openSourceProviders.filter(
      (provider) => process.env[provider.key],
    );
    for (const provider of configuredProviders) {
      try {
        const answer = await askOpenSourceProvider(provider, prompt);
        return response.status(200).json({ answer, provider: provider.name });
      } catch {
        // A free provider can rate-limit; continue to the next configured provider.
      }
    }
    if (process.env.GEMINI_API_KEY) {
      try {
        const data = await requestJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || "gemini-2.5-flash")}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${websiteContext}\n${prompt}` }] }],
            }),
          },
        );
        const answer = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("")
          .trim();
        if (answer)
          return response.status(200).json({ answer, provider: "Gemini" });
      } catch {
        // Keep the same graceful failure path as the other optional providers.
      }
    }
    if (process.env.AI_GATEWAY_API_KEY) {
      try {
        const answer = await askGateway(prompt);
        return response.status(200).json({ answer, provider: "AI Gateway" });
      } catch {
        // A configured gateway can still be temporarily unavailable.
      }
    }
    return response.status(503).json({ error: "AI is not configured yet." });
  } catch {
    return response
      .status(502)
      .json({ error: "The AI service is temporarily unavailable." });
  }
}
