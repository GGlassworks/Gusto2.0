import { appendNoteToCustomerDoc } from "@/utils/googleDocs";

export async function POST(req) {
  try {
    const { customerName, note } = await req.json();

    if (!customerName || !note) {
      return Response.json({ success: false, error: "Missing customerName or note." }, { status: 400 });
    }

    const docUrl = await appendNoteToCustomerDoc({ customerName, note });

    return Response.json({ success: true, docUrl }, { status: 200 });
  } catch (err) {
    console.error("Customer note append error:", err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
