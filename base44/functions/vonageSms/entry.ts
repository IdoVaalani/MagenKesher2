import { createClient } from 'npm:@base44/sdk@0.1.0';

// Forcing a redeployment to resolve timeout issues.
const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'), 
});

const apiKey = Deno.env.get("VONAGE_API_KEY");
const apiSecret = Deno.env.get("VONAGE_API_SECRET");
const fromNumber = Deno.env.get("VONAGE_FROM_NUMBER");

Deno.serve(async (req) => {
  try {
    // 1. Authenticate with base44
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized: Missing Authorization header', { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    base44.auth.setToken(token);
    const user = await base44.auth.me();
    if (!user) {
      return new Response('Unauthorized: Invalid user token', { status: 401 });
    }

    // 2. Check for Vonage credentials
    if (!apiKey || !apiSecret || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "Vonage credentials are not configured in secrets." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Get request body
    const { to, body: text } = await req.json();

    if (!to || !text) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'body' in request." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // 4. Validate phone number format (E.164)
    if (!/^\+[1-9]\d{6,14}$/.test(to)) {
        return new Response(
            JSON.stringify({ error: "Invalid 'to' phone number format. Must be E.164 (e.g., +972501234567)." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // 5. Check if text contains Hebrew or other Unicode characters
    const hasUnicode = /[\u0590-\u05FF\u0600-\u06FF\u200F\u200E]/.test(text);

    // 6. Prepare request payload with proper encoding
    const requestPayload = {
        from: fromNumber,
        text: text,
        to: to,
        api_key: apiKey,
        api_secret: apiSecret,
    };

    // Add Unicode support if needed
    if (hasUnicode) {
        requestPayload.type = "unicode";
    }

    // 7. Call Vonage API
    const vonageUrl = "https://rest.nexmo.com/sms/json";
    const response = await fetch(vonageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(requestPayload),
    });

    const responseData = await response.json();

    // 8. Handle Vonage response
    if (!responseData.messages || responseData.messages.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Unexpected response from Vonage",
          details: responseData 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (responseData.messages[0].status !== "0") {
      console.error("Vonage API Error:", responseData);
      return new Response(
        JSON.stringify({ 
          error: `Vonage error: ${responseData.messages[0]['error-text']}`,
          details: responseData 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: responseData,
      unicode_used: hasUnicode 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});