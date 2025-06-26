import { PipedriveService } from "@/lib/pipedrive";

// Helper for standard API responses
function apiResponse({ success, soNumber, message, error = null, status = 200 }) {
  return Response.json({
    success,
    soNumber,
    message,
    error,
    timestamp: new Date().toISOString(),
  }, { status });
}

export async function POST(req) {
  try {
    console.log("[S.O# GEN] Request received");

    // Validate environment variables
    if (!process.env.PIPEDRIVE_API_KEY) {
      console.error("[S.O# GEN] Missing Pipedrive API key");
      return apiResponse({
        success: false,
        soNumber: null,
        message: "Pipedrive configuration missing",
        error: "Missing Pipedrive API key",
        status: 500,
      });
    }

    console.log("[S.O# GEN] Creating Pipedrive service...");
    const pipedrive = new PipedriveService();

    console.log("[S.O# GEN] Fetching next sequential S.O#...");
    const soNumber = await pipedrive.getNextSequentialSONumber();

    console.log("[S.O# GEN] S.O# generated successfully:", soNumber);

    return apiResponse({
      success: true,
      soNumber,
      message: "S.O# generated successfully with sequential numbering",
    });

  } catch (error) {
    console.error("[S.O# GEN] Error:", error);

    // Fallback to timestamp-based S.O#
    const fallbackSO = `S.O#${Date.now().toString().slice(-6)}`;

    return apiResponse({
      success: true,
      soNumber: fallbackSO,
      message: "S.O# generated using fallback method",
      error: error.message || "Unknown error",
    });
  }
}
