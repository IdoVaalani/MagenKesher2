import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({
  appId: Deno.env.get('BASE44_APP_ID'), 
});

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);
        const user = await base44.auth.me();
        if (!user) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { to, subject, body, from_name } = await req.json();
        
        if (!to || !subject || !body) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { 
                status: 400, 
                headers: { "Content-Type": "application/json" } 
            });
        }

        // שימוש באותה שיטה כמו בדשבורד
        await base44.integrations.Core.SendEmail({
            to: to,
            subject: subject,
            body: body,
            from_name: from_name || "מערכת ניהול ציוד"
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});