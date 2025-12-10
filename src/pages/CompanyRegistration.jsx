import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, CheckCircle, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function CompanyRegistration() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    admin_email: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = await base44.auth.me();
      
      // יצירת הפלוגה
      const company = await base44.entities.Company.create({
        name: formData.name,
        description: formData.description,
        admin_email: formData.admin_email || user.email,
        is_active: true
      });

      // יצירת הגדרות ברירת מחדל לפלוגה
      await base44.entities.AppSettings.create({
        company_id: company.id,
        manager_email: formData.admin_email || user.email,
        default_communication_method: "email",
        app_url: window.location.origin
      });

      setSuccess(true);
      
      // העברה לדף הבית אחרי 2 שניות
      setTimeout(() => {
        window.location.href = createPageUrl("Dashboard");
      }, 2000);

    } catch (err) {
      console.error("Error creating company:", err);
      setError("שגיאה ביצירת הפלוגה. נסה שוב.");
    }
    
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">הפלוגה נוצרה בהצלחה!</h2>
              <p className="text-slate-600">מעביר אותך למערכת...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4" dir="rtl">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold">הקמת פלוגה חדשה</CardTitle>
          <CardDescription className="text-base">
            מלא את הפרטים להקמת מערכת ניהול ציוד עצמאית לפלוגה שלך
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">שם הפלוגה *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: פלוגה ב'"
                required
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">תיאור הפלוגה</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור קצר על הפלוגה..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_email">מייל מנהל המערכת</Label>
              <Input
                id="admin_email"
                type="email"
                value={formData.admin_email}
                onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                placeholder="admin@example.com"
              />
              <p className="text-sm text-slate-500">אם לא תמלא, ישתמש במייל שלך</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ✨ <strong>חינם לחלוטין!</strong> תוכל להתחיל לנהל את הציוד של הפלוגה שלך מיד.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !formData.name}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-lg py-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  יוצר פלוגה...
                </>
              ) : (
                <>
                  <Building2 className="w-5 h-5 ml-2" />
                  צור פלוגה חדשה
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}