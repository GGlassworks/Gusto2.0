import { useRef, useState } from "react";

// Usage: const { isRecording, transcript, aiReply, audioUrl, startRecording, stopRecording, playAudio } = useVoiceBot()
export function useVoiceBot() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [aiReply, setAiReply] = useState("");
  const mediaRecorder = useRef();
  const audioChunks = useRef([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new window.MediaRecorder(stream);
    audioChunks.current = [];
    mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data);
    mediaRecorder.current.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
      const arrayBuffer = await audioBlob.arrayBuffer();
      // Send to backend
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: arrayBuffer
      });
      const audioBuffer = await res.arrayBuffer();
      // For displaying transcript and AI reply
      setTranscript(decodeURIComponent(res.headers.get("X-Transcript") || ""));
      setAiReply(decodeURIComponent(res.headers.get("X-AI-Reply") || ""));
      setAudioUrl(URL.createObjectURL(new Blob([audioBuffer], { type: "audio/mp3" })));
    };
    setIsRecording(true);
    mediaRecorder.current.start();
  }

  function stopRecording() {
    setIsRecording(false);
    mediaRecorder.current?.stop();
  }

  function playAudio() {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  }

  return { isRecording, transcript, aiReply, audioUrl, startRecording, stopRecording, playAudio };
}
