import React from 'react';
import Tools from './components/Tools';

const App: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-app-bg text-app-text font-sans flex flex-col items-center relative overflow-x-hidden selection:bg-app-accent selection:text-white">
      
      {/* Background decoration */}
      <div className="fixed top-0 left-0 w-full h-[60vh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/20 via-black/50 to-transparent pointer-events-none z-0"></div>

      {/* Logo Header - using attached image file */}
      <header className="flex-none w-full max-w-md py-6 flex flex-col items-center justify-center z-10 relative">
        <div className="relative w-24 h-24 mb-2">
           <img 
             src="/logo.png" 
             alt="Sidekick Logo" 
             className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]"
           />
        </div>
        
        {/* Text Logo */}
        <h1 className="text-2xl font-black tracking-widest text-app-accent select-none uppercase" style={{ fontFamily: 'Impact, sans-serif' }}>
          SIDEKICK
        </h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md px-4 pb-10 z-10 relative">
        <Tools />
      </main>
    </div>
  );
};

export default App;