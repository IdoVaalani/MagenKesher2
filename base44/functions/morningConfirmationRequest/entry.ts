import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { google } from "npm:googleapis@134.0.0";

// --- Gmail helpers ---
function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function toBase64Url(str) {
  return toBase64(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmailWithGmail(options) {
  const oAuth2Client = new google.auth.OAuth2(
    Deno.env.get("GMAIL_CLIENT_ID"),
    Deno.env.get("GMAIL_CLIENT_SECRET"),
    "https://developers.google.com/oauthplayground"
  );
  oAuth2Client.setCredentials({ refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN") });
  const { token } = await oAuth2Client.getAccessToken();
  if (!token) throw new Error("Failed to get Gmail access token");

  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const fromName = options.from_name || "מערכת ניהול ציוד";
  const encodedFromName = `=?UTF-8?B?${toBase64(fromName)}?=`;
  const mailLines = [
    `From: ${encodedFromName} <${Deno.env.get("GMAIL_ADDRESS")}>`,
    `To: ${options.to}`,
    "Content-type: text/html;charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: =?UTF-8?B?${toBase64(options.subject)}?=`,
    "",
    options.body,
  ];
  const encodedMessage = toBase64Url(mailLines.join("\r\n"));
  await gmail.users.messages.send({ userId: "me", requestBody: { raw: encodedMessage } });
}

// --- SMS helper ---
async function sendSmsDirectly(phoneNumber, message) {
  const smsToken = Deno.env.get("CUSTOM_SMS_TOKEN");
  if (!smsToken) throw new Error("SMS token not configured");
  
  let phone = phoneNumber.trim();
  if (!phone.startsWith('+')) {
    phone = phone.startsWith('0') ? '+972' + phone.substring(1) : '+972' + phone;
  }

  const smsUrl = `http://195.192.226.31:50987/send?token=${encodeURIComponent(smsToken)}&to=${phone}&message=${encodeURIComponent(message)}`;
  const response = await fetch(smsUrl, { method: 'GET' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS API Error ${response.status}: ${text}`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    console.log("🌅 Morning confirmation request starting...");

    // Get Israel date
    const now = new Date();
    const israelDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const today = israelDate.toISOString().split('T')[0];
    const formattedDate = israelDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Load settings, soldiers, equipment, existing confirmations
    const [settingsList, allSoldiers, allActiveEquipment, todayConfirmations] = await Promise.all([
      base44.asServiceRole.entities.AppSettings.list(null, 1),
      base44.asServiceRole.entities.Soldier.list(),
      base44.asServiceRole.entities.Equipment.filter({ status: 'active' }),
      base44.asServiceRole.entities.DailyConfirmation.filter({ confirmation_date: today }),
    ]);

    const settings = settingsList?.[0] || {};
    const defaultCommMethod = settings.default_communication_method || 'email';
    const appUrl = settings.app_url || '';

    if (!appUrl) {
      console.error("No app_url configured in settings!");
      return Response.json({ error: "app_url not configured" }, { status: 400 });
    }

    // Find unique soldiers with active equipment
    const soldiersWithEquipment = [...new Set(allActiveEquipment.map(eq => eq.soldier_name).filter(Boolean))];
    
    // Find who already confirmed today (complete confirmation)
    const confirmedSoldiers = new Set(
      todayConfirmations.filter(c => c.is_complete_confirmation === true).map(c => c.soldier_name)
    );

    // Build soldier data map
    const soldierDataMap = new Map(allSoldiers.map(s => [s.full_name, s]));

    const results = { email: 0, gmail: 0, sms: 0, skipped: 0, unreachable: 0, error: 0 };

    for (const soldierName of soldiersWithEquipment) {
      // Skip already confirmed
      if (confirmedSoldiers.has(soldierName)) {
        results.skipped++;
        console.log(`⏭️ ${soldierName} already confirmed, skipping.`);
        continue;
      }

      const soldierInfo = soldierDataMap.get(soldierName);
      let commMethod = defaultCommMethod;
      if (soldierInfo?.preferred_communication_method && soldierInfo.preferred_communication_method !== 'default') {
        commMethod = soldierInfo.preferred_communication_method;
      }

      const soldierEmail = soldierInfo?.email;
      const soldierPhone = soldierInfo?.phone_number;

      try {
        // Generate token
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        await base44.asServiceRole.entities.SoldierToken.create({
          soldier_name: soldierName,
          soldier_email: soldierEmail || '',
          soldier_id: soldierInfo?.personal_id || '',
          token: token,
          token_type: 'daily_confirmation',
          expires_at: expiresAt.toISOString(),
          used: false,
        });

        const confirmationUrl = `${appUrl}/DailyConfirmation?token=${token}`;

        if (commMethod === 'email' || commMethod === 'gmail') {
          if (!soldierEmail) {
            results.unreachable++;
            console.log(`⚠️ ${soldierName}: no email, skipping.`);
            continue;
          }

          const emailBody = `
            <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; color: #333;">
              <h3>שלום ${soldierName},</h3>
              <p>זוהי בקשת אישור ציוד יומית לתאריך <strong>${formattedDate}</strong>.</p>
              <p>אנא לחץ על הכפתור למטה לאישור הציוד שברשותך:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  אשר ציוד עכשיו
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">הקישור תקף ל-48 שעות. לא נדרשת התחברות.</p>
              <p>תודה,<br>מערכת ניהול ציוד</p>
            </div>
          `;
          const subject = `📋 בקשת אישור ציוד יומי - ${formattedDate}`;

          if (commMethod === 'gmail') {
            await sendEmailWithGmail({ to: soldierEmail, subject, body: emailBody, from_name: "מערכת ניהול ציוד" });
            results.gmail++;
          } else {
            await base44.asServiceRole.integrations.Core.SendEmail({ to: soldierEmail, subject, body: emailBody, from_name: "מערכת ניהול ציוד" });
            results.email++;
          }
          console.log(`✅ Email sent to ${soldierName} (${commMethod})`);

        } else if (commMethod === 'sms') {
          if (!soldierPhone) {
            results.unreachable++;
            console.log(`⚠️ ${soldierName}: no phone, skipping.`);
            continue;
          }
          const smsBody = `שלום ${soldierName}, בקשת אישור ציוד יומי (${formattedDate}). לחץ לאישור (תקף 48 שעות, ללא התחברות): ${confirmationUrl}`;
          await sendSmsDirectly(soldierPhone, smsBody);
          results.sms++;
          console.log(`✅ SMS sent to ${soldierName}`);
        }

        // Log reminder
        await base44.asServiceRole.entities.ReminderLog.create({
          soldier_name: soldierName,
          reminder_date: today,
          reminder_type: 'first_reminder',
          sent_successfully: true,
        });

      } catch (err) {
        results.error++;
        console.error(`❌ Failed for ${soldierName}:`, err.message);
        await base44.asServiceRole.entities.ReminderLog.create({
          soldier_name: soldierName,
          reminder_date: today,
          reminder_type: 'first_reminder',
          sent_successfully: false,
          error_message: err.message,
        });
      }

      // Small delay between sends
      await new Promise(r => setTimeout(r, 300));
    }

    await base44.asServiceRole.entities.SystemLog.create({
      message: `בקשות אישור בוקר נשלחו: מייל=${results.email}, Gmail=${results.gmail}, SMS=${results.sms}, דילוג=${results.skipped}, לא נגיש=${results.unreachable}, שגיאות=${results.error}`,
      level: 'info',
      category: 'communication',
    });

    console.log("🌅 Morning confirmation results:", results);
    return Response.json({ success: true, results });

  } catch (error) {
    console.error("Error in morningConfirmationRequest:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});