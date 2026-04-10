// Forcing a clean redeployment to resolve potential routing issues.
import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

// --- פונקציות עזר ---
function normalizePhoneNumber(phoneInput) {
  if (!phoneInput || typeof phoneInput !== 'string') return null;
  let phone = phoneInput.trim();
  if (phone.startsWith('+972')) return phone;
  if (phone.startsWith('0')) phone = phone.substring(1);
  return `+972${phone}`;
}

async function sendSmsViaMiddleware(phoneNumber, message) {
  const smsToken = Deno.env.get("CUSTOM_SMS_TOKEN");
  const smsBaseUrl = 'http://195.192.226.31:50987/send';
  if (!smsToken) throw new Error("SMS token not configured.");
  const smsUrl = `${smsBaseUrl}?token=${encodeURIComponent(smsToken)}&to=${phoneNumber}&message=${encodeURIComponent(message)}`;
  const response = await fetch(smsUrl, { method: 'GET' });
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`SMS API Error ${response.status}: ${responseText}`);
  }
}

async function sendGmailViaExistingFunction(to, subject, body, fromName = 'מערכת ניהול ציוד') {
  const functionUrl = `${Deno.env.get('BASE44_APP_URL') || 'https://base44.app'}/api/apps/${Deno.env.get('BASE44_APP_ID')}/functions/sendEmailHandler`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('automationTrigger')}`
    },
    body: JSON.stringify({ to, subject, body, from_name: fromName })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email function error ${response.status}: ${errorText}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(`Email sending failed: ${result.error || 'Unknown error'}`);
  }
}

function resolveCommMethodForSoldier(soldierData, systemDefaultMethod) {
  if (soldierData?.preferred_communication_method && soldierData.preferred_communication_method !== 'default') {
    return soldierData.preferred_communication_method;
  }
  return systemDefaultMethod;
}

// פונקציית עזר לשליחת תזכורות כדי למנוע כפילות קוד
async function sendReminders(base44, reminderType, pendingSoldiers, soldierDataMap, appSettings, appUrl) {
    const today = new Date().toISOString().split('T')[0];
    const defaultCommMethod = appSettings.default_communication_method || 'gmail';
    let sentSms = 0, sentEmails = 0, unreachable = 0, errors = 0;

    for (const soldierName of pendingSoldiers) {
        const soldierData = soldierDataMap.get(soldierName);
        if (!soldierData) { unreachable++; continue; }
        const commMethod = resolveCommMethodForSoldier(soldierData, defaultCommMethod);
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        try {
            await base44.asServiceRole.entities.SoldierToken.create({
                soldier_name: soldierName,
                soldier_email: soldierData.email || '',
                soldier_id: soldierData.personal_id || '',
                token: token,
                token_type: "daily_confirmation",
                expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
                used: false
            });
            const confirmationUrl = `${appUrl}/DailyConfirmation?token=${token}`;
            
            const timeText = reminderType === 'first_reminder' ? 'בוקר טוב' : 'שלום';
            const urgencyText = reminderType === 'second_reminder' ? ' (תזכורת שנייה)' : '';
            
            if ((commMethod === 'email' || commMethod === 'gmail') && soldierData.email) {
                const emailBody = `${timeText} ${soldierName},\n\nזוהי תזכורת לאישור הציוד היומי${urgencyText}.\n\nאנא לחץ על הקישור הבא לאישור הציוד:\n${confirmationUrl}\n\nהקישור תקף ל-48 שעות.\nלא נדרשת התחברות - פשוט לחץ והאשר!\n\nבברכה,\nמערכת ניהול ציוד`;
                await sendGmailViaExistingFunction(soldierData.email, `תזכורת: אישור ציוד יומי${urgencyText}`, emailBody);
                sentEmails++;
            } else if (commMethod === 'sms' && soldierData.phone_number) {
                const phone = normalizePhoneNumber(soldierData.phone_number);
                if (phone) {
                    const smsText = `${timeText} ${soldierName}, תזכורת לאישור ציוד${urgencyText}: ${confirmationUrl}`;
                    await sendSmsViaMiddleware(phone, smsText);
                    sentSms++;
                } else { unreachable++; }
            } else {
                unreachable++;
            }
            
        } catch (error) {
            errors++;
            console.error(`Error sending ${reminderType} to ${soldierName}:`, error);
        }
    }

    // Log that this reminder type was sent for the day
    await base44.asServiceRole.entities.ReminderLog.create({
        soldier_name: 'SYSTEM',
        reminder_date: today,
        reminder_type: reminderType,
        sent_successfully: true, // This indicates the system *attempted* to send this reminder type
        error_message: `Sent to ${sentEmails} emails, ${sentSms} SMS. Unreachable: ${unreachable}, Errors: ${errors}`
    });

    return { sentSms, sentEmails, unreachable, errors };
}

// פונקציה לקביעת זמן התזכורת - מותאמת לשעון ישראל
function getReminderTimeSlot() {
  const now = new Date();
  // התאמת הזמן לשעון ישראל (UTC+3)
  const israelTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  const hour = israelTime.getUTCHours();
  
  // תזכורת ראשונה: 8:00-8:59 שעון ישראל
  if (hour === 8) {
    return 'first_reminder';
  }
  // תזכורת שנייה: 10:00-10:59 שעון ישראל
  else if (hour === 10) {
    return 'second_reminder';
  }
  // זמן סיכום: 10:00-19:59 שעון ישראל
  else if (hour >= 10 && hour < 20) {
    return 'summary_time';
  }
  // זמן לא פעיל
  else {
    return 'inactive';
  }
}

async function generateEquipmentReport(base44) {
    try {
        const [allEquipment, allEquipmentTypes] = await Promise.all([
            base44.asServiceRole.entities.Equipment.list("-created_date"),
            base44.asServiceRole.entities.EquipmentType.list()
        ]);

        const typesMap = new Map(allEquipmentTypes.map(type => [type.id, type]));

        const reportData = allEquipment
            .filter(eq => eq.status === 'active')
            .filter(eq => {
                const equipmentType = typesMap.get(eq.equipment_type_id);
                return equipmentType?.serial_number && equipmentType.serial_number > 0;
            })
            .map(eq => {
                const equipmentType = typesMap.get(eq.equipment_type_id);
                return [
                    eq.last_confirmation_date ? new Date(eq.last_confirmation_date).toLocaleDateString('he-IL') : 'לא אושר',
                    eq.location || '',
                    eq.soldier_name || 'לא משויך',
                    equipmentType?.serial_number ? `'${equipmentType.serial_number}` : 'אין',
                    equipmentType?.name || 'לא ידוע'
                ];
            });

        if (reportData.length === 0) {
            await base44.asServiceRole.entities.SystemLog.create({
                message: `לא נמצא ציוד פעיל עם מספר צ' ליצירת דוח ציוד. נבדק: ציוד פעיל (${allEquipment.filter(eq => eq.status === 'active').length}), סוגי ציוד עם צ' (${allEquipmentTypes.filter(t => t.serial_number && t.serial_number > 0).length})`,
                level: 'info',
                category: 'report'
            });
            return null;
        }

        const headers = ['אישור אחרון', 'מקום', 'שם חייל', 'מספר צ\'', 'שם ציוד'];
        const csvRows = [
            headers.join(','),
            ...reportData.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        ];
        const csvContent = csvRows.join('\n');

        const csvWithBOM = '\ufeff' + csvContent; // BOM for Hebrew support
        const csvBytes = new TextEncoder().encode(csvWithBOM);
        
        // יצירת קובץ CSV בצורה שתעבוד בסביבת Deno
        const today = new Date().toISOString().split('T')[0];
        const fileName = `דוח_ציוד_עם_צ_${today}.csv`;
        const csvFile = new File([csvBytes], fileName, { type: 'text/csv;charset=utf-8;' });

        await base44.asServiceRole.entities.SystemLog.create({
            message: `נוצר קובץ CSV של דוח ציוד עם מספרי צ' ומקומות (${reportData.length} פריטים).`,
            level: 'info',
            category: 'report'
        });

        try {
            const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: csvFile });
            if (!file_url) {
                throw new Error("שגיאה בהעלאת קובץ הדוח המפורט.");
            }
            await base44.asServiceRole.entities.SystemLog.create({
                message: `דוח ציוד עם מספרי צ' ומקומות הועלה בהצלחה: ${file_url}`,
                level: 'info',
                category: 'report'
            });
            return file_url;
        } catch (uploadError) {
            await base44.asServiceRole.entities.SystemLog.create({
                message: `שגיאה בהעלאת דוח ציוד: ${uploadError.message}`,
                level: 'error',
                category: 'report'
            });
            throw uploadError;
        }

    } catch (error) {
        console.error("Error generating equipment report:", error);
        await base44.asServiceRole.entities.SystemLog.create({
            message: `שגיאה ביצירת דוח ציוד עם מספרי צ' ומקומות: ${error.message}`,
            level: 'error',
            category: 'report'
        });
        return null;
    }
}

