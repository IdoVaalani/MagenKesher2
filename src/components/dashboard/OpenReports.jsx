import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileWarning, CheckCheck, MessageSquare, User, Calendar } from 'lucide-react';

// Helper function for safely formatting date strings
const safeFormatDate = (dateString) => {
    if (!dateString) return 'לא זמין';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString; // Return original string if it's invalid
        }
        return date.toLocaleDateString('he-IL');
    } catch (e) {
        return dateString; // Return original string on error
    }
};

export default function OpenReports({ reports, onMarkAsHandled, isSending }) {
  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <CardTitle className="flex items-center gap-3">
          <FileWarning className="w-6 h-6 text-amber-600" />
          פניות פתוחות של חיילים ({reports.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {reports.length === 0 ? (
          <div className="text-center py-8">
            <CheckCheck className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">אין פניות פתוחות</h3>
            <p className="text-slate-500">כל הדיווחים מטופלים. עבודה טובה!</p>
          </div>
        ) : (
          <ScrollArea className="max-h-72 sm:h-72">
            <div className="space-y-3 sm:space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="p-3 sm:p-4 bg-amber-50 border-r-4 border-amber-500 rounded-lg space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm sm:text-base">
                        <User className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="truncate">{report.soldier_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 mt-0.5">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {safeFormatDate(report.confirmation_date)}
                      </div>
                    </div>
                     <Button
                        size="sm"
                        onClick={() => onMarkAsHandled(report)}
                        disabled={isSending}
                        className="bg-green-600 hover:bg-green-700 text-white text-[10px] sm:text-xs px-2 sm:px-3 py-1 h-auto shrink-0"
                      >
                        <CheckCheck className="w-3.5 h-3.5 ml-0.5 sm:ml-1" />
                        טופל
                      </Button>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3 pt-2 border-t border-amber-200">
                     <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                     <p className="text-xs sm:text-sm text-slate-700">{report.report_details}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}