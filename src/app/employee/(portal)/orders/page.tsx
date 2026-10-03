import MyOrdersSection from "@/components/EmployeePortal/MyOrdersSection";

export default function EmployeeOrdersPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Orders & Qist</h1>
        <p className="mt-1 text-sm text-gray-500">
          All orders you are involved in as a purchaser or guarantor
        </p>
      </div>

      <MyOrdersSection />
    </div>
  );
}
