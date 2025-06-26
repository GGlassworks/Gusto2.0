// app/actions/submitToPipedrive.js
"use server"

import { z } from "zod"

const LeadSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(7, "Phone number must be at least 7 characters"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  notes: z.string().min(5, "Notes must be at least 5 characters"),
})

export async function submitToPipedrive(leadInfo) {
  const parse = LeadSchema.safeParse(leadInfo)

  if (!parse.success) {
    console.error("❌ Validation failed:", parse.error.issues)
    return {
      success: false,
      error: "Validation failed",
      issues: parse.error.issues,
    }
  }

  const endpoint =
    "https://webforms.pipedrive.com/form/6NhSfOLSbdamRmbb0Z6iC9kelWRjv3v4v8y1L4B0tduS6xz0JcJZBYTzaVFxN9Rb7d"

  // ✅ FIXED: Removed visitor_id completely
  const payload = {
    values: {
      // Full Name
      V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0MS00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM: leadInfo.fullName,
      // Phone Number
      V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0Mi00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM: leadInfo.phone,
      // Email
      V2ViRm9ybUNhcHR1cmVCbG9jazozYzQwYzBlMC00YTZlLTExZjAtYmU4Ni1jZjBiZGZjYWYxYmY: leadInfo.email,
      // Address
      V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0My00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM: leadInfo.address,
      // Notes
      V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2M2Y1MC00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM: leadInfo.notes,
    },
  }

  try {
    console.log("🚀 Submitting to Pipedrive (NO visitor_id):", {
      endpoint,
      leadInfo: {
        fullName: leadInfo.fullName,
        phone: leadInfo.phone,
        email: leadInfo.email,
        address: leadInfo.address,
        notes: leadInfo.notes ? "Provided" : "Not provided",
      },
      payloadStructure: "values object only (no visitor_id)",
    })

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GlazeGlassworks-ChatBot/1.0",
        Referer: "https://webforms.pipedrive.com/",
        Origin: "https://webforms.pipedrive.com",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Pipedrive submission failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const responseData = await response.text()
    console.log("✅ Pipedrive submission successful:", {
      status: response.status,
      response: responseData.substring(0, 200) + "...",
    })

    return {
      success: true,
      data: responseData,
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error("❌ Pipedrive submission error:", error)
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      timestamp: new Date().toISOString(),
    }
  }
}
