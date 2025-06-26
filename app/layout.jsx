import "./globals.css"

export const metadata = {
  title: "Glaze Glassworks Chatbot",
  description: "AI Assistant for Glaze Glassworks",
  generator: "v0.dev",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
