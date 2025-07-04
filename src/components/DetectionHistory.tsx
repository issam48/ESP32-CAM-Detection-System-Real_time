import React from 'react';
import { History, Calendar, Users, Trash2, RefreshCw } from 'lucide-react';
import { Detection } from '../types/detection';

type StatsType = {
  live_count: number;
  today_detections: number;
  total_detections: number;
  avg_persons: number;
};

interface DetectionHistoryProps {
  detections: Detection[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDelete: (id: number) => void;
  stats?: StatsType;
}

import { useState } from 'react';

export const DetectionHistory: React.FC<DetectionHistoryProps> = ({
  detections,
  loading,
  error,
  onRefresh,
  onDelete,
  stats
}) => {
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // عند تغير stats (أي بث WebSocket)، أعد جلب الكشوفات مباشرة
  React.useEffect(() => {
    if (stats) {
      onRefresh();
    }
  }, [stats]);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    };
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <History className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Detection History</h2>
        </div>
        <div className="flex items-center space-x-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                // Optimistic UI: Remove detections مباشرة من الواجهة
                selectedIds.forEach(id => {
                  onDelete(id);
                });
                setSelectedIds([]);
              }}
              className="flex items-center space-x-2 bg-red-500/80 hover:bg-red-500 px-4 py-2 rounded-lg text-white font-medium"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المحدد ({selectedIds.length})</span>
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-2 bg-purple-500/20 hover:bg-purple-500/30 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-purple-400 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-purple-400 text-sm font-medium">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-700/30 rounded-lg p-4 animate-pulse">
              <div className="bg-gray-600/50 rounded-lg aspect-video mb-3"></div>
              <div className="space-y-2">
                <div className="bg-gray-600/50 rounded h-4 w-3/4"></div>
                <div className="bg-gray-600/50 rounded h-3 w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : detections.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <div className="text-gray-400 text-lg">No detections yet</div>
          <div className="text-gray-500 text-sm">Start the ESP32-CAM to see detection history</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {detections.map((detection) => {
            const { date, time } = formatDate(detection.timestamp);
            const isSelected = selectedIds.includes(detection.id);
            return (
              <div
                key={detection.id}
                className={`bg-gray-800/30 rounded-lg overflow-hidden hover:bg-gray-800/50 transition-colors group relative ${isSelected ? 'ring-2 ring-red-400' : ''}`}
              >
                <div className="absolute left-2 top-2 z-10">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={e => {
                      setSelectedIds(ids =>
                        e.target.checked ? [...ids, detection.id] : ids.filter(id => id !== detection.id)
                      );
                    }}
                    className="w-5 h-5 text-red-500 rounded border-gray-300 focus:ring-red-500"
                  />
                </div>
                <div className="aspect-video bg-gray-700/50 relative">
                  <img
                    src={`http://localhost:5000/api/images/${detection.imagePath}`}
                    alt={`Detection ${detection.id}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => {
                      setModalError(null);
                      setModalImage(`http://localhost:5000/api/images/${detection.imagePath}`);
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iIzM3NDE1MSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                  <button
                    onClick={() => {
                      // Optimistic UI: Remove مباشرة من الواجهة
                      onDelete(detection.id);
                      setSelectedIds(ids => ids.filter(id => id !== detection.id));
                    }}
                    className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-semibold">
                        {detection.personCount} person{detection.personCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {Math.round(detection.confidence * 100)}% confidence
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-300 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>{date} at {time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    {/* Modal لعرض الصورة بالحجم الكامل */}
    {modalImage && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="relative bg-gray-900 rounded-lg shadow-lg max-w-3xl w-full p-4 flex flex-col items-center">
          <button
            className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 p-2 rounded-full text-white"
            onClick={() => setModalImage(null)}
          >
            &#10006;
          </button>
          {modalError ? (
            <div className="text-red-400 text-center py-8">{modalError}</div>
          ) : (
            <img
              src={modalImage}
              alt="Detection Full Size"
              className="max-w-full max-h-[70vh] rounded-lg border border-white/10"
              onError={() => setModalError('تعذر تحميل الصورة. قد تكون غير متوفرة أو هناك مشكلة في الخادم.')}
            />
          )}
        </div>
      </div>
    )}

  </div>
  );
};