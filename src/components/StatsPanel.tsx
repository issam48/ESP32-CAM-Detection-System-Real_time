import React from 'react';
import { Activity, Eye, Clock, TrendingUp } from 'lucide-react';
import { Detection } from '../types/detection';

type StatsType = {
  live_count: number;
  today_detections: number;
  total_detections: number;
  avg_persons: number;
};

interface StatsPanelProps {
  detections: Detection[];
  isConnected: boolean;
  currentPersonCount: number;
  stats?: StatsType;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  detections,
  isConnected,
  currentPersonCount,
  stats
}) => {
  // استخدم القيم من stats إذا توفرت (WebSocket)، وإلا احسبها من detections
  const totalDetections = stats ? stats.total_detections : detections.length;
  const totalPersons = stats ? stats.total_detections * stats.avg_persons : detections.reduce((sum, d) => sum + d.personCount, 0);
  const averagePersons = stats ? stats.avg_persons.toFixed(1) : (totalDetections > 0 ? (totalPersons / totalDetections).toFixed(1) : '0');
  const todayDetections = stats ? stats.today_detections : detections.filter(d => {
    const today = new Date();
    const detectionDate = new Date(d.timestamp);
    return detectionDate.toDateString() === today.toDateString();
  }).length;
  const liveCount = stats ? stats.live_count : currentPersonCount;

  const statList = [
    {
      icon: Activity,
      label: 'Live Count',
      value: liveCount.toString(),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20'
    },
    {
      icon: Eye,
      label: 'Total Detections',
      value: totalDetections.toString(),
      color: 'text-green-400',
      bgColor: 'bg-green-500/20'
    },
    {
      icon: Clock,
      label: 'Today',
      value: todayDetections.toString(),
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20'
    },
    {
      icon: TrendingUp,
      label: 'Avg. Persons',
      value: averagePersons,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statList.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 hover:bg-white/15 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className={`${stat.bgColor} p-2 rounded-lg`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};