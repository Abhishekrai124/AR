const websiteContext = `
You are AR Support, a warm, concise assistant for arrai.in. The founder is Abhishek Rai, Founder & CEO.
AR is connected with RaiGenZ Foundation (parent company) and AR Tech Solutions. It offers web design,
visual direction and practical digital strategy. Contact email: abhishekrai@arrai.in. Location: Ludhiana, Punjab, India.
Keep answers useful, factual, friendly and under 160 words. Do not claim to have completed actions or accessed private data.
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
    let webContext = "";
    if (process.env.TAVILY_API_KEY) {
      const search = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: question,
          search_depth: "basic",
          max_results: 4,
        }),
      });
      if (search.ok) {
        const data = await search.json();
        webContext = (data.results || [])
          .map((item) => `Source: ${item.title}\n${item.content}`)
          .join("\n\n")
          .slice(0, 10000);
      }
    }
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
      const data = await requestJson(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
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
    }
    return response.status(503).json({ error: "AI is not configured yet." });
  } catch {
    return response
      .status(502)
      .json({ error: "The AI service is temporarily unavailable." });
  }
}
