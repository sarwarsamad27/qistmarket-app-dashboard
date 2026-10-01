'use client';

import React, { useCallback, useState } from 'react';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { getErrorMessage, extractBodyMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type PreviewRow = {
    city: string;
    zone: string;
    area: string;
};

type UploadStats = {
    totalRows: number;
    createdCount: number;
    skippedExisting: number;
    invalidRows: number;
} | null;

const BulkUploadPage = () => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [preview, setPreview] = useState<PreviewRow[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStats, setUploadStats] = useState<UploadStats>(null);

    const resetState = () => {
        setUploadProgress(0);
        setUploadStats(null);
    };

    const parseCSVPreview = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = (e.target?.result as string) || '';
            const lines = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            if (lines.length <= 1) {
                setPreview([]);
                return;
            }

            const rows: PreviewRow[] = lines.slice(1).map((line) => {
                const [city = '', zone = '', area = ''] = line.split(',').map((s) => s.trim());
                return { city, zone, area };
            });

            setPreview(rows);
        };
        reader.readAsText(file);
    };

    const handleSelectedFile = useCallback((selectedFile: File) => {
        if (selectedFile.type !== 'text/csv' && !selectedFile.name.toLowerCase().endsWith('.csv')) {
            toast.error("Please upload a CSV file");
            return;
        }
        if (selectedFile.size > 10 * 1024 * 1024) {
            toast.error("File size should be less than 10MB");
            return;
        }
        setFile(selectedFile);
        resetState();
        parseCSVPreview(selectedFile);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleSelectedFile(selectedFile);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            handleSelectedFile(droppedFile);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error("Please select a file first");
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setUploadStats(null);

        try {
            const reader = new FileReader();

            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 40);
                    setUploadProgress(percent);
                }
            };

            reader.onload = async (e) => {
                try {
                    const text = (e.target?.result as string) || '';
                    const lines = text
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0);

                    if (lines.length <= 1) {
                        toast.error("File is empty or header only");
                        setUploading(false);
                        setUploadProgress(0);
                        return;
                    }

                    setUploadProgress(55);

                    const data = lines
                        .slice(1)
                        .map((line) => {
                            const [city = '', zone = '', area = ''] = line
                                .split(',')
                                .map((s) => s.trim());
                            return { city, zone, area };
                        })
                        .filter((row) => row.city && row.zone && row.area);

                    if (data.length === 0) {
                        toast.error("No valid rows found in CSV");
                        setUploading(false);
                        setUploadProgress(0);
                        return;
                    }

                    setUploadProgress(70);

                    const token = Cookies.get("auth_token");
                    if (!token) {
                        toast.error("Authentication token missing");
                        setUploading(false);
                        setUploadProgress(0);
                        return;
                    }

                    const resp = await fetch(`${BACKEND_URL}/api/address/bulk-upload`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ data })
                    });

                    setUploadProgress(90);

                    const result = await resp.json();

                    if (result.success) {
                        const stats: UploadStats = result.stats || null;
                        setUploadStats(stats);
                        setUploadProgress(100);
                        toast.success(result.message || "Upload successful");
                    } else {
                        setUploadProgress(0);
                        toast.error(extractBodyMessage(result) || "Upload failed");
                    }
                } catch (err) {
                    console.error(err);
                    setUploadProgress(0);
                    toast.error(getErrorMessage(err, "Error processing file"));
                } finally {
                    setUploading(false);
                }
            };

            reader.onerror = () => {
                setUploading(false);
                setUploadProgress(0);
                toast.error("Failed to read file");
            };

            reader.readAsText(file);
        } catch (err) {
            console.error(err);
            setUploading(false);
            setUploadProgress(0);
            toast.error(getErrorMessage(err, "Error processing file"));
        }
    };

    const downloadSampleCSV = () => {
        const content = "cityName,zoneName,areaName\nKarachi,Central,Gulshan-e-Iqbal\nKarachi,South,Saddar\nLahore,Model Town,Garden Town";
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'address_sample.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="Bulk Address Upload" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Side: Upload Area */}
                <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl">
                            <Upload className="w-6 h-6" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Upload CSV</h3>
                    </div>

                    <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
                        Upload a CSV file with three columns: <span className="text-red-600 font-bold">cityName</span>, <span className="text-red-600 font-bold">zoneName</span>, and <span className="text-red-600 font-bold">areaName</span>.
                    </p>

                    <div
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition cursor-pointer bg-gray-50 dark:bg-gray-800/50 mb-8 group ${
                            isDragging
                                ? 'border-red-500 bg-red-50/40 dark:bg-red-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-red-500'
                        }`}
                        onClick={() => document.getElementById('csv-upload')?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <input
                            id="csv-upload"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-4 text-center">
                                <FileText className="w-16 h-16 text-red-600 animate-bounce" />
                                <div>
                                    <p className="text-lg font-bold text-gray-800 dark:text-white">{file.name}</p>
                                    <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="p-5 bg-white dark:bg-gray-700 rounded-full shadow-md group-hover:scale-110 transition-transform">
                                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-red-600 transition-colors" />
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 font-bold">
                                    Click to upload or drag &amp; drop
                                </p>
                                <p className="text-sm text-gray-400 font-medium">CSV files only (max. 10MB)</p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="space-y-3">
                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading}
                                className="w-full flex items-center justify-center gap-3 bg-red-600 text-white py-4 rounded-xl hover:bg-red-700 transition font-bold disabled:opacity-50 shadow-lg shadow-red-200 dark:shadow-none"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>Uploading... {uploadProgress}%</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-6 h-6" /> <span>Process &amp; Upload CSV</span>
                                    </>
                                )}
                            </button>

                            {uploading || uploadProgress > 0 ? (
                                <div className="w-full space-y-1">
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span>{uploading ? 'Uploading & processing file' : 'Last upload'}</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                        <div
                                            className="h-2 rounded-full bg-gradient-to-r from-red-500 via-red-400 to-orange-400 transition-all"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <button
                            onClick={downloadSampleCSV}
                            className="w-full flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-700 py-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition font-bold text-gray-600 dark:text-gray-300"
                        >
                            <Download className="w-5 h-5" />
                            Download Sample Template
                        </button>
                    </div>
                </div>

                {/* Right Side: Instructions & Preview */}
                <div className="space-y-8">
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-2xl p-8">
                        <div className="flex items-center gap-3 mb-4 text-blue-700 dark:text-blue-400">
                            <AlertCircle className="w-6 h-6" />
                            <h4 className="text-xl font-bold">Important Instructions</h4>
                        </div>
                        <ul className="space-y-3 text-blue-800/80 dark:text-blue-300/80 font-medium">
                            <li className="flex gap-2"><span>1.</span> The first row should be the header (City Name, Zone Name, Area Name).</li>
                            <li className="flex gap-2"><span>2.</span> Each row must contain all three values.</li>
                            <li className="flex gap-2"><span>3.</span> The system automatically creates Cities and Zones if they don't exist.</li>
                            <li className="flex gap-2"><span>4.</span> Duplicate areas for the same zone will be skipped.</li>
                        </ul>
                    </div>

                    {file && preview.length > 0 && (
                        <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-sm p-8 animate-in fade-in slide-in-from-bottom duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xl font-bold text-gray-800 dark:text-white">
                                    File Preview ({preview.length.toLocaleString()} rows)
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Showing all parsed rows • Scroll to review
                                </p>
                            </div>
                            <div className="max-h-[360px] overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900/40">
                                        <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-wider font-bold">
                                            <th className="py-3 px-3">#</th>
                                            <th className="py-3 px-3">City</th>
                                            <th className="py-3 px-3">Zone</th>
                                            <th className="py-3 px-3">Area</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {preview.map((row, idx) => (
                                            <tr key={`${row.city}-${row.zone}-${row.area}-${idx}`}>
                                                <td className="py-2 px-3 text-xs text-gray-400 dark:text-gray-500">
                                                    {idx + 1}
                                                </td>
                                                <td className="py-2 px-3 text-gray-700 dark:text-gray-200 font-medium">
                                                    {row.city}
                                                </td>
                                                <td className="py-2 px-3 text-gray-700 dark:text-gray-200 font-medium">
                                                    {row.zone}
                                                </td>
                                                <td className="py-2 px-3 text-gray-700 dark:text-gray-200 font-medium">
                                                    {row.area}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {uploadStats && (
                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-2xl p-6 space-y-2">
                            <div className="flex items-center gap-2 text-green-800 dark:text-green-300 mb-1">
                                <CheckCircle2 className="w-5 h-5" />
                                <h4 className="font-semibold text-sm">Upload Summary</h4>
                            </div>
                            <p className="text-xs text-green-900/80 dark:text-green-200/90">
                                Total Rows: <strong>{uploadStats.totalRows.toLocaleString()}</strong> • New
                                Areas Created:{' '}
                                <strong>{uploadStats.createdCount.toLocaleString()}</strong> • Duplicates
                                Skipped:{' '}
                                <strong>{uploadStats.skippedExisting.toLocaleString()}</strong> • Invalid
                                Rows:{' '}
                                <strong>{uploadStats.invalidRows.toLocaleString()}</strong>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkUploadPage;
