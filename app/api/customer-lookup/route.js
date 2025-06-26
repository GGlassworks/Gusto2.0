import { PipedriveService } from "@/lib/pipedrive";

// Helper to standardize API responses
function apiResponse({ success, data = null, error = null, status = 200 }) {
  return Response.json({ success, data, error, timestamp: new Date().toISOString() }, { status });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { firstName, lastName, phone, password } = body;

    // Validate and normalize inputs
    const _firstName = (firstName || "").trim();
    const _lastName  = (lastName  || "").trim();
    const _phone     = (phone     || "").replace(/\D/g, "");

    if (!_firstName || !_lastName || !_phone) {
      return apiResponse({
        success: false,
        error: "First name, last name, and phone number are required.",
        status: 400
      });
    }

    if (!process.env.PIPEDRIVE_API_KEY) {
      return apiResponse({
        success: false,
        error: "Pipedrive configuration missing.",
        status: 500
      });
    }

    // === Main Lookup Logic ===
    const pipedrive = new PipedriveService();
    const person = await pipedrive.findPersonByNameAndPhone(_firstName, _lastName, _phone, password);

    if (!person || person.error) {
      return apiResponse({
        success: false,
        error: person?.error || "Customer not found.",
        status: 404
      });
    }

    // Get all deals for this person in "Deals" stage (or your target stage)
    const deals = await pipedrive.getDealsForPerson(person.id, { stage: "Deals" });

    if (!deals.length) {
      return apiResponse({
        success: false,
        error: "No active deals found for this customer.",
        status: 404
      });
    }

    // For each deal, gather notes & key info
    const dealsWithNotes = await Promise.all(deals.map(async (deal) => {
      const notes = await pipedrive.getNotesForDeal(deal.id);
      // Find the most recent note, or summary
      const latestNote = notes.length > 0 ? notes[0].content : "No recent updates.";
      // Build the info package
      return {
        dealTitle: deal.title,
        status: deal.status,
        stage: deal.stage_id, // Optionally map to stage name
        value: deal.value,
        currency: deal.currency,
        addTime: deal.add_time,
        updateTime: deal.update_time,
        lastNote: latestNote,
        // add more deal fields as needed
      };
    }));

    // Optionally, redact sensitive info, mask PII, etc.
    // dealsWithNotes.forEach(d => delete d.internalId);

    // Build a customer-friendly summary
    const customerMessage = dealsWithNotes.map(d =>
      `Project "${d.dealTitle}": Current status is "${d.status}". Last update: ${d.lastNote}`
    ).join("\n\n");

    return apiResponse({
      success: true,
      data: {
        customer: {
          name: `${person.first_name} ${person.last_name}`,
          email: person.email[0]?.value || "",
          phone: person.phone[0]?.value || "",
        },
        projects: dealsWithNotes,
        summary: customerMessage
      },
      status: 200
    });

  } catch (error) {
    console.error("Customer lookup error:", error);
    return apiResponse({
      success: false,
      error: "Failed to lookup customer.",
      status: 500
    });
  }
}
