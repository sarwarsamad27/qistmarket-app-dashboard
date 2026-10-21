import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Calendar, Trash2, Plus, ArrowRight, Smartphone, Key, Camera, CheckCircle2, UserCheck, Calculator, AlertCircle } from 'lucide-react';
import { formatExactDate, todayDate, addMonths, addDays, formatStandardDate } from "@/utils/dateUtils";

interface LedgerRow {
    month: number;
    date: string;
    amount: number;
}

interface InstallmentLedgerEditorProps {
    totalPrice: number;
    advance: number;
    months: number;
    monthlyAmount: number;
    onLedgerChange: (ledger: LedgerRow[]) => void;
}

export const InstallmentLedgerEditor = ({
    totalPrice,
    advance,
    months,
    monthlyAmount,
    onLedgerChange
}: InstallmentLedgerEditorProps) => {
    const [ledger, setLedger] = useState<LedgerRow[]>([]);
    const today = todayDate();

    // Initial ledger generation
    useEffect(() => {
        const initialLedger = Array.from({ length: months }, (_, i) => ({
            month: i + 1,
            date: formatStandardDate(addMonths(today, i + 1), 'YYYY-MM-DD'),
            amount: monthlyAmount,
        }));
        setLedger(initialLedger);
    }, [months, monthlyAmount]);

    // Notify parent of changes
    useEffect(() => {
        onLedgerChange(ledger);
    }, [ledger]);

    const updateLedgerRow = (index: number, field: keyof LedgerRow, value: string | number) => {
        const updated = [...ledger];

        if (field === 'date' && index === 0) {
            // First installment date changed -> cascade to others
            const newStartDate = new Date(value as string);
            for (let i = 0; i < updated.length; i++) {
                updated[i] = {
                    ...updated[i],
                    date: formatStandardDate(addMonths(newStartDate, i), 'YYYY-MM-DD')
                };
            }
        } else {
            // Should not be reachable for other rows or amounts, but kept for safety
            updated[index] = { ...updated[index], [field]: value };
        }

        setLedger(updated);
    };

    const totalInLedger = ledger.reduce((sum, r) => sum + Number(r.amount), 0);
    const balanceRemaining = (totalPrice - advance) - totalInLedger;

    return (
        <div className="space-y-4">


            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
                        <tr className="border-b border-gray-100 dark:border-strokedark">
                            <th className="py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">S.No</th><th className="py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Month</th>
                            <th className="py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Due Date</th>
                            <th className="py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-strokedark">
                        {ledger.map((r, index) => (
                            <tr key={r.month} className="hover:bg-gray-50/50 dark:hover:bg-meta-4/10 transition-colors"><td className="py-3 text-sm font-bold text-gray-500 tabular-nums">{index + 1}</td>
                                <td className="py-3 text-sm font-bold text-gray-900 dark:text-white">{r.month}</td>
                                <td className="py-3">
                                    {index === 0 ? (
                                        <input
                                            type="date"
                                            value={r.date}
                                            min={formatStandardDate(today, 'YYYY-MM-DD')}
                                            max={formatStandardDate(addDays(today, 40), 'YYYY-MM-DD')}
                                            onChange={e => updateLedgerRow(index, 'date', e.target.value)}
                                            className="bg-transparent border-none p-0 text-sm font-medium text-gray-600 dark:text-gray-400 outline-none focus:text-primary transition-colors cursor-pointer"
                                        />
                                    ) : (
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                            {formatExactDate(r.date, 'DD MMM, YYYY')}
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-[10px] text-gray-400 font-bold">Rs.</span>
                                        <span className="w-24 bg-transparent border-none p-0 text-sm font-black text-gray-900 dark:text-white text-right">
                                            {Number(r.amount).toLocaleString()}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            

        </div>
    );
};
