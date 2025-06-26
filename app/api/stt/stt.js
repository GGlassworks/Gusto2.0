// app/api/stt/route.js
import { Deepgram } from "@deepgram/sdk";

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

export async function POST(req) {
  if (!process.env.DEEPGRAM_API_KEY) {
    return new Response("Missing Deepgram API key", { status: 500 });
  }

  // Assume audio comes in as a binary stream or base64 string
  const audioBuffer = await req.arrayBuffer();
  try {
    const deepgramRes = await deepgram.transcription.preRecorded(
      { buffer: Buffer.from(audioBuffer), mimetype: "audio/wav" },
      { punctuate: true, language: "en" } // or use auto
    );

    return Response.json({
      success: true,
      transcript: deepgramRes.results.channels[0].alternatives[0].transcript,
      deepgram: deepgramRes,
    });
  } catch (error) {
    console.error("STT Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
