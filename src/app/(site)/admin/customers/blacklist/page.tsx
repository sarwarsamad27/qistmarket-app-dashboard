import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb';
import BlacklistedCustomerList from '@/components/Blacklist/BlacklistedCustomerList';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Blacklisted Customers | QistMarket',
    description: 'Monitor and manage customers with high delinquency and overdue installments.',
};

const BlacklistPage = () => {
    return (
        <>
            <Breadcrumb pageName="Blacklisted Customers" />
            <div className="flex flex-col gap-10">
                <BlacklistedCustomerList />
            </div>
        </>
    );
};

export default BlacklistPage;
