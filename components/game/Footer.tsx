'use client'

import Link from 'next/link'

interface FooterProps {
   solved: Record<number, string>
   groupCode: string
   groupInfo: { memberCount: number; maxMembers: number }
}

export default function Footer({ solved, groupCode, groupInfo }: FooterProps) {
   return (
      <div className="footer">
         <span>© Miss Anti-lomene</span>
         <span>Gruppe: {groupCode}</span>
         <span>
            Mitglieder: {groupInfo.memberCount}/{groupInfo.maxMembers}
         </span>
         <span>gelöst: {Object.keys(solved).length}/20</span>
         <Link className="footer-link" href={`/admin/${groupCode}`}>
            Spielleitung
         </Link>
         <Link className="footer-link" href={`/projector/${groupCode}`}>
            Beamer
         </Link>
      </div>
   )
}
