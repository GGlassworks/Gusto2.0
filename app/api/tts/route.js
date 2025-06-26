// /app/api/tts/route.js
import { NextResponse } from "next/server";
import { Deepgram } from "@deepgram/sdk";

// Initialize Deepgram with your API key from env
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

export async function POST(req) {
  try {
    // Parse body for text and speed (optional, defaults to 1)
    const { text, speed = 1 } = await req.json();

    // Check for required API key
    if (!process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json("Missing Deepgram API key", { status: 500 });
    }

    // Validate text input
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json("No text provided", { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json("Text too long", { status: 400 });
    }

    // --- Simple Spanish detection, swap to more advanced logic if needed ---
    const isSpanish =
      /[áéíóúñ¿¡]/i.test(text) ||
      /(?: el | la | de | los | las | y | en | por | para )/i.test(text);
    const voice = isSpanish ? "aura-2-sirio-es" : "aura-2-orpheus-en";

    // Request Deepgram TTS
    const ttsRes = await deepgram.speak.request(
      { text },
      { model: voice, encoding: "mp3", speed }
    );

    // Stream mp3 audio back to client
    return new Response(ttsRes, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json("Internal error", { status: 500 });
  }
}