async function sendDailySummary(base44, appSettings) {
    const today = new Date().toISOString().split('T')[0];
    const validRecipients = (appSettings.summary_recipients || []).filter(r => r.value && r.value.trim() !== '');
    if (validRecipients.length === 0) return { message: "No summary recipients configured." };

    const [todayConfirmations, allActiveEquipment] = await Promise.all([
        base44.asServiceRole.entities.DailyConfirmation.filter({ confirmation_date: today }),
        base44.asServiceRole.entities.Equipment.filter({ status: 'active' })
    ]);
    const confirmedSoldierNames = [...new Set(todayConfirmations.map(c => c.soldier_name).filter(Boolean))];
    const allSoldierNamesWithEquipment = [...new Set(allActiveEquipment.map(eq => eq.soldier_name).filter(Boolean))];
    
    // יצירת דוח ציוד
    const equipmentReportUrl = await generateEquipmentReport(base44);
    
    const emailBody = `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; color: #333;">
            <h3>שלום,</h3>
            <p>מצורף סיכום יומי של אישורי הציוד והדוח המפורט לתאריך <strong>${new Date().toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year: 'numeric'})}</strong>.</p>

            <div style="background-color: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #d0e8ff;">
                <h4 style="margin-top: 0; color: #2a6496;">📊 סטטיסטיקות סיכום יומי:</h4>
                <ul style="margin: 10px 0; padding-right: 20px; list-style: none;">
                    <li style="margin-bottom: 5px;"><strong>👥 סה"כ חיילים עם ציוד פעיל:</strong> ${allSoldierNamesWithEquipment.length}</li>
                    <li style="margin-bottom: 5px;"><strong>✅ חיילים שאישרו היום:</strong> ${confirmedSoldierNames.length}</li>
                </ul>
            </div>

            ${equipmentReportUrl ? `
            <div style="background-color: #e6ffe6; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #c6ffc6;">
                <h4 style="margin-top: 0; color: #338833;">📋 דוח ציוד עם צ':</h4>
                <p>ניתן להוריד את דוח הציוד המעודכן המכיל מידע מפורט על כלל הציוד הפעיל במערכת מהקישור הבא:</p>
                <a href="${equipmentReportUrl}" download="דוח_ציוד_עם_צ_${today}.csv" style="background-color: #28a745; color: white; padding: 12px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-weight: bold; margin-top: 10px;">
                    הורד דוח ציוד עם צ'
                </a>
            </div>
            ` : `<p style="color: #888; font-style: italic; margin-top: 20px;">לא נוצר דוח ציוד עם צ' (ייתכן שאין ציוד פעיל עם צ' במערכת).</p>`}

            <p style="margin-top: 30px;">בברכה,<br>מערכת ניהול ציוד</p>
        </div>
    `;

    const textSummary = `
סיכום אישורי ציוד יומי - ${new Date().toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year: 'numeric'})}

📊 סטטיסטיקות:
• סה"כ חיילים עם ציוד פעיל: ${allSoldierNamesWithEquipment.length}
• חיילים שאישרו היום: ${confirmedSoldierNames.length}

${confirmedSoldierNames.length === allSoldierNamesWithEquipment.length && allSoldierNamesWithEquipment.length > 0 ? `✅ כל החיילים אישרו את הציוד שלהם!` : ''}

${equipmentReportUrl ? `📋 דוח ציוד עם צ':
${equipmentReportUrl}` : ''}

הודעה זו נשלחה אוטומטית ממערכת ניהול הציוד.
    `.trim();
    
    let success = 0, failed = 0;
    for (const recipient of validRecipients) {
        try {
            if (recipient.type === 'email') {
                await sendGmailViaExistingFunction(
                    recipient.value,
                    `📊 סיכום יומי - אישורי ציוד ${new Date().toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year: 'numeric'})}`,
                    emailBody,
                    "מערכת ניהול ציוד"
                );
                success++;
            } else if (recipient.type === 'sms') {
                const normalizedPhone = normalizePhoneNumber(recipient.value);
                if (normalizedPhone) {
                    await sendSmsViaMiddleware(normalizedPhone, textSummary);
                    success++;
                } else {
                    failed++;
                }
            }
        } catch (e) {
            console.error(`Failed to send summary to ${recipient.value}:`, e);
            failed++;
        }
    }
    
    if (success > 0) {
        await base44.asServiceRole.entities.DailySummaryLog.create({ 
            summary_date: today, 
            sent_at: new Date().toISOString(),
            success_count: success,
            failed_count: failed,
            report_url: equipmentReportUrl
        });
    }
    return { success, failed, equipmentReportUrl };
}

