import React from 'react'
const LABELS = {
   qr: 'Übergabe · QR-Code',
   play: 'Stationen · Chaos Protokoll',
   finale: 'Lösungsschlüssel',
}
function formatRemaining(settings) {
   if (!settings?.startedAt) return `${settings?.timerMinutes ?? 60}:00`
   const pausedAt = settings.pausedAt ? Date.parse(settings.pausedAt) : null
   const end = pausedAt ?? Date.now()
   const elapsed = end - Date.parse(settings.startedAt) - (settings.elapsedPauseMs ?? 0)
   const remaining = Math.max(0, (settings.timerMinutes ?? 60) * 60000 - elapsed)
   const min = Math.floor(remaining / 60000)
   const sec = Math.floor((remaining % 60000) / 1000)
   return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function TopBar({ phase, solvedCount, total, groupCode, groupInfo, groupState }) {
    return (
        <header className="topbar">
           <div className="brand">
             <span className="dot" />
             MISS ANTI-LOMENE · {groupCode}
          </div>
           <div className="topbar-mid">{LABELS[phase] || 'System'} · {formatRemaining(groupState?.settings)}</div>
           <div className="topbar-right">
             TEAM {groupInfo.memberCount}/{groupInfo.maxMembers} · SOLVED {solvedCount}/{total}
          </div>
        </header>
    )
}
