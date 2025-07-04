import React from 'react';
import { Camera, Shield } from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import { useDetectionHistory } from './hooks/useDetectionHistory';
import { LiveStream } from './components/LiveStream';
import { DetectionHistory } from './components/DetectionHistory';
import { StatsPanel } from './components/StatsPanel';
import { detectionService } from './services/detectionService';

function App() {
  const { isConnected, lastFrame, error, stats } = useWebSocket('http://localhost:5000');
  const { detections, loading, error: historyError, refresh } = useDetectionHistory();

  const handleDeleteDetection = async (id: number) => {
    try {
      await detectionService.deleteDetection(id);
      refresh();
    } catch (err) {
      console.error('Error deleting detection:', err);
    }
  };

  const currentPersonCount = lastFrame?.personCount || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <Camera className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">ESP32-CAM Detection System</h1>
                <p className="text-gray-400 text-sm">Real-time person detection with YOLOv8</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 bg-green-500/20 px-4 py-2 rounded-full">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">AI Powered</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Panel */}
        <StatsPanel
          detections={detections}
          isConnected={isConnected}
          currentPersonCount={currentPersonCount}
          stats={stats ? stats : undefined}
        />

        {/* Live Stream */}
        <div className="mb-8">
          <LiveStream
            frame={lastFrame}
            isConnected={isConnected}
            error={error}
          />
        </div>

        {/* Detection History */}
        <DetectionHistory
          detections={detections}
          loading={loading}
          error={historyError}
          onRefresh={refresh}
          onDelete={handleDeleteDetection}
          stats={stats ? stats : undefined}
        />
      </main>

      {/* Footer */}
      <footer className="bg-black/20 backdrop-blur-md border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-400">
            <p>&copy; 2025 ESP32-CAM Detection System. Built with React, Flask, and YOLOv8.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;