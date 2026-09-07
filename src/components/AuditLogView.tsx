import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  History,
  Lock,
  ChevronDown,
  ChevronRight,
  Code,
  User,
  Database,
} from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditLogViewProps {
  auditEvents: AuditEvent[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ auditEvents }) => {
  const [filterAction, setFilterAction] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const filteredEvents = auditEvents.filter((evt) => {
    if (filterAction !== 'all' && evt.action !== filterAction) return false;
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      return (
        evt.action.toLowerCase().includes(q) ||
        evt.actor_name.toLowerCase().includes(q) ||
        evt.resource_type.toLowerCase().includes(q) ||
        evt.resource_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(auditEvents.map((e) => e.action)));

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Append-Only Immutable Event Ledger
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Grant Enforced (INSERT/SELECT Only)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Legally defensible audit trail. Every clinical touch, medication administration, daily report submission, and prospect conversion is permanently recorded.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800"
            >
              <option value="all">All Action Types ({auditEvents.length})</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search actor, ID, resource..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white w-56"
            />
          </div>
        </div>
      </div>

      {/* Events Stream List */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold uppercase text-slate-500 tracking-wider">
          <span>Audit Stream ({filteredEvents.length} Recorded Mutations)</span>
          <span className="font-mono text-[11px] text-slate-400">PostgreSQL table: events</span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No audit events matched your search filter.
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isExpanded = expandedEventId === evt.id;

            return (
              <div key={evt.id} className="p-4 text-xs hover:bg-slate-50/50 transition">
                <div
                  onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                  className="flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <button className="text-slate-400 hover:text-slate-600 mt-0.5">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-[11px]">
                          {evt.action}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                          {evt.resource_type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {evt.resource_id}
                        </span>
                      </div>

                      <div className="text-slate-600 mt-1 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Actor: <strong>{evt.actor_name}</strong> ({evt.actor_id})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px] text-slate-400 shrink-0">
                    <div>{new Date(evt.created_at).toLocaleTimeString()}</div>
                    <div className="text-[10px]">{new Date(evt.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Expanded JSON payload view */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 pl-7">
                    <div className="flex items-center justify-between mb-1 text-[11px] text-slate-400 font-mono">
                      <span>Event UUID: {evt.id}</span>
                      <span>Prior Event ID: {evt.prior_event_id || 'null (genesis)'}</span>
                    </div>
                    <pre className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
