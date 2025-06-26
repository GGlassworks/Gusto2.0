export async function getLLMReply({ text, language = "en" }) {
  const messages = [
    {
      role: "system",
      content: `You are Gusto, a helpful, bilingual (English/Spanish) glass and glazing expert. Reply only in ${language === "es" ? "Spanish" : "English"}.`,
    },
    { role: "user", content: text },
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 256,
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}
