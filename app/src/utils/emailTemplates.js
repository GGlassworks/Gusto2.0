export function newLeadHtmlTemplate(leadInfo) {
  return `
  <div style="background:#f9fafb;padding:32px 0;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:auto;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(20,60,90,0.06);overflow:hidden;">
      <tr>
        <td style="background:#003366;padding:24px 24px 8px 24px;">
          <img src="https://www.glazeglassworks.com/assets/logo.png" alt="Glaze Glassworks" style="height:36px;">
          <h2 style="color:#fff;font-weight:800;font-size:22px;margin:18px 0 0 0;">New Website Chat Lead</h2>
        </td>
      </tr>
      <!-- INTERNAL ONLY Banner -->
      <tr>
        <td style="padding:0 24px 12px 24px;">
          <div style="background:#ffeb3b;color:#222;font-weight:700;text-align:center;border-radius:8px;padding:10px 0;margin:16px 0 8px 0;letter-spacing:1px;font-size:15px;border:2px dashed #d4bc34;">
            🚧 INTERNAL USE ONLY — DO NOT FORWARD 🚧
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px 24px;">
          <table style="width:100%;font-size:16px;">
            <tr><td style="padding:4px 0;"><b>Name:</b></td><td>${leadInfo.fullName}</td></tr>
            <tr><td style="padding:4px 0;"><b>Phone:</b></td><td>${leadInfo.phone}</td></tr>
            <tr><td style="padding:4px 0;"><b>Email:</b></td><td>${leadInfo.email}</td></tr>
            <tr><td style="padding:4px 0;"><b>Address:</b></td><td>${leadInfo.address}</td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;"><b>Notes:</b></td>
                <td style="white-space:pre-wrap;background:#f0f3f6;border-radius:8px;padding:8px 12px;margin:4px 0 0 0;">${leadInfo.notes}</td>
            </tr>
            ${leadInfo.chatSummary
              ? `<tr><td style="padding:4px 0;vertical-align:top;"><b>Chat Summary:</b></td>
                <td style="white-space:pre-wrap;background:#eef3fb;border-radius:8px;padding:8px 12px;">${leadInfo.chatSummary}</td></tr>`
              : ""}
            <tr><td style="padding:4px 0;"><b>Time:</b></td><td>${new Date().toLocaleString()}</td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#003366;padding:12px 24px;text-align:center;color:#fff;font-size:13px;">
          Glaze Glassworks • <b>This lead was submitted via website chatbot.</b>
        </td>
      </tr>
    </table>
  </div>
  `;
}
