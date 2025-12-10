import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatsCards({ title, value, icon: Icon, bgColor, trend, isIconSpinning = false, onClick }) {
  const cardClasses = "shadow-xl border-0 bg-white/80 backdrop-blur-sm h-full" + 
                      (onClick ? " cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all duration-200" : "");

  return (
    <Card className={cardClasses} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
        <div className={`w-8 h-8 ${bgColor} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-4 h-4 text-white ${isIconSpinning ? 'animate-spin' : ''}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <p className="text-xs text-slate-500 mt-1">
          {trend}
        </p>
      </CardContent>
    </Card>
  );
}