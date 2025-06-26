import { Deepgram } from "@deepgram/sdk";
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

export async function transcribeAudioBuffer(audioBuffer, mimetype = "audio/wav") {
  const result = await deepgram.transcription.preRecorded(
    { buffer: audioBuffer, mimetype },
    { punctuation: true, smart_format: true, model: "nova-2", language: "und" }
  );
  return result.results;
}
