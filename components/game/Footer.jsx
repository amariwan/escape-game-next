'use client'

import React from 'react'

export default function Footer({ solved, onReset, groupCode, groupInfo }) {
    return (
        <div className="footer">
           <span>© Miss Anti-lomene</span>
           <span>Gruppe: {groupCode}</span>
           <span>Mitglieder: {groupInfo.memberCount}/{groupInfo.maxMembers}</span>
           <span>gelöst: {Object.keys(solved).length}/20</span>
           <a className="footer-link" href={`/admin/${groupCode}`}>Spielleitung</a>
           <a className="footer-link" href={`/projector/${groupCode}`}>Beamer</a>
           <button className="footer-reset" onClick={onReset}>Spielstand zurücksetzen</button>
        </div>
     )
}
