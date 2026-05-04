import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatsCards({ title, value, icon: Icon, bgColor, trend, isIconSpinning = false, onClick }) {
  const cardClasses = "shadow-xl border-0 bg-white/80 backdrop-blur-sm h-full" + 
                      (onClick ? " cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all duration-200" : "");

  return (
    <Card className={cardClasses} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
        <CardTitle className="text-[11px] sm:text-sm font-medium text-slate-600 leading-tight">
          {title}
        </CardTitle>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 ${bgColor} rounded-lg flex items-center justify-center shrink-0 mr-2`}>
          <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-white ${isIconSpinning ? 'animate-spin' : ''}`} />
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="text-lg sm:text-2xl font-bold text-slate-800">{value}</div>
        <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 line-clamp-1">
          {trend}
        </p>
      </CardContent>
    </Card>
  );
}