import React, { useState } from 'react';
import { 
  Database, 
  Upload, 
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import ImportSystem from '../components/import/ImportSystem';
import ManageProblems from '../components/manage/ManageProblems';
import CommunicationSettings from '../components/manage/CommunicationSettings';
import ShopSettings from '../components/manage/ShopSettings';

type ManageSection = 'import' | 'problems' | 'communication' | 'shop';

export default function ManageData() {
  const [activeSection, setActiveSection] = useState<ManageSection>('import');

  const menuItems = [
    { id: 'shop', label: 'Shop Settings', icon: Store },
    { id: 'import', label: 'Import Data', icon: Upload },
    { id: 'problems', label: 'Manage Repair Problems', icon: AlertCircle },
    { id: 'communication', label: 'Communication Settings', icon: MessageSquare },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'import':
        return (
          <div className="space-y-8">
            {/* Quick Migration Card */}
            <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">CellStore Migration</h2>
                <p className="text-blue-100 mb-6 max-w-md">
                  Migrate your entire business from CellStore in minutes. Upload your exported files and we'll handle the rest.
                </p>
                <div className="flex gap-4">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-blue-600 bg-blue-400 flex items-center justify-center text-[10px] font-bold">
                        {['C', 'P', 'S', 'R'][i-1]}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-100 flex items-center">
                    Customers, Products, Sales, and Repairs supported.
                  </p>
                </div>
              </div>
              <Database className="absolute -right-8 -bottom-8 w-48 h-48 text-blue-500/20 rotate-12" />
            </div>

            <ImportSystem />
          </div>
        );
      case 'problems':
        return <ManageProblems />;
      case 'communication':
        return <CommunicationSettings />;
      case 'shop':
        return <ShopSettings />;
      default:
        return <ImportSystem />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Manage Data
            </h2>
          </div>
          <nav className="p-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as ManageSection)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                  activeSection === item.id 
                    ? "bg-primary/10 text-primary" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn(
                    "w-4 h-4",
                    activeSection === item.id ? "text-primary" : "text-gray-400 group-hover:text-gray-600"
                  )} />
                  {item.label}
                </div>
                <ChevronRight className={cn(
                  "w-4 h-4 transition-transform",
                  activeSection === item.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
                )} />
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
}

// Helper icons for the menu
import { AlertCircle, Store } from 'lucide-react';
