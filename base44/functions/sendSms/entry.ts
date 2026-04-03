import { createClient } from 'npm:@base44/sdk@0.1.0';

Deno.serve(async (req) => {
    const smsToken = Deno.env.get("CUSTOM_SMS_TOKEN");
    const smsBaseUrl = 'http://195.192.226.31:50987/send';

    try {
        const base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID') });
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }
        base44.auth.setToken(authHeader.split(' ')[1]);
        const user = await base44.auth.me();
        if (!user) {
            return new Response('Unauthorized', { status: 401 });
        }

        if (!smsToken) {
            return new Response(JSON.stringify({ error: "SMS token not configured." }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const { phoneNumber, message } = await req.json();
        if (!phoneNumber || !message) {
            return new Response(JSON.stringify({ error: "Missing phoneNumber or message." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const smsUrl = `${smsBaseUrl}?token=${encodeURIComponent(smsToken)}&to=${phoneNumber}&message=${encodeURIComponent(message)}`;
        
        // תיקון: שינוי השיטה ל-GET, כפי שהשגיאה 405 מרמזת
        const response = await fetch(smsUrl, { method: 'GET' });

        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`SMS API Error ${response.status}: ${responseText}`);
        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});