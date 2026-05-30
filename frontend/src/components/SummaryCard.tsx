import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string | number
  subtext?: string
  highlight?: 'green' | 'red' | 'yellow' | 'default'
}

const highlightStyles: Record<string, string> = {
  green: 'text-green-600',
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  default: 'text-gray-900',
}

export default function SummaryCard({ label, value, subtext, highlight = 'default' }: Props): ReactNode {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${highlightStyles[highlight]}`}>{value}</p>
      {subtext && (
        <p className="mt-1 text-xs text-gray-400">{subtext}</p>
      )}
    </div>
  )
}