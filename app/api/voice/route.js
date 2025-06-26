// /app/api/voice/route.js
import { Deepgram } from "@deepgram/sdk";
import { NextResponse } from "next/server";

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

export async function POST(req) {
  try {
    // 1. Get audio buffer from POST (assume raw binary body)
    const arrayBuffer = await req.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // 2. Transcribe with Deepgram
    const dgResult = await deepgram.transcription.preRecorded(
      { buffer: audioBuffer, mimetype: req.headers.get("content-type") || "audio/wav" },
      { punctuation: true, smart_format: true, model: "nova-2", language: "und" }
    );
    const text = dgResult.results.channels[0].alternatives[0].transcript || "";

    // 3. Language detection (super basic)
    const isSpanish = /[áéíóúñ¿¡]/i.test(text) || /(?: el | la | de | los | las )/i.test(text);
    const ttsVoice = isSpanish ? "aura-2-sirio-es" : "aura-2-orpheus-en";

    // 4. Get AI reply from OpenAI GPT-4o
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are Gusto, a professional glass and glazing AI assistant. Respond ONLY in ${isSpanish ? "Spanish" : "English"} and keep it friendly and informative.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 256,
      }),
    });
    const openaiJson = await openaiRes.json();
    const aiText = openaiJson.choices?.[0]?.message?.content || "";

    // 5. TTS with Deepgram
    const ttsAudioRes = await deepgram.speak.request(
      { text: aiText },
      { model: ttsVoice, encoding: "mp3", speed: 1 }
    );

    // 6. Send audio/mp3 plus transcript for UI
    return new Response(ttsAudioRes, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Transcript": encodeURIComponent(text),
        "X-AI-Reply": encodeURIComponent(aiText),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Voice API error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
