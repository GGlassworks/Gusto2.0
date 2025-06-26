import { google } from "googleapis";

/**
 * Appends a note (with timestamp) to a customer Google Doc.
 * Creates the doc if not found.
 * 
 * @param {Object} params
 * @param {string} params.customerName - Customer full name or label
 * @param {string} params.note - Note to append
 * @returns {Promise<string>} Google Doc edit link
 */
export async function appendNoteToCustomerDoc({ customerName, note }) {
  // 1. Auth setup
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive"
    ],
  });
  const authClient = await auth.getClient();
  const docs = google.docs({ version: "v1", auth: authClient });
  const drive = google.drive({ version: "v3", auth: authClient });

  // 2. Search for existing doc
  const docTitle = `${customerName} - Customer Notes`;
  let docId;
  const searchRes = await drive.files.list({
    q: `name='${docTitle}' and mimeType='application/vnd.google-apps.document' and trashed=false`,
    fields: "files(id, name)"
  });

  if (searchRes.data.files.length > 0) {
    docId = searchRes.data.files[0].id;
  } else {
    // 3. Create doc if not found
    const docRes = await docs.documents.create({ requestBody: { title: docTitle } });
    docId = docRes.data.documentId;
    // Insert heading at top
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `Customer Notes for ${customerName}\n\n`
            }
          },
          {
            updateParagraphStyle: {
              range: { startIndex: 1, endIndex: 1 + `Customer Notes for ${customerName}\n\n`.length },
              paragraphStyle: { namedStyleType: "HEADING_1" },
              fields: "namedStyleType"
            }
          }
        ]
      }
    });
  }

  // 4. Append note at end
  const timestamp = new Date().toLocaleString();
  const noteText = `\n[${timestamp}]\n${note}\n`;
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1e6 }, // Big number = end of doc
            text: noteText
          }
        }
      ]
    }
  });

  // 5. Return Doc URL
  return `https://docs.google.com/document/d/${docId}/edit`;
}
