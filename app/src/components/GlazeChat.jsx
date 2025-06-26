"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Volume2, VolumeX, Send, Mic, StopCircle, Paperclip } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { submitToPipedrive } from "@/app/actions/submitToPipedrive"
import { appendNoteToCustomerDoc } from "@/utils/googleDocs" // <- Utility for support notes!
import { newLeadHtmlTemplate } from "@/utils/emailTemplates" // <- Email for notifications!
import { sendEmail } from "@/utils/sendEmail" // <- Nodemailer wrapper!
import LOGO from "/public/logo.png"
import PDF_ICON from "/public/pdf-icon.png"
import FILE_ICON from "/public/file-icon.png"

function processTextForSpeech(text) {
  return text
    .replace(/Gusto/gi, "Gus-toh")
    .replace(/([.?!])\s*/g, "$1\n")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\w\s.,!?'"-]/g, "")
    .trim()
}

// --- Helper for file previews
function getFilePreview(file) {
  if (typeof file === "string" && file.startsWith("http")) return file;
  if (file?.type?.startsWith("image/")) return URL.createObjectURL(file);
  if (file?.type === "application/pdf") return PDF_ICON;
  return FILE_ICON;
}

export default function GlazeChat() {
  // --- State definitions ---
  const [language, setLanguage] = useState("en")
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [leadData, setLeadData] = useState({})
  const [conversationStage, setConversationStage] = useState("greeting")
  const [isListening, setIsListening] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState(null)
  const [hasSubmitted, setHasSubmitted] = useState(false) // prevent double-submits

  // --- File Upload state ---
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef()

  // --- Voice and chat refs ---
  const audioRef = useRef(null)
  const spokenMessageIds = useRef(new Set())
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  // --- Email validation ---
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // --- Scroll on message update ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // --- Speech Recognition init ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = language

      recognitionRef.current.onstart = () => setIsListening(true)
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
      }
      recognitionRef.current.onend = () => setIsListening(false)
      recognitionRef.current.onerror = (event) => {
        setIsListening(false)
        if (event.error === "not-allowed" || event.error === "permission-denied") {
          alert("Microphone access denied. Please enable it.")
        }
      }
    }
    return () => recognitionRef.current?.stop()
  }, [language])

  // --- Initial greeting (multi-language ready) ---
  useEffect(() => {
    const userLang = navigator.language.split("-")[0]
    const supportedLang = initialMessagesDict[userLang] ? userLang : "en"
    setLanguage(supportedLang)
    setMessages([{ ...initialMessagesDict[supportedLang][0], id: Date.now() + Math.random() }])
  }, [])

  // --- Text-to-Speech (calls backend or browser TTS) ---
  const playTTS = async (message) => {
    if (!message || isMuted) return
    if (spokenMessageIds.current.has(message.id)) return
    try {
      const cleaned = processTextForSpeech(message.content)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      // === Swap to your Deepgram/OpenAI TTS endpoint if needed ===
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned }),
      })
      if (!res.ok) throw new Error("TTS error")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.play()
      spokenMessageIds.current.add(message.id)
    } catch (err) {
      // Optionally fallback to browser TTS
      if ('speechSynthesis' in window) {
        const utter = new window.SpeechSynthesisUtterance(message.content)
        window.speechSynthesis.speak(utter)
      }
    }
  }

  // --- File Upload Handler (calls /api/upload) ---
  async function uploadFiles(files) {
    setUploading(true)
    const formData = new FormData()
    ;[...files].forEach(file => formData.append("files", file))
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (data?.links?.length) {
        setMessages(msgs =>
          [...msgs, ...data.links.map(link => ({
            sender: "bot", fileUrl: link.url, fileName: link.name, fileType: link.type, id: Date.now() + Math.random()
          }))]
        )
      }
    } catch (err) {
      setMessages(msgs => [...msgs, { sender: "bot", text: "Sorry, file upload failed!" }])
    }
    setUploading(false)
  }
  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setAttachments(prev => [...prev, ...e.dataTransfer.files])
    }
  }
  function handleDragOver(e) { e.preventDefault(); setDragActive(true) }
  function handleDragLeave() { setDragActive(false) }
  function handleFileChange(e) { setAttachments(prev => [...prev, ...e.target.files]) }
  function handleAttachClick() { fileInputRef.current.click() }

  // --- Voice button logic ---
  const toggleSpeechRecognition = () => {
    if (recognitionRef.current) {
      if (isListening) recognitionRef.current.stop()
      else { setInput(""); recognitionRef.current.start() }
    }
  }

  // --- Main send handler ---
  const handleSend = async () => {
    if (!input.trim() && !attachments.length) return

    let newMsgs = [...messages]
    if (input.trim()) newMsgs.push({ role: "user", content: input.trim(), id: Date.now() + Math.random() })

    // --- Attachments: upload to Drive
    if (attachments.length > 0) {
      attachments.forEach(file => {
        newMsgs.push({
          sender: "user",
          file,
          fileName: file.name,
          fileType: file.type,
          preview: getFilePreview(file),
          id: Date.now() + Math.random(),
        })
      })
      setMessages(newMsgs)
      await uploadFiles(attachments)
      setAttachments([])
    } else {
      setMessages(newMsgs)
    }
    setInput("")
    setIsLoading(true)
    setError(null)

    // === AI/CRM Lead logic below is unchanged from your version (see earlier posts) ===
    // (You can use your full logic for form flow, S.O#, Pipedrive, etc.)
    // ... [keep your handleSend code from above, unchanged] ...
    // --- Only difference: after successful lead, trigger email + google doc log
    // Add this after successful submit to Pipedrive:
    /*
    if (result.success) {
      // Email notification
      await sendEmail({
        to: "support@glazeglassworks.com",
        subject: `New Website Lead: ${leadInfo.fullName}`,
        html: newLeadHtmlTemplate(leadInfo),
        replyTo: leadInfo.email || undefined,
      });
      // Google Docs note
      await appendNoteToCustomerDoc({
        customerName: `${currentLeadData.firstName} ${currentLeadData.lastName}`,
        note: comprehensiveNotes,
      });
    }
    */
    // [Finish with setIsLoading(false), setHasSubmitted(true), etc.]
  }

  // --- UI return (add file upload bar) ---
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 w-[380px] max-w-[98vw] h-[650px] max-h-[98vh] rounded-3xl shadow-2xl flex flex-col border border-white/30 glassmorphic transition-all
        ${dragActive ? "ring-4 ring-blue-300 ring-inset" : ""}`}
      style={{
        background: "linear-gradient(120deg, rgba(255,255,255,0.22) 0%, rgba(0,80,200,0.12) 100%)",
        boxShadow: "0 10px 48px 0 rgba(30,70,130,0.16)",
        backdropFilter: "blur(34px) saturate(170%)",
        WebkitBackdropFilter: "blur(34px) saturate(170%)"
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-gradient-to-r from-white/10 to-blue-200/10 backdrop-blur-xl relative">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-white/80 shadow-lg border-2 border-blue-200 overflow-hidden">
          <img src={LOGO} alt="Glaze Glassworks" className="h-10 w-10 object-contain" style={{ display: "block", margin: "auto" }} />
        </div>
        <span className="font-extrabold text-lg text-blue-900 drop-shadow tracking-wide">Glaze Glassworks</span>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => setIsMuted(m => !m)} title={isMuted ? "Unmute voice" : "Mute voice"} className="text-blue-800 hover:bg-blue-200/20">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </Button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 custom-scrollbar">
        {messages.filter(msg => msg.role !== "system").map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} transition-all duration-300`}>
            <div className={`min-w-[56px] max-w-[85%] px-4 py-2 rounded-2xl mb-1 shadow-xl
                ${msg.role === "assistant"
                  ? "bg-white/90 text-gray-900 self-start"
                  : "bg-gradient-to-br from-blue-600/90 to-sky-400/80 text-white self-end"}
                transition-all duration-300`}
              style={{ backdropFilter: "blur(6px)" }}
            >
              {msg.content}
              {/* File bubbles (user/bot) */}
              {msg.file && (
                <div className="mt-2 flex flex-col items-center">
                  {msg.file.type.startsWith("image/")
                    ? <img src={msg.preview} alt={msg.fileName} className="max-h-32 rounded-lg shadow-lg" />
                    : (
                      <a href={msg.preview} download={msg.fileName} className="flex items-center gap-2 text-blue-900 underline hover:text-blue-700">
                        <img src={getFilePreview(msg.file)} alt="file" className="w-7 h-7" />
                        {msg.fileName}
                      </a>
                    )
                  }
                </div>
              )}
              {msg.fileUrl && (
                <div className="mt-2 flex flex-col items-center">
                  {msg.fileType?.startsWith("image/")
                    ? <img src={msg.fileUrl} alt={msg.fileName} className="max-h-32 rounded-lg shadow-lg" />
                    : (
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-800 underline hover:text-blue-600"
                      >
                        <img src={msg.fileType?.includes("pdf") ? PDF_ICON : FILE_ICON} alt="file" className="w-7 h-7" />
                        {msg.fileName}
                      </a>
                    )
                  }
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 px-4 py-2 bg-white/25 rounded-lg mx-4 my-2 border border-blue-200/30 animate-fade-in">
          {attachments.map((file, i) => (
            <div key={i} className="flex flex-col items-center">
              {file.type.startsWith("image/")
                ? <img src={getFilePreview(file)} alt={file.name} className="w-12 h-12 rounded-lg object-cover" />
                : <img src={getFilePreview(file)} alt="file" className="w-8 h-8" />
              }
              <span className="text-xs text-blue-900 mt-1 break-all">{file.name}</span>
            </div>
          ))}
        </div>
      )}
      {dragActive && (
        <div className="absolute inset-0 z-50 bg-blue-300/40 flex items-center justify-center pointer-events-none rounded-3xl animate-fade-in">
          <span className="text-xl font-bold text-blue-800">Drop files to upload</span>
        </div>
      )}

      {/* Input bar */}
      <form className="flex gap-2 px-5 py-4 border-t border-white/10 bg-gradient-to-r from-white/10 to-blue-100/10 backdrop-blur-xl" onSubmit={e => { e.preventDefault(); handleSend() }}>
        <button type="button" title="Attach a file"
          className="flex-shrink-0 p-2 rounded-lg hover:bg-blue-300/25 transition group focus:ring-2 focus:ring-blue-400"
          onClick={handleAttachClick}
        >
          <Paperclip className="w-6 h-6 text-blue-800 group-hover:scale-110 transition" />
          <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
        </button>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type or speak your message…"
          className="flex-1 border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-base"
          disabled={isLoading || isListening || isPending || uploading}
          onKeyPress={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        {recognitionRef.current && (
          <Button
            onClick={toggleSpeechRecognition}
            disabled={isLoading || isPending}
            className={`px-4 shadow-lg ${isListening ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"} text-white`}
            title={isListening ? "Stop speaking" : "Speak your message"}
          >
            {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
          </Button>
        )}
        <Button
          onClick={handleSend}
          disabled={isLoading || isListening || isPending || uploading}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 shadow-lg"
        >
          <Send size={18} />
        </Button>
      </form>
      <p className="text-xs text-slate-500 mt-2 text-center pb-2">
        Powered by AI {isPending && "• Submitting to Pipedrive..."}
      </p>
    </div>
  )
}

const initialMessagesDict = {
  en: [
    {
      role: "assistant",
      content:
        "Hi there, I'm Gusto, your glass guide at Glaze Glassworks! If you're looking for answers, inspiration, or quotes — our services page is the perfect place to start. And if you're ready, I can help gather a few quick details to get things rolling!",
    },
  ],
  es: [
    {
      role: "assistant",
      content: "¡Hola! 👋 Soy Gusto, tu experto personal en vidrio aquí en Glaze Glassworks! ¿Cómo puedo ayudarte hoy?",
    },
  ],
}
