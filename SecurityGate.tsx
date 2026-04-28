import React, { useState, useMemo } from 'react';
import { Equipment, Client } from '../types';

interface ReminderCenterProps {
  equipment: Equipment[];
  clients: Client[];
  onViewAsset: (clientId: string, assetId: string) => void;
}

type AlertSeverity = 'critical' | 'urgent' | 'upcoming';

interface ComplianceAlert {
  id: string;
  asset: Equipment;
  client: Client | undefined;
  type: 'Annual Maintenance' | 'Pressure Test';
  dueDate: Date;
  daysRemaining: number;
  severity: AlertSeverity;
}

const ReminderCenter: React.FC<ReminderCenterProps> = ({ equipment, clients, onViewAsset }) => {
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');

  const alerts = useMemo(() => {
    const now = new Date();
    const list: ComplianceAlert[] = [];

    equipment.forEach(item => {
      // Skip assets that are discarded or archived
      if (item.isArchived) return;

      const client = clients.find(c => c.id === item.client_id);

      // Check Service Date
      if (item.nextServiceDate) {
        const sDate = new Date(item.nextServiceDate);
        const sDiff = Math.ceil((sDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        list.push({
          id: `${item.id}-service`,
          asset: item,
          client,
          type: 'Annual Maintenance',
          dueDate: sDate,
          daysRemaining: sDiff,
          severity: sDiff < 0 ? 'critical' : (sDiff <= 30 ? 'urgent' : 'upcoming')
        });
      }

      // Check Pressure Test Date
      if (item.nextPressureTestDate) {
        const pDate = new Date(item.nextPressureTestDate);
        const pDiff = Math.ceil((pDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        list.push({
          id: `${item.id}-pressure`,
          asset: item,
          client,
          type: 'Pressure Test',
          dueDate: pDate,
          daysRemaining: pDiff,
          severity: pDiff < 0 ? 'critical' : (pDiff <= 30 ? 'urgent' : 'upcoming')
        });
      }
    });

    return list
      .filter(a => a.daysRemaining <= 90) // Only show things within 90 days or overdue
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [equipment, clients]);

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

  const stats = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    urgent: alerts.filter(a => a.severity === 'urgent').length,
    upcoming: alerts.filter(a => a.severity === 'upcoming').length
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Compliance Reminders</h2>
          <p className="text-sm text-slate-500 font-medium">Monitoring active SANS 1475 maintenance and pressure test cycles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button 
          onClick={() => setFilter('critical')}
          className={`p-4 rounded-2xl border-2 transition-all text-left ${filter === 'critical' ? 'bg-red-50 border-red-500 ring-4 ring-red-500/10' : 'bg-white border-slate-100 hover:border-red-200'}`}
        >
          <div className="text-red-600 font-black text-2xl leading-none mb-1">{stats.critical}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overdue / Critical</div>
        </button>
        <button 
          onClick={() => setFilter('urgent')}
          className={`p-4 rounded-2xl border-2 transition-all text-left ${filter === 'urgent' ? 'bg-amber-50 border-amber-200 ring-4 ring-amber-500/10' : 'bg-white border-slate-100 hover:border-red-200'}`}
        >
          <div className="text-amber-600 font-black text-2xl leading-none mb-1">{stats.urgent}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due Soon (30d)</div>
        </button>
        <button 
          onClick={() => setFilter('upcoming')}
          className={`p-4 rounded-2xl border-2 transition-all text-left ${filter === 'upcoming' ? 'bg-blue-50 border-blue-200 ring-4 ring-blue-500/10' : 'bg-white border-slate-100 hover:border-red-200'}`}
        >
          <div className="text-blue-600 font-black text-2xl leading-none mb-1">{stats.upcoming}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Upcoming (90d)</div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredAlerts.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 italic">No alerts found for the selected criteria.</p>
            <button onClick={() => setFilter('all')} className="mt-4 text-red-600 font-black text-[10px] uppercase tracking-widest underline">Show All Reminders</button>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id}
              className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group transition-all hover:shadow-md ${alert.severity === 'critical' ? 'border-l-4 border-l-red-600' : (alert.severity === 'urgent' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-blue-500')}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${alert.severity === 'critical' ? 'bg-red-600 text-white' : (alert.severity === 'urgent' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}`}>
                    {alert.type}
                  </span>
                  <span className="text-xs font-black text-slate-900">{alert.asset.serialNumber}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{alert.asset.type}</span>
                </div>
                <div className="text-[10px] font-black text-slate-700 uppercase tracking-widest truncate">{alert.client?.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{alert.asset.location}</div>
              </div>

              <div className="flex items-center gap-6 self-end sm:self-center">
                <div className="text-right">
                  <div className={`text-lg font-black leading-none ${alert.daysRemaining < 0 ? 'text-red-600' : (alert.daysRemaining <= 30 ? 'text-amber-600' : 'text-blue-600')}`}>
                    {alert.daysRemaining < 0 ? `Overdue ${Math.abs(alert.daysRemaining)}d` : `${alert.daysRemaining} Days`}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Due: {alert.dueDate.toLocaleDateString()}
                  </div>
                </div>
                
                <button 
                  onClick={() => alert.client && onViewAsset(alert.client.id, alert.asset.id)}
                  className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition-all shadow-lg active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReminderCenter;