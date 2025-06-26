import nodemailer from "nodemailer";

// ========== Modular Validation ==========
function validateFields(body) {
  const { firstName, lastName, email, phone, serviceType } = body;
  if (!firstName?.trim() || !lastName?.trim())
    return "First name and last name are required";
  if (!serviceType?.trim())
    return "Service type is required";
  if (!email?.trim() && !phone?.trim())
    return "Email or phone number is required";
  return null;
}

// ========== Modular Notes Builder ==========
function buildComprehensiveNotes(contactData, serviceType, notes) {
  return `WEBSITE CHAT LEAD - ${new Date().toLocaleString()}

CUSTOMER INFORMATION:
- Full Name: ${contactData.name}
- First Name: ${contactData.firstName}
- Last Name: ${contactData.lastName}
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
3. Provide detailed quote based on requirements

CRITICAL INFORMATION FOR FOLLOW-UP:
- Customer completed full chat flow
- All contact information verified
- Ready for immediate follow-up
- High-intent lead from website interaction`;
}

// ========== Send Email ==========
// NOTE: Configure this to use your SMTP provider!
async function sendSupportEmail({ contactData, serviceType, notes }) {
  const transporter = nodemailer.createTransport({
    // EXAMPLE: For Gmail/Google Workspace
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,   // support@glazeglassworks.com
      pass: process.env.MAIL_PASS    // App password or real password
    }
  });

  const mailOptions = {
    from: `"GlazeGlassworks Chatbot" <${process.env.MAIL_USER}>`,
    to: "support@glazeglassworks.com",
    subject: `New Website Chat Lead: ${contactData.name} - ${serviceType}`,
    text: buildComprehensiveNotes(contactData, serviceType, notes),
    // html: ... (optional, for pretty emails)
  };

  await transporter.sendMail(mailOptions);
}

// ========== Main API Route ==========
export async function POST(req) {
  try {
    const body = await req.json();
    const error = validateFields(body);
    if (error) return Response.json({ error }, { status: 400 });

    const { name, firstName, lastName, email, phone, address, serviceType, notes } = body;
    const contactData = {
      name: name || `${firstName} ${lastName}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      address: address?.trim() || "",
    };
    const comprehensiveNotes = buildComprehensiveNotes(contactData, serviceType, notes);

    // ======= Pipedrive Webform Integration (as before) =======
    const fullName = `${contactData.firstName} ${contactData.lastName}`;
    const visitorId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const formPayload = {
      visitor_id: visitorId,
      values: {
        V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0MS00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM: fullName,
        V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0Mi00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM: contactData.phone || "",
        V2ViRm9ybUNhcHR1cmVCbG9jazozYzQwYzBlMC00YTZlLTExZjAtYmU4Ni1jZjBiZGZjYWYxYmY: contactData.email || "",
        V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2MTg0My00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM: contactData.address || "",
        V2ViRm9ybUNhcHR1cmVCbG9jazo3OWI2M2Y1MC00YTYzLTExZjAtYThiOS05M2M3YTU0NmUwYWM: comprehensiveNotes,
      },
    };

    const response = await fetch(
      "https://webforms.pipedrive.com/f/6NhSfOLSbdamRmbb0Z6iC9kelWRjv3v4v8y1L4B0tduS6xz0JcJZBYTzaVFxN9Rb7d",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "GlazeGlassworks-ChatBot/1.0",
          Referer: "https://webforms.pipedrive.com/",
          Origin: "https://webforms.pipedrive.com",
        },
        body: JSON.stringify(formPayload),
      },
    );

    // ======= Send Support Email =======
    await sendSupportEmail({ contactData, serviceType, notes });

    // ======= Final Response =======
    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ success: false, message: "Web form submission failed", error: errorText }, { status: 500 });
    }

    const responseText = await response.text();
    return Response.json({
      success: true,
      message: "Successfully submitted to Pipedrive web form & support email sent",
      pipedriveStatus: response.status,
      pipedriveResponse: responseText.substring(0, 500) + "...",
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
