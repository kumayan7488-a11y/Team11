
import React from 'react';

export const AppLayout: React.FC<{ 
  children: React.ReactNode; 
  title?: string; 
  showHeader?: boolean;
  headerRight?: React.ReactNode; 
}> = ({ 
  children, 
  title = "Team 11", 
  showHeader = true,
  headerRight
}) => {
  return (
    <div className="h-full flex flex-col bg-gray-50 max-w-md mx-auto shadow-2xl relative overflow-hidden border-x border-gray-200">
      {showHeader && (
        <header className="bg-red-600 text-white p-4 shadow-lg shrink-0 z-10 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {headerRight && <div>{headerRight}</div>}
        </header>
      )}
      <main className="flex-1 overflow-y-auto pb-20 scroll-smooth">
        {children}
      </main>
    </div>
  );
};
