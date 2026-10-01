"use client";

import Link from "next/link";
import { useAuth } from "../../../contexts/AuthContext";
import { getRoleHome } from "@/lib/roleHome";

interface BreadcrumbProps {
  pageName: string;
}

const Breadcrumb = ({ pageName }: BreadcrumbProps) => {
  const { user } = useAuth();

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-[26px] font-bold leading-[30px] text-dark dark:text-white">
        {pageName}
      </h2>

      <nav>
        <ol className="flex items-center gap-2">
          <li>
            <Link className="font-medium" href={getRoleHome(user?.role)}>
              Dashboard /
            </Link>
          </li>
          <li className="font-medium text-[#ff3d3d]">{pageName}</li>
        </ol>
      </nav>
    </div>
  );
};

export default Breadcrumb;
