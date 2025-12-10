import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, X, User } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function ReminderConfirmationDialog({ open, onOpenChange, soldiers, onConfirm, isSending }) {
  
  const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>אישור שליחת תזכורות</DialogTitle>
          <DialogDescription>
            אתה עומד לשלוח תזכורות לחיילים הבאים. בדוק את הרשימה ולחץ על "שלח" לאישור.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="h-72 w-full rounded-md border p-4">
            {safeSoldiers.length === 0 ? (
              <p className="text-center text-slate-500">לא נמצאו חיילים לשליחת תזכורת.</p>
            ) : (
              <div className="space-y-3">
                {safeSoldiers.map((soldier, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                       <User className="w-4 h-4 text-slate-500" />
                       <span className="font-medium text-slate-800">{soldier.soldierName}</span>
                    </div>
                    <Badge variant="outline">ממתין לאישור</Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            ביטול
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isSending || safeSoldiers.length === 0}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isSending ? 'שולח...' : `שלח תזכורת (${safeSoldiers.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}