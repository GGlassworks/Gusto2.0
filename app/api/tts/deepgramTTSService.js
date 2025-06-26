import { Deepgram } from "@deepgram/sdk";
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

export async function speakText(text, language = "en") {
  const voice = language === "es" ? "aura-2-sirio-es" : "aura-2-orpheus-en";
  return await deepgram.speak.request(
    { text },
    { model: voice, encoding: "mp3", speed: 1 }
  );
}
