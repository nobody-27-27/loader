import React from 'react';
import { TruckScene } from './components/visualizer/TruckScene';
import { Sidebar } from './components/layout/Sidebar';

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sol Panel */}
      <Sidebar />

      {/* Sağ Panel: 3D Sahne */}
      <main className="flex-1 relative">
        <TruckScene />
      </main>
    </div>
  );
}

export default App;
