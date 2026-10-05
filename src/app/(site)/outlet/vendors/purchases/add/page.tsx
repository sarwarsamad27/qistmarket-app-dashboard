"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { 
    Plus, Trash2, ShoppingCart, 
    Save, Calendar, FileText, AlertCircle, 
    CheckCircle2, Building2, Package, Upload, HelpCircle, Download,
    Maximize2, Minimize2, X
} from "lucide-react";
import Papa from "papaparse";
import Loader from "@/components/common/Loader";
import SearchableSelect from "@/components/common/SearchableSelect";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import SerialOrEngineChassisInput from "@/components/VendorPurchase/SerialOrEngineChassisInput";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

interface PurchaseItemInput {
    tempId: string;
    product_name: string;
    category: string;
    color_variant: string;
    imei_serials: string[];
    quantity: number;
    unit_price: number;
}

export default function AddVendorPurchasePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [vendorId, setVendorId] = useState<string>("");
    const [vendorName, setVendorName] = useState("");
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState("");
    const [notes, setNotes] = useState("");
    const [isFullView, setIsFullView] = useState(false);
    const [vendors, setVendors] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [allProducts, setAllProducts] = useState<any[]>([]);

    const [items, setItems] = useState<PurchaseItemInput[]>([
        { tempId: Math.random().toString(), product_name: "", category: "", color_variant: "", imei_serials: [""], quantity: 1, unit_price: 0 }
    ]);

    // Barcode Scanner Logic
    const [scannerConnected, setScannerConnected] = useState(false);
    const [scannerDeviceName, setScannerDeviceName] = useState('Hardware Barcode Scanner');
    const barcodeBuffer = useRef('');
    const lastKeyTime = useRef(Date.now());
    const itemsRef = useRef(items);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        const checkExistingScanner = async () => {
            try {
                if ('hid' in navigator) {
                    const devices = await (navigator as any).hid.getDevices();
                    if (devices && devices.length > 0) {
                        setScannerDeviceName(devices[0].productName || 'Hardware Barcode Scanner');
                        setScannerConnected(true);
                    }
                }
            } catch (err) {
                console.error("Failed to check existing scanner", err);
            }
        };
        checkExistingScanner();
    }, []);

    const connectScanner = async () => {
        try {
            const devices = await (navigator as any).hid.requestDevice({ filters: [] });
            if (devices && devices.length > 0) {
                setScannerDeviceName(devices[0].productName || 'Hardware Barcode Scanner');
                setScannerConnected(true);
                toast.success(`Scanner Connected: ${devices[0].productName}`);
            }
        } catch (err) {
            console.error('Error connecting scanner:', err);
        }
    };

    const itemsSnapshotBeforeScan = useRef<PurchaseItemInput[] | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            const currentTime = Date.now();
            const timeDiff = currentTime - lastKeyTime.current;

            if (timeDiff > 50) {
                barcodeBuffer.current = '';
                // Save a snapshot of the state before the scan begins.
                // This allows us to "undo" any characters that leak into the focused native input.
                itemsSnapshotBeforeScan.current = itemsRef.current;
            } else if (barcodeBuffer.current.length >= 1 && isInputFocused) {
                // Prevent native input from capturing rapid scanner keystrokes to avoid UI freeze/crash
                e.preventDefault();
            }

            if (e.key === 'Enter') {
                if (barcodeBuffer.current.length > 3) {
                    const scannedCode = barcodeBuffer.current;
                    if (!scannerConnected) setScannerConnected(true);
                    
                    let updated = false;
                    // Use the snapshot to completely undo the leaked first-character onChange event!
                    const prevItems = itemsSnapshotBeforeScan.current || itemsRef.current;
                    let newItems = [...prevItems];

                    newItems = newItems.map(item => {
                        if (updated) return item;
                        
                        const emptyIndex = item.imei_serials.findIndex(i => !i.trim());
                        if (emptyIndex !== -1) {
                            const newImeis = [...item.imei_serials];
                            newImeis[emptyIndex] = scannedCode;
                            updated = true;
                            return { ...item, imei_serials: newImeis };
                        }
                        return item;
                    });

                    if (updated) {
                        toast.success(`Barcode Scanned: ${scannedCode}`);
                        setItems(newItems);
                    } else {
                        // Automatically increase quantity of the last item and add the new IMEI
                        const lastItemIndex = newItems.length - 1;
                        if (lastItemIndex >= 0) {
                            const lastItem = { ...newItems[lastItemIndex] };
                            lastItem.quantity = Number(lastItem.quantity || 1) + 1;
                            lastItem.imei_serials = [...lastItem.imei_serials, scannedCode];
                            newItems[lastItemIndex] = lastItem;
                            
                            toast.success(`Increased Quantity & Added: ${scannedCode}`);
                            setItems(newItems);
                        } else {
                            toast.error('Please add at least one row first.');
                        }
                    }

                    if (isInputFocused) {
                        e.preventDefault();
                        target.blur(); // Blur the input so subsequent scans don't continue to target it
                    }
                }
                barcodeBuffer.current = '';
                itemsSnapshotBeforeScan.current = null;
            } else if (e.key.length === 1) {
                barcodeBuffer.current += e.key;
            }

            lastKeyTime.current = currentTime;
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [scannerConnected]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const headers = getAuthHeaders();
                const [vRes, pRes] = await Promise.all([
                    fetch(`${API_BASE}/api/outlet/vendors`, { headers }),
                    fetch(`${API_BASE}/api/products`, { headers })
                ]);
                const vData = await vRes.json();
                const pData = await pRes.json();

                if (vData.success) setVendors(vData.vendors);
                if (pData.success) {
                    setAllProducts(pData.data);
                    const cats = Array.from(new Set(pData.data.map((p: any) => p.category_name))) as string[];
                    setCategories(cats.sort());
                }
            } catch (err) {
                console.error("Failed to fetch initial data:", err);
            }
        };
        fetchData();
    }, []);

    const handleProductSelectByRow = (tempId: string, product: any) => {
        setItems(prevItems => prevItems.map(i => {
            if (i.tempId === tempId) {
                return {
                    ...i,
                    product_name: product.name,
                    category: product.category_name,
                    color_variant: product.color_variant || "",
                    unit_price: product.price || 0
                };
            }
            return i;
        }));
    };

    const [importing, setImporting] = useState(false);

    const addItem = () => {
        setItems(prevItems => [...prevItems, { 
            tempId: Math.random().toString(), 
            product_name: "", 
            category: "", 
            color_variant: "", 
            imei_serials: [""], 
            quantity: 1, 
            unit_price: 0 
        }]);
    };

    const removeItem = (tempId: string) => {
        setItems(prevItems => {
            if (prevItems.length === 1) return prevItems;
            return prevItems.filter(i => i.tempId !== tempId);
        });
    };

    const updateItem = (tempId: string, field: keyof PurchaseItemInput, value: any) => {
        setItems(prevItems => prevItems.map(i => {
            if (i.tempId === tempId) {
                const updated = { ...i, [field]: value };
                if (field === "quantity") {
                    let qty = parseInt(value) || 1;
                    if (qty > 1000) qty = 1000; // PREVENT OOM CRASH
                    updated.quantity = qty;
                    let newImeis = [...updated.imei_serials];
                    if (qty > newImeis.length) {
                        newImeis = [...newImeis, ...Array(qty - newImeis.length).fill("")];
                    } else if (qty < newImeis.length) {
                        newImeis = newImeis.slice(0, qty);
                    }
                    updated.imei_serials = newImeis;
                }
                return updated;
            }
            return i;
        }));
    };

    const updateImei = (tempId: string, index: number, value: string) => {
        setItems(prevItems => prevItems.map(i => {
            if (i.tempId === tempId) {
                const newImeis = [...i.imei_serials];
                newImeis[index] = value;
                return { ...i, imei_serials: newImeis };
            }
            return i;
        }));
    };

    const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setError("");

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const importedItems: PurchaseItemInput[] = results.data.map((row: any) => {
                    const qty = parseInt(row.quantity || row.Qty || "1") || 1;
                    const singleImei = row.imei_serial || row.IMEI || row.Serial || "";
                    let imeisArray = [singleImei];
                    if (qty > 1) {
                        imeisArray = [...imeisArray, ...Array(qty - 1).fill("")];
                    }
                    return {
                        tempId: Math.random().toString(),
                        product_name: row.product_name || row.Product || "",
                        category: row.category || row.Category || "",
                        color_variant: row.color_variant || row.Variant || row.Color || "",
                        imei_serials: imeisArray,
                        quantity: qty,
                        unit_price: parseFloat(row.unit_price || row.Price || row.Rate || "0") || 0,
                    };
                });

                if (importedItems.length > 0) {
                    setItems(prev => {
                        // If the only item is empty, replace it
                        if (prev.length === 1 && !prev[0].product_name) return importedItems;
                        return [...prev, ...importedItems];
                    });
                    setSuccess(`Successfully imported ${importedItems.length} items.`);
                } else {
                    setError("No valid data found in CSV.");
                }
                setImporting(false);
                // Clear input
                e.target.value = "";
            },
            error: (err) => {
                setError("Error parsing CSV: " + err.message);
                setImporting(false);
            }
        });
    };

    const downloadSampleCsv = () => {
        const headers = "product_name,category,color_variant,imei_serial,quantity,unit_price\n";
        const sample1 = "Samsung Galaxy A54,Smartphone,Awesome Graphite,356842XXXXXXXXX,1,55000\n";
        const sample2 = "Silicon Case,Accessories,Clear,,10,1200\n";
        
        const blob = new Blob([headers + sample1 + sample2], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "procurement_sample.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorName.trim()) return setError("Vendor name is required.");
        if (items.some(i => !i.product_name.trim() || i.unit_price <= 0)) return setError("All items must have a product name and price > 0.");
        // A partly-typed year (e.g. 0006) would otherwise be saved and show as thousands of years overdue in Aging.
        const badYear = (d: string) => !!d && !/^(20\d{2}|2100)-/.test(d);
        if (badYear(purchaseDate)) return setError("Purchase date has an invalid year — please re-enter it.");
        if (badYear(dueDate)) return setError("Payment due date has an invalid year — please re-enter it.");

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            const apiItems = items.flatMap(item => {
                const hasImeis = item.imei_serials.some(imei => imei.trim().length > 0);
                if (hasImeis) {
                    const validImeis = item.imei_serials.filter(i => i.trim().length > 0);
                    const records = validImeis.map(imei => ({
                        product_name: item.product_name,
                        category: item.category,
                        color_variant: item.color_variant,
                        imei_serial: imei.trim(),
                        quantity: 1,
                        unit_price: item.unit_price,
                        total_price: item.unit_price
                    }));

                    const diff = item.quantity - validImeis.length;
                    if (diff > 0) {
                        records.push({
                            product_name: item.product_name,
                            category: item.category,
                            color_variant: item.color_variant,
                            imei_serial: "",
                            quantity: diff,
                            unit_price: item.unit_price,
                            total_price: item.unit_price * diff
                        });
                    }
                    return records;
                } else {
                    return [{
                        product_name: item.product_name,
                        category: item.category,
                        color_variant: item.color_variant,
                        imei_serial: "",
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.quantity * item.unit_price
                    }];
                }
            });

            const res = await fetch(`${API_BASE}/api/outlet/vendors/purchases`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    vendor_id: vendorId,
                    vendor_name: vendorName,
                    purchase_date: purchaseDate,
                    due_date: dueDate || null,
                    notes,
                    items: apiItems
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess("Vendor purchase recorded successfully!");
                setTimeout(() => router.push("/outlet/vendors/purchases"), 1500);
            } else {
                setError(data.message || "Failed to save purchase.");
            }
        } catch (err) {
            setError(getErrorMessage(err, "Network error. Please try again."));
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loader text="Preparing form..." />;

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="New Vendor Purchase" />

            <form onSubmit={handleSubmit} className="mb-20">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                            <Plus className="text-primary" /> Create Purchase Invoice
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">Record a new procurement batch from vendor</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            type="button" 
                            onClick={() => router.back()}
                            className="px-6 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="bg-primary hover:bg-opacity-90 text-white px-8 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Save size={18} />}
                            {saving ? "Saving..." : "Save Purchase"}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-100/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-3 animate-head-shake">
                        <AlertCircle size={20} />
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 rounded-2xl bg-green-100/10 border border-green-500/20 text-green-600 dark:text-green-400 flex items-center gap-3 animate-bounce">
                        <CheckCircle2 size={20} />
                        <span className="text-sm font-bold">{success}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT: Purchase Header */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-boxdark p-6 rounded-3xl border border-stroke dark:border-strokedark shadow-sm">
                            <h3 className="text-base font-black mb-6 flex items-center gap-2">
                                <Building2 size={18} className="text-primary" /> Vendor & General
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <SearchableSelect
                                        label="Vendor Name *"
                                        options={vendors.map(v => ({ label: v.name, value: v.id.toString() }))}
                                        value={vendorId}
                                        onChange={(val, opt) => {
                                            setVendorId(val);
                                            if (opt) setVendorName(opt.label);
                                            else setVendorName(val); // Custom name
                                        }}
                                        placeholder="Select or type vendor..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Purchase Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input 
                                            type="date" 
                                            min="2000-01-01"
                                            max="2100-12-31"
                                            value={purchaseDate}
                                            onChange={(e) => setPurchaseDate(e.target.value)}
                                            className="w-full pl-12 pr-5 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark outline-none focus:border-primary text-sm font-bold transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 text-red-500">Payment Due Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" size={16} />
                                        <input 
                                            type="date" 
                                            min="2000-01-01"
                                            max="2100-12-31"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full pl-12 pr-5 py-3 rounded-2xl bg-red-50/50 dark:bg-meta-4 border border-red-200 dark:border-strokedark outline-none focus:border-red-500 text-sm font-bold transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Internal Notes</label>
                                        <div className="relative">
                                            <FileText className="absolute left-4 top-3.5 text-gray-400" size={16} />
                                            <textarea 
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Remarks, discount info, etc..."
                                                rows={3}
                                                className="w-full pl-12 pr-5 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark outline-none focus:border-primary text-sm font-medium transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* CSV IMPORT GUIDE */}
                                    <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10 space-y-3">
                                        <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                                            <HelpCircle size={14} /> Bulk Sourcing Guide
                                        </div>
                                        <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
                                            Format: <span className="text-gray-900 dark:text-white">Product, Category, Variant, IMEI, Qty, Price</span>
                                        </p>
                                        <button 
                                            type="button"
                                            onClick={downloadSampleCsv}
                                            className="text-[10px] font-black text-primary hover:underline flex items-center gap-1.5"
                                        >
                                            <Download size={12} /> Download Procurement Template
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Card */}
                        <div className="bg-primary p-8 rounded-3xl text-white shadow-xl flex flex-col justify-between overflow-hidden relative group">
                            <ShoppingCart size={120} className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-500" />
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Invoice Amount</div>
                                <div className="text-4xl font-black tabular-nums tracking-tighter">PKR {totalAmount.toLocaleString()}</div>
                            </div>
                            <div className="mt-12 text-xs font-bold opacity-80 flex items-center gap-2">
                                <AlertCircle size={14} /> This amount will be added to vendor balance.
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Items Table */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-boxdark p-6 rounded-3xl border border-stroke dark:border-strokedark shadow-sm overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 px-1 gap-4">
                                <div className="space-y-2">
                                    <h3 className="text-base font-black flex items-center gap-2">
                                        <Package size={20} className="text-primary" /> Purchase Items ({items.length})
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full animate-pulse",
                                            scannerConnected ? "bg-emerald-500" : "bg-amber-500"
                                        )}></div>
                                        <span className="text-xs font-bold text-gray-500">
                                            {scannerConnected ? `Connected: ${scannerDeviceName}` : "Waiting for Barcode Scanner..."}
                                        </span>
                                        {!scannerConnected && (
                                            <button
                                                type="button"
                                                onClick={connectScanner}
                                                className="text-[10px] font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded transition-colors"
                                            >
                                                Connect Scanner
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer px-4 py-2 rounded-xl text-xs font-black bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-2 active:scale-95">
                                        <Upload size={14} />
                                        {importing ? "Importing..." : "Import CSV"}
                                        <input 
                                            type="file" 
                                            accept=".csv" 
                                            className="hidden" 
                                            onChange={handleCsvImport}
                                            disabled={importing}
                                        />
                                    </label>
                                    <button 
                                        type="button"
                                        onClick={() => setIsFullView(true)}
                                        className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
                                        title="Full Screen View"
                                    >
                                        <Maximize2 size={16} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={addItem}
                                        className="px-4 py-2 rounded-xl text-xs font-black bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all flex items-center gap-2 active:scale-95"
                                    >
                                        <Plus size={14} /> Add Row
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-meta-4 text-[10px] uppercase font-black tracking-widest text-gray-400">
                                            <th className="p-3 w-10">#</th>
                                            <th className="p-3 min-w-[200px]">Product / Category</th>
                                            <th className="p-3">Variant</th>
                                            <th className="p-3">IMEI / Serial</th>
                                            <th className="p-3 w-20 text-center">Qty</th>
                                            <th className="p-3 w-32 text-right">Unit Price</th>
                                            <th className="p-3 w-10" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stroke dark:divide-strokedark">
                                        {items.map((item, index) => (
                                            <tr key={item.tempId} className="group hover:bg-gray-50/50 dark:hover:bg-meta-4/20 transition-all">
                                                <td className="p-3 font-mono text-gray-300 font-black">{index + 1}</td>
                                                <td className="p-3 space-y-2">
                                                    <SearchableSelect
                                                        options={!item.category ? [] : allProducts
                                                            .filter(p => !item.category || p.category_name === item.category)
                                                            .map(p => ({ label: p.name, value: p.name, ...p }))
                                                        }
                                                        value={item.product_name}
                                                        allowCustom={true}
                                                        disabled={!item.category}
                                                        onChange={(val, opt) => {
                                                            if (opt) {
                                                                handleProductSelectByRow(item.tempId, opt);
                                                            } else {
                                                                updateItem(item.tempId, "product_name", val);
                                                            }
                                                        }}
                                                        placeholder={!item.category ? "Select Cat..." : "Product..."}
                                                        className="border-none p-0 ring-0 focus:ring-0"
                                                    />
                                                    <SearchableSelect
                                                        options={categories.map(c => ({ label: c, value: c }))}
                                                        value={item.category}
                                                        allowCustom={true}
                                                        onChange={(val) => updateItem(item.tempId, "category", val)}
                                                        placeholder="Category..."
                                                        className="border-none p-0 opacity-70 scale-90 -ml-2"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input 
                                                        type="text" 
                                                        value={item.color_variant}
                                                        onChange={(e) => updateItem(item.tempId, "color_variant", e.target.value)}
                                                        placeholder="Color / Color"
                                                        className="w-full bg-transparent outline-none font-medium text-violet-600 dark:text-violet-400 placeholder:text-gray-300 p-0"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <div className="space-y-1.5">
                                                        {item.imei_serials.map((imei, idx) => (
                                                            <div key={idx} className="relative">
                                                                <SerialOrEngineChassisInput
                                                                    category={item.category}
                                                                    value={imei}
                                                                    onChange={(val) => updateImei(item.tempId, idx, val)}
                                                                    index={idx}
                                                                    compact
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center align-top pt-4">
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(item.tempId, "quantity", e.target.value)}
                                                        className="w-16 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-lg outline-none text-center font-black text-sm text-primary py-1"
                                                    />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span className="text-gray-300 text-[10px]">PKR</span>
                                                        <input 
                                                            type="number" 
                                                            value={item.unit_price || ""}
                                                            onChange={(e) => updateItem(item.tempId, "unit_price", parseFloat(e.target.value))}
                                                            placeholder="0"
                                                            className="w-20 bg-transparent outline-none text-right font-black text-sm text-gray-800 dark:text-white placeholder:text-gray-300 p-0"
                                                        />
                                                    </div>
                                                    <div className="text-[10px] text-gray-300 font-bold mt-1">Total: PKR {(item.quantity * item.unit_price).toLocaleString()}</div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeItem(item.tempId)}
                                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all active:scale-90"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-8 pt-8 border-t border-stroke dark:border-strokedark px-4 flex items-center justify-between">
                                <div className="text-xs text-gray-400 font-medium">Add rows for multiple items in this purchase invoice</div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Items Net Total</div>
                                    <div className="text-xl font-black text-primary">PKR {totalAmount.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
            {/* FULL VIEW MODAL */}
            {isFullView && (
                <div className="fixed inset-0 z-[9999] bg-white dark:bg-boxdark flex flex-col p-6 animate-fadeIn">
                    <div className="flex items-center justify-between mb-8 border-b dark:border-strokedark pb-6">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setIsFullView(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-meta-4 rounded-full transition-all"
                            >
                                <Minimize2 size={24} className="text-gray-400" />
                            </button>
                            <div>
                                <h2 className="text-xl font-black text-black dark:text-white flex items-center gap-2">
                                    <ShoppingCart className="text-primary" /> Purchase Items Master List
                                </h2>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{vendorName || "Unselected Vendor"} · {items.length} records</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Total Value</div>
                                <div className="text-2xl font-black text-primary tabular-nums">PKR {totalAmount.toLocaleString()}</div>
                            </div>
                            <div className="h-10 w-[1px] bg-stroke dark:bg-strokedark" />
                            <div className="flex items-center gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsFullView(false)}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={saving}
                                    onClick={(e) => { e.preventDefault(); handleSubmit(e as any); }}
                                    className="bg-primary hover:bg-opacity-90 text-white px-10 py-3 rounded-xl text-sm font-black flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Save size={18} />}
                                    {saving ? "Saving..." : "Save Purchase"}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setIsFullView(false)}
                                    className="p-3 bg-gray-100 dark:bg-meta-4 text-gray-500 rounded-xl hover:text-red-500 transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto px-1">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="sticky top-0 bg-white dark:bg-boxdark z-20">
                                <tr className="bg-gray-50 dark:bg-meta-4 text-[10px] uppercase font-black tracking-widest text-gray-400 shadow-sm">
                                    <th className="p-4 w-12 border-b border-stroke dark:border-strokedark">#</th>
                                    <th className="p-4 border-b border-stroke dark:border-strokedark">Product Info</th>
                                    <th className="p-4 border-b border-stroke dark:border-strokedark">Variant Details</th>
                                    <th className="p-4 border-b border-stroke dark:border-strokedark">IMEI / Serial</th>
                                    <th className="p-4 w-24 text-center border-b border-stroke dark:border-strokedark">Quantity</th>
                                    <th className="p-4 w-40 text-right border-b border-stroke dark:border-strokedark">Unit Price</th>
                                    <th className="p-4 w-12 border-b border-stroke dark:border-strokedark" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stroke/50 dark:divide-strokedark/50">
                                {items.map((item, index) => (
                                    <tr key={item.tempId} className="group hover:bg-gray-50/50 dark:hover:bg-meta-4/20 transition-all">
                                        <td className="p-4 font-mono text-gray-300 font-black">{index + 1}</td>
                                        <td className="p-4 space-y-3">
                                            <SearchableSelect
                                                label="Category"
                                                options={categories.map(c => ({ label: c, value: c }))}
                                                value={item.category}
                                                allowCustom={true}
                                                onChange={(val) => updateItem(item.tempId, "category", val)}
                                                placeholder="Choose or Type..."
                                                className="scale-90 origin-left"
                                            />
                                            <SearchableSelect
                                                label="Product Name"
                                                options={!item.category ? [] : allProducts
                                                    .filter(p => !item.category || p.category_name === item.category)
                                                    .map(p => ({ label: p.name, value: p.name, ...p }))
                                                }
                                                value={item.product_name}
                                                allowCustom={true}
                                                disabled={!item.category}
                                                onChange={(val, opt) => {
                                                    if (opt) handleProductSelectByRow(item.tempId, opt);
                                                    else updateItem(item.tempId, "product_name", val);
                                                }}
                                                placeholder="Search or Type..."
                                            />
                                        </td>
                                        <td className="p-4">
                                            <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Color / Specs</label>
                                            <input 
                                                type="text" 
                                                value={item.color_variant}
                                                onChange={(e) => updateItem(item.tempId, "color_variant", e.target.value)}
                                                placeholder="e.g. 128GB Black"
                                                className="w-full bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-xl px-4 py-3 outline-none focus:border-primary text-sm font-bold"
                                            />
                                        </td>
                                        <td className="p-4 align-top pt-8 font-mono">
                                            <div className="space-y-2">
                                                {item.imei_serials.map((imei, idx) => (
                                                    <div key={idx} className="relative">
                                                        {item.quantity > 1 && <span className="absolute -left-5 top-3.5 text-[9px] text-gray-400 font-bold">{idx + 1}.</span>}
                                                        <SerialOrEngineChassisInput
                                                            category={item.category}
                                                            value={imei}
                                                            onChange={(val) => updateImei(item.tempId, idx, val)}
                                                            index={idx}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center align-top pt-8">
                                            <div className="flex flex-col items-center justify-center">
                                                <label className="block text-[8px] font-black text-gray-400 uppercase mb-2">Quantity</label>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(item.tempId, "quantity", e.target.value)}
                                                    className="w-20 bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark shadow-inner rounded-xl py-3 outline-none text-center font-black text-primary text-lg"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-black">PKR</span>
                                                <input 
                                                    type="number" 
                                                    value={item.unit_price || ""}
                                                    onChange={(e) => updateItem(item.tempId, "unit_price", parseFloat(e.target.value))}
                                                    placeholder="0"
                                                    className="w-full bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-xl pl-10 pr-4 py-3 outline-none text-right font-black text-gray-800 dark:text-white"
                                                />
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-bold mt-2 px-1">Total: PKR {(item.quantity * item.unit_price).toLocaleString()}</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                type="button"
                                                onClick={() => removeItem(item.tempId)}
                                                className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={7} className="p-4">
                                        <button 
                                            type="button"
                                            onClick={addItem}
                                            className="w-full py-4 rounded-2xl border-2 border-dashed border-stroke dark:border-strokedark text-gray-400 hover:border-primary hover:text-primary transition-all font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                        >
                                            <Plus size={16} /> Add Another Row to Invoice
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
