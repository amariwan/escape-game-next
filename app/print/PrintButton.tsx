'use client'

export default function PrintButton() {
   return (
      <button type="button" className="btn small" onClick={() => window.print()}>
         Als PDF drucken
      </button>
   )
}
