'use client'

import React from 'react'
import Link from 'next/link'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import { 
  ClipboardCheck, 
  Banknote, 
  Package, 
  BarChart3, 
  Clock 
} from 'lucide-react'

const reports = [
  {
    title: 'Global Daybook',
    description: 'Consolidated cash flow showing payments and expenses across all/selected outlets.',
    icon: Banknote,
    href: '/reports/daybook',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    title: 'Global Sales Report',
    description: 'Aggregate breakdown of orders, gross amounts, and collections nationwide.',
    icon: ClipboardCheck,
    href: '/reports/sales',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Stock Summary (Global)',
    description: 'Combined inventory status, total capital valuation, and stock levels.',
    icon: Package,
    href: '/reports/stock',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    title: 'P&L (Global)',
    description: 'Calculate total net earnings after COGS and nationwide operational expenses.',
    icon: BarChart3,
    href: '/reports/profit-loss',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  {
    title: 'Recovery Report',
    description: 'Track all pending installments and credit exposure across the business.',
    icon: Clock,
    href: '/reports/recovery',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
]

export default function GlobalReportsPage() {
  return (
    <>
      <Breadcrumb pageName="Global Reports & Analytics" />
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Business Intelligence</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Vyapar-style reports for Super Admins. Select a report to view aggregated or outlet-specific insights.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="group relative flex flex-col rounded-[20px] border border-stroke bg-white p-8 transition-all hover:border-[#ff3d3d] hover:shadow-2 dark:border-dark-3 dark:bg-gray-dark dark:hover:border-[#ff3d3d]"
          >
            <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${report.bgColor} transition-transform group-hover:scale-110`}>
              <report.icon className={`h-7 w-7 ${report.color}`} />
            </div>
            
            <h3 className="mb-3 text-xl font-bold text-dark dark:text-white group-hover:text-[#ff3d3d]">
              {report.title}
            </h3>
            
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {report.description}
            </p>

            <div className="mt-6 flex items-center text-sm font-bold text-[#ff3d3d] opacity-0 transition-opacity group-hover:opacity-100">
              View Report
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
