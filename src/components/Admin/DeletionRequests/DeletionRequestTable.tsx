"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Loader from "@/components/common/Loader";
import { getAllDeletionRequests, reviewDeletionRequest } from "@/services/account-deletion.service";
import { AccountDeletionRequest } from "@/types/account-deletion";
import { ReviewModal } from "./ReviewModal";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/apiErrors";

export default function DeletionRequestsTable() {
    const [requests, setRequests] = useState<AccountDeletionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<AccountDeletionRequest | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchRequests = async () => {
        try {
            const response = await getAllDeletionRequests();
            setRequests(response.requests);
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to fetch deletion requests"));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleReviewClick = (request: AccountDeletionRequest) => {
        setSelectedRequest(request);
        setIsModalOpen(true);
    };

    const handleReviewSubmit = async (requestId: number, action: 'approve' | 'reject', remarks?: string) => {
        try {
            await reviewDeletionRequest(requestId, action, remarks);
            toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
            fetchRequests(); // Refresh list
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to submit review"));
            console.error(error);
            throw error; // Re-throw to handle loading state in modal
        }
    };

    if (loading) {
        return <Loader text="Loading requests..." className="py-20" />;
    }

    return (
        <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card sm:p-7.5">
            <div className="max-w-full overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-base [&>th]:text-dark [&>th]:dark:text-white">
                            <TableHead>User</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Requested At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((request) => (
                            <TableRow key={request.id} className="border-[#eee] dark:border-dark-3">
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-black dark:text-white">{request.user?.full_name}</span>
                                        <span className="text-sm">{request.user?.username}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <p className="text-black dark:text-white truncate max-w-[200px]" title={request.reason}>
                                        {request.reason || "N/A"}
                                    </p>
                                </TableCell>
                                <TableCell>
                                    <span
                                        className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${request.status === "approved"
                                            ? "bg-green-100 text-green-700"
                                            : request.status === "rejected"
                                                ? "bg-red-100 text-red-700"
                                                : "bg-yellow-100 text-yellow-700"
                                            }`}
                                    >
                                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <span className="text-black dark:text-white">
                                        {new Date(request.requestedAt).toLocaleDateString()}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    {request.status === 'pending' && (
                                        <button
                                            onClick={() => handleReviewClick(request)}
                                            className="text-primary hover:underline font-medium"
                                        >
                                            Review
                                        </button>
                                    )}
                                    {request.status !== 'pending' && (
                                        <span className="text-gray-500 text-sm">
                                            Reviewed by {request.reviewedBy?.username || 'Admin'}
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {requests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                                    No deletion requests found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <ReviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                request={selectedRequest}
                onReview={handleReviewSubmit}
            />
        </div>
    );
}
