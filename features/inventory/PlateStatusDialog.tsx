import { useState } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { addToHistory } from "@/utils/vehicleHistory";
import { CreditCard, Printer, Package, Building2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlateStatusDialogProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
}

export const PlateStatusDialog = ({ isOpen, onClose, vehicle }: PlateStatusDialogProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    if (!vehicle) return null;

    const currentStatus = vehicle.plateStatus || "Never Applied";
    const isDelivered = currentStatus.toLowerCase().includes("delivered");

    const handleUpdateStatus = async (newStatus: string) => {
        if (!user) return;
        setLoading(true);

        try {
            // Update vehicle plate status
            await updateDoc(doc(db, "cars", vehicle.id), {
                plateStatus: newStatus,
                updatedAt: serverTimestamp()
            });

            // Log the action
            await addDoc(collection(db, "logs"), {
                action: `Updated Plate Status: ${newStatus}`,
                vehicleId: vehicle.id,
                details: `Changed from ${currentStatus} to ${newStatus}`,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "STATUS_UPDATE"
            });

            // Add to Vehicle History
            await addToHistory(
                vehicle.id,
                "Plate Status Update",
                `Changed status from ${currentStatus} to ${newStatus}`,
                user.uid,
                { type: "PLATE", status: newStatus }
            );

            onClose();
        } catch (error) {
            console.error("Error updating status:", error);
        } finally {
            setLoading(false);
        }
    };

    const statusOptions = [
        {
            value: "Plates Printing in Process",
            label: "Printing",
            desc: "In Process",
            icon: <Printer size={24} className="text-orange-500" />,
            color: "orange"
        },
        {
            value: "Ready for Collection",
            label: "Ready",
            desc: "Ready to Collect",
            icon: <Package size={24} className="text-blue-500" />,
            color: "blue"
        },
        {
            value: "Collected by Showroom",
            label: "Collected",
            desc: "At Showroom",
            icon: <Building2 size={24} className="text-green-500" />,
            color: "green"
        }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="text-slate-900" size={20} />
                        Update Number Plate Status
                    </DialogTitle>
                    <DialogDescription>
                        Track the production and collection status of number plates.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-sm font-medium text-slate-500">Current Status:</span>
                        <Badge variant="outline" className="text-sm font-bold px-3 py-1 bg-white">
                            {currentStatus}
                        </Badge>
                    </div>

                    {isDelivered ? (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3 text-green-800">
                            <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
                            <div className="text-sm">
                                <p className="font-bold mb-1">Plates Delivered</p>
                                <p>The plates have been delivered to the customer. No further status updates are allowed here.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {statusOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant="outline"
                                    className={`h-auto py-3 flex flex-col gap-2 relative overflow-hidden ${currentStatus === option.value
                                        ? `border-${option.color}-500 bg-${option.color}-50 ring-1 ring-${option.color}-500 text-${option.color}-700`
                                        : "hover:bg-slate-50 border-slate-200"
                                        }`}
                                    disabled={currentStatus === option.value || loading}
                                    onClick={() => handleUpdateStatus(option.value)}
                                >
                                    <div className={`p-2 rounded-full ${currentStatus === option.value ? "bg-white" : "bg-slate-100"}`}>
                                        {option.icon}
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-sm">{option.label}</div>
                                        <div className="text-[10px] opacity-80 font-normal">{option.desc}</div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    )}

                    {!isDelivered && (
                        <div className="flex items-start gap-2 p-3 bg-blue-50/50 rounded text-xs text-blue-700">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <p>
                                Marking as <span className="font-bold">Delivered</span> is only available via the Delivery Management page.
                            </p>
                        </div>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
};
