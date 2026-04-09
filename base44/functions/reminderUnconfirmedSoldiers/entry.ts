import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

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
    console.log("🔔 Reminder for unconfirmed soldiers starting...");

    // Get Israel date
    const now = new Date();
    const israelDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const today = israelDate.toISOString().split('T')[0];
    const formattedDate = israelDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Load data
    const [settingsList, allSoldiers, allActiveEquipment, todayConfirmations] = await Promise.all([
      base44.asServiceRole.entities.AppSettings.list(null, 1),
      base44.asServiceRole.entities.Soldier.list(),
      base44.asServiceRole.entities.Equipment.filter({ status: 'active' }),
      base44.asServiceRole.entities.DailyConfirmation.filter({ confirmation_date: today }),
    ]);

    const settings = settingsList?.[0] || {};
    const appUrl = settings.app_url || '';

    if (!appUrl) {
      console.error("No app_url configured in settings!");
      return Response.json({ error: "app_url not configured" }, { status: 400 });
    }

    // Find soldiers with equipment requiring confirmation (same logic as automationTrigger)
    const equipmentRequiringConfirmation = allActiveEquipment.filter(eq => eq.requires_soldier_confirmation);
    const equipmentCountBySoldier = {};
    for (const eq of equipmentRequiringConfirmation) {
      if (eq.soldier_name) {
        equipmentCountBySoldier[eq.soldier_name] = (equipmentCountBySoldier[eq.soldier_name] || 0) + 1;
      }
    }
    const soldiersWithEquipment = Object.keys(equipmentCountBySoldier);
    
    // Find who already fully confirmed today (by equipment count, same as automationTrigger)
    const todayConfirmationsMap = new Map(todayConfirmations.map(conf => [conf.soldier_name, conf]));
    const confirmedSoldiers = new Set();
    for (const name of soldiersWithEquipment) {
      const totalItems = equipmentCountBySoldier[name] || 0;
      const confRecord = todayConfirmationsMap.get(name);
      const confirmedItemsCount = confRecord?.equipment_ids?.length || 0;
      if (totalItems > 0 && confirmedItemsCount === totalItems) {
        confirmedSoldiers.add(name);
      }
    }

    // Find who hasn't confirmed
    const unconfirmedSoldiers = soldiersWithEquipment.filter(name => !confirmedSoldiers.has(name));

    console.log(`📊 ${confirmedSoldiers.size}/${soldiersWithEquipment.length} confirmed. ${unconfirmedSoldiers.length} pending.`);

    if (unconfirmedSoldiers.length === 0) {
      console.log("✅ All soldiers confirmed, no reminders needed.");
      return Response.json({ success: true, sent: 0, reason: "all_confirmed" });
    }

    const soldierDataMap = new Map(allSoldiers.map(s => [s.full_name, s]));
    const results = { sent: 0, noPhone: 0, error: 0 };

    for (const soldierName of unconfirmedSoldiers) {
      const soldierInfo = soldierDataMap.get(soldierName);
      const soldierPhone = soldierInfo?.phone_number;

      if (!soldierPhone) {
        results.noPhone++;
        console.log(`⚠️ ${soldierName}: no phone number, cannot send SMS reminder.`);
        continue;
      }

      try {
        // Find existing valid token or create new one
        const existingTokens = await base44.asServiceRole.entities.SoldierToken.filter({
          soldier_name: soldierName,
          token_type: 'daily_confirmation',
          used: false,
        });

        let tokenValue;
        const validToken = existingTokens.find(t => new Date(t.expires_at) > now);
        
        if (validToken) {
          tokenValue = validToken.token;
        } else {
          // Create new token
          tokenValue = Math.random().toString(36).substring(2) + Date.now().toString(36);
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 48);
          await base44.asServiceRole.entities.SoldierToken.create({
            soldier_name: soldierName,
            soldier_email: soldierInfo?.email || '',
            soldier_id: soldierInfo?.personal_id || '',
            token: tokenValue,
            token_type: 'daily_confirmation',
            expires_at: expiresAt.toISOString(),
            used: false,
          });
        }

        const confirmationUrl = `${appUrl}/DailyConfirmation?token=${tokenValue}`;
        const smsBody = `⚠️ תזכורת: ${soldierName}, טרם אישרת את הציוד שלך להיום (${formattedDate}). לחץ לאישור: ${confirmationUrl}`;

        await sendSmsDirectly(soldierPhone, smsBody);
        results.sent++;
        console.log(`📱 SMS reminder sent to ${soldierName}`);

        await base44.asServiceRole.entities.ReminderLog.create({
          soldier_name: soldierName,
          reminder_date: today,
          reminder_type: 'second_reminder',
          sent_successfully: true,
        });

      } catch (err) {
        results.error++;
        console.error(`❌ SMS reminder failed for ${soldierName}:`, err.message);
        await base44.asServiceRole.entities.ReminderLog.create({
          soldier_name: soldierName,
          reminder_date: today,
          reminder_type: 'second_reminder',
          sent_successfully: false,
          error_message: err.message,
        });
      }

      await new Promise(r => setTimeout(r, 300));
    }

    await base44.asServiceRole.entities.SystemLog.create({
      message: `תזכורות SMS נשלחו ל-${results.sent} חיילים שטרם אישרו (${results.noPhone} ללא טלפון, ${results.error} שגיאות).`,
      level: 'info',
      category: 'communication',
    });

    console.log("🔔 Reminder results:", results);
    return Response.json({ success: true, results });

  } catch (error) {
    console.error("Error in reminderUnconfirmedSoldiers:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});