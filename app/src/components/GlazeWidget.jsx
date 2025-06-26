import React, { useState, useRef, useEffect } from "react";

// === LOGO ===
// Adjust path as needed. Replace with your logo file, ideally SVG or a transparent PNG for sharpness.
const LOGO_PATH = "/logo.png";
const PDF_ICON = "/pdf-icon.png";
const FILE_ICON = "/file-icon.png";

// Helper for file previews (supports images, pdf, others)
function getFilePreview(file) {
  if (typeof file === "string" && file.startsWith("http")) return file;
  if (file?.type?.startsWith("image/")) return URL.createObjectURL(file);
  if (file?.type === "application/pdf") return PDF_ICON;
  return FILE_ICON;
}

export default function GlazeWidget() {
  const [messages, setMessages] = useState([
    // Start with ONLY a welcome message (no delayed message, just this).
    { sender: "bot", text: "Welcome to Glaze Glassworks! How can we help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();
  const chatEndRef = useRef();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // === FILE UPLOAD HANDLER (POST to backend API) ===
  async function uploadFiles(files) {
    setUploading(true);
    const formData = new FormData();
    [...files].forEach(file => formData.append("files", file));
    try {
      // === GOOGLE DRIVE API PLACEHOLDER ===
      // Replace /api/upload with your backend endpoint that handles Drive upload.
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      // === GOOGLE DRIVE API PLACEHOLDER ===
      // Returned { links: [ { url, name, type } ] }
      if (data?.links?.length) {
        setMessages(msgs =>
          [...msgs, ...data.links.map(link => ({
            sender: "bot",
            fileUrl: link.url,
            fileName: link.name,
            fileType: link.type
          }))]
        );
      }
    } catch (err) {
      setMessages(msgs =>
        [...msgs, { sender: "bot", text: "Sorry, file upload failed!" }]
      );
    }
    setUploading(false);
  }

  // === SENDING MESSAGES & FILES ===
  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    let newMsgs = [...messages];
    if (input.trim()) newMsgs.push({ sender: "user", text: input });

    if (attachments.length > 0) {
      // Show user-uploaded files as preview bubbles
      attachments.forEach(file => {
        newMsgs.push({
          sender: "user",
          file,
          fileName: file.name,
          fileType: file.type,
          preview: getFilePreview(file)
        });
      });
      setMessages(newMsgs);
      await uploadFiles(attachments); // Send files to backend (Google Drive placeholder)
      setAttachments([]);
    } else {
      setMessages(newMsgs);
    }
    setInput("");
    // === AI BOT LOGIC PLACEHOLDER ===
    // Replace this comment with your API/chatbot integration.
    // Call your AI/chat endpoint and push a bot reply to setMessages([...]).
  }

  // Drag & drop support
  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setAttachments(prev => [...prev, ...e.dataTransfer.files]);
    }
  }
  function handleDragOver(e) { e.preventDefault(); setDragActive(true); }
  function handleDragLeave() { setDragActive(false); }
  function handleFileChange(e) { setAttachments(prev => [...prev, ...e.target.files]); }
  function handleAttachClick() { fileInputRef.current.click(); }

  // If you want to trigger a bot file share (manually or from backend):
  function botSendFile({ url, fileName, fileType }) {
    setMessages(msgs => [
      ...msgs,
      { sender: "bot", fileUrl: url, fileName, fileType }
    ]);
  }

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50
        w-[380px] max-w-[98vw] h-[650px] max-h-[98vh]
        rounded-3xl shadow-2xl flex flex-col
        border border-white/30 glassmorphic transition-all
        ${dragActive ? "ring-4 ring-blue-300 ring-inset" : ""}
      `}
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
          <img
            src={LOGO_PATH}
            alt="Glaze Glassworks"
            className="h-10 w-10 object-contain"
            style={{ display: "block", margin: "auto" }}
          />
        </div>
        <span className="font-extrabold text-lg text-blue-900 drop-shadow tracking-wide">Glaze Glassworks</span>
        <div className="flex-1" />
        {/* Optionally add a minimize/close here */}
      </div>
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`
            flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"} transition-all duration-300
          `}>
            <div
              className={`
                min-w-[56px] max-w-[85%] px-4 py-2 rounded-2xl mb-1 shadow-xl
                ${msg.sender === "bot"
                  ? "bg-white/90 text-gray-900 self-start"
                  : "bg-gradient-to-br from-blue-600/90 to-sky-400/80 text-white self-end"
                }
                transition-all duration-300
                `}
              style={{ backdropFilter: "blur(6px)" }}
            >
              {msg.text}
              {/* User file */}
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
              {/* Bot file */}
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
        <div ref={chatEndRef} />
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
      {/* Drag drop overlay */}
      {dragActive && (
        <div className="absolute inset-0 z-50 bg-blue-300/40 flex items-center justify-center pointer-events-none rounded-3xl animate-fade-in">
          <span className="text-xl font-bold text-blue-800">Drop files to upload</span>
        </div>
      )}
      {/* Input */}
      <form
        className="flex gap-2 px-5 py-4 border-t border-white/10 bg-gradient-to-r from-white/10 to-blue-100/10 backdrop-blur-xl"
        onSubmit={handleSend}
      >
        <button type="button" title="Attach a file"
          className="flex-shrink-0 p-2 rounded-lg hover:bg-blue-300/25 transition group focus:ring-2 focus:ring-blue-400"
          onClick={handleAttachClick}
        >
          {/* Paperclip icon */}
          <svg className="w-6 h-6 text-blue-800 group-hover:scale-110 transition" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 002.828 2.828l7.07-7.07a4 4 0 00-5.657-5.657l-7.071 7.07a6 6 0 008.485 8.485l1.414-1.414"/>
          </svg>
          <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
        </button>
        <input
          className="flex-1 bg-transparent outline-none text-blue-900 placeholder:text-blue-900/60 px-4 py-2 rounded-lg border border-blue-300/20 backdrop-blur focus:ring-2 focus:ring-blue-400/20 font-medium"
          type="text"
          value={input}
          placeholder="Type your message…"
          onChange={e => setInput(e.target.value)}
          disabled={uploading}
        />
        <button
          className="px-4 py-2 bg-gradient-to-br from-blue-600/90 to-sky-400/80 hover:from-blue-700 hover:to-sky-500 text-white rounded-xl shadow font-bold focus:ring-2 focus:ring-blue-400 transition"
          type="submit"
          disabled={uploading}
        >
          {uploading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

/*
.glassmorphic {
  background: linear-gradient(120deg, rgba(255,255,255,0.16) 0%, rgba(0,80,200,0.10) 100%) !important;
  border: 1.5px solid rgba(255,255,255,0.16);
  backdrop-filter: blur(32px) saturate(140%);
  -webkit-backdrop-filter: blur(32px) saturate(140%);
}
.custom-scrollbar::-webkit-scrollbar { width: 8px; background: transparent;}
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,80,200,0.12); border-radius: 6px;}
.animate-fade-in { animation: fadeIn .45s cubic-bezier(.21,1.02,.73,1) both;}
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px);} to { opacity: 1; transform: none;}}
*/

// === GOOGLE DRIVE API PLACEHOLDER ===
// Your backend should POST files to Google Drive, then return an array of { url, name, type }
// Example backend response for uploaded files:
// { links: [ { url: 'https://drive.google.com/uc?id=...&export=view', name: 'customer_invoice.pdf', type: 'application/pdf' } ] }
