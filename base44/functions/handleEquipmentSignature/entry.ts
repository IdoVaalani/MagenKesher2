import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const requestData = await req.json();
        const { token, signatureData, action } = requestData;

        if (!token) {
            return new Response(JSON.stringify({ error: "חסר טוקן" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const tokens = await base44.asServiceRole.entities.SoldierToken.filter({ token, used: false, token_type: "equipment_signature" });
        if (tokens.length === 0) {
            return new Response(JSON.stringify({ error: "קישור לא תקין, פג תוקפו, או שכבר נעשה בו שימוש." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const validToken = tokens[0];
        const now = new Date();
        const expiresAt = new Date(validToken.expires_at);
        if (now > expiresAt) {
            return new Response(JSON.stringify({ error: "הקישור פג תוקף. אנא פנה למנהל לבקשת קישור חדש." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const metadata = JSON.parse(validToken.metadata || '{}');
        const equipmentIds = metadata.equipment_ids || [];
        if (equipmentIds.length === 0) {
            return new Response(JSON.stringify({ error: "לא נמצא ציוד לשיוך בקישור זה." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const equipmentDetailsPromises = equipmentIds.map(id => base44.asServiceRole.entities.EquipmentType.get(id).catch(() => null));
        const equipmentDetails = (await Promise.all(equipmentDetailsPromises)).filter(Boolean);

        if (action === 'validate_only') {
            return new Response(JSON.stringify({ success: true, equipment_details: equipmentDetails, soldier_name: validToken.soldier_name }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        if (action === 'submit_signature') {
            if (!signatureData) {
                return new Response(JSON.stringify({ error: "חסרים נתוני חתימה" }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const signatureRecord = {
                company_id: validToken.company_id,
                soldier_name: validToken.soldier_name,
                soldier_email: validToken.soldier_email,
                soldier_id: validToken.soldier_id || "",
                equipment_items: equipmentDetails.map(eq => ({
                    equipment_name: eq.name,
                    serial_number: eq.serial_number?.toString() || '',
                    equipment_type_id: eq.id
                })),
                signature_data: signatureData,
                signature_date: now.toISOString().split('T')[0],
                signature_time: now.toLocaleTimeString('he-IL'),
                device_info: req.headers.get('User-Agent') || "",
                status: 'active'
            };

            await base44.asServiceRole.entities.EquipmentSignature.create(signatureRecord);
            await base44.asServiceRole.entities.SoldierToken.update(validToken.id, { used: true });

            return new Response(JSON.stringify({ success: true, message: "החתימה נשמרה בהצלחה!" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: "פעולה לא ידועה" }), { status: 400, headers: { "Content-Type": "application/json" } });

    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});