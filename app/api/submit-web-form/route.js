// API route to submit data to Pipedrive web form with specific field ID
export async function POST(req) {
  try {
    const body = await req.json()
    console.log("Received Pipedrive web form submission request:", body)

    const { firstName, lastName, email, phone, address, notes } = body

    // Validate required fields
    if (!firstName || !lastName) {
      console.error("Missing required name fields for Pipedrive web form:", { firstName, lastName })
      return Response.json({ error: "First name and last name are required for web form" }, { status: 400 })
    }

    // Prepare form data for Pipedrive web form
    const fullName = `${firstName} ${lastName}`
    const formData = new FormData()

    // Use the specific field ID for the name field
    formData.append("V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0MS00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM", fullName)

    // Standard Pipedrive web form field names for other fields
    formData.append("phone", phone || "")
    formData.append("email", email || "")
    formData.append("address", address || "")
    formData.append("message", notes || "Website chat inquiry - Glass services consultation")

    console.log("Submitting to Pipedrive web form with specific name field ID:", {
      url: "https://webforms.pipedrive.com/f/6NhSfOLSbdamRmbb0Z6iC9kelWRjv3v4v8y1L4B0tduS6xz0JcJZBYTzaVFxN9Rb7d",
      nameFieldId: "V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0MS00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM",
      fullName: fullName,
      phone: phone || "Not provided",
      email: email || "Not provided",
      address: address || "Not provided",
      message: notes || "Website chat inquiry",
    })

    // Submit to the Pipedrive web form
    const response = await fetch(
      "https://webforms.pipedrive.com/f/6NhSfOLSbdamRmbb0Z6iC9kelWRjv3v4v8y1L4B0tduS6xz0JcJZBYTzaVFxN9Rb7d",
      {
        method: "POST",
        body: formData,
        headers: {
          "User-Agent": "GlazeGlassworks-ChatBot/1.0",
          Referer: "https://webforms.pipedrive.com/",
          Origin: "https://webforms.pipedrive.com",
        },
      },
    )

    console.log("Pipedrive web form submission response status:", response.status)
    console.log("Pipedrive web form submission response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Pipedrive web form submission failed:", errorText)

      // Don't fail the entire process if web form fails
      return Response.json(
        {
          success: false,
          message: "Pipedrive web form submission failed, but lead was still captured in main Pipedrive system",
          error: errorText,
          statusCode: response.status,
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      ) // Return 200 so it doesn't break the main flow
    }

    const responseText = await response.text()
    console.log("Pipedrive web form submission successful:", responseText.substring(0, 500) + "...")

    return Response.json({
      success: true,
      message: "Successfully submitted to Pipedrive web form",
      formData: {
        nameFieldId: "V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0MS00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM",
        fullName: fullName,
        phone: phone || "Not provided",
        email: email || "Not provided",
        address: address || "Not provided",
        message: notes || "Website chat inquiry",
      },
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Pipedrive web form submission error:", error)

    // Don't fail the entire process if web form fails
    return Response.json(
      {
        success: false,
        message:
          "Pipedrive web form submission encountered an error, but lead was still captured in main Pipedrive system",
        error: error.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    ) // Return 200 so it doesn't break the main flow
  }
}
