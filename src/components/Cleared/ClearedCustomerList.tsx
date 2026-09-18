'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Loader from '@/components/common/Loader'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Cookies from 'js-cookie'
import { SearchIcon } from '@/assets/icons'
import { useProfileModal } from '../../../contexts/ProfileModalContext'
import { CheckCircle, PartyPopper, Ban } from 'lucide-react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

interface CustomerGroup {
  customer: any
  ledgerSummary: any
  orders: any[]
}

const fmt = (n: number) => `Rs. ${Number(n).toLocaleString()}`

const ClearedCustomerList = () => {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerGroup[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const { openProfile } = useProfileModal()

  const fetchCleared = async () => {
    setLoading(true)
    try {
      const token = Cookies.get('auth_token')
      if (!token) return

      const res = await fetch(`${BACKEND_URL}/api/customers/cleared`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch cleared accounts')
      const json = await res.json()

      if (json.success && json.data) {
        setCustomers(json.data.customers ?? [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCleared()
  }, [])

  const handleViewProfile = (customerGroup: CustomerGroup) => {
    if (customerGroup.orders && customerGroup.orders.length > 0) {
        openProfile(customerGroup.orders[0]);
    }
  }

  const columns: ColumnDef<CustomerGroup>[] = [
    {
      id: 'customer_name',
      accessorFn: (row) => row.customer.name,
      header: 'Customer Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle size={18} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-dark dark:text-white">{row.original.customer.name}</span>
            {row.original.customer.is_blacklisted && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <Ban size={10} /> Blacklisted
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'telephone_number',
      accessorFn: (row) => row.customer.telephone_number,
      header: 'Contact',
    },
    {
      id: 'cnic_number',
      accessorFn: (row) => row.customer.cnic_number || '-',
      header: 'CNIC',
    },
    {
      id: 'created_at',
      accessorFn: (row) => row.customer.created_at,
      header: 'Registration',
      cell: ({ getValue }) => {
        const val = getValue() as string
        if (!val) return '-'
        const date = new Date(val)
        return (
          <div className="flex flex-col">
            <span className="font-bold text-dark dark:text-white">
              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-[10px] text-gray-400 font-bold uppercase">
              {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        )
      },
    },
    {
      id: 'cleared_at',
      accessorFn: (row) => row.customer.cleared_at,
      header: 'Cleared Date',
      cell: ({ getValue }) => {
        const val = getValue() as string
        if (!val) return '-'
        const date = new Date(val)
        return (
          <div className="flex flex-col">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-[10px] text-gray-400 font-bold uppercase">
              {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        )
      },
    },
    {
      id: 'total_paid',
      accessorFn: (row) => row.ledgerSummary.totalPaid,
      header: 'Total Paid',
      cell: ({ getValue }) => (
        <div className="font-black text-emerald-600">
          {fmt(Number(getValue()))}
        </div>
      ),
    },
    {
        id: 'status',
        header: 'Health Status',
        cell: () => (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase text-white">
                <PartyPopper size={12} /> Excellent
            </span>
        )
    },
    {
      id: 'actions',
      header: 'Review',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewProfile(row.original)}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            View Profile
          </button>
          <button
            onClick={() => {
              if (row.original.customer.is_blacklisted) return;
              const lastOrder = row.original.orders?.[0];
              if (lastOrder) {
                router.push(`/convert-sale/${lastOrder.order_id}`);
              }
            }}
            disabled={row.original.customer.is_blacklisted}
            title={row.original.customer.is_blacklisted ? 'Whitelist this account first from Blacklisted Customers' : undefined}
            className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            Convert Sale
          </button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const filteredData = globalFilter 
    ? customers.filter(c => 
        c.customer.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
        c.customer.telephone_number.includes(globalFilter) ||
        (c.customer.cnic_number && c.customer.cnic_number.includes(globalFilter))
      )
    : customers;

  return (
    <section className="rounded-[2.5rem] bg-white p-8 dark:bg-boxdark">
      <div className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
            <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight flex items-center gap-3">
                <CheckCircle className="text-emerald-500" size={32} />
                Cleared Accounts
            </h2>
            <p className="text-sm text-gray-400 mt-1 font-medium">List of customers who have successfully completed all installments.</p>
        </div>

        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full rounded-2xl border border-stroke bg-gray-50 px-6 py-4 outline-none focus:border-emerald-500 dark:border-strokedark dark:bg-meta-4 transition-all"
            placeholder="Search cleared customers..."
          />
          <SearchIcon className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-stroke dark:border-strokedark">
                {hg.headers.map((header) => (
                  <th key={header.id} className="pb-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-meta-4/20">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center text-emerald-500 font-black">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  FETCHING CLEARED RECORDS...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center">
                  <div className="bg-gray-50 dark:bg-meta-4/10 p-10 rounded-[2.5rem] inline-block border border-stroke dark:border-strokedark">
                    <CheckCircle size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No Cleared Accounts Yet</p>
                    <p className="text-xs text-gray-400 mt-2">Accounts will appear here once all installments are fully paid.</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/5 transition-colors group">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-6 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ClearedCustomerList