// --- פונקציה ראשית ---
Deno.serve(async (_req) => {
  try {
    const base44 = createClientFromRequest(_req);
    const appSettingsArray = await base44.asServiceRole.entities.AppSettings.list();
    const appSettings = appSettingsArray?.[0] || {};
    
    // CRITICAL FIX: Prioritize the system environment variable for the app URL to prevent broken links.
    const appUrl = Deno.env.get('BASE44_APP_URL') || appSettings.app_url;
    
    if (!appUrl || appUrl.trim() === '') return Response.json({ success: false, error: "App URL is not configured in settings or environment variables." }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];
    const timeSlot = getReminderTimeSlot();
    
    const [allEquipment, todayConfirmations, soldiers, reminderLogs] = await Promise.all([
      base44.asServiceRole.entities.Equipment.filter({ status: 'active' }),
      base44.asServiceRole.entities.DailyConfirmation.filter({ confirmation_date: today }),
      base44.asServiceRole.entities.Soldier.list(),
      base44.asServiceRole.entities.ReminderLog.filter({ reminder_date: today, soldier_name: 'SYSTEM' })
    ]);
    
    // **תיקון קריטי: שימוש באותה לוגיקה כמו הדשבורד**
    const equipmentRequiringConfirmation = allEquipment.filter(eq => eq.requires_soldier_confirmation && eq.status === 'active');
    
    // ספירת ציוד לכל חייל
    const equipmentCountBySoldier = equipmentRequiringConfirmation.reduce((acc, eq) => {
      if (eq.soldier_name) {
          acc[eq.soldier_name] = (acc[eq.soldier_name] || 0) + 1;
      }
      return acc;
    }, {});
    
    const soldierNames = Object.keys(equipmentCountBySoldier);
    const todayConfirmationsMap = new Map(todayConfirmations.map(conf => [conf.soldier_name, conf]));

    // חישוב אישורים מלאים בזמן אמת
    const fullyConfirmedSoldiers = new Set();
    const pendingSoldiers = [];
    
    for (const name of soldierNames) {
      const totalItems = equipmentCountBySoldier[name] || 0;
      const confRecord = todayConfirmationsMap.get(name);
      const confirmedItemsCount = confRecord?.equipment_ids?.length || 0;
      
      if (totalItems > 0 && confirmedItemsCount === totalItems) {
        fullyConfirmedSoldiers.add(name);
      } else {
        pendingSoldiers.push(name);
      }
    }

    const confirmedCount = fullyConfirmedSoldiers.size;
    const pendingCount = pendingSoldiers.length;

    await base44.asServiceRole.entities.SystemLog.create({
        message: `בדיקה אוטומטית: ${soldierNames.length} חיילים, ${confirmedCount} אישרו במלואו, ${pendingCount} ממתינים.`,
        level: 'info',
        category: 'data'
    });

    // אם כולם אישרו במלואו - שלח סיכום יומי
    if (pendingCount === 0 && soldierNames.length > 0) {
      const existingSummaries = await base44.asServiceRole.entities.DailySummaryLog.filter({ summary_date: today });
      if (existingSummaries && existingSummaries.length > 0) {
        return Response.json({ success: true, message: "All confirmed, summary already sent today." });
      }
      const { success, failed, equipmentReportUrl } = await sendDailySummary(base44, appSettings);
      return Response.json({ success: true, message: `All confirmed. Summary sent to ${success} recipients, failed for ${failed}.`, reportUrl: equipmentReportUrl });
    }

    // שאר הקוד נשאר זהה
    const soldierDataMap = new Map(soldiers.map(s => [s.full_name, s]));
    const actionsTaken = [];

    const currentSlot = getReminderTimeSlot();
    if (currentSlot === 'first_reminder' || currentSlot === 'second_reminder') {
        
        if (pendingSoldiers.length > 0) {
            const firstReminderSent = reminderLogs.some(log => log.reminder_type === 'first_reminder');
            if (!firstReminderSent && timeSlot === 'first_reminder') {
                const result = await sendReminders(base44, 'first_reminder', pendingSoldiers, soldierDataMap, appSettings, appUrl);
                actionsTaken.push(`Sent first reminder to ${result.sentEmails + result.sentSms} soldiers. (Errors: ${result.errors}, Unreachable: ${result.unreachable})`);
                reminderLogs.push({ reminder_type: 'first_reminder' }); 
            }

            const firstReminderNowSent = reminderLogs.some(log => log.reminder_type === 'first_reminder');
            const secondReminderSent = reminderLogs.some(log => log.reminder_type === 'second_reminder');
            if (firstReminderNowSent && !secondReminderSent && timeSlot === 'second_reminder') {
                const result = await sendReminders(base44, 'second_reminder', pendingSoldiers, soldierDataMap, appSettings, appUrl);
                actionsTaken.push(`Sent second reminder to ${result.sentEmails + result.sentSms} soldiers. (Errors: ${result.errors}, Unreachable: ${result.unreachable})`);
            }
        }
    }

    if (actionsTaken.length > 0) {
        return Response.json({ success: true, message: actionsTaken.join(' ') });
    }
    
    if (timeSlot === 'summary_time') {
        const existingSummaries = await base44.asServiceRole.entities.DailySummaryLog.filter({ summary_date: today });
        if (existingSummaries && existingSummaries.length > 0) {
            return Response.json({ success: true, message: "Summary already sent today." });
        }
        const { success, failed, equipmentReportUrl } = await sendDailySummary(base44, appSettings);
        return Response.json({ 
            success: true, 
            message: `Daily summary sent to ${success} recipients (failed: ${failed}). Pending soldiers: ${pendingSoldiers.length}.`,
            pending_soldiers: pendingSoldiers,
            reportUrl: equipmentReportUrl
        });
    }

    return Response.json({ success: true, message: "No action required at this time." });
  } catch (error) {
    console.error('Automation Trigger Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});