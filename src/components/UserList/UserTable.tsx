"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import SubAdminPagePicker from "@/components/Users/SubAdminPagePicker";
import { useAuth } from "../../../contexts/AuthContext";
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
import Cookies from "js-cookie";
import {
  ChevronLeft,
  ChevronRight,
  SearchIcon,
  PointerUp,
  ChevronUpIcon,
} from "@/assets/icons";
import ColumnFilter from "../DataTables/ColumnFilter";
import { Modal } from "../Modal/Modal";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import Pagination from "../common/Pagination";
import { toast } from "react-hot-toast";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface User {
  id: number;
  full_name: string;
  username: string;
  email: string | null;
  phone: string | null;
  cnic: string | null;
  role: string;
  status: string;
  bio: string;
  image: string;
  coverImage: string;
  permissions: Record<string, any> | null;
  sub_admin_pages?: string[];
  password?: string;
  outlet_id?: number | null;
  outlet?: { id: number; name: string; code: string } | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface CropState {
  open: boolean;
  target: "image" | "coverImage" | null;
  src: string;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Crop Modal Component
// ─────────────────────────────────────────────────────────────────────────────

interface ImageCropModalProps {
  open: boolean;
  target: "image" | "coverImage" | null;
  src: string;
  onCancel: () => void;
  onApply: (dataUrl: string, file: File, target: "image" | "coverImage") => void;
}

const CANVAS_W = 480;
const CANVAS_H = 280;

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  open,
  target,
  src,
  onCancel,
  onApply,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(100);
  const [cropBox, setCropBox] = useState<CropBox>({ x: 40, y: 40, w: 200, h: 200 });
  const [cropType, setCropTypeState] = useState<"free" | "square" | "wide">("square");
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const dragRef = useRef<{
    active: boolean;
    handle: string | null;
    startX: number;
    startY: number;
    startBox: CropBox;
    isPan: boolean;
    panStartX: number;
    panStartY: number;
  }>({
    active: false,
    handle: null,
    startX: 0,
    startY: 0,
    startBox: { x: 0, y: 0, w: 0, h: 0 },
    isPan: false,
    panStartX: 0,
    panStartY: 0,
  });
  const panRef = useRef({ x: 0, y: 0 });

  // Load image when src changes
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Reset pan
      panRef.current = { x: 0, y: 0 };
      setPanOffset({ x: 0, y: 0 });
      setZoom(100);

      // Set default crop box based on target
      if (target === "coverImage") {
        setCropTypeState("wide");
        const w = CANVAS_W - 40;
        const h = Math.round(w / 3);
        const y = Math.round((CANVAS_H - h) / 2);
        setCropBox({ x: 20, y, w, h });
      } else {
        setCropTypeState("square");
        const size = Math.min(CANVAS_W, CANVAS_H) - 60;
        const x = Math.round((CANVAS_W - size) / 2);
        const y = Math.round((CANVAS_H - size) / 2);
        setCropBox({ x, y, w: size, h: size });
      }
    };
    img.src = src;
  }, [src, target]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw image centered with zoom + pan
    const scale = zoom / 100;
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    const sx = (CANVAS_W - iw) / 2 + panRef.current.x * scale;
    const sy = (CANVAS_H - ih) / 2 + panRef.current.y * scale;
    ctx.drawImage(img, sx, sy, iw, ih);

    // Dark overlay
    const { x, y, w, h } = cropBox;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, CANVAS_W, y);
    ctx.fillRect(0, y + h, CANVAS_W, CANVAS_H - y - h);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, CANVAS_W - x - w, h);

    // Crop border
    ctx.strokeStyle = "#ff3d3d";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Rule of thirds grid
    ctx.strokeStyle = "rgba(255,61,61,0.3)";
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * i) / 3, y);
      ctx.lineTo(x + (w * i) / 3, y + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + (h * i) / 3);
      ctx.lineTo(x + w, y + (h * i) / 3);
      ctx.stroke();
    }

    // Corner + edge handles
    const handles = [
      [x, y], [x + w / 2, y], [x + w, y],
      [x, y + h / 2], [x + w, y + h / 2],
      [x, y + h], [x + w / 2, y + h], [x + w, y + h],
    ];
    handles.forEach(([hx, hy]) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(hx - 5, hy - 5, 10, 10);
      ctx.strokeStyle = "#ff3d3d";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx - 5, hy - 5, 10, 10);
    });
  }, [cropBox, zoom]);

  useEffect(() => {
    if (open) draw();
  }, [open, draw]);

  // Clamp crop box
  const clampBox = (box: CropBox, type: "free" | "square" | "wide"): CropBox => {
    let { x, y, w, h } = box;
    w = Math.max(40, w);
    h = Math.max(40, h);
    if (type === "square") { const s = Math.max(w, h); w = s; h = s; }
    if (type === "wide") { h = Math.round(w / 3); }
    x = Math.max(0, Math.min(x, CANVAS_W - w));
    y = Math.max(0, Math.min(y, CANVAS_H - h));
    w = Math.min(w, CANVAS_W - x);
    h = Math.min(h, CANVAS_H - y);
    return { x, y, w, h };
  };

  const getHandle = (mx: number, my: number, box: CropBox): string | null => {
    const { x, y, w, h } = box;
    const pts: [string, number, number][] = [
      ["tl", x, y], ["tm", x + w / 2, y], ["tr", x + w, y],
      ["ml", x, y + h / 2], ["mr", x + w, y + h / 2],
      ["bl", x, y + h], ["bm", x + w / 2, y + h], ["br", x + w, y + h],
    ];
    const found = pts.find(([, hx, hy]) => Math.abs(mx - hx) < 10 && Math.abs(my - hy) < 10);
    return found ? found[0] : null;
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: mx, y: my } = getCanvasPos(e);
    const handle = getHandle(mx, my, cropBox);
    const d = dragRef.current;
    if (handle) {
      d.active = true; d.handle = handle; d.isPan = false;
      d.startX = mx; d.startY = my; d.startBox = { ...cropBox };
    } else if (mx > cropBox.x && mx < cropBox.x + cropBox.w && my > cropBox.y && my < cropBox.y + cropBox.h) {
      d.active = true; d.handle = "move"; d.isPan = false;
      d.startX = mx; d.startY = my; d.startBox = { ...cropBox };
    } else {
      d.isPan = true; d.active = false;
      d.panStartX = mx - panRef.current.x;
      d.panStartY = my - panRef.current.y;
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: mx, y: my } = getCanvasPos(e);
    const d = dragRef.current;
    const canvas = canvasRef.current!;

    if (!d.active && !d.isPan) {
      const handle = getHandle(mx, my, cropBox);
      if (handle) {
        canvas.style.cursor = ["tl", "br"].includes(handle) ? "nwse-resize" : ["tr", "bl"].includes(handle) ? "nesw-resize" : ["tm", "bm"].includes(handle) ? "ns-resize" : "ew-resize";
      } else if (mx > cropBox.x && mx < cropBox.x + cropBox.w && my > cropBox.y && my < cropBox.y + cropBox.h) {
        canvas.style.cursor = "move";
      } else {
        canvas.style.cursor = "grab";
      }
      return;
    }

    if (d.isPan) {
      panRef.current = { x: mx - d.panStartX, y: my - d.panStartY };
      setPanOffset({ ...panRef.current });
      draw();
      return;
    }

    if (!d.active) return;
    const dx = mx - d.startX;
    const dy = my - d.startY;
    const b = { ...d.startBox };

    if (d.handle === "move") { b.x += dx; b.y += dy; }
    else if (d.handle === "tl") { b.x += dx; b.y += dy; b.w -= dx; b.h -= dy; }
    else if (d.handle === "tr") { b.y += dy; b.w += dx; b.h -= dy; }
    else if (d.handle === "bl") { b.x += dx; b.w -= dx; b.h += dy; }
    else if (d.handle === "br") { b.w += dx; b.h += dy; }
    else if (d.handle === "tm") { b.y += dy; b.h -= dy; }
    else if (d.handle === "bm") { b.h += dy; }
    else if (d.handle === "ml") { b.x += dx; b.w -= dx; }
    else if (d.handle === "mr") { b.w += dx; }

    const clamped = clampBox(b, cropType);
    setCropBox(clamped);
  };

  const onMouseUp = () => {
    dragRef.current.active = false;
    dragRef.current.isPan = false;
    if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
  };

  const handleCropTypeChange = (type: "free" | "square" | "wide") => {
    setCropTypeState(type);
    setCropBox(prev => clampBox(prev, type));
  };

  const handleZoomChange = (val: number) => {
    setZoom(val);
  };

  const handleApply = () => {
    const img = imgRef.current;
    if (!img || !target) return;

    const scale = zoom / 100;
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    const sx = (CANVAS_W - iw) / 2 + panRef.current.x * scale;
    const sy = (CANVAS_H - ih) / 2 + panRef.current.y * scale;

    const srcX = (cropBox.x - sx) / scale;
    const srcY = (cropBox.y - sy) / scale;
    const srcW = cropBox.w / scale;
    const srcH = cropBox.h / scale;

    const off = document.createElement("canvas");
    off.width = cropBox.w * 2;
    off.height = cropBox.h * 2;
    const ctx = off.getContext("2d")!;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, off.width, off.height);

    const dataUrl = off.toDataURL("image/jpeg", 0.92);
    off.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `${target}.jpg`, { type: "image/jpeg" });
      onApply(dataUrl, file, target);
    }, "image/jpeg", 0.92);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4"
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div className="w-full max-w-[540px] rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-dark dark:text-white">
            {target === "coverImage" ? "Crop Cover Picture" : "Crop Profile Picture"}
          </h3>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-dark-3 text-gray-500"
          >
            ✕
          </button>
        </div>

        {/* Canvas */}
        <div className="relative overflow-hidden rounded-xl bg-[#111]">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block w-full cursor-crosshair"
            style={{ touchAction: "none" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          />
        </div>

        {/* Controls */}
        <div className="mt-4 space-y-3">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10">Zoom</span>
            <input
              type="range"
              min={100}
              max={300}
              step={1}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="flex-1 accent-[#ff3d3d]"
            />
            <span className="text-xs font-medium text-dark dark:text-white w-10 text-right">
              {(zoom / 100).toFixed(1)}x
            </span>
          </div>

          {/* Aspect ratio */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10">Ratio</span>
            <div className="flex gap-2">
              {(["free", "square", "wide"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleCropTypeChange(type)}
                  className={cn(
                    "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                    cropType === type
                      ? "border-transparent bg-[#ff3d3d] text-white"
                      : "border-stroke text-gray-500 hover:border-[#ff3d3d] hover:text-[#ff3d3d] dark:border-dark-3 dark:text-gray-400"
                  )}
                >
                  {type === "free" ? "Free" : type === "square" ? "1 : 1" : "3 : 1"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tip */}
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Drag inside box to move • Drag handles to resize • Drag outside to pan image
        </p>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-stroke px-5 py-2 text-sm font-medium text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="rounded-lg bg-[#ff3d3d] px-5 py-2 text-sm font-medium text-white hover:bg-[#d63030]"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Image Upload Field Component
// ─────────────────────────────────────────────────────────────────────────────

interface ImageUploadFieldProps {
  label: string;
  type: "avatar" | "cover";
  preview: string | null;
  existingUrl?: string;
  inputName: string;
  onFileSelect: (file: File, name: string) => void;
  onRemove: () => void;
}

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label, type, preview, existingUrl, inputName, onFileSelect, onRemove,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const displaySrc = preview || existingUrl || null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("File size must be under 2MB"); return; }
    onFileSelect(file, e.target.name);
    e.target.value = "";
  };

  return (
    <div className="md:col-span-2">
      <label className="mb-2 block text-sm font-medium text-dark dark:text-gray-300">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border p-4 transition-colors",
          displaySrc
            ? "border-stroke bg-gray-50/50 dark:border-dark-3 dark:bg-dark-2/50"
            : "border-dashed border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
        )}
      >
        {/* Thumbnail */}
        <div className="relative flex-shrink-0">
          {type === "cover" ? (
            <div className="h-[56px] w-[140px] overflow-hidden rounded-lg border border-stroke dark:border-dark-3 bg-gray-100 dark:bg-dark-3 flex items-center justify-center">
              {displaySrc ? (
                <img src={displaySrc} alt="Cover" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">No photo</span>
              )}
            </div>
          ) : (
            <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-stroke dark:border-dark-3 bg-gray-100 dark:bg-dark-3 flex items-center justify-center">
              {displaySrc ? (
                <img src={displaySrc} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">No</span>
              )}
            </div>
          )}

          {/* Remove button */}
          {displaySrc && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove image"
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#e24b4a] text-[10px] text-white hover:bg-[#a32d2d] dark:border-gray-800"
            >
              ✕
            </button>
          )}
        </div>

        {/* Info + button */}
        <div className="flex-1">
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            {displaySrc
              ? preview
                ? "New image selected — ready to save"
                : "Current image"
              : "No image selected"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-sm font-medium text-dark hover:border-[#ff3d3d] hover:text-[#ff3d3d] dark:border-dark-3 dark:text-gray-300 dark:hover:border-[#ff3d3d] dark:hover:text-[#ff3d3d] transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {displaySrc ? "Change image" : "Upload image"}
            </button>
            {displaySrc && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-xs text-[#ff3d3d] hover:underline"
              >
                Re-crop
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            JPG, PNG or WEBP &bull; Max 2 MB
            {type === "cover" ? " • Recommended 1200×400" : " • Recommended 400×400"}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        name={inputName}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const UsersTable = () => {
  const [users, setUsers] = useState<User[]>([]);
  // A Sub Admin viewing this list can't change Super Admin / Admin / Sub Admin
  // accounts (or their own) — the backend refuses it; hide the actions to match.
  const { user: viewer } = useAuth();
  const isProtectedForViewer = (u: User) =>
    !!viewer?.is_sub_admin && (u.id === viewer.id || ["Super Admin", "Admin", "Sub Admin"].includes(u.role));
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false,
  });
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "id", desc: true }]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [createOrderPermission, setCreateOrderPermission] = useState(false);
  const [subAdminPagesEdit, setSubAdminPagesEdit] = useState<string[]>([]);
  const [subAdminPagesError, setSubAdminPagesError] = useState("");

  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);

  // Crop modal state
  const [cropState, setCropState] = useState<CropState>({ open: false, target: null, src: "" });
  const [pendingFile, setPendingFile] = useState<{ file: File; name: string } | null>(null);

  const [outlets, setOutlets] = useState<{ id: number; name: string; code: string; status: string; address?: string }[]>([]);
  const [manageOutletsModalOpen, setManageOutletsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<{ id?: number; name: string; code: string; address: string; status: string } | null>(null);

  // ── Reset image state when edit modal closes ────────────────────────────────
  useEffect(() => {
    if (!editModalOpen) {
      setImagePreview(null);
      setCoverPreview(null);
      setImageFile(null);
      setCoverImageFile(null);
    }
  }, [editModalOpen]);

  // ── Fetch outlets ───────────────────────────────────────────────────────────
  const fetchOutlets = async () => {
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(`${BACKEND_URL}/api/outlets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setOutlets(json.outlets);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchOutlets(); }, []);

  // ── Fetch users ─────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = Cookies.get("auth_token");
      if (!token) return;
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: globalFilter.trim(),
        sortBy: sorting[0]?.id || "id",
        sortDir: sorting[0]?.desc ? "desc" : "asc",
      });
      columnFilters.forEach((f) => { if (f.id && f.value) params.append(f.id, String(f.value)); });
      const res = await fetch(`${BACKEND_URL}/api/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Fetch failed");
      const json = await res.json();
      if (json.success && json.data?.users) {
        setUsers(json.data.users);
        setPagination(json.data.pagination);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [pagination.page, pagination.limit, globalFilter, columnFilters, sorting]);

  // ── Image handlers ──────────────────────────────────────────────────────────

  // Called when user picks a file — open crop modal
  const handleFileSelect = (file: File, name: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setPendingFile({ file, name });
      setCropState({
        open: true,
        target: name as "image" | "coverImage",
        src,
      });
    };
    reader.readAsDataURL(file);
  };

  // Called when crop is applied
  const handleCropApply = (dataUrl: string, croppedFile: File, target: "image" | "coverImage") => {
    if (target === "image") {
      setImagePreview(dataUrl);
      setImageFile(croppedFile);
    } else {
      setCoverPreview(dataUrl);
      setCoverImageFile(croppedFile);
    }
    setCropState({ open: false, target: null, src: "" });
    setPendingFile(null);
  };

  const handleCropCancel = () => {
    setCropState({ open: false, target: null, src: "" });
    setPendingFile(null);
  };

  const handleRemoveImage = (target: "image" | "coverImage") => {
    if (target === "image") {
      setImagePreview(null);
      setImageFile(null);
      setFormData((prev) => ({ ...prev, image: "" }));
    } else {
      setCoverPreview(null);
      setCoverImageFile(null);
      setFormData((prev) => ({ ...prev, coverImage: "" }));
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns: ColumnDef<User>[] = [
    { accessorKey: "full_name", header: "Full Name", enableColumnFilter: true },
    { accessorKey: "username", header: "Username", enableColumnFilter: true },
    { accessorKey: "email", header: "Email", enableColumnFilter: true },
    { accessorKey: "phone", header: "Phone", enableColumnFilter: true },
    { accessorKey: "cnic", header: "CNIC", enableColumnFilter: true },
    { accessorKey: "role", header: "Role", enableColumnFilter: true },
    {
      accessorKey: "outlet", header: "Outlet", enableColumnFilter: true,
      cell: ({ row }) => row.original.outlet?.name || "N/A",
    },
    { accessorKey: "status", header: "Status", enableColumnFilter: true },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const user = row.original;
        const [isOpen, setIsOpen] = useState(false);
        const [position, setPosition] = useState({ top: 0, left: 0 });
        const [openUp, setOpenUp] = useState(false);
        const triggerRef = useRef<HTMLButtonElement | null>(null);
        const dropdownRef = useRef<HTMLDivElement | null>(null);

        const toggleDropdown = () => {
          if (!triggerRef.current) return;
          const rect = triggerRef.current.getBoundingClientRect();
          const dropdownWidth = 176;
          const dropdownHeight = 150;
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceRight = window.innerWidth - rect.right;
          const shouldOpenUp = spaceBelow < dropdownHeight;
          const shouldAlignLeft = spaceRight < dropdownWidth;
          setOpenUp(shouldOpenUp);
          setPosition({
            top: shouldOpenUp ? rect.top + window.scrollY - 8 : rect.bottom + window.scrollY + 6,
            left: shouldAlignLeft ? rect.left + window.scrollX : rect.right + window.scrollX - dropdownWidth,
          });
          setIsOpen((prev) => !prev);
        };

        useEffect(() => {
          const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current && !triggerRef.current.contains(target) && dropdownRef.current && !dropdownRef.current.contains(target)) {
              setIsOpen(false);
            }
          };
          const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
          if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
          }
          return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
          };
        }, [isOpen]);

        if (isProtectedForViewer(user)) {
          return <span className="text-xs font-medium text-gray-400" title="Sub Admins can't change admin accounts">Protected</span>;
        }

        return (
          <>
            <button
              ref={triggerRef}
              onClick={toggleDropdown}
              className="group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-dark shadow-[0_1px_3px_0_rgba(166,175,195,0.4)] hover:text-[#ff3d3d] dark:border dark:border-dark-3 dark:text-white dark:shadow-none"
            >
              <span>Actions</span>
              <ChevronUpIcon className={`size-4 transition-transform ${isOpen ? "rotate-0" : "rotate-180"}`} />
            </button>

            {isOpen && createPortal(
              <div
                ref={dropdownRef}
                style={{ position: "absolute", top: position.top, left: position.left, transform: openUp ? "translateY(-100%)" : "none" }}
                className="z-[99999] w-44 rounded-md border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-900"
              >
                <ul className="overflow-hidden text-sm font-medium text-current">
                  <li>
                    <button onClick={() => { handleEdit(user); setIsOpen(false); }} className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3 dark:hover:text-neutral-50">Edit</button>
                  </li>
                  <li>
                    <button onClick={() => { handleDelete(user.id); setIsOpen(false); }} className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3 dark:hover:text-neutral-50">Delete</button>
                  </li>
                  <li>
                    <button onClick={() => { handlePermissions(user); setIsOpen(false); }} className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3 dark:hover:text-neutral-50">Permissions</button>
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
    data: users,
    columns,
    state: {
      globalFilter,
      columnFilters,
      sorting,
      pagination: { pageIndex: pagination.page - 1, pageSize: pagination.limit },
    },
    pageCount: pagination.totalPages,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const newState = typeof updater === "function" ? updater({ pageIndex: pagination.page - 1, pageSize: pagination.limit }) : updater;
      setPagination((prev) => ({ ...prev, page: newState.pageIndex + 1, limit: newState.pageSize }));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // ── Action Handlers ─────────────────────────────────────────────────────────

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({ ...user });
    setEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedUser?.id) return;
    setIsSubmitting(true);
    try {
      const token = Cookies.get("auth_token");
      const fd = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        if (key === "imageFile" || key === "coverImageFile") return;
        if (key === "password") {
          if (value && typeof value === "string" && value.trim() !== "") fd.append(key, String(value));
        } else if (key === "outlet_id") {
          fd.append(key, value ? String(value) : "");
        } else if (value !== undefined && value !== null) {
          fd.append(key, String(value));
        }
      });

      // Append cropped files if present
      if (imageFile) fd.append("image", imageFile);
      if (coverImageFile) fd.append("coverImage", coverImageFile);

      const res = await fetch(`${BACKEND_URL}/api/users/${selectedUser.id}/edit`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error?.message || "Update failed");

      await fetchUsers();
      setEditModalOpen(false);
      toast.success("User updated successfully!");
    } catch (err: any) {
      console.error("Update error:", err);
      toast.error(err.message || "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    setSelectedUser({ id } as User);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser?.id) return;
    setIsSubmitting(true);
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(`${BACKEND_URL}/api/users/${selectedUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchUsers();
      setDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermissions = (user: User) => {
    setSelectedUser(user);
    setCreateOrderPermission(user.permissions?.create_order ?? false);
    setSubAdminPagesEdit(Array.isArray(user.sub_admin_pages) ? user.sub_admin_pages : []);
    setSubAdminPagesError("");
    setPermissionsModalOpen(true);
  };

  const isSubAdminTarget = selectedUser?.role === "Sub Admin";

  const updatePermissions = async () => {
    if (!selectedUser?.id) return;
    setIsSubmitting(true);
    try {
      const token = Cookies.get("auth_token");
      if (isSubAdminTarget && subAdminPagesEdit.length === 0) {
        setSubAdminPagesError("Tick at least one page this Sub Admin can access");
        return;
      }
      const res = await fetch(`${BACKEND_URL}/api/users/${selectedUser.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          isSubAdminTarget
            ? { sub_admin_pages: subAdminPagesEdit }
            : { permissions_json: { create_order: createOrderPermission } }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.message || "Permissions update failed");
      if (isSubAdminTarget) toast.success("Sub Admin access updated — applies on their next action.");
      await fetchUsers();
      setPermissionsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update permissions");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* Top bar */}
      <div className="flex justify-between px-7.5 py-4.5">
        <div className="relative z-20 w-full max-w-[414px]">
          <input
            type="text"
            value={globalFilter || ""}
            onChange={(e) => { setGlobalFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
            className="w-full rounded-lg border border-stroke bg-transparent px-5 py-2.5 outline-none focus:border-[#ff3d3d]"
            placeholder="Search here..."
          />
          <button className="absolute right-0 top-0 flex h-11.5 w-11.5 items-center justify-center rounded-r-md bg-[#ff3d3d] text-white">
            <SearchIcon className="size-4.5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => { setEditingOutlet({ name: "", code: "", address: "", status: "active" }); setManageOutletsModalOpen(true); }}
            className="flex items-center justify-center rounded-lg bg-gray-100 px-4 py-2.5 font-medium text-dark hover:bg-gray-200 dark:bg-dark-3 dark:text-white"
          >
            Manage Outlets
          </button>
          <p className="pl-2 font-medium text-dark dark:text-current">Per Page:</p>
          <select
            value={pagination.limit}
            onChange={(e) => setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))}
            className="bg-transparent pl-2.5"
          >
            {[5, 10, 15, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="grid grid-cols-1 overflow-x-auto">
        <table className="datatable-table datatable-one !border-collapse px-4 md:px-8">
          <thead className="border-separate px-4">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr className="border-t border-stroke dark:border-dark-3" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-3 py-4 align-top">
                    <div className="flex min-h-[70px] flex-col">
                      <div className="flex cursor-pointer items-center" onClick={header.column.getToggleSortingHandler()}>
                        <span className="font-[500]">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {header.column.getCanSort() && (
                          <div className="ml-2 inline-flex flex-col">
                            <PointerUp className="size-2.5" />
                            <PointerUp className="size-2.5 rotate-180" />
                          </div>
                        )}
                      </div>
                      {header.column.getCanFilter() && header.column.id !== "actions" && (
                        <div className="mt-2">
                          <ColumnFilter column={{ filterValue: header.column.getFilterValue() as string, setFilter: header.column.setFilterValue }} />
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
              <tr><td colSpan={columns.length} className="py-12 text-center"><Loader text="Loading users..." /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={columns.length} className="py-12 text-center">No users found</td></tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr className="border-t border-stroke dark:border-dark-3" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="truncate px-3 py-3">
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
      <div className="flex items-center justify-between px-7.5 py-7">
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page: number) => setPagination((p) => ({ ...p, page }))}
          isLoading={loading}
        />
        <p className="font-medium text-dark dark:text-gray-300">
          Showing {pagination.page} of {pagination.totalPages} pages
        </p>
      </div>

      {/* ── EDIT MODAL ── */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        className="max-h-[90vh] w-full max-w-[700px] overflow-y-auto rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-6 text-2xl font-bold text-dark dark:text-white">Edit User</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">Full Name</label>
            <input id="full_name" name="full_name" value={formData.full_name || ""} onChange={handleInputChange}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2" />
          </div>
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">Username</label>
            <input id="username" name="username" value={formData.username || ""} onChange={handleInputChange}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2" />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">Email</label>
            <input id="email" name="email" value={formData.email || ""} onChange={handleInputChange}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2" />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">Phone</label>
            <input id="phone" name="phone" value={formData.phone || ""} onChange={handleInputChange}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2" />
          </div>
          <div>
            <label htmlFor="cnic" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">CNIC</label>
            <input id="cnic" name="cnic" value={formData.cnic || ""} onChange={handleInputChange}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2" />
          </div>
          <div>
            <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">Status</label>
            <select id="status" name="status" value={formData.status || "active"} onChange={handleInputChange}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {["Verification Officer", "Delivery Agent", "Recovery Officer", "Branch User"].includes(formData.role || "") && (
            <div>
              <label htmlFor="outlet_id" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">Assigned Outlet</label>
              <select id="outlet_id" name="outlet_id" value={formData.outlet_id || ""} onChange={handleInputChange}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2">
                <option value="">No Outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>{outlet.name} ({outlet.code})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">Update Password (leave blank to keep current)</label>
            <input id="password" name="password" type="password" value={formData.password || ""} onChange={handleInputChange} placeholder="Enter new password"
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2" />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-dark dark:text-gray-300">Bio</label>
            <textarea id="bio" name="bio" value={formData.bio || ""} onChange={handleInputChange} rows={3}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2" />
          </div>

          {/* ── Cover Picture Upload with Crop ── */}
          <ImageUploadField
            label="Cover Picture"
            type="cover"
            preview={coverPreview}
            existingUrl={formData.coverImage}
            inputName="coverImage"
            onFileSelect={handleFileSelect}
            onRemove={() => handleRemoveImage("coverImage")}
          />

          {/* ── Profile Picture Upload with Crop ── */}
          <ImageUploadField
            label="Profile Picture"
            type="avatar"
            preview={imagePreview}
            existingUrl={formData.image}
            inputName="image"
            onFileSelect={handleFileSelect}
            onRemove={() => handleRemoveImage("image")}
          />
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button onClick={() => setEditModalOpen(false)} disabled={isSubmitting}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3">
            Cancel
          </button>
          <button onClick={handleUpdate} disabled={isSubmitting}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Modal>

      {/* ── IMAGE CROP MODAL (rendered outside edit modal to avoid z-index issues) ── */}
      <ImageCropModal
        open={cropState.open}
        target={cropState.target}
        src={cropState.src}
        onCancel={handleCropCancel}
        onApply={handleCropApply}
      />

      {/* ── DELETE MODAL ── */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Confirm Deletion</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">Are you sure you want to delete this user? This action cannot be undone.</p>
        <div className="flex justify-end gap-4">
          <button onClick={() => setDeleteModalOpen(false)} disabled={isSubmitting}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3">
            Cancel
          </button>
          <button onClick={confirmDelete} disabled={isSubmitting}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50">
            {isSubmitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>

      {/* ── PERMISSIONS MODAL ── */}
      <Modal open={permissionsModalOpen} onClose={() => setPermissionsModalOpen(false)}
        className={`${isSubAdminTarget ? "max-h-[90vh] w-full max-w-[900px] overflow-y-auto" : "max-w-md"} rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800`}>
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          {isSubAdminTarget ? `Sub Admin Access — ${selectedUser?.full_name || selectedUser?.username}` : "User Permissions"}
        </h2>
        {isSubAdminTarget ? (
          <div className="mb-6">
            <SubAdminPagePicker
              value={subAdminPagesEdit}
              onChange={(pages) => { setSubAdminPagesEdit(pages); setSubAdminPagesError(""); }}
              error={subAdminPagesError}
            />
          </div>
        ) : (
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-dark dark:text-gray-300">Create Order</label>
            <input type="checkbox" checked={createOrderPermission} onChange={(e) => setCreateOrderPermission(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-[#ff3d3d] focus:ring-[#ff3d3d]" />
          </div>
        </div>
        )}
        <div className="flex justify-end gap-4">
          <button onClick={() => setPermissionsModalOpen(false)} disabled={isSubmitting}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3">
            Cancel
          </button>
          <button onClick={updatePermissions} disabled={isSubmitting}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50">
            {isSubmitting ? "Saving..." : "Save Permissions"}
          </button>
        </div>
      </Modal>

      {/* ── MANAGE OUTLETS MODAL ── */}
      <Modal open={manageOutletsModalOpen} onClose={() => setManageOutletsModalOpen(false)}
        className="max-h-[90vh] w-full max-w-[800px] overflow-y-auto rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-dark dark:text-white">Outlet Management</h2>
          <button onClick={() => setEditingOutlet({ name: "", code: "", address: "", status: "active" })}
            className="rounded-lg bg-[#ff3d3d] px-4 py-2 text-sm font-medium text-white">
            + New Outlet
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="rounded-xl border border-stroke bg-gray-50 p-6 dark:border-dark-3 dark:bg-dark-2">
            <h3 className="mb-4 text-lg font-semibold">{editingOutlet?.id ? "Edit Outlet" : "Create Outlet"}</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Outlet Name</label>
                <input value={editingOutlet?.name || ""} onChange={(e) => setEditingOutlet(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full rounded-lg border border-stroke bg-white px-4 py-2 outline-none focus:border-[#ff3d3d]" placeholder="e.g. Saddar Main branch" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Outlet Code</label>
                <input value={editingOutlet?.code || ""} onChange={(e) => setEditingOutlet(prev => prev ? { ...prev, code: e.target.value } : null)}
                  className="w-full rounded-lg border border-stroke bg-white px-4 py-2 outline-none focus:border-[#ff3d3d]" placeholder="e.g. SDO-1" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Status</label>
                <select value={editingOutlet?.status || "active"} onChange={(e) => setEditingOutlet(prev => prev ? { ...prev, status: e.target.value } : null)}
                  className="w-full rounded-lg border border-stroke bg-white px-4 py-2 outline-none focus:border-[#ff3d3d]">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <button
                disabled={isSubmitting}
                onClick={async () => {
                  if (!editingOutlet?.name || !editingOutlet?.code) return alert("Name and Code are required");
                  setIsSubmitting(true);
                  try {
                    const token = Cookies.get("auth_token");
                    const method = editingOutlet.id ? "PATCH" : "POST";
                    const url = editingOutlet.id ? `${BACKEND_URL}/api/outlets/${editingOutlet.id}` : `${BACKEND_URL}/api/outlets`;
                    const res = await fetch(url, {
                      method,
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify(editingOutlet),
                    });
                    const result = await res.json();
                    if (result.success) {
                      await fetchOutlets();
                      setEditingOutlet({ name: "", code: "", address: "", status: "active" });
                    } else {
                      alert(result.message || "Failed");
                    }
                  } catch (e) { console.error(e); }
                  finally { setIsSubmitting(false); }
                }}
                className="mt-4 w-full rounded-lg bg-[#ff3d3d] py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {isSubmitting ? "Processing..." : editingOutlet?.id ? "Update Outlet" : "Create Outlet"}
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Existing Outlets</h3>
            <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
              {outlets.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-stroke p-3 hover:bg-gray-50 dark:border-dark-3">
                  <div>
                    <p className="font-medium text-dark dark:text-white">{o.name}</p>
                    <p className="text-xs text-gray-500">{o.code} &bull; {o.status}</p>
                  </div>
                  <button onClick={() => setEditingOutlet({ ...o, address: o.address || "" })}
                    className="text-sm font-medium text-[#ff3d3d] hover:underline">
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
};

export default UsersTable;