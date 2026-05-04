import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, CheckCircle, Clock, ListChecks } from "lucide-react";

export default function SoldiersList({ confirmationData, loading, onSoldierClick }) {
  if (loading) {
    return (
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>רשימת חיילים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Safe guard against null/undefined confirmationData
  if (!confirmationData || !Array.isArray(confirmationData)) {
    return (
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="flex items-center gap-3">
            <User className="w-6 h-6 text-blue-600" />
            רשימת חיילים (0)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <ListChecks className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">אין חיילים במערכת</h3>
            <p className="text-slate-500">הנתונים עדיין נטענים...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <CardTitle className="flex items-center gap-3">
          <User className="w-6 h-6 text-blue-600" />
          רשימת חיילים ({confirmationData.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {confirmationData.length === 0 ? (
          <div className="text-center py-8">
            <ListChecks className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">אין חיילים במערכת</h3>
            <p className="text-slate-500">לא נמצאו חיילים עם ציוד הדורש אישור</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3 max-h-[60vh] sm:max-h-96 overflow-y-auto">
            {confirmationData.map((soldierData) => {
              const isConfirmed = soldierData.confirmed || false;
              const isPartiallyConfirmed = soldierData.partiallyConfirmed || false; 
              
              return (
                <div 
                  key={soldierData.soldierName} 
                  className={`flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-lg transition-colors ${
                    isPartiallyConfirmed ? 'cursor-pointer hover:bg-yellow-100 border border-yellow-300' : 'hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    if (isPartiallyConfirmed && onSoldierClick) {
                      onSoldierClick(soldierData.soldierName);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isConfirmed ? 'bg-green-100' : isPartiallyConfirmed ? 'bg-yellow-100' : 'bg-orange-100'
                    }`}>
                      {isConfirmed ? (
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                      ) : isPartiallyConfirmed ? (
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                      ) : (
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 text-sm sm:text-base truncate">{soldierData.soldierName}</p>
                      {soldierData.confirmationTime && (
                        <p className="text-xs sm:text-sm text-slate-500">
                          אושר: {soldierData.confirmationTime}
                        </p>
                      )}
                      {soldierData.reportDetails && (
                        <p className="text-[10px] sm:text-xs text-amber-600 mt-0.5 truncate">
                          דווח: {soldierData.reportDetails}
                        </p>
                      )}
                      {isPartiallyConfirmed && (
                        <p className="text-[10px] sm:text-xs text-yellow-700 mt-0.5 font-medium">
                          👆 לחץ לפרטים
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className={`shrink-0 text-[10px] sm:text-xs ${
                    isConfirmed 
                      ? "bg-green-100 text-green-800 border-green-200" 
                      : isPartiallyConfirmed 
                      ? "bg-yellow-100 text-yellow-800 border-yellow-200" 
                      : "bg-orange-100 text-orange-800 border-orange-200"
                  }`}>
                    {isConfirmed ? 'אושר' : isPartiallyConfirmed ? 'חלקי' : 'ממתין'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}