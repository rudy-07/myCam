import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const DashboardLayout = ({ user, children, onLogout }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('cameras');

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden font-sans text-slate-100">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogout={onLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <div className="flex-1 flex flex-col relative z-0 overflow-hidden bg-slate-900">
         {/* Background shapes logic can be reused or simplified here */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-DEFAULT/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-accent-DEFAULT/5 rounded-full blur-[100px]" />
         </div>

        <TopBar user={user} />
        
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          {children ? children : (
            // Default content matching tabs
            <div className="h-full">
                {activeTab === 'cameras' && <div className="animate-fade-in"><slot name="cameras" /></div>}
                {/* Other tabs can be rendered conditionally here or passed as children */}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
