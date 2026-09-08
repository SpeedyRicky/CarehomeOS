import React, { useState } from 'react';
import {
  Building2,
  Clock,
  Bell,
  LogOut,
  LogIn,
  ChevronDown,
} from 'lucide-react';
import { Staff, ShiftAssignment, NotificationItem } from '../types';

interface HeaderProps {
  currentStaff: Staff;
  onLogout: () => void;
  activeAssignment: ShiftAssignment | undefined;
  onClockToggle: () => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStaff,
  onLogout,
  activeAssignment,
  onClockToggle,
  notifications,
  onMarkNotificationRead,
  activeTab,
  setActiveTab,
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const unreadNotifs = notifications.filter((n) => !n.read);
  const isCareWorker = currentStaff.role === 'Care Worker';
  const isOwner = currentStaff.role === 'Owner';

  const navItems = [
    { id: 'today', label: 'Today Queue', badge: 'Active' },
    // Owner Dashboard is Owner-only; Manager Dashboard is Manager+Owner.
    ...(isOwner ? [{ id: 'owner-dashboard', label: 'Owner Dashboard' }] : []),
    ...(!isCareWorker ? [{ id: 'manager-dashboard', label: 'Manager Dashboard' }] : []),
    { id: 'emar', label: 'eMAR Meds' },
    { id: 'incidents', label: 'Incidents & Review', countBadge: '2' },
    { id: 'residents', label: 'Residents & Care' },
    ...(!isCareWorker
      ? [
          { id: 'reassessments', label: 'Reassessments', alertBadge: '1 Overdue' },
          { id: 'compliance', label: 'CA-NL Compliance' },
        ]
      : []),
    // CRM Pipeline is Owner-only — Managers and Care Workers do not see it.
    ...(isOwner ? [{ id: 'crm', label: 'CRM Pipeline' }] : []),
    { id: 'audit', label: 'Audit Log' },
    { id: 'ai', label: 'AI Explainer', special: true },
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Facility Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-lg tracking-wider shadow-sm">
              OS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">CareHomeOS</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-medium">
                  v1.0
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-700/60">
                  CA-NL
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Hi Haven Manor Inc. (18 Beds) · St. John’s, NL</span>
              </p>
            </div>
          </div>

          {/* User Role Switcher & Clock In Status */}
          <div className="flex items-center gap-3">
            {/* Shift Clock Button */}
            <button
              id="clock-toggle-btn"
              onClick={onClockToggle}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                activeAssignment?.is_active
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/40 hover:bg-rose-500/20'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>
                {activeAssignment?.is_active ? 'Clocked In (Shift Active)' : 'Clocked Out'}
              </span>
              {activeAssignment?.is_active ? (
                <LogOut className="w-3.5 h-3.5 text-emerald-400 ml-1" />
              ) : (
                <LogIn className="w-3.5 h-3.5 text-rose-400 ml-1" />
              )}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                id="notification-bell-btn"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse" />
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Workflow & Push Notifications
                    </span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                      {unreadNotifs.length} unread
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-700/60">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-400 text-center">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => onMarkNotificationRead(n.id)}
                          className={`p-3 text-xs cursor-pointer hover:bg-slate-700/50 transition ${
                            n.read ? 'opacity-60' : 'bg-slate-700/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-100">{n.title}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                n.channel === 'push'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {n.channel.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-slate-300 leading-relaxed">{n.body}</p>
                          <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
                            <span>To: {n.recipient_name} ({n.recipient_role})</span>
                            <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Signed-in account — real auth now, so this is identity display
                + sign out, not a free staff switcher. */}
            <div className="relative">
              <button
                id="account-menu-btn"
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition"
              >
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
                  {currentStaff.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200 leading-tight">
                    {currentStaff.name}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium leading-tight">
                    {currentStaff.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {showAccountMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-2">
                  <div className="px-2.5 py-2 border-b border-slate-700 mb-1">
                    <div className="text-xs font-semibold text-slate-100">{currentStaff.name}</div>
                    <div className="text-[10px] text-slate-400">@{currentStaff.username}</div>
                    <div className="text-[10px] text-emerald-400 font-medium mt-0.5">
                      {currentStaff.role} · {currentStaff.schedule_type === 'fixed_office' ? 'Mon-Fri (09:00-15:00)' : 'Rotating Shift'}
                    </div>
                  </div>
                  <div className="mt-1 pt-1">
                    <button
                      id="logout-btn"
                      onClick={() => {
                        setShowAccountMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/10 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="bg-slate-950/80 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? item.special
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : item.special
                    ? 'text-purple-300 hover:bg-slate-800'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {item.alertBadge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold">
                    {item.alertBadge}
                  </span>
                )}
                {item.countBadge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-200">
                    {item.countBadge}
                  </span>
                )}
                {item.special && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-200 border border-purple-800">
                    AI
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
