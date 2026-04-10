import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';
import { google } from "npm:googleapis@134.0.0";

// --- Gmail helpers (inlined from sendEmailHandler) ---
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

// --- Main handler ---
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    console.log("checkAllConfirmedAndSendSummary triggered", JSON.stringify(payload?.event || {}));

    // Get today's date in Israel timezone
    const now = new Date();
    const israelDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const today = israelDate.toISOString().split('T')[0];
    console.log("Today (Israel):", today);

    // Get all active equipment requiring confirmation (same logic as automationTrigger)
    const allActiveEquipment = await base44.asServiceRole.entities.Equipment.filter({ status: 'active' });
    const equipmentRequiringConfirmation = allActiveEquipment.filter(eq => eq.requires_soldier_confirmation);
    
    // Count equipment per soldier
    const equipmentCountBySoldier = {};
    for (const eq of equipmentRequiringConfirmation) {
      if (eq.soldier_name) {
        equipmentCountBySoldier[eq.soldier_name] = (equipmentCountBySoldier[eq.soldier_name] || 0) + 1;
      }
    }
    
    const soldiersWithEquipment = Object.keys(equipmentCountBySoldier);
    console.log(`Total soldiers with active equipment: ${soldiersWithEquipment.length}`);

    if (soldiersWithEquipment.length === 0) {
      console.log("No soldiers with equipment, skipping summary.");
      return Response.json({ sent: false, reason: "no_soldiers_with_equipment" });
    }

    // Get today's confirmations and check by equipment count (same logic as automationTrigger)
    const todayConfirmations = await base44.asServiceRole.entities.DailyConfirmation.filter({ confirmation_date: today });
    const todayConfirmationsMap = new Map(todayConfirmations.map(conf => [conf.soldier_name, conf]));
    
    const completedSoldiers = [];
    const pending = [];
    
    for (const name of soldiersWithEquipment) {
      const totalItems = equipmentCountBySoldier[name] || 0;
      const confRecord = todayConfirmationsMap.get(name);
      const confirmedItemsCount = confRecord?.equipment_ids?.length || 0;
      
      if (totalItems > 0 && confirmedItemsCount === totalItems) {
        completedSoldiers.push(name);
      } else {
        pending.push(name);
      }
    }
    
    console.log(`Completed confirmations today: ${completedSoldiers.length}/${soldiersWithEquipment.length}`);

    // Check if all confirmed
    if (pending.length > 0) {
      console.log(`Not all confirmed yet. Pending: ${pending.join(', ')}`);
      return Response.json({ sent: false, reason: "not_all_confirmed", pending });
    }

    console.log("All soldiers confirmed! Checking if summary already sent today...");

    // Check if summary already sent today
    const existingSummaries = await base44.asServiceRole.entities.DailySummaryLog.filter({ summary_date: today });
    if (existingSummaries && existingSummaries.length > 0) {
      console.log("Summary already sent today, skipping.");
      return Response.json({ sent: false, reason: "already_sent_today" });
    }

    // Get settings for recipients
    const settingsList = await base44.asServiceRole.entities.AppSettings.list(null, 1);
    if (!settingsList || settingsList.length === 0) {
      console.log("No AppSettings found, cannot send summary.");
      return Response.json({ sent: false, reason: "no_settings" });
    }
    const settings = settingsList[0];
    const recipients = (settings.summary_recipients || []).filter(r => r.value && r.value.trim() !== '' && r.type !== 'whatsapp');

    if (recipients.length === 0) {
      console.log("No valid recipients configured.");
      return Response.json({ sent: false, reason: "no_recipients" });
    }

    // Build CSV with soldier + equipment details
    const allEquipmentTypes = await base44.asServiceRole.entities.EquipmentType.list();
    const typesMap = new Map(allEquipmentTypes.map(t => [t.id, t]));

    const csvHeaders = ['שם חייל', 'שם ציוד', 'מספר צ\'', 'מיקום', 'תאריך אישור אחרון'];
    const csvRows = [csvHeaders.join(',')];
    
    for (const soldierName of completedSoldiers) {
      const soldierEquipment = equipmentRequiringConfirmation.filter(eq => eq.soldier_name === soldierName);
      for (const eq of soldierEquipment) {
        const eqType = typesMap.get(eq.equipment_type_id);
        if (!eqType?.serial_number || eqType.serial_number <= 0) continue;
        const row = [
          soldierName,
          eqType?.name || 'לא ידוע',
          `'${eqType.serial_number}`,
          eq.location || '',
          eq.last_confirmation_date ? new Date(eq.last_confirmation_date).toLocaleDateString('he-IL') : ''
        ].map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',');
        csvRows.push(row);
      }
    }

    let reportUrl = null;
    try {
      const csvContent = '\ufeff' + csvRows.join('\n');
      const csvBytes = new TextEncoder().encode(csvContent);
      const today2 = israelDate.toISOString().split('T')[0];
      const csvFile = new File([csvBytes], `סיכום_ציוד_${today2}.csv`, { type: 'text/csv;charset=utf-8;' });
      const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: csvFile });
      reportUrl = file_url;
      console.log('CSV uploaded:', reportUrl);
    } catch (csvErr) {
      console.error('Failed to generate CSV:', csvErr.message);
    }

    // Build summary email
    const confirmedSoldierNames = completedSoldiers;
    const totalActiveEquipmentItems = allActiveEquipment.length;
    const totalSoldiersWithEquipment = soldiersWithEquipment.length;
    const dateFormatted = israelDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const emailBody = `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; color: #333;">
        <h3>שלום,</h3>
        <p>כל החיילים אישרו את הציוד שלהם! מצורף סיכום יומי לתאריך <strong>${dateFormatted}</strong>.</p>
        <div style="background-color: #e6ffe6; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #c6ffc6;">
          <h4 style="margin-top: 0; color: #338833;">🎉 כל החיילים אישרו!</h4>
          <p>כלל ${totalSoldiersWithEquipment} החיילים עם ציוד פעיל השלימו את האישור היומי.</p>
        </div>
        <div style="background-color: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #d0e8ff;">
          <h4 style="margin-top: 0; color: #2a6496;">📊 סטטיסטיקות:</h4>
          <ul style="margin: 10px 0; padding-right: 20px; list-style: none;">
            <li style="margin-bottom: 5px;"><strong>📦 סה"כ פריטי ציוד פעילים:</strong> ${totalActiveEquipmentItems}</li>
            <li style="margin-bottom: 5px;"><strong>👥 סה"כ חיילים עם ציוד:</strong> ${totalSoldiersWithEquipment}</li>
            <li style="margin-bottom: 5px;"><strong>✅ חיילים שאישרו:</strong> ${confirmedSoldierNames.length}</li>
          </ul>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee;">
          <h4 style="margin-top: 0; color: #555;">✅ חיילים שאישרו:</h4>
          <p style="margin: 5px 0;">${confirmedSoldierNames.map(name => `• ${name}`).join('<br>')}</p>
        </div>
        ${reportUrl ? `
        <div style="background-color: #fff8e6; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffe0a0;">
          <h4 style="margin-top: 0; color: #996600;">📋 דוח ציוד מפורט:</h4>
          <p>הדוח כולל פירוט של כל חייל, הציוד שאישר, מספרי צ' ומיקומים.</p>
          <a href="${reportUrl}" style="background-color: #28a745; color: white; padding: 12px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-weight: bold; margin-top: 10px;">הורד דוח ציוד מפורט</a>
        </div>
        ` : ''}
        <p style="margin-top: 30px;">בברכה,<br>מערכת ניהול ציוד</p>
      </div>
    `;

    const subject = `🎉 סיכום יומי - כל החיילים אישרו! ${dateFormatted}`;
    const useGmail = settings.default_communication_method === 'gmail';
    const results = { success: 0, failed: 0 };

    for (const recipient of recipients) {
      try {
        if (recipient.type === 'email') {
          if (useGmail) {
            await sendEmailWithGmail({
              to: recipient.value,
              subject,
              body: emailBody,
              from_name: "מערכת ניהול ציוד"
            });
          } else {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: recipient.value,
              subject,
              body: emailBody,
              from_name: "מערכת ניהול ציוד"
            });
          }
          results.success++;
          console.log(`Email sent to ${recipient.value}`);
        } else if (recipient.type === 'sms') {
          const smsMessage = `כל ${totalSoldiersWithEquipment} החיילים אישרו את הציוד שלהם להיום ${dateFormatted}`;
          await sendSmsDirectly(recipient.value, smsMessage);
          results.success++;
          console.log(`SMS sent to ${recipient.value}`);
        }
      } catch (err) {
        results.failed++;
        console.error(`Failed to send to ${recipient.value}:`, err.message);
      }
    }

    console.log(`Summary sent: ${results.success} success, ${results.failed} failed`);
    return Response.json({ sent: true, results, reportUrl });

  } catch (error) {
    console.error("Error in checkAllConfirmedAndSendSummary:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});