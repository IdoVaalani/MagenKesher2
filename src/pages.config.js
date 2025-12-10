import EquipmentManagement from './pages/EquipmentManagement';
import DailyConfirmation from './pages/DailyConfirmation';
import Dashboard from './pages/Dashboard';
import EquipmentTypes from './pages/EquipmentTypes';
import Soldiers from './pages/Soldiers';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import DataCleanup from './pages/DataCleanup';
import SignEquipment from './pages/SignEquipment';
import SystemLog from './pages/SystemLog';
import SystemLogAnalysis from './pages/SystemLogAnalysis';
import CompanyRegistration from './pages/CompanyRegistration';
import __Layout from './Layout.jsx';


export const PAGES = {
    "EquipmentManagement": EquipmentManagement,
    "DailyConfirmation": DailyConfirmation,
    "Dashboard": Dashboard,
    "EquipmentTypes": EquipmentTypes,
    "Soldiers": Soldiers,
    "Settings": Settings,
    "Reports": Reports,
    "DataCleanup": DataCleanup,
    "SignEquipment": SignEquipment,
    "SystemLog": SystemLog,
    "SystemLogAnalysis": SystemLogAnalysis,
    "CompanyRegistration": CompanyRegistration,
}

export const pagesConfig = {
    mainPage: "EquipmentManagement",
    Pages: PAGES,
    Layout: __Layout,
};