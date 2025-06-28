import { sendEmail } from "@/utils/sendEmail";
import { newLeadHtmlTemplate } from "@/utils/emailTemplates";

// Inside your POST handler or async function:
await sendEmail({
  to: "support@glazeglassworks.com",
  subject: `New Website Lead: ${leadInfo.fullName}`,
  html: newLeadHtmlTemplate(leadInfo),
  replyTo: leadInfo.email || undefined,
});
