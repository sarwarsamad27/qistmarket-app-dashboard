import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getFilteredRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import Loader from "@/components/common/Loader";
import { ChevronLeft, ChevronRight, SearchIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

import { serialColumn } from '@/utils/serialColumn'
interface DeliveryOrder {
    id: number;
    order_ref: string;
    customer_name: string;
    address: string;
    product_name: string;
    amount: number;
    status: string;
    delivery_officer: { username: string; full_name: string } | null;
    updated_at: string;
}

interface DeliveryTableProps {
    data: DeliveryOrder[];
    loading: boolean;
    onMarkDelivered: (order: DeliveryOrder) => void;
    onMarkReturned: (order: DeliveryOrder) => void;
    onMarkRefunded: (order: DeliveryOrder) => void;
}

export const DeliveryTable = ({
    data,
    loading,
    onMarkDelivered,
    onMarkReturned,
    onMarkRefunded,
}: DeliveryTableProps) => {
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const columns: ColumnDef<DeliveryOrder>[] = [
    serialColumn<DeliveryOrder>(),
    {
            accessorKey: 'order_ref',
            header: 'Order Ref',
            cell: ({ row }) => <span className="font-bold text-black dark:text-white">{row.original.order_ref}</span>
        },
        { accessorKey: 'customer_name', header: 'Customer' },
        { accessorKey: 'product_name', header: 'Product' },
        {
            accessorKey: 'address',
            header: 'Address',
            cell: ({ row }) => <div className="max-w-[200px] truncate" title={row.original.address}>{row.original.address}</div>
        },
        {
            accessorKey: 'delivery_officer',
            header: 'Rider',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-black dark:text-white">
                        {row.original.delivery_officer?.full_name || 'Unassigned'}
                    </span>
                    {row.original.delivery_officer && (
                        <span className="text-[10px] text-gray-500">@{row.original.delivery_officer.username}</span>
                    )}
                </div>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <span className={cn(
                    "inline-flex rounded-full py-1 px-3 text-xs font-bold uppercase tracking-wider",
                    row.original.status === 'delivered' ? "bg-success/10 text-success" :
                        row.original.status === 'returned' ? "bg-danger/10 text-danger" :
                            row.original.status === 'refunded' ? "bg-blue-600/10 text-blue-600" :
                                "bg-warning/10 text-warning"
                )}>
                    {row.original.status.replace('_', ' ')}
                </span>
            )
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const order = row.original;

                return (
                    <div className="flex items-center gap-2">
                        {(order.status === 'in_transit' || order.status === 'picked_up') && (
                            <>
                                <button
                                    onClick={() => onMarkDelivered(order)}
                                    className="bg-success text-white cursor-pointer rounded-md py-1.5 px-3 text-[10px] font-bold hover:bg-opacity-90 transition-all shadow-sm"
                                >
                                    DELIVER
                                </button>
                                <button
                                    onClick={() => onMarkReturned(order)}
                                    className="bg-danger text-white cursor-pointer rounded-md py-1.5 px-3 text-[10px] font-bold hover:bg-opacity-90 transition-all shadow-sm"
                                >
                                    RETURN
                                </button>
                            </>
                        )}
                        {(order.status === 'delivered') && (
                            <button
                                onClick={() => onMarkRefunded(order)}
                                className="bg-blue-600 text-white cursor-pointer rounded-md py-1.5 px-3 text-[10px] font-bold hover:bg-opacity-90 transition-all shadow-sm flex items-center gap-1"
                            >
                                <RotateCcw size={12} />
                                REFUND
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];

    const filteredData = statusFilter === 'all'
        ? data
        : data.filter(d => d.status === statusFilter);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        initialState: {
            pagination: {
                pageSize: 10,
            }
        }
    });

    if (loading) {
        return <Loader text="Loading delivery data..." className="py-20 rounded-[10px] border border-stroke bg-white shadow-1 dark:border-strokedark dark:bg-gray-dark" />;
    }

    return (
        <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-strokedark dark:bg-gray-dark dark:shadow-card overflow-hidden">
            {/* Table Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-b border-stroke dark:border-strokedark bg-gray-50/50 dark:bg-meta-4/10">
                <div className="relative w-full md:w-80">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <SearchIcon className="h-5 w-5" />
                    </span>
                    <input
                        type="text"
                        placeholder="Search orders, customers..."
                        value={globalFilter ?? ''}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="w-full rounded-lg border border-stroke bg-white py-2.5 pl-11 pr-5 text-black outline-none focus:border-primary focus-visible:shadow-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary transition-all shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-stroke bg-white py-2.5 px-5 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white shadow-sm font-medium"
                    >
                        <option value="all">All Statuses</option>
                        <option value="picked_up">Picked Up</option>
                        <option value="in_transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                        <option value="returned">Returned</option>
                        <option value="refunded">Refunded</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full table-auto">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="bg-gray-2 text-left dark:bg-meta-4">
                                {headerGroup.headers.map((header) => (
                                    <th key={header.id} className="px-6 py-4 font-bold text-black dark:text-white uppercase text-xs tracking-wider">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="p-20 text-center font-medium text-gray-400">
                                    No matching delivery orders found.
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr key={row.id} className="border-b border-stroke dark:border-strokedark hover:bg-gray-50/50 dark:hover:bg-meta-4/20 transition-all">
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-6 py-5 text-sm dark:text-gray-300">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t border-stroke dark:border-strokedark">
                <div className="text-sm text-gray-500 font-medium">
                    Showing <span className="text-black dark:text-white font-bold">{table.getRowModel().rows.length}</span> of <span className="text-black dark:text-white font-bold">{filteredData.length}</span> results
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-stroke bg-white hover:text-primary disabled:opacity-30 dark:border-strokedark dark:bg-meta-4 dark:text-white shadow-sm transition-all"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-bold">
                        <span className="text-primary">{table.getState().pagination.pageIndex + 1}</span> / {table.getPageCount() || 1}
                    </span>
                    <button
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-stroke bg-white hover:text-primary disabled:opacity-30 dark:border-strokedark dark:bg-meta-4 dark:text-white shadow-sm transition-all"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
