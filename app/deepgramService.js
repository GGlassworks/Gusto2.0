// /lib/voice/deepgramService.js
import { createClient } from '@deepgram/sdk'

class DeepgramVoiceService {
  constructor() {
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY)
    this.isHealthy = true
    this.fallbackCount = 0
    
    // Health check every 30 seconds
    setInterval(() => this.healthCheck(), 30000)
  }

  async healthCheck() {
    try {
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`
        }
      })
      this.isHealthy = response.ok
      if (this.isHealthy) this.fallbackCount = 0
    } catch (error) {
      this.isHealthy = false
    }
  }

  // Speech-to-Text with automatic language detection
  async transcribe(audioBuffer, options = {}) {
    try {
      if (!this.isHealthy) throw new Error('Deepgram unhealthy')
      
      const result = await this.deepgram.transcription.preRecorded(
        { buffer: audioBuffer, mimetype: options.mimetype || 'audio/webm' },
        {
          model: 'nova-2',
          punctuate: true,
          language: 'multi',  // Auto-detect language
          detect_language: true,
          smart_format: true,
          diarize: true,
          utterances: true,
          measurements: true,
          ...options
        }
      )

      const transcript = result.results.channels[0].alternatives[0]
      const detectedLanguage = result.results.channels[0].detected_language || 'en'
      
      return {
        text: transcript.transcript,
        confidence: transcript.confidence,
        language: detectedLanguage,
        words: transcript.words,
        speakers: result.results.utterances,
        duration: result.metadata.duration,
        provider: 'deepgram'
      }
    } catch (error) {
      console.error('Deepgram STT error:', error)
      this.fallbackCount++
      
      // Fallback to OpenAI Whisper
      return this.transcribeWithOpenAI(audioBuffer)
    }
  }

  // Fallback STT with OpenAI Whisper
  async transcribeWithOpenAI(audioBuffer) {
    try {
      const formData = new FormData()
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' })
      formData.append('file', audioBlob, 'audio.webm')
      formData.append('model', 'whisper-1')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: formData
      })

      const result = await response.json()
      
      return {
        text: result.text,
        confidence: 0.95, // OpenAI doesn't provide confidence
        language: result.language || 'en',
        provider: 'openai-whisper'
      }
    } catch (error) {
      console.error('OpenAI Whisper fallback failed:', error)
      throw new Error('Both STT providers failed')
    }
  }

  // Text-to-Speech with voice cloning support
  async synthesize(text, options = {}) {
    try {
      if (!this.isHealthy) throw new Error('Deepgram unhealthy')
      
      // Detect language from text
      const language = await this.detectLanguage(text)
      const voice = this.selectVoice(language, options.voiceStyle)
      
      const response = await this.deepgram.speak.request(
        { text },
        {
          model: voice,
          encoding: 'mp3',
          container: 'mp3',
          sample_rate: 24000,
          bit_rate: 64000,
          ...options
        }
      )

      // Get audio buffer
      const reader = response.getReader()
      const chunks = []
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      
      const audioBuffer = Buffer.concat(chunks)
      
      return {
        audio: audioBuffer,
        contentType: 'audio/mpeg',
        voice: voice,
        provider: 'deepgram'
      }
    } catch (error) {
      console.error('Deepgram TTS error:', error)
      this.fallbackCount++
      
      // Fallback to OpenAI TTS
      return this.synthesizeWithOpenAI(text, options)
    }
  }

  // Fallback TTS with OpenAI
  async synthesizeWithOpenAI(text, options = {}) {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: options.voiceStyle === 'professional' ? 'alloy' : 'nova',
          response_format: 'mp3'
        })
      })

      const audioBuffer = await response.arrayBuffer()
      
      return {
        audio: Buffer.from(audioBuffer),
        contentType: 'audio/mpeg',
        voice: 'openai-nova',
        provider: 'openai'
      }
    } catch (error) {
      console.error('OpenAI TTS fallback failed:', error)
      throw new Error('Both TTS providers failed')
    }
  }

  // Real-time speech-to-speech pipeline
  async processSpeechToSpeech(audioStream, context = {}) {
    try {
      // 1. Transcribe incoming audio
      const transcription = await this.transcribe(audioStream)
      
      // 2. Process with AI (this will be handled by your chat handler)
      const aiResponse = await this.processWithAI(transcription.text, {
        ...context,
        detectedLanguage: transcription.language,
        audioMetrics: {
          duration: transcription.duration,
          confidence: transcription.confidence
        }
      })
      
      // 3. Synthesize response
      const synthesized = await this.synthesize(aiResponse.text, {
        voiceStyle: context.voiceStyle || 'friendly',
        speed: this.calculateSpeechRate(transcription, aiResponse)
      })
      
      return {
        transcription,
        response: aiResponse,
        audio: synthesized,
        metrics: {
          totalLatency: Date.now() - context.startTime,
          sttProvider: transcription.provider,
          ttsProvider: synthesized.provider
        }
      }
    } catch (error) {
      console.error('Speech-to-speech pipeline error:', error)
      throw error
    }
  }

  // Helper: Select best voice based on language and style
  selectVoice(language, style = 'friendly') {
    const voiceMap = {
      en: {
        friendly: 'aura-2-orpheus-en',
        professional: 'aura-orpheus-en',
        energetic: 'aura-2-orpheus-en'
      },
      es: {
        friendly: 'aura-2-sirio-es',
        professional: 'aura-2-sirio-es',
        energetic: 'aura-2-sirio-es'
      }
    }
    
    const langCode = language.substring(0, 2).toLowerCase()
    return voiceMap[langCode]?.[style] || 'aura-luna-en'
  }

  // Helper: Detect language from text
  async detectLanguage(text) {
    // Simple detection based on common words
    const spanishIndicators = /\b(el|la|de|que|y|los|las|un|una|es|está|con|para|por)\b/gi
    const spanishMatches = text.match(spanishIndicators)?.length || 0
    
    return spanishMatches > 5 ? 'es' : 'en'
  }

  // Helper: Calculate appropriate speech rate
  calculateSpeechRate(transcription, response) {
    // Match customer's speaking pace
    const wordsPerMinute = (transcription.words?.length || 50) / (transcription.duration / 60)
    
    if (wordsPerMinute < 120) return 0.9  // Slow speaker
    if (wordsPerMinute > 180) return 1.1  // Fast speaker
    return 1.0  // Normal pace
  }

  // Placeholder for AI processing (will be replaced with actual implementation)
  async processWithAI(text, context) {
    // This will be handled by your existing chat logic
    return {
      text: `I understand you said: "${text}". How can I help you with your glass needs?`,
      intent: 'greeting',
      confidence: 0.95
    }
  }
}

export default DeepgramVoiceService
// Usage example
// const deepgramService = new DeepgramVoiceService()   