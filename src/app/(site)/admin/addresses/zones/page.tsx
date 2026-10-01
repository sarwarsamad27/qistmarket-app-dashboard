"use client";

import React, { useState, useEffect, useRef } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import Loader from "@/components/common/Loader";
import {
    ColumnDef,
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from "@tanstack/react-table";
import {
    SearchIcon,
    PointerUp,
    ChevronUpIcon,
} from "@/assets/icons";
import ColumnFilter from "@/components/DataTables/ColumnFilter";
import { Modal } from "@/components/Modal/Modal";
import Pagination from "@/components/common/Pagination";
import { createPortal } from "react-dom";
import { getErrorMessage, extractBodyMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface City {
    id: number;
    name: string;
}

interface Zone {
    id: number;
    name: string;
    city_id: number;
    status: string;
    city?: City;
    _count?: {
        areas: number;
    };
}

const ZonesPage = () => {
    const [zones, setZones] = useState<Zone[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(true);

    // Table state
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    // Modals state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [formData, setFormData] = useState({ name: "", city_id: "", status: "active" });
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = Cookies.get("auth_token");
            const [zonesResp, citiesResp] = await Promise.all([
                fetch(`${BACKEND_URL}/api/address/zones?all=true`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${BACKEND_URL}/api/address/cities`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const zonesData = await zonesResp.json();
            const citiesData = await citiesResp.json();

            if (zonesData.success) setZones(zonesData.data);
            if (citiesData.success) setCities(citiesData.data);
        } catch (err) {
            toast.error(getErrorMessage(err, "Error fetching data"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Columns
    const columns: ColumnDef<Zone>[] = [
        {
            accessorKey: "name",
            header: "Zone Name",
            enableColumnFilter: true,
        },
        {
            id: "cityName",
            accessorFn: (row) => row.city?.name || "N/A",
            header: "City",
            enableColumnFilter: true,
        },
        {
            accessorKey: "status",
            header: "Status",
            enableColumnFilter: true,
            cell: ({ row }) => (
                <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${row.original.status === "active"
                            ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-500"
                            : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-500"
                        }`}
                >
                    {row.original.status === "active" ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            id: "areasCount",
            accessorFn: (row) => row._count?.areas || 0,
            header: "Areas Count",
            enableColumnFilter: false,
        },
        {
            id: "actions",
            header: "Actions",
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => {
                const zone = row.original;
                const [isOpen, setIsOpen] = useState(false);
                const [position, setPosition] = useState({ top: 0, left: 0 });
                const [openUp, setOpenUp] = useState(false);
                const triggerRef = useRef<HTMLButtonElement | null>(null);
                const dropdownRef = useRef<HTMLDivElement | null>(null);

                const toggleDropdown = () => {
                    if (!triggerRef.current) return;
                    const rect = triggerRef.current.getBoundingClientRect();
                    const dropdownWidth = 176;
                    const dropdownHeight = 100;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const spaceRight = window.innerWidth - rect.right;
                    const shouldOpenUp = spaceBelow < dropdownHeight;
                    const shouldAlignLeft = spaceRight < dropdownWidth;

                    setOpenUp(shouldOpenUp);
                    setPosition({
                        top: shouldOpenUp
                            ? rect.top + window.scrollY - 8
                            : rect.bottom + window.scrollY + 6,
                        left: shouldAlignLeft
                            ? rect.left + window.scrollX
                            : rect.right + window.scrollX - dropdownWidth,
                    });
                    setIsOpen((prev) => !prev);
                };

                useEffect(() => {
                    const handleClickOutside = (e: MouseEvent) => {
                        const target = e.target as Node;
                        if (
                            triggerRef.current &&
                            !triggerRef.current.contains(target) &&
                            dropdownRef.current &&
                            !dropdownRef.current.contains(target)
                        ) {
                            setIsOpen(false);
                        }
                    };
                    const handleEscape = (e: KeyboardEvent) => {
                        if (e.key === "Escape") setIsOpen(false);
                    };
                    if (isOpen) {
                        document.addEventListener("mousedown", handleClickOutside);
                        document.addEventListener("keydown", handleEscape);
                    }
                    return () => {
                        document.removeEventListener("mousedown", handleClickOutside);
                        document.removeEventListener("keydown", handleEscape);
                    };
                }, [isOpen]);

                return (
                    <>
                        <button
                            ref={triggerRef}
                            onClick={toggleDropdown}
                            className="group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-dark shadow-[0_1px_3px_0_rgba(166,175,195,0.4)] hover:text-[#ff3d3d] dark:border dark:border-dark-3 dark:text-white dark:shadow-none"
                        >
                            <span>Actions</span>
                            <ChevronUpIcon
                                className={`size-4 transition-transform ${isOpen ? "rotate-0" : "rotate-180"
                                    }`}
                            />
                        </button>
                        {isOpen &&
                            createPortal(
                                <div
                                    ref={dropdownRef}
                                    style={{
                                        position: "absolute",
                                        top: position.top,
                                        left: position.left,
                                        transform: openUp ? "translateY(-100%)" : "none",
                                    }}
                                    className="z-[99999] w-44 rounded-md border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-900"
                                >
                                    <ul className="overflow-hidden text-sm font-medium text-current">
                                        <li>
                                            <button
                                                onClick={() => {
                                                    setSelectedZone(zone);
                                                    setFormData({ name: zone.name, city_id: zone.city_id.toString(), status: zone.status || "active" });
                                                    setIsEditModalOpen(true);
                                                    setIsOpen(false);
                                                }}
                                                className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3 dark:hover:text-neutral-50"
                                            >
                                                Edit
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() => {
                                                    setSelectedZone(zone);
                                                    setIsDeleteModalOpen(true);
                                                    setIsOpen(false);
                                                }}
                                                className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3 dark:hover:text-neutral-50"
                                            >
                                                Delete
                                            </button>
                                        </li>
                                    </ul>
                                </div>,
                                document.body
                            )}
                    </>
                );
            },
        },
    ];

    const table = useReactTable({
        data: zones,
        columns,
        state: {
            globalFilter,
            columnFilters,
            sorting,
            pagination,
        },
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    // Actions
    const handleCreate = async () => {
        if (!formData.name.trim() || !formData.city_id) return;
        setSubmitting(true);
        try {
            const token = Cookies.get("auth_token");
            const resp = await fetch(`${BACKEND_URL}/api/address/zones`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });
            const data = await resp.json();
            if (data.success) {
                toast.success("Zone created successfully");
                setFormData({ name: "", city_id: "", status: "active" });
                setIsCreateModalOpen(false);
                fetchData();
            } else {
                toast.error(extractBodyMessage(data) || "Failed to create zone");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Error creating zone"));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedZone || !formData.name.trim() || !formData.city_id) return;
        setSubmitting(true);
        try {
            const token = Cookies.get("auth_token");
            const resp = await fetch(
                `${BACKEND_URL}/api/address/zones/${selectedZone.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(formData),
                }
            );
            const data = await resp.json();
            if (data.success) {
                toast.success("Zone updated successfully");
                setFormData({ name: "", city_id: "", status: "active" });
                setIsEditModalOpen(false);
                setSelectedZone(null);
                fetchData();
            } else {
                toast.error(extractBodyMessage(data) || "Failed to update zone");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Error updating zone"));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedZone) return;
        setSubmitting(true);
        try {
            const token = Cookies.get("auth_token");
            const resp = await fetch(
                `${BACKEND_URL}/api/address/zones/${selectedZone.id}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await resp.json();
            if (data.success) {
                toast.success("Zone deleted");
                setIsDeleteModalOpen(false);
                setSelectedZone(null);
                fetchData();
            } else {
                toast.error(extractBodyMessage(data) || "Failed to delete zone");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Error deleting zone"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Breadcrumb pageName="Zone Management" />
                <button
                    onClick={() => {
                        setFormData({ name: "", city_id: "", status: "active" });
                        setIsCreateModalOpen(true);
                    }}
                    className="flex items-center justify-center rounded-lg bg-[#ff3d3d] px-6 py-2.5 text-center font-medium text-white hover:bg-opacity-90"
                >
                    Add New Zone
                </button>
            </div>

            <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
                {/* Top bar */}
                <div className="flex justify-between px-7.5 py-4.5">
                    <div className="relative z-20 w-full max-w-[414px]">
                        <input
                            type="text"
                            value={globalFilter || ""}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="w-full rounded-lg border border-stroke bg-transparent px-5 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2"
                            placeholder="Search here..."
                        />
                        <button className="absolute right-0 top-0 flex h-11.5 w-11.5 items-center justify-center rounded-r-md bg-[#ff3d3d] text-white">
                            <SearchIcon className="size-4.5" />
                        </button>
                    </div>

                    <div className="flex items-center font-medium">
                        <p className="pl-2 font-medium text-dark dark:text-current">
                            Per Page:
                        </p>
                        <select
                            value={table.getState().pagination.pageSize}
                            onChange={(e) => {
                                table.setPageSize(Number(e.target.value));
                            }}
                            className="bg-transparent pl-2.5 text-dark outline-none dark:text-current font-medium"
                        >
                            {[10, 20, 50].map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="grid grid-cols-1 overflow-x-auto">
                    <table className="datatable-table datatable-one !border-collapse px-4 md:px-8">
                        <thead className="border-separate px-4">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr
                                    className="border-t border-stroke dark:border-dark-3"
                                    key={headerGroup.id}
                                >
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="whitespace-nowrap px-3 py-4 align-top"
                                        >
                                            <div className="flex min-h-[70px] flex-col">
                                                <div
                                                    className="flex cursor-pointer items-center"
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    <span className="font-[500]">
                                                        {flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                    </span>
                                                    {header.column.getCanSort() && (
                                                        <div className="ml-2 inline-flex flex-col">
                                                            <PointerUp className="size-2.5" />
                                                            <PointerUp className="size-2.5 rotate-180" />
                                                        </div>
                                                    )}
                                                </div>

                                                {header.column.getCanFilter() &&
                                                    header.column.id !== "actions" && (
                                                        <div className="mt-2 text-dark dark:text-white">
                                                            <ColumnFilter
                                                                column={{
                                                                    filterValue: header.column.getFilterValue() as string,
                                                                    setFilter: header.column.setFilterValue,
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="py-12 text-center">
                                        <Loader text="Loading zones..." />
                                    </td>
                                </tr>
                            ) : table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="py-12 text-center text-dark dark:text-white">
                                        No zones found.
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        className="border-t border-stroke dark:border-dark-3"
                                        key={row.id}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="truncate px-3 py-3 text-dark dark:text-white">
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination bar */}
                <div className="flex items-center justify-between px-7.5 py-7 text-dark dark:text-white">
                    <Pagination
                        currentPage={table.getState().pagination.pageIndex + 1}
                        totalPages={table.getPageCount()}
                        onPageChange={(page) => table.setPageIndex(page - 1)}
                        isLoading={loading}
                    />
                    <p className="font-medium text-dark dark:text-gray-300">
                        Showing {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()} pages
                    </p>
                </div>
            </section>

            {/* CREATE / EDIT MODAL */}
            <Modal
                open={isCreateModalOpen || isEditModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                }}
                className="max-h-[90vh] w-full max-w-[500px] overflow-y-auto rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
            >
                <h2 className="mb-6 text-2xl font-bold text-dark dark:text-white">
                    {isEditModalOpen ? "Edit Zone" : "Add New Zone"}
                </h2>
                <div className="space-y-4 mb-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">
                            City
                        </label>
                        <select
                            value={formData.city_id}
                            onChange={(e) => setFormData({ ...formData, city_id: e.target.value })}
                            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 text-dark dark:text-white font-medium"
                        >
                            <option value="">Select City</option>
                            {cities.map((city) => (
                                <option key={city.id} value={city.id}>
                                    {city.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">
                            Zone Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 text-dark dark:text-white font-medium"
                            placeholder="e.g. Central"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 text-dark dark:text-white font-medium"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
                <div className="mt-8 flex justify-end gap-4">
                    <button
                        onClick={() => {
                            setIsCreateModalOpen(false);
                            setIsEditModalOpen(false);
                        }}
                        disabled={submitting}
                        className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={isEditModalOpen ? handleUpdate : handleCreate}
                        disabled={submitting}
                        className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {submitting ? "Saving..." : isEditModalOpen ? "Save Changes" : "Create Zone"}
                    </button>
                </div>
            </Modal>

            {/* DELETE MODAL */}
            <Modal
                open={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                className="w-full max-w-[500px] rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
            >
                <h2 className="mb-4 text-xl font-bold text-dark dark:text-white">
                    Delete Zone?
                </h2>
                <p className="mb-6 text-gray-600 dark:text-gray-300">
                    Are you sure you want to delete <span className="font-bold">"{selectedZone?.name}"</span>?
                    This will also delete all associated Areas. This action cannot be undone.
                </p>
                <div className="flex justify-end gap-4">
                    <button
                        onClick={() => setIsDeleteModalOpen(false)}
                        disabled={submitting}
                        className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={submitting}
                        className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {submitting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default ZonesPage;
