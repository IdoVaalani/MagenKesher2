import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const smsBaseUrl = 'http://195.192.226.31:50987/send';

// Rate limiting per user
const userRateLimit = new Map();
const RATE_LIMIT_MS = 10000; // 10 seconds between SMS sends per user

const canUserSend = (userEmail) => {
  const lastSent = userRateLimit.get(userEmail);
  const now = Date.now();
  
  if (lastSent && now - lastSent < RATE_LIMIT_MS) {
    const waitTime = Math.ceil((RATE_LIMIT_MS - (now - lastSent)) / 1000);
    return { canSend: false, waitTime };
  }
  
  userRateLimit.set(userEmail, now);
  
  // Cleanup old entries
  if (userRateLimit.size > 100) {
    const oldEntries = Array.from(userRateLimit.entries())
      .filter(([_, timestamp]) => now - timestamp > RATE_LIMIT_MS * 2);
    oldEntries.forEach(([email]) => userRateLimit.delete(email));
  }
  
  return { canSend: true };
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { 
            headers: { 
                'Access-Control-Allow-Origin': '*', 
                'Access-Control-Allow-Methods': 'POST, OPTIONS', 
                'Access-Control-Allow-Headers': 'Content-Type, Authorization' 
            } 
        });
    }

    try {
        console.log('📱 [SMS] Starting sendSms...');
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Rate limiting check
        const rateLimitCheck = canUserSend(user.email);
        if (!rateLimitCheck.canSend) {
            return Response.json({ 
                error: `יש להמתין ${rateLimitCheck.waitTime} שניות לפני שליחת SMS נוסף` 
            }, { status: 429 });
        }

        const { phoneNumber, message } = await req.json();
        
        if (!phoneNumber) return Response.json({ error: 'חסר מספר טלפון' }, { status: 400 });
        if (!message) return Response.json({ error: 'חסרה הודעה' }, { status: 400 });

        const smsToken = Deno.env.get("CUSTOM_SMS_TOKEN");
        if (!smsToken) {
            throw new Error("SMS token is not configured in the system secrets.");
        }

        // Send SMS with retry logic
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const smsUrl = `${smsBaseUrl}?token=${encodeURIComponent(smsToken)}&to=${phoneNumber}&message=${encodeURIComponent(message)}`;
                
                console.log(`📱 [SMS] Sending attempt ${attempt} to ${phoneNumber}...`);
                const smsResponse = await fetch(smsUrl, { method: 'GET' });

                console.log('📱 [SMS] SMS API response status:', smsResponse.status);

                if (!smsResponse.ok) {
                    const responseText = await smsResponse.text();
                    console.error('📱 [SMS] SMS API Error:', responseText);
                    throw new Error(`SMS API Error ${smsResponse.status}: ${responseText}`);
                }

                const smsResponseText = await smsResponse.text();
                console.log('📱 [SMS] SMS API response:', smsResponseText);

                console.log('📱 [SMS] SMS sent successfully!');
                return Response.json({ success: true, message: 'ההודעה נשלחה בהצלחה!' });
                
            } catch (error) {
                console.error(`📱 [SMS] Send attempt ${attempt} failed:`, error);
                if (attempt === 2) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

    } catch (error) {
        console.error('📱 [SMS] ❌ Error in sendSms function:', error);
        
        let errorMessage = 'שגיאה: ' + error.message;
        if (error.message?.includes('SMS API')) {
            errorMessage = 'שגיאה בשליחת ההודעה. בדוק את מספר הטלפון ונסה שוב.';
        }
        
        return Response.json({ success: false, error: errorMessage }, { status: 500 });
    }
});