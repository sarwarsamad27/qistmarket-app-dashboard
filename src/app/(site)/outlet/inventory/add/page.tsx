"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import Cookies from "js-cookie";
import { PlusCircle, Trash2, Save, ArrowLeft } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import SearchableSelect from "@/components/common/SearchableSelect";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

interface ItemRow {
    id: string;
    product_name: string;
    category: string;
    subcategory?: string;
    imei_serial: string;
    color_variant: string;
    quantity: string;
    purchase_price: string;
    status: string;
    installment_plans?: any[];
}

export default function AddInventoryBulkPage() {
    const router = useRouter();
    
    const createEmptyRow = (): ItemRow => ({
        id: Math.random().toString(36).substring(7),
        product_name: "",
        category: "",
        imei_serial: "",
        color_variant: "",
        quantity: "1",
        purchase_price: "",
        status: "In Stock"
    });

    const [items, setItems] = useState<ItemRow[]>([createEmptyRow()]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleChange = (id: string, field: keyof ItemRow, value: string) => {
        setItems(items.map(item => {
            if (item.id === id) {
                let updated = { ...item, [field]: value };
                
                // Real-world enforcement rules:
                if (field === 'imei_serial' && value.trim() !== '') {
                    updated.quantity = "1";
                }
                if (field === 'quantity' && parseInt(value) > 1) {
                    updated.imei_serial = "";
                }
                
                return updated;
            }
            return item;
        }));
        setError("");
    };

    const addRow = () => {
        setItems([...items, createEmptyRow()]);
    };

    const removeRow = (id: string) => {
        if (items.length === 1) return; // Prevent removing last row
        setItems(items.filter(item => item.id !== id));
    };

    const handleSubmit = async () => {
        // Validation
        const validItems = items.filter(i => i.product_name && i.imei_serial && i.purchase_price);
        
        if (validItems.length === 0) {
            setError("Please fill out at least one complete product row.");
            return;
        }

        const payload = validItems.map(item => ({
            product_name: item.product_name,
            category: item.category,
            imei_serial: item.imei_serial,
            color_variant: item.color_variant,
            quantity: item.quantity,
            purchase_price: parseFloat(item.purchase_price),
            status: item.status,
            installment_plans: item.installment_plans
        }));

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ items: payload }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(`Successfully added ${data.count} items to inventory!`);
                setTimeout(() => router.push("/outlet/inventory"), 1500);
            } else {
                setError(data.message || "Failed to add items.");
            }
        } catch (e) {
            setError(getErrorMessage(e, "Network error. Could not connect to API."));
        } finally {
            setLoading(false);
        }
    };

    const [categories, setCategories] = useState<string[]>([]);
    const [allProducts, setAllProducts] = useState<any[]>([]);

    useEffect(() => {
        const fetchStockData = async () => {
            try {
                const token = Cookies.get("auth_token");
                const resp = await fetch(`${API_BASE}/api/products`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                const data = await resp.json();
                if (data.success) {
                    setAllProducts(data.data);
                    const uniqueCategories = Array.from(new Set(data.data.map((p: any) => p.category_name))) as string[];
                    setCategories(uniqueCategories.sort());
                }
            } catch (err) {
                console.error("Failed to fetch products for auto-fill:", err);
                setCategories(["Smartphone", "Tablet", "Laptop", "Accessories", "Home Appliances", "Other"]);
            }
        };
        fetchStockData();
    }, []);

    const handleProductSelect = (id: string, product: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    product_name: product.name,
                    category: product.category_name,
                    subcategory: product.subcategory_name,
                    installment_plans: product.ProductInstallments?.filter((p: any) => p.isActive) || []
                };
            }
            return item;
        }));
    };

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="Bulk Add Inventory" />

            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Bulk Add Stock</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Add multiple products to your inventory at once.</p>
                </div>
                <button onClick={() => router.back()} className="flex items-center gap-2 text-primary hover:underline font-medium">
                    <ArrowLeft size={18} /> Back to Stock
                </button>
            </div>

            <div className="bg-white dark:bg-boxdark rounded-xl shadow border border-stroke dark:border-strokedark p-6">
                {error && <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 font-medium text-sm border border-red-200 dark:border-red-800">{error}</div>}
                {success && <div className="mb-4 p-4 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-medium text-sm border border-green-200 dark:border-green-800">{success}</div>}

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-meta-4 text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                                <th className="px-4 py-3 border-b border-stroke dark:border-strokedark rounded-tl-lg">Category</th>
                                <th className="px-4 py-3 border-b border-stroke dark:border-strokedark">Product Name *</th>
                                <th className="px-4 py-3 border-b border-stroke dark:border-strokedark">Color / Variant</th>
                                <th className="px-4 py-3 border-b border-stroke dark:border-strokedark">IMEI / Serial</th>
                                <th className="px-4 py-3 border-b border-stroke dark:border-strokedark text-center">Qty</th>
                                <th className="px-4 py-3 border-b border-stroke dark:border-strokedark">Purchase Price *</th>
                                <th className="px-4 py-3 border-b border-stroke dark:border-strokedark">Status *</th>
                                <th className="px-4 py-3 border-b border-stroke dark:border-strokedark text-center rounded-tr-lg">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stroke dark:divide-strokedark">
                            {items.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-meta-4/30 transition-colors">
                                    <td className="p-3 min-w-[150px]">
                                        <SearchableSelect
                                            options={categories.map(c => ({ label: c, value: c }))}
                                            value={item.category}
                                            onChange={(val) => handleChange(item.id, 'category', val)}
                                            placeholder="Cat..."
                                            allowCustom={true}
                                        />
                                    </td>
                                    <td className="p-3 min-w-[200px]">
                                        <SearchableSelect
                                            options={!item.category ? [] : allProducts
                                                .filter(p => !item.category || p.category_name === item.category)
                                                .map(p => ({ label: p.name, value: p.name, ...p }))
                                            }
                                            value={item.product_name}
                                            disabled={!item.category}
                                            onChange={(val, opt) => {
                                                if (opt) {
                                                    handleProductSelect(item.id, opt);
                                                } else {
                                                    handleChange(item.id, 'product_name', val);
                                                }
                                            }}
                                            placeholder={!item.category ? "Select Cat..." : "Product..."}
                                            allowCustom={true}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="text"
                                            value={item.color_variant} 
                                            onChange={(e) => handleChange(item.id, 'color_variant', e.target.value)} 
                                            placeholder="e.g. Black" 
                                            className="w-full border border-stroke dark:border-strokedark rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-primary dark:bg-form-input dark:text-white" 
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="text"
                                            value={item.imei_serial} 
                                            onChange={(e) => handleChange(item.id, 'imei_serial', e.target.value)} 
                                            placeholder="Optional Barcode" 
                                            title="Cannot use IMEI if Quantity > 1"
                                            disabled={parseInt(item.quantity) > 1}
                                            className="w-full border border-stroke dark:border-strokedark rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-primary disabled:opacity-50 dark:bg-form-input dark:text-white" 
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="number"
                                            min="1"
                                            value={item.quantity} 
                                            onChange={(e) => handleChange(item.id, 'quantity', e.target.value)} 
                                            title="Must be 1 if IMEI exists"
                                            disabled={item.imei_serial.trim().length > 0}
                                            className="w-16 text-center border border-stroke dark:border-strokedark rounded-lg px-2 py-2 text-sm bg-transparent outline-none focus:border-primary disabled:opacity-50 dark:bg-form-input dark:text-white" 
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="number"
                                            value={item.purchase_price} 
                                            onChange={(e) => handleChange(item.id, 'purchase_price', e.target.value)} 
                                            placeholder="PKR" 
                                            className="w-full border border-stroke dark:border-strokedark rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-primary dark:bg-form-input dark:text-white" 
                                        />
                                    </td>
                                    <td className="p-3">
                                        <select 
                                            value={item.status} 
                                            onChange={(e) => handleChange(item.id, 'status', e.target.value)} 
                                            className="w-full border border-stroke dark:border-strokedark rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:bg-form-input dark:text-white"
                                        >
                                            <option value="In Stock">In Stock</option>
                                            <option value="Out Of Stock">Out Of Stock</option>
                                        </select>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button 
                                            title="Remove Row"
                                            onClick={() => removeRow(item.id)} 
                                            disabled={items.length === 1}
                                            className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-between items-center bg-gray-50 dark:bg-meta-4/20 p-4 rounded-b-xl border-t border-stroke dark:border-strokedark">
                    <button 
                        onClick={addRow} 
                        className="flex items-center gap-2 text-primary font-medium hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                        <PlusCircle size={18} /> Add Another Item
                    </button>
                    
                    <button 
                        onClick={handleSubmit} 
                        disabled={loading} 
                        className="flex items-center gap-2 bg-primary hover:bg-opacity-90 disabled:opacity-60 text-white px-8 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all"
                    >
                        <Save size={18} />
                        {loading ? "Saving Stock..." : "Save All to Inventory"}
                    </button>
                </div>
            </div>
        </div>
    );
}
