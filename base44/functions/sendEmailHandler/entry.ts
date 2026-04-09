import { google } from "npm:googleapis@134.0.0";

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function toBase64Url(str) {
  return toBase64(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- פונקציית עזר לשליחת מייל - משולבת ישירות בקובץ ---
async function sendEmailWithGmail(options) {
  try {
    const oAuth2Client = new google.auth.OAuth2(
      Deno.env.get("GMAIL_CLIENT_ID"),
      Deno.env.get("GMAIL_CLIENT_SECRET"),
      "https://developers.google.com/oauthplayground"
    );

    oAuth2Client.setCredentials({
      refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN"),
    });

    const { token } = await oAuth2Client.getAccessToken();
    if (!token) {
        throw new Error("Failed to create access token for Gmail");
    }

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    
    const fromName = options.from_name || "מערכת ניהול ציוד";
    const mailLines = [
      `From: "${fromName}" <${Deno.env.get("GMAIL_ADDRESS")}>`,
      `To: ${options.to}`,
      "Content-type: text/html;charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: =?UTF-8?B?${toBase64(options.subject)}?=`,
      "",
      options.body,
    ];
    const rawMessage = mailLines.join("\r\n");

    const encodedMessage = toBase64Url(rawMessage);


    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("Error sending email via Gmail:", error.message);
    return { success: false, error: error.message };
  }
}


// --- Deno.serve ראשי ---
Deno.serve(async (req) => {
    // CORS preflight request handling
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    try {
        const payload = await req.json();

        if (!payload.to || !payload.subject || !payload.body) {
            return new Response(JSON.stringify({ success: false, error: 'Missing required fields: to, subject, body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
        
        // קריאה לפונקציית העזר המקומית
        const result = await sendEmailWithGmail(payload);

        if (result.success) {
            return new Response(JSON.stringify({ success: true, message: 'Email sent successfully', messageId: result.messageId }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        } else {
            return new Response(JSON.stringify({ success: false, error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

    } catch (error) {
        console.error('Error in sendEmailHandler:', error);
        return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }
});