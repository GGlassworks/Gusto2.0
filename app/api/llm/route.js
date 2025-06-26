// app/api/llm/route.js
export async function POST(req) {
  const { messages } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return new Response("Missing OpenAI key", { status: 500 });
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      stream: true,
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text();
    console.error("🔴 LLM Error:", err);
    return new Response("Failed to stream LLM response", { status: 500 });
  }

  return new Response(openaiRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
