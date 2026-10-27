// Payment-method chips for the aging lists — labels come from the backend
// (accountsController.agingMethodLabel): "Cash", "Online — QR", "Online — 1Link", "Admin Entry · …".
const methodTone = (m: string) => {
  if (/QR/.test(m)) return "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300";
  if (/1Link/i.test(m)) return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
  if (/^Admin Entry/.test(m)) return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
};

export default function MethodBadges({ methods, empty = "No payment yet" }: { methods: string[]; empty?: string }) {
  if (!methods.length) return <span className="text-xs text-gray-400">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((m) => (
        <span key={m} className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${methodTone(m)}`}>
          {m}
        </span>
      ))}
    </div>
  );
}
