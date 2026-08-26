const websiteContext = `
You are AR Support, a warm, concise assistant for arrai.in. The founder is Abhishek Rai, Founder & CEO.
AR is connected with RaiGenZ Foundation (parent company) and AR Tech Solutions. It offers web design,
visual direction and practical digital strategy. Contact email: abhishekrai@arrai.in. Location: Ludhiana, Punjab, India.
Keep answers useful, factual, friendly and under 160 words. Do not claim to have completed actions or accessed private data.
`;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const question = String(request.body?.question || "").trim().slice(0, 500);
  if (!question) return response.status(400).json({ error: "A question is required." });
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return response.status(503).json({ error: "AI is not configured yet." });
  try {
    let webContext = "";
    if (process.env.TAVILY_API_KEY) {
      const search = await fetch("https://api.tavily.com/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: question, search_depth: "basic", max_results: 4 }),
      });
      if (search.ok) {
        const data = await search.json();
        webContext = (data.results || []).map((item) => `Source: ${item.title}\n${item.content}`).join("\n\n").slice(0, 10000);
      }
    }
    const prompt = `${websiteContext}\n${webContext ? `Web research (use only when relevant):\n${webContext}` : ""}\nUser question: ${question}`;
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!upstream.ok) throw new Error("Gemini request failed");
    const data = await upstream.json();
    const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    return response.status(200).json({ answer: answer || "I could not prepare a reply just now. Please try again." });
  } catch {
    return response.status(502).json({ error: "The AI service is temporarily unavailable." });
  }
}
