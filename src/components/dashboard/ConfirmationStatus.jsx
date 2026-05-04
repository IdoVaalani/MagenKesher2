import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Clock } from "lucide-react";

export default function ConfirmationStatus({ stats = {}, loading, onSendReminders, pendingCount, isSending }) {
  if (loading) {
    return (
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>סטטוס אישורים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const safeStats = stats || { total: 0, confirmed: 0, pending: 0 };
  const completionPercentage = safeStats.totalSoldiers > 0 ? Math.round((safeStats.confirmed / safeStats.totalSoldiers) * 100) : 0;

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <CardTitle className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          סטטוס אישורים יומיים
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="space-y-4 sm:space-y-6">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1 sm:mb-2">
              {completionPercentage}%
            </div>
            <p className="text-slate-600 text-sm">שיעור אישורים היום</p>
            <div className="w-full bg-slate-200 rounded-full h-2.5 sm:h-3 mt-3 sm:mt-4">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 sm:h-3 rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-xl sm:text-2xl font-bold text-green-700 mb-0.5">
                {safeStats.confirmed}
              </div>
              <p className="text-xs sm:text-sm text-green-600">אישרו</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-xl sm:text-2xl font-bold text-orange-700 mb-0.5">
                {safeStats.pending}
              </div>
              <p className="text-xs sm:text-sm text-orange-600">ממתינים</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}