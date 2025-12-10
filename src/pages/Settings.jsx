
import React, { useState, useEffect } from "react";
import { AppSettings } from "@/entities/AppSettings";
import { DailyConfirmation } from "@/entities/DailyConfirmation";
import { Equipment } from "@/entities/Equipment";
import { EquipmentType } from "@/entities/EquipmentType"; // Fixed syntax error here
import { SystemLog } from "@/entities/SystemLog";
import { Soldier } from "@/entities/Soldier";
import { DailySummaryLog } from "@/entities/DailySummaryLog";
import { UploadFile, SendEmail } from "@/integrations/Core";
import { sendEmailHandler } from "@/functions/sendEmailHandler";
import { sendSms } from "@/functions/sendSms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, FileText, Mail, Plus, Trash2, MessageSquare, Globe } from "lucide-react";
import { User } from "@/entities/User";

export default function Settings() {
    const [settings, setSettings] = useState({
        single_confirmation_per_day: false,
        default_communication_method: 'email',
        summary_recipients: [{ type: 'email', value: '', name: '' }],
        app_url: '',
        manager_email: '',
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSendingManualSummary, setIsSendingManualSummary] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                const userData = await User.me();
                setUser(userData);

                const settingsData = await AppSettings.list(null, 1);
                let loadedSettings = {};
                if (settingsData && settingsData.length > 0) {
                    loadedSettings = settingsData[0];
                }

                setSettings(prevSettings => ({
                    ...prevSettings,
                    single_confirmation_per_day: loadedSettings.single_confirmation_per_day || false,
                    // Ensure 'whatsapp' is not selected as a default method on load if it was previously saved
                    default_communication_method: loadedSettings.default_communication_method === 'whatsapp' ? 'email' : loadedSettings.default_communication_method || 'email',
                    app_url: loadedSettings.app_url || '',
                    manager_email: userData.email,

                    summary_recipients: (() => {
                        if (loadedSettings.summary_recipients) {
                            if (Array.isArray(loadedSettings.summary_recipients) && loadedSettings.summary_recipients.length > 0) {
                                const firstItem = loadedSettings.summary_recipients[0];
                                if (typeof firstItem === 'string') {
                                    // Convert old string array to new object format, filtering out invalid emails
                                    const convertedRecipients = loadedSettings.summary_recipients
                                        .filter(email => email && email.trim() !== '')
                                        .map(email => ({ type: 'email', value: email, name: '' }));
                                    return convertedRecipients.length > 0 ? convertedRecipients : [{ type: 'email', value: '', name: '' }];
                                } else {
                                    // Filter out 'whatsapp' type recipients if they exist from previous versions
                                    const filteredRecipients = loadedSettings.summary_recipients.filter(r => r.type !== 'whatsapp');
                                    return filteredRecipients.length > 0 ? filteredRecipients : [{ type: 'email', value: '', name: '' }];
                                }
                            } else {
                                return [{ type: 'email', value: '', name: '' }];
                            }
                        } else {
                            return [{ type: 'email', value: '', name: '' }];
                        }
                    })()
                }));
            } catch (err) {
                setError('שגיאה בטעינת ההגדרות או נתוני המשתמש.');
                console.error("Error loading settings or user:", err);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    const handleRecipientChange = (index, field, value) => {
        setSettings(prevSettings => {
            const newRecipients = [...prevSettings.summary_recipients];
            newRecipients[index] = { ...newRecipients[index], [field]: value };
            return { ...prevSettings, summary_recipients: newRecipients };
        });
    };

    const addRecipient = () => {
        setSettings(prevSettings => ({
            ...prevSettings,
            summary_recipients: [...prevSettings.summary_recipients, { type: 'email', value: '', name: '' }]
        }));
    };

    const removeRecipient = (index) => {
        setSettings(prevSettings => {
            const newRecipients = prevSettings.summary_recipients.filter((_, i) => i !== index);
            if (newRecipients.length === 0) {
                return { ...prevSettings, summary_recipients: [{ type: 'email', value: '', name: '' }] };
            }
            return { ...prevSettings, summary_recipients: newRecipients };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatus('שומר הגדרות...');

        if (settings.app_url && !settings.app_url.startsWith('http://') && !settings.app_url.startsWith('https://')) {
            setStatus("שגיאה: כתובת ה-URL חייבת להתחיל עם http:// או https://");
            setIsSaving(false);
            return;
        }

        const validRecipients = settings.summary_recipients.filter(r => r.value && r.value.trim() !== '' && r.type !== 'whatsapp');
        const dataToSave = {
            single_confirmation_per_day: settings.single_confirmation_per_day,
            manager_email: user.email,
            default_communication_method: settings.default_communication_method,
            summary_recipients: validRecipients,
            app_url: settings.app_url,
        };

        try {
            let existingSettings = null;
            try {
                const currentSettings = await AppSettings.list(null, 1);
                if (currentSettings && currentSettings.length > 0) {
                    existingSettings = currentSettings[0];
                }
            } catch (err) {
                console.warn("Could not fetch existing settings, will attempt to create.", err);
            }

            const recipientsLogString = validRecipients.map(r => `${r.name ? r.name + ' ' : ''}(${r.value})`).join(', ') || 'אין';

            if (existingSettings && existingSettings.id) {
                await AppSettings.update(existingSettings.id, dataToSave);
                await SystemLog.create({
                    message: `הגדרות עודכנו. נמענים לסיכום: ${recipientsLogString}`,
                    level: 'info',
                    category: 'data'
                });
            } else {
                await AppSettings.create(dataToSave);
                await SystemLog.create({
                    message: `הגדרות נוצרו. נמענים לסיכום: ${recipientsLogString}`,
                    level: 'info',
                    category: 'data'
                });
            }

            setStatus('ההגדרות נשמרו בהצלחה!');
            setTimeout(() => setStatus(''), 3000);

        } catch (err) {
            console.error("Error saving settings:", err);
            setStatus(`שגיאה בשמירת ההגדרות: ${err.message}`);
            try {
                await SystemLog.create({
                    message: `כשל בשמירת הגדרות: ${err.message}`,
                    level: 'error',
                    category: 'data'
                });
            } catch (logErr) {
                console.error("Critical: Failed to log the settings save error:", logErr);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const generateEquipmentReport = async () => {
        try {
            const [allEquipment, allEquipmentTypes] = await Promise.all([
                Equipment.list("-created_date"),
                EquipmentType.list()
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
                await SystemLog.create({
                    message: `לא נמצא ציוד פעיל עם מספר צ' ליצירת דוח ציוד.`,
                    level: 'info',
                    category: 'report'
                });
                return null;
            }

            const headers = ['אישור אחרון מקום', 'מקום', 'שם חייל', 'מספר צ\'', 'שם ציוד'];
            const csvRows = [
                headers.join(','),
                ...reportData.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
            ];
            const csvContent = csvRows.join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const today = new Date().toISOString().split('T')[0];
            const fileName = `דוח_ציוד_עם_צ_${today}.csv`;
            const file = new File([blob], fileName, {
                type: 'text/csv;charset=utf-8;'
            });

            await SystemLog.create({
                message: `נוצר קובץ CSV של דוח ציוד עם מספרי צ' ומקומות (${reportData.length} פריטים).`,
                level: 'info',
                category: 'report'
            });

            const { file_url } = await UploadFile({ file });
            if (!file_url) {
                throw new Error("שגיאה בהעלאת קובץ הדוח המפורט.");
            }
            await SystemLog.create({
                message: `דוח ציוד עם מספרי צ' ומקומות הועלה בהצלחה: ${file_url}`,
                level: 'info',
                category: 'report'
            });

            return file_url;
        } catch (error) {
            console.error("Error generating equipment report:", error);
            await SystemLog.create({
                message: `שגיאה ביצירת דוח ציוד עם מספרי צ' ומקומות: ${error.message}`,
                level: 'error',
                category: 'report'
            });
            return null;
        }
    };

    const sendDailySummary = async () => {
        const validRecipients = settings.summary_recipients.filter(r => r.value && r.value.trim() !== '' && r.type !== 'whatsapp');

        if (validRecipients.length === 0) {
            alert("לא הוגדרו נמענים לסיכום יומי. אנא הגדר נמענים בהגדרות.");
            await SystemLog.create({
                message: `ניסיון לשלוח סיכום יומי נכשל - אין נמענים תקינים`,
                level: 'warning',
                category: 'communication'
            });
            return;
        }

        const emailRegex = /\S+@\S+\.\S+/;

        for (const recipient of validRecipients) {
            if (recipient.type === 'email' && !emailRegex.test(recipient.value)) {
                alert(`כתובת מייל לא תקינה: ${recipient.value}`);
                return;
            }
            if (recipient.type === 'sms') {
                let phoneNumber = recipient.value.trim();
                if (!phoneNumber.startsWith('+')) {
                    if (phoneNumber.startsWith('0')) {
                        phoneNumber = '+972' + phoneNumber.substring(1);
                    } else {
                        phoneNumber = '+972' + phoneNumber;
                    }
                }
                if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
                    alert(`מספר טלפון SMS לא תקין: ${recipient.value}. הכנס מספר תקין כמו 0501234567, +972501234567`);
                    return;
                }
                recipient.normalizedValue = phoneNumber;
            }
        }

        setIsSendingManualSummary(true);
        await SystemLog.create({
            message: `התחלת שליחת סיכום יומי ידני ל-${validRecipients.length} נמענים.`,
            level: 'info',
            category: 'communication'
        });

        try {
            const today = new Date().toISOString().split('T')[0];

            const existingSummaries = await DailySummaryLog.filter({ summary_date: today });
            if (existingSummaries && existingSummaries.length > 0) {
                if (!window.confirm("כבר נשלח סיכום היום. האם לשלוח שוב?")) {
                    setIsSendingManualSummary(false);
                    await SystemLog.create({
                        message: `שליחת סיכום יומי ידני בוטלה עקב שליחה קודמת היום.`,
                        level: 'info',
                        category: 'communication'
                    });
                    return;
                }
            }

            const [todayConfirmations, allSoldiers, allActiveEquipment] = await Promise.all([
                DailyConfirmation.filter({ confirmation_date: today }),
                Soldier.list(),
                Equipment.filter({ status: 'active' })
            ]);

            const confirmedSoldierNames = [...new Set(todayConfirmations.map(c => c.soldier_name))];
            const allSoldierNamesWithEquipment = [...new Set(allActiveEquipment.map(eq => eq.soldier_name).filter(Boolean))];

            const confirmedSoldiersCount = confirmedSoldierNames.length;
            const totalSoldiersWithEquipment = allSoldierNamesWithEquipment.length;
            const totalActiveEquipmentItems = allActiveEquipment.length;

            const pendingSoldierNames = allSoldierNamesWithEquipment.filter(name => !confirmedSoldierNames.includes(name));

            const equipmentReportUrl = await generateEquipmentReport();

            const textSummaryContent = `
סיכום אישורי ציוד יומי - ${new Date().toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year: 'numeric'})}

📊 סטטיסטיקות:
• סה"כ פריטי ציוד פעילים: ${totalActiveEquipmentItems}
• סה"כ חיילים עם ציוד פעיל: ${totalSoldiersWithEquipment}
• חיילים שאישרו היום: ${confirmedSoldiersCount}
• חיילים שטרם אישרו: ${pendingSoldierNames.length}

✅ חיילים שאישרו:
${confirmedSoldierNames.length > 0 ? confirmedSoldierNames.map(name => `• ${name}`).join('\n') : '• אף חייל לא אישר'}

❌ חיילים שטרם אישרו:
${pendingSoldierNames.length > 0 ? pendingSoldierNames.map(name => `• ${name}`).join('\n') : '• כל החיילים אישרו'}

${equipmentReportUrl ? `📋 דוח ציוד עם צ':
${equipmentReportUrl}` : ''}

הודעה זו נשלחה אוטומטית ממערכת ניהול הציוד.
            `.trim();

            const emailBody = `
                <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; color: #333;">
                    <h3>שלום,</h3>
                    <p>מצורף סיכום יומי של אישורי הציוד והדוח המפורט לתאריך <strong>${new Date().toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year: 'numeric'})}</strong>.</p>

                    <div style="background-color: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #d0e8ff;">
                        <h4 style="margin-top: 0; color: #2a6496;">📊 סטטיסטיקות סיכום יומי:</h4>
                        <ul style="margin: 10px 0; padding-right: 20px; list-style: none;">
                            <li style="margin-bottom: 5px;"><strong>📦 סה"כ פריטי ציוד פעילים:</strong> ${totalActiveEquipmentItems}</li>
                            <li style="margin-bottom: 5px;"><strong>👥 סה"כ חיילים עם ציוד פעיל:</strong> ${totalSoldiersWithEquipment}</li>
                            <li style="margin-bottom: 5px;"><strong>✅ חיילים שאישרו היום:</strong> ${confirmedSoldiersCount}</li>
                            <li style="margin-bottom: 5px;"><strong>🚫 חיילים שטרם אישרו:</strong> ${pendingSoldierNames.length}</li>
                        </ul>
                    </div>

                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee;">
                        <h4 style="margin-top: 0; color: #555;">✅ חיילים שאישרו:</h4>
                        <p style="margin: 5px 0;">${confirmedSoldierNames.length > 0 ? confirmedSoldierNames.map(name => `• ${name}`).join('<br>') : '• אף חייל לא אישר היום.'}</p>
                    </div>

                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee;">
                        <h4 style="margin-top: 0; color: #555;">❌ חיילים שטרם אישרו:</h4>
                        <p style="margin: 5px 0;">${pendingSoldierNames.length > 0 ? pendingSoldierNames.map(name => `• ${name}`).join('<br>') : '• כל החיילים אישרו!'}</p>
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

            const results = { success: 0, failed: 0, errors: [] };

            // פונקציה לשליחת מייל בהתאם לשיטה שנבחרה
            const sendEmailBasedOnSettings = async (email, subject, body, from_name) => {
                const useGmailFunction = settings.default_communication_method === 'gmail';
                
                if (useGmailFunction) {
                    try {
                        // Attempt to use the specific Gmail function if selected
                        await sendEmailHandler({ to: email, subject, body, from_name });
                    } catch (gmailError) {
                        console.error("Gmail function failed, falling back to built-in:", gmailError);
                        // Fallback to the built-in email sending method
                        await SendEmail({ to: email, subject, body, from_name });
                    }
                } else {
                    // Use the built-in email sending method
                    await SendEmail({ to: email, subject, body, from_name });
                }
            };

            for (const recipient of validRecipients) {
                try {
                    const valueToSend = recipient.normalizedValue || recipient.value;

                    if (recipient.type === 'email') {
                        await sendEmailBasedOnSettings(
                            valueToSend,
                            `📊 סיכום יומי - אישורי ציוד ${new Date().toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year: 'numeric'})}`,
                            emailBody,
                            "מערכת ניהול ציוד"
                        );
                        results.success++;
                        await SystemLog.create({
                            message: `סיכום יומי נשלח בהצלחה במייל ל-${recipient.value} (שיטה: ${settings.default_communication_method || 'email'})`,
                            level: 'info',
                            category: 'email'
                        });
                    } else if (recipient.type === 'sms') {
                        await sendSms({ phoneNumber: valueToSend, message: textSummaryContent });
                        results.success++;
                        await SystemLog.create({
                            message: `סיכום יומי נשלח בהצלחה ב-SMS ל-${recipient.value}`,
                            level: 'info',
                            category: 'sms'
                        });
                    }
                } catch (e) {
                    console.error(`Failed to send to ${recipient.value} (${recipient.type}):`, e);
                    results.failed++;
                    results.errors.push(`${recipient.value} (${recipient.type}): ${e.message}`);
                    await SystemLog.create({
                        message: `כשל בשליחת סיכום יומי ל-${recipient.value} (${recipient.type}): ${e.message}`,
                        level: 'error',
                        category: 'communication'
                    });
                }
            }

            await DailySummaryLog.create({
                summary_date: today,
                sent_at: new Date().toISOString(),
                success_count: results.success,
                failed_count: results.failed,
                errors: results.errors.join('; '),
                report_url: equipmentReportUrl
            });

            let finalMessage = `שליחת הסיכום הושלמה.`;
            if (results.success > 0) finalMessage += `\n✅ נשלח בהצלחה ל-${results.success} נמענים.`;
            if (results.failed > 0) {
                finalMessage += `\n❌ נכשל עבור ${results.failed} נמענים.`;
                if (results.errors.length > 0) {
                    finalMessage += `\nשגיאות: ${results.errors.slice(0, 3).map(err => err.split(':')[0]).join(', ')}${results.errors.length > 3 ? '...' : ''}`;
                }
            }
            if (equipmentReportUrl) {
                finalMessage += `\n📋 דוח ציוד עם צ' צורף לסיכום.`;
            }

            alert(finalMessage);

        } catch (error) {
            console.error("Error sending daily summary:", error);
            await SystemLog.create({
                message: `שגיאה כללית בשליחת סיכום יומי: ${error.message}`,
                level: 'error',
                category: 'communication'
            });
            alert(`שגיאה בשליחת הסיכום היומי: ${error.message}`);
        } finally {
            setIsSendingManualSummary(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-gray-700" />
                <p className="text-gray-700 mr-2">טוען הגדרות...</p>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 p-4 text-center bg-gray-50 min-h-screen">{error}</div>;
    }

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <p className="text-xl text-red-500">
                    גישה אסורה. עליך להיות מנהל כדי לגשת לדף זה.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">הגדרות מערכת</h1>
                        <p className="text-gray-600 mt-1">ניהול הגדרות כלליות של המערכת.</p>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        שמור שינויים
                    </Button>
                </header>

                {status && <p className={`mb-4 text-sm font-medium text-center p-2 rounded-md ${status.includes('בהצלחה') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{status}</p>}

                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-8">
                    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>הגדרות תקשורת</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="manager_email" className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-blue-600" />
                                    מייל מנהל המערכת (שולח סיכומים)
                                </Label>
                                <Input
                                    id="manager_email"
                                    type="email"
                                    placeholder="your_email@example.com"
                                    value={settings.manager_email}
                                    onChange={(e) => setSettings(prev => ({ ...prev, manager_email: e.target.value }))}
                                    disabled
                                />
                                <p className="text-sm text-slate-500">
                                    המייל מוגדר אוטומטית בהתאם למייל המשתמש המחובר כרגע.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="app_url" className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-blue-600" />
                                    כתובת URL ראשית של האפליקציה
                                </Label>
                                <Input
                                    id="app_url"
                                    type="url"
                                    placeholder="https://yourapp.base44.app"
                                    value={settings.app_url || ""}
                                    onChange={(e) => setSettings({ ...settings, app_url: e.target.value })}
                                />
                                <p className="text-sm text-slate-500">
                                    זוהי כתובת הבסיס של האפליקציה. היא חובה כדי שהקישורים שישלחו ב-SMS או במייל יעבדו.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="communication_method" className="flex items-center gap-2 mb-2">
                                    <MessageSquare className="w-4 h-4 text-green-600" />
                                    שיטת תקשורת ברירת מחדל
                                </Label>
                                <Select
                                    value={settings.default_communication_method}
                                    onValueChange={(value) => setSettings({ ...settings, default_communication_method: value })}
                                >
                                    <SelectTrigger id="communication_method">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="email">מייל (מובנית)</SelectItem>
                                        <SelectItem value="gmail">מייל גוגל (פונקציה עצמאית)</SelectItem>
                                        <SelectItem value="sms">SMS</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-slate-500">
                                    {settings.default_communication_method === "email" && "שימוש באינטגרציית המייל המובנית של המערכת"}
                                    {settings.default_communication_method === "gmail" && "שימוש בפונקציית מייל גוגל עצמאית (עם גיבוי למייל מובנית)"}
                                    {settings.default_communication_method === "sms" && "שליחת הודעות SMS בלבד"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>הגדרות אישור יומי</CardTitle>
                            <CardDescription>קביעת אופן פעולת מערכת האישור היומי לחיילים.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-blue-900">הגבלת אישור לפעם אחת ביום</h4>
                                    <p className="text-sm text-blue-700 mt-1">
                                        כאשר מופעל: חייל יכול לאשר ציוד פעם אחת ביום בלבד.
                                        כאשר כבוי: חייל יכול לאשר מספר פעמים ולעדכן דיווחים.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                    <input
                                        type="checkbox"
                                        id="single-confirmation"
                                        checked={settings.single_confirmation_per_day}
                                        onChange={(e) => setSettings(prev => ({ ...prev, single_confirmation_per_day: e.target.checked }))}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <Label htmlFor="single-confirmation" className="text-sm font-medium text-blue-900">
                                        {settings.single_confirmation_per_day ? 'מופעל' : 'כבוי'}
                                    </Label>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>נמענים לסיכום יומי</CardTitle>
                            <CardDescription>
                                הגדר למי יישלח סיכום יומי (מייל או SMS), ושלח דוח ידנית לנמענים הרשומים.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {settings.summary_recipients.map((recipient, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-3">
                                        <select
                                            value={recipient.type}
                                            onChange={(e) => handleRecipientChange(index, 'type', e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="email">מייל</option>
                                            <option value="sms">SMS</option>
                                        </select>
                                    </div>
                                    <div className="col-span-4">
                                        <Input
                                            type={recipient.type === 'email' ? 'email' : 'tel'}
                                            value={recipient.value}
                                            onChange={(e) => handleRecipientChange(index, 'value', e.target.value)}
                                            placeholder={
                                                recipient.type === 'email'
                                                    ? 'example@domain.com'
                                                    : '0501234567'
                                            }
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <Input
                                            type="text"
                                            value={recipient.name}
                                            onChange={(e) => handleRecipientChange(index, 'name', e.target.value)}
                                            placeholder="שם (אופציונלי)"
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeRecipient(index)}
                                            className="text-red-500 hover:bg-red-100"
                                            disabled={settings.summary_recipients.length === 1 && settings.summary_recipients[0].value === ""}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                onClick={addRecipient}
                                className="w-full border-dashed"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                הוסף נמען
                            </Button>
                        </CardContent>
                        <CardFooter className="border-t pt-6">
                            <Button
                                onClick={sendDailySummary}
                                disabled={isSendingManualSummary}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isSendingManualSummary ? (
                                    <>
                                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                        שולח דוח...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="ml-2 h-4 w-4" />
                                        שלח סיכום יומי לנמענים
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </div>
        </div>
    );
}
