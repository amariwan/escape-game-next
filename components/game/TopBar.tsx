import { remainingLabel } from '../../lib/time'
import type { GroupPayload } from '../../lib/types'

const LABELS: Record<string, string> = {
   qr: 'Übergabe · QR-Code',
   play: 'Stationen · Chaos Protokoll',
   finale: 'Lösungsschlüssel',
}

interface TopBarProps {
   phase: string
   solvedCount: number
   total: number
   groupCode: string
   groupInfo: { memberCount: number; maxMembers: number }
   groupState: GroupPayload | null
}

export default function TopBar({ phase, solvedCount, total, groupCode, groupInfo, groupState }: TopBarProps) {
   return (
      <header className="topbar">
         <div className="brand">
            <span className="dot" />
            MISS ANTI-LOMENE · {groupCode}
         </div>
         <div className="topbar-mid">
            {LABELS[phase] || 'System'} · {remainingLabel(groupState?.settings)}
         </div>
         <div className="topbar-right">
            TEAM {groupInfo.memberCount}/{groupInfo.maxMembers} · SOLVED {solvedCount}/{total}
         </div>
      </header>
   )
}
