"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mic, StopCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { submitToPipedrive } from "@/app/actions/submitToPipedrive"
import Image from "next/image"

function processTextForSpeech(text) {
  return text
    .replace(/Gusto/gi, "Gus-toh")
    .replace(/([.?!])\s*/g, "$1\n")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\w\s.,!?'"-]/g, "")
    .trim()
}

export default function GlazeChatPreview() {
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

  const audioRef = useRef(null)
  const spokenMessageIds = useRef(new Set())
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  // ✅ Enhanced email validation function
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // ✅ Enhanced streaming chunk handler
  const handleStreamChunk = (data) => {
    if (data === "[DONE]") return // Fix for JSON chunk parse error
    try {
      const json = JSON.parse(data)
      const deltaContent = json.choices[0]?.delta?.content
      return deltaContent || ""
    } catch (err) {
      console.warn("Invalid JSON chunk skipped:", data)
      return ""
    }
  }

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = language

      recognitionRef.current.onstart = () => {
        setIsListening(true)
        console.log("🎙️ Speech recognition started.")
      }

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        console.log("🗣️ Recognized speech:", transcript)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
        console.log("🎙️ Speech recognition ended.")
      }

      recognitionRef.current.onerror = (event) => {
        console.error("🎙️ Speech recognition error:", event.error)
        setIsListening(false)
        if (event.error === "not-allowed" || event.error === "permission-denied") {
          alert("Microphone access denied. Please enable it in your browser settings to use voice input.")
        } else if (event.error === "no-speech") {
          if (!input.trim()) setInput("")
        }
      }
    } else {
      console.warn("Speech Recognition API not supported in this browser.")
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [language, input])

  // Initial setup for language
  useEffect(() => {
    const userLang = navigator.language.split("-")[0]
    const supportedLang = initialMessagesDict[userLang] ? userLang : "en"
    setLanguage(supportedLang)

    const generateAndSetInitialMessages = async () => {
      try {
        console.log("🚀 Starting initial message setup...")

        const greetingMessage = { ...initialMessagesDict[supportedLang][0], id: Date.now() + Math.random() }
        console.log("📝 Setting greeting message:", greetingMessage.content.substring(0, 50) + "...")
        setMessages([greetingMessage])
        await playTTS(greetingMessage)

        console.log("✅ Initial setup complete - CRM will handle S.O# assignment")
      } catch (error) {
        console.error("Failed to setup initial messages:", error)
        const initialMsg = { ...initialMessagesDict[supportedLang][0], id: Date.now() + Math.random() }
        setMessages([initialMsg])
        playTTS(initialMsg)
      }
    }
    generateAndSetInitialMessages()
  }, [])

  const playTTS = async (message) => {
    if (!message || isMuted) return
    if (spokenMessageIds.current.has(message.id)) {
      console.log("🛑 Skipping duplicate TTS playback for message ID:", message.id)
      return
    }

    try {
      const cleaned = processTextForSpeech(message.content)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

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
      console.error("🔊 Playback error:", err)
    }
  }

  const toggleSpeechRecognition = () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop()
      } else {
        setInput("")
        recognitionRef.current.start()
      }
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = { role: "user", content: input.trim(), id: Date.now() + Math.random() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)
    setError(null) // Clear any previous errors

    let botResponseContent = ""
    let nextConversationStage = conversationStage
    let systemPrompt = ""
    const currentLeadData = { ...leadData }

    const extractAndFormatName = (text) => {
      const words = text.trim().split(/\s+/)
      let name = ""
      if (words.length > 0) {
        name = words[words.length - 1]
      }
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
    }

    // Handle data collection based on current stage
    switch (conversationStage) {
      case "greeting":
        botResponseContent =
          "Fantastic! To kick things off and make sure I'm helping you perfectly, could you share your first name with me?"
        nextConversationStage = "firstName"
        break
      case "firstName":
        currentLeadData.firstName = extractAndFormatName(input)
        setLeadData(currentLeadData)
        systemPrompt = `You are Gusto, a very upbeat, friendly, and helpful AI assistant for Glaze Glassworks. Your primary goal is to collect customer information to create a lead for glass installation or service. You need to ask for one piece of information at a time, clearly and politely.
        The customer has just provided their first name: ${currentLeadData.firstName}.
        Your next task is to ask for their last name. Be appreciative and enthusiastic. Keep your response concise.`
        nextConversationStage = "lastName"
        break
      case "lastName":
        currentLeadData.lastName = extractAndFormatName(input)
        setLeadData(currentLeadData)
        systemPrompt = `You are Gusto, a very upbeat, friendly, and helpful AI assistant for Glaze Glassworks. Your primary goal is to collect customer information to create a lead for glass installation or service. You need to ask for one piece of information at a time, clearly and politely.
        The customer has just provided their last name: ${currentLeadData.lastName}.
        Your next task is to ask for details about their specific glass needs. Encourage them to provide details like the type of project (e.g., shower enclosure, custom mirrors, window repairs, glass doors, wine rooms, smart glass, office partitions), dimensions, glass type (clear, frosted, textured), or frame preferences. Be enthusiastic and helpful. Keep your response concise.`
        nextConversationStage = "notes"
        break
      case "notes":
        currentLeadData.notes = input.trim()
        setLeadData(currentLeadData)
        systemPrompt = `You are Gusto, a very upbeat, friendly, and helpful AI assistant for Glaze Glassworks. Your primary goal is to collect customer information to create a lead for glass installation or service. You need to ask for one piece of information at a time, clearly and politely.
        The customer has just provided details about their glass needs.
        Your next task is to ask for the best phone number for our team to reach out to them. Be appreciative and enthusiastic. Keep your response concise.`
        nextConversationStage = "phone"
        break
      case "phone":
        currentLeadData.phone = input.trim()
        setLeadData(currentLeadData)
        systemPrompt = `You are Gusto, a very upbeat, friendly, and helpful AI assistant for Glaze Glassworks. Your primary goal is to collect customer information to create a lead for glass installation or service. You need to ask for one piece of information at a time, clearly and politely.
        The customer has just provided their phone number.
        Your next task is to ask for their email address. Explain that this helps send important updates. Be appreciative and enthusiastic. Keep your response concise.`
        nextConversationStage = "email"
        break
      case "email":
        const emailInput = input.trim()
        // ✅ Enhanced email validation
        if (!isValidEmail(emailInput)) {
          setError("Please enter a valid email address (e.g., john@example.com)")
          setIsLoading(false)
          return
        }
        currentLeadData.email = emailInput
        setLeadData(currentLeadData)
        systemPrompt = `You are Gusto, a very upbeat, friendly, and helpful AI assistant for Glaze Glassworks. Your primary goal is to collect customer information to create a lead for glass installation or service. You need to ask for one piece of information at a time, clearly and politely.
        The customer has just provided their email address.
        Your next task is to ask for the physical address for the job location. Explain that this helps plan everything perfectly. Be appreciative and enthusiastic. Keep your response concise.`
        nextConversationStage = "address"
        break
      case "address":
        currentLeadData.address = input.trim()
        setLeadData(currentLeadData)
        systemPrompt = `You are Gusto, a very upbeat, friendly, and helpful AI assistant for Glaze Glassworks. All required customer information (first name, last name, glass needs, phone, email, address) has been collected.
        Your final task is to confirm that all details are gathered and inform the customer that a specialist team will be in touch very soon to discuss everything. Be absolutely fantastic and enthusiastic! Keep your response concise. Do not mention any order numbers as the CRM will handle that.`
        nextConversationStage = "complete"
        break
      case "complete":
        systemPrompt = `You are Gusto, a very upbeat, friendly, and helpful AI assistant for Glaze Glassworks. The lead generation process is complete.
        Your task now is to offer further assistance if they have any more questions, maintaining your helpful and friendly persona. Keep your response concise.`
        nextConversationStage = "complete"
        break
      default:
        systemPrompt = `You are Gusto, a very upbeat, friendly, and helpful AI assistant for Glaze Glassworks. Your primary goal is to collect customer information to create a lead.
        It seems there might have been a misunderstanding. Please gently guide the user back to the current information needed. Keep your response concise.`
        nextConversationStage = "greeting"
    }

    // Only send to AI if not in the initial 'greeting' stage (which is hardcoded)
    if (conversationStage !== "greeting") {
      const messagesForAI = [{ role: "system", content: systemPrompt }, ...newMessages]

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messagesForAI }),
        })

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulatedContent = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n").filter((line) => line.trim() !== "")
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const jsonStr = line.substring(5)
              // ✅ Enhanced streaming chunk handling
              const deltaContent = handleStreamChunk(jsonStr)
              if (deltaContent) {
                accumulatedContent += deltaContent
              }
            }
          }
        }

        botResponseContent = accumulatedContent.trim()
        if (!botResponseContent) {
          botResponseContent = "I'm sorry, I couldn't generate a response. Could you please try again?"
        }
      } catch (error) {
        console.error("Error fetching AI response:", error)
        botResponseContent = "Oops! I'm having a little trouble connecting right now. Please try again in a moment!"
      }
    }

    // Update conversation stage
    setConversationStage(nextConversationStage)

    const botMessage = { role: "assistant", content: botResponseContent, id: Date.now() + Math.random() }
    setMessages((prev) => [...prev, botMessage])
    setIsLoading(false)
    await playTTS(botMessage)

    // After the AI response is generated and the conversation is complete
    if (nextConversationStage === "complete" && Object.keys(currentLeadData).length > 0 && !hasSubmitted) {
      // ✅ SINGLE submission using Server Action only with double-submit prevention
      startTransition(async () => {
        try {
          if (hasSubmitted) return // Extra safety check

          setHasSubmitted(true) // Prevent double submissions
          console.log("🚀 Submitting complete lead data using Server Action (SINGLE SUBMISSION)...")

          // Create comprehensive notes
          const comprehensiveNotes = `WEBSITE CHAT LEAD - ${new Date().toLocaleString()}

CUSTOMER INFORMATION:
- Full Name: ${currentLeadData.firstName} ${currentLeadData.lastName}
- First Name: ${currentLeadData.firstName}
- Last Name: ${currentLeadData.lastName}
- Email: ${currentLeadData.email || "Not provided"}
- Phone: ${currentLeadData.phone || "Not provided"}  
- Address: ${currentLeadData.address || "Not provided"}
- Service Interest: Glass Services

CONVERSATION DETAILS:
${currentLeadData.notes || "No conversation notes available"}

LEAD SOURCE: Website Chat Bot
SUBMISSION TIME: ${new Date().toISOString()}
PRIORITY: High - Contact within 24 hours

NEXT STEPS:
1. Contact customer to confirm project details
2. Schedule free estimate appointment  
3. Provide detailed quote based on requirements

CRITICAL INFORMATION FOR FOLLOW-UP:
- Customer completed full chat flow
- All contact information verified
- Ready for immediate follow-up
- High-intent lead from website interaction`

          const leadInfo = {
            fullName: `${currentLeadData.firstName} ${currentLeadData.lastName}`,
            phone: currentLeadData.phone || "",
            email: currentLeadData.email || "",
            address: currentLeadData.address || "",
            notes: comprehensiveNotes,
          }

          console.log("📤 Submitting ONCE to Pipedrive:", leadInfo.fullName)
          const result = await submitToPipedrive(leadInfo)
          console.log("📬 Server Action Result:", result)

          if (result.success) {
            console.log("✅ SINGLE submission successful!")
            // Update the bot response to include submission confirmation
            const updatedBotMessage = {
              role: "assistant",
              content:
                botResponseContent +
                `\n\n✅ Perfect! I've submitted your information to our team for immediate follow-up. You should receive confirmation shortly!`,
              id: Date.now() + Math.random(),
            }
            setMessages((prev) => [...prev.slice(0, -1), updatedBotMessage])
          } else {
            console.error("❌ Server Action failed:", result.error)
            setHasSubmitted(false) // Allow retry on failure
            setError("There was an issue submitting your information. Please try again.")
          }
        } catch (error) {
          console.error("❌ Failed to submit via Server Action:", error)
          setHasSubmitted(false) // Allow retry on failure
          setError("There was an issue submitting your information. Please try again.")
        }
      })
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto text-gray-800">
      <div className="flex justify-center mb-4">
        <Image src="/glaze-logo.png" alt="Glaze Glassworks Logo" width={80} height={80} />
      </div>
      <Card className="rounded-2xl shadow-lg">
        <CardContent className="space-y-2 p-4">
          <div className="text-center font-serif text-xl font-semibold">Contact Glaze Glassworks</div>
          <div className="text-sm text-center text-gray-500">
            Your privacy matters to us. All shared info stays secure. 🔒
          </div>

          <div className="h-72 overflow-y-auto space-y-2 bg-gray-50 rounded-xl p-2">
            <AnimatePresence>
              {messages
                .filter((msg) => msg.role !== "system")
                .map((msg, i) => (
                  <motion.div
                    key={i}
                    className={`p-2 rounded-xl max-w-xs ${msg.role === "assistant" ? "bg-blue-100 text-left" : "bg-green-100 text-right ml-auto"}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {msg?.content ?? "Message unavailable."}
                  </motion.div>
                ))}
            </AnimatePresence>
            {(isLoading || isPending) && <div className="text-gray-400 text-sm">Typing...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="font-serif"
              disabled={isLoading || isListening || isPending}
              onKeyPress={(e) => {
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
              className="bg-blue-600 text-white"
              disabled={isLoading || isListening || isPending}
            >
              Send
            </Button>
          </div>
          {error && <div className="mt-2 text-red-600 text-sm text-center">{error}</div>}
        </CardContent>
      </Card>
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
