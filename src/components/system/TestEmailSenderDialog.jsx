import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Loader2, X } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { SendEmail } from '@/integrations/Core';
import { User } from '@/entities/User';

export default function TestEmailSenderDialog({ open, onOpenChange }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('מייל בדיקה ממערכת ניהול ציוד');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCurrentUserEmail = async () => {
      if (open) {
        try {
          const currentUser = await User.me();
          if (currentUser?.email) {
            setTo(currentUser.email);
            setBody(`שלום ${currentUser.full_name},\n\nזהו מייל בדיקה אוטומטי כדי לוודא שמערכת המיילים פועלת כראוי.\n\nתודה,\nצוות ניהול המלאי`);
          }
        } catch (error) {
          console.error("Could not fetch current user's email", error);
          toast({
            variant: "destructive",
            title: "שגיאה",
            description: "לא ניתן היה לטעון את כתובת המייל של המשתמש הנוכחי.",
          });
        }
      }
    };
    fetchCurrentUserEmail();
  }, [open, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await SendEmail({ to, subject, body });
      
      toast({
        title: "✅ המייל נשלח בהצלחה!",
        description: `המייל נשלח אל: ${to}`,
        className: "bg-green-100 text-green-800",
      });
      onOpenChange(false); // Close dialog on success
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ שגיאה בשליחה",
        description: error.message || "אירעה שגיאה לא צפויה.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>שליחת מייל בדיקה</DialogTitle>
          <DialogDescription>
            ודא שמערכת המיילים פועלת על ידי שליחת מייל בדיקה לעצמך או לנמען אחר.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="to">אל:</Label>
            <Input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">נושא:</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">תוכן ההודעה:</Label>
            <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} required rows={6} />
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              <X className="w-4 h-4 ml-2" /> ביטול
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-2" />}
              {isLoading ? "שולח..." : "שלח מייל"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}