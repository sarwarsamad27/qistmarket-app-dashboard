import type { ColumnDef } from '@tanstack/react-table'

// "S.No" column for TanStack tables. Numbers rows in the order they are shown (after
// sorting/filtering) and keeps counting across pages, for both client-side and
// server-side (manualPagination) tables: page 2 of 10 starts at 11.
export function serialColumn<T>(): ColumnDef<T, any> {
  return {
    id: 'sno',
    header: 'S.No',
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enableHiding: false,
    size: 60,
    cell: ({ row, table }) => {
      const { pageIndex = 0, pageSize = 0 } = table.getState().pagination || {}
      const rows = table.getRowModel().rows
      const pos = rows.findIndex((r) => r.id === row.id)
      // Without a pagination row model getRowModel() is the full list — no page offset then.
      const paged = table.options.manualPagination || !!table.options.getPaginationRowModel
      const offset = paged ? pageIndex * pageSize : 0
      return <span className="tabular-nums text-gray-500">{offset + pos + 1}</span>
    },
  }
}
