import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User";
import { Soldier } from "@/entities/Soldier";
import { CompanyProvider, useCompany } from "@/components/CompanyContext";
import { ClipboardList, Package, CheckSquare, BarChart3, LogOut, Wrench, Menu, Users, Settings, Server, Building2, ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigationItems = [
  { title: "לוח בקרה", url: createPageUrl("Dashboard"), icon: BarChart3, adminOnly: true },
  { title: "ניהול ציוד", url: createPageUrl("EquipmentManagement"), icon: Package, adminOnly: true },
  { title: "סוגי ציוד", url: createPageUrl("EquipmentTypes"), icon: Wrench, adminOnly: true },
  { title: "חיילים", url: createPageUrl("Soldiers"), icon: Users, adminOnly: true },
  { title: "דוחות", url: createPageUrl("Reports"), icon: ClipboardList, adminOnly: true },
  { title: "הגדרות", url: createPageUrl("Settings"), icon: Settings, adminOnly: true },
  { title: "לוג מערכת", url: createPageUrl("SystemLog"), icon: Server, adminOnly: true },
  { title: "אישור יומי", url: createPageUrl("DailyConfirmation"), icon: CheckSquare, adminOnly: false },
];

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { currentCompany, companies, loading: companiesLoading, switchCompany } = useCompany();

  const urlParams = new URLSearchParams(location.search);
  const hasToken = !!urlParams.get('token');

  useEffect(() => {
    if (hasToken) {
      setIsLoading(false);
      return;
    }

    const checkUser = async () => {
      try {
        const userData = await User.me();
        setUser(userData);
      } catch (error) {
        User.login();
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, [location.search, hasToken]);

  // בדיקה אם יש פלוגה - אם לא, הפנה להרשמה
  useEffect(() => {
    const companyRegUrl = createPageUrl("CompanyRegistration");
    if (!hasToken && user && !companiesLoading && companies.length === 0 && location.pathname !== companyRegUrl) {
      navigate(companyRegUrl, { replace: true });
    }
  }, [user, companiesLoading, companies, hasToken, navigate, location.pathname]);

  useEffect(() => {
    if (!hasToken && user && currentCompany) {
      const checkUserRoleAndNavigate = async () => {
        try {
          if (user.role === 'admin') {
            return;
          }

          const soldiers = await Soldier.filter({ company_id: currentCompany.id });
          const soldierRecord = soldiers.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());

          if (soldierRecord && soldierRecord.role === 'admin') {
            return;
          }

          const dailyConfirmationUrl = createPageUrl("DailyConfirmation");
          if (location.pathname !== dailyConfirmationUrl) {
            navigate(dailyConfirmationUrl, { replace: true });
          }
        } catch (error) {
          console.error("Error checking user role for navigation:", error);
          const dailyConfirmationUrl = createPageUrl("DailyConfirmation");
          if (location.pathname !== dailyConfirmationUrl) {
            navigate(dailyConfirmationUrl, { replace: true });
          }
        }
      };

      checkUserRoleAndNavigate();
    }
  }, [user, currentCompany, location.pathname, navigate, hasToken]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user || !currentCompany) {
        setIsAdmin(false);
        return;
      }

      if (user.role === 'admin') {
        setIsAdmin(true);
        return;
      }

      try {
        const soldiers = await Soldier.filter({ company_id: currentCompany.id });
        const soldierRecord = soldiers.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
        setIsAdmin(soldierRecord && soldierRecord.role === 'admin');
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user, currentCompany]);

  const handleLogout = async () => {
    await User.logout();
    window.location.reload();
  };

  // אם יש טוקן, הצג את הדף ישירות ללא Layout
  if (hasToken) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        {/* סטיילינג בסיסי לדפי טוקן */}
        <style>{`
          * { direction: rtl; }
          @media (max-width: 768px) {
            body { font-size: 16px; -webkit-text-size-adjust: 100%; }
            input, select, textarea, button { font-size: 16px !important; }
          }
        `}</style>
        {children}
      </div>
    );
  }

  if (isLoading || companiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-6">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-6">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg">מתחבר...</p>
        </div>
      </div>
    );
  }

  // אפשר גישה לדף הרשמת פלוגה גם ללא פלוגה
  const companyRegUrl = createPageUrl("CompanyRegistration");
  if (!currentCompany && companies.length === 0 && location.pathname !== companyRegUrl) {
    return null;
  }

  // דף הרשמת פלוגה ללא Sidebar
  if (location.pathname === companyRegUrl || currentPageName === "CompanyRegistration") {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <style>{` * { direction: rtl; }`}</style>
        {children}
      </div>
    );
  }

  // הצגת ה-Layout המלא למשתמשים מחוברים
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-slate-50" dir="rtl">
        <style>{` * { direction: rtl; }`}</style>
        <Sidebar className="border-r border-slate-200 bg-white transition-all duration-300" collapsible="icon" side="right">
          <SidebarHeader className="border-b border-slate-200 p-4 md:p-6">
            {companies.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full">
                  <div className="flex items-center gap-3 hover:bg-slate-50 rounded-lg p-2 transition-colors cursor-pointer">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center shadow-lg">
                      <Building2 className="w-4 h-4 md:w-6 md:h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <h2 className="font-bold text-slate-800 text-base md:text-lg">{currentCompany?.name || 'בחר פלוגה'}</h2>
                      <p className="text-xs text-slate-500">ניהול ציוד פלוגתי</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {companies.map(company => (
                    <DropdownMenuItem
                      key={company.id}
                      onClick={() => switchCompany(company)}
                      className={currentCompany?.id === company.id ? 'bg-blue-50' : ''}
                    >
                      <Building2 className="w-4 h-4 ml-2" />
                      {company.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Building2 className="w-4 h-4 md:w-6 md:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-slate-800 text-base md:text-lg">{currentCompany?.name || 'פלוגה'}</h2>
                  <p className="text-xs text-slate-500">ניהול ציוד פלוגתי</p>
                </div>
              </div>
            )}
          </SidebarHeader>
          <SidebarContent className="p-2 md:p-3">
             <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">תפריט ראשי</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {/* Filter navigation items based on the new isAdmin state */}
                        {navigationItems.filter(item => !item.adminOnly || isAdmin).map(item => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild className={`hover:bg-slate-100 hover:text-slate-900 transition-all duration-200 rounded-xl mb-2 text-slate-700 min-h-[44px] ${location.pathname.startsWith(item.url) ? 'bg-blue-50 text-blue-600 font-semibold' : ''}`}>
                                    <Link to={item.url} className="flex items-center gap-3 px-3 md:px-4 py-3 text-sm md:text-base">
                                        <item.icon className={`w-5 h-5 ${location.pathname.startsWith(item.url) ? 'text-blue-600' : 'text-slate-500'}`} />
                                        <span className="font-medium">{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroupContent>
             </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-slate-200 p-3 md:p-4">
              <div className="flex items-center justify-between">
                {user && (
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{user.full_name?.charAt(0) || 'U'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 text-sm truncate">{user.full_name}</p>
                            {/* Display role based on isAdmin state */}
                            <p className="text-xs text-slate-500 truncate">{isAdmin ? 'מנהל מערכת' : 'חייל'}</p>
                        </div>
                    </div>
                )}
                <SidebarTrigger className="bg-slate-100 text-slate-300 p-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground h-8 w-8 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                    <Menu className="w-5 h-5 text-slate-500" />
                </SidebarTrigger>
              </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200">
                <Menu className="w-5 h-5 text-slate-600" />
              </SidebarTrigger>
              <h1 className="text-lg md:text-xl font-bold text-slate-800">{currentCompany?.name || 'פלוגה'}</h1>
            </div>
          </header>
          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <CompanyProvider>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </CompanyProvider>
  );
}