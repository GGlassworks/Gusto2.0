// Updated leads route to also submit to web form after creating Pipedrive lead
import { PipedriveService } from "@/lib/pipedrive"

export async function POST(req) {
  try {
    const body = await req.json()
    console.log("Received comprehensive lead data:", body)

    const { name, firstName, lastName, email, phone, address, serviceType, notes, isEditSubmission } = body

    // IMPROVED validation - ensure we have proper name data
    if (!firstName?.trim() || !lastName?.trim()) {
      console.error("Missing required name fields:", { firstName, lastName, name })
      return Response.json({ error: "First name and last name are required" }, { status: 400 })
    }

    if (!serviceType?.trim()) {
      console.error("Missing service type:", { serviceType })
      return Response.json({ error: "Service type is required" }, { status: 400 })
    }

    if (!email?.trim() && !phone?.trim()) {
      console.error("Missing contact method:", { email, phone })
      return Response.json({ error: "Email or phone number is required" }, { status: 400 })
    }

    // Validate environment variables
    if (!process.env.PIPEDRIVE_API_KEY || !process.env.PIPEDRIVE_STAGE_ID) {
      console.error("Missing Pipedrive environment variables")
      return Response.json({ error: "Pipedrive configuration missing" }, { status: 500 })
    }

    console.log("Creating Pipedrive service...")
    const pipedrive = new PipedriveService()

    // Prepare comprehensive contact data
    const contactData = {
      name: name || `${firstName} ${lastName}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      address: address?.trim() || "",
    }

    // Simplify the notes to avoid any potential formatting issues
    const comprehensiveNotes = `WEBSITE CHAT LEAD - ${new Date().toLocaleString()}

CUSTOMER INFORMATION:
- Full Name: ${contactData.name}
- Email: ${contactData.email || "Not provided"}
- Phone: ${contactData.phone || "Not provided"}  
- Address: ${contactData.address || "Not provided"}
- Service Interest: ${serviceType}

CONVERSATION DETAILS:
${notes || "No conversation notes available"}

LEAD SOURCE: Website Chat Bot
SUBMISSION TIME: ${new Date().toISOString()}
PRIORITY: High - Contact within 24 hours

NEXT STEPS:
1. Contact customer to confirm project details
2. Schedule free estimate appointment  
3. Provide detailed quote based on requirements`

    console.log("Calling createLead with validated data...")
    const result = await pipedrive.createLead(contactData, serviceType, comprehensiveNotes, isEditSubmission || false)

    console.log("Lead created successfully with all data:", result)

    // STEP 2: Submit to glazeglassworks.com web form
    console.log("Submitting data to glazeglassworks.com web form...")

    try {
      const webFormResponse = await fetch(`${req.url.replace("/api/leads", "/api/submit-web-form")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          email: contactData.email,
          phone: contactData.phone,
          address: contactData.address,
          notes: comprehensiveNotes,
        }),
      })

      const webFormData = await webFormResponse.json()
      console.log("Web form submission result:", webFormData)

      return Response.json({
        success: true,
        message: "Lead captured successfully and submitted to web form",
        leadId: result.lead.id,
        dealId: result.deal?.id,
        personId: result.person?.id,
        salesOrderNumber: result.salesOrderNumber,
        webFormSubmission: webFormData,
        dataTransmitted: {
          contactInfo: contactData,
          serviceType,
          leadSource: "Website Chat",
          timestamp: new Date().toISOString(),
        },
      })
    } catch (webFormError) {
      console.error("Web form submission failed (non-critical):", webFormError)

      // Still return success since Pipedrive lead was created
      return Response.json({
        success: true,
        message: "Lead captured successfully in Pipedrive (web form submission failed)",
        leadId: result.lead.id,
        dealId: result.deal?.id,
        personId: result.person?.id,
        salesOrderNumber: result.salesOrderNumber,
        webFormError: webFormError.message,
        dataTransmitted: {
          contactInfo: contactData,
          serviceType,
          leadSource: "Website Chat",
          timestamp: new Date().toISOString(),
        },
      })
    }
  } catch (error) {
    console.error("Lead capture error:", error)

    // Return more specific error information
    return Response.json(
      {
        error: "Failed to capture lead",
        details: error.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
