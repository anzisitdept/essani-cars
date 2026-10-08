import { useState } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { addToHistory } from "@/utils/vehicleHistory";
import { Building2, Truck, Hand, PackageOpen } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReturnedToShowroomDialogProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
    onSuccess: () => void;
}

export const ReturnedToShowroomDialog = ({ isOpen, onClose, vehicle, onSuccess }: ReturnedToShowroomDialogProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [method, setMethod] = useState<string>("hand");
    const [details, setDetails] = useState<string>("");
    const [newRegNo, setNewRegNo] = useState<string>("");
    const [newPlatesIssued, setNewPlatesIssued] = useState<boolean>(false);
    const [newPlateStatus, setNewPlateStatus] = useState<string>("Showroom");

    const handleConfirm = async () => {
        if (!user || !vehicle) return;
        setLoading(true);

        const newStatus = "Returned Back to Showroom";
        const methodLabel = method === "courier" ? "Sent through Courier" : "Sent through Hand";

        try {
            // Update vehicle document status and return details
            const updateData: any = {
                fileStatus: newStatus,
                returnedToShowroomMethod: methodLabel,
                returnedToShowroomDetails: details,
                newPlatesIssued: newPlatesIssued,
                updatedAt: serverTimestamp()
            };

            const updatedRegNo = newRegNo.trim().toUpperCase();
            if (updatedRegNo) {
                updateData.newRegistrationNumber = updatedRegNo;
                if (vehicle.registrationNumber && vehicle.registrationNumber !== updatedRegNo) {
                    updateData.oldRegistrationNumber = vehicle.registrationNumber;
                }
                updateData.registrationNumber = updatedRegNo;
            }

            if (newPlatesIssued) {
                updateData.newPlateStatus = newPlateStatus;
                if (vehicle.plateStatus) {
                    updateData.oldPlateStatus = vehicle.plateStatus;
                }
                // If plates location is Showroom, ensure platesAvailable is true
                if (newPlateStatus === "Showroom") {
                    updateData.platesAvailable = true;
                }
            }

            await updateDoc(doc(db, "cars", vehicle.id), updateData);

            const detailsStr = `Returned via ${methodLabel}. Details: ${details}` +
                (updatedRegNo ? `. New Reg No: ${updatedRegNo}` : "") +
                (newPlatesIssued ? `. New Plates Issued: Yes (Status: ${newPlateStatus})` : "");

            // Log the action
            await addDoc(collection(db, "logs"), {
                action: `Updated Doc Status: ${newStatus}`,
                vehicleId: vehicle.id,
                details: detailsStr,
                performedBy: user.uid,
                timestamp: serverTimestamp(),
                type: "STATUS_UPDATE"
            });

            // Add to Vehicle History
            await addToHistory(
                vehicle.id,
                "Document Returned to Showroom",
                detailsStr,
                user.uid,
                {
                    type: "FILE",
                    status: newStatus,
                    method: methodLabel,
                    details: details,
                    newPlatesIssued: newPlatesIssued,
                    ...(newPlatesIssued && { newPlateStatus: newPlateStatus }),
                    ...(updatedRegNo && {
                        newRegistrationNumber: updatedRegNo,
                        oldRegistrationNumber: vehicle.registrationNumber || ""
                    })
                }
            );

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error updating return status:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="text-blue-600" size={20} />
                        Return Documents to Showroom
                    </DialogTitle>
                    <DialogDescription>
                        Specify how the documents are being returned to the showroom.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-5">
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Delivery Method</Label>
                        <RadioGroup value={method} onValueChange={setMethod} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <RadioGroupItem value="courier" id="courier" className="peer sr-only" />
                                <Label
                                    htmlFor="courier"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-slate-100 bg-white p-4 hover:bg-slate-50 hover:text-slate-900 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 [&:has([data-state=checked])]:border-blue-500 cursor-pointer transition-all h-full"
                                >
                                    <Truck className="mb-2 h-6 w-6 text-slate-500 peer-data-[state=checked]:text-blue-600" />
                                    <span className="font-medium text-center">Through Courier</span>
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="hand" id="hand" className="peer sr-only" />
                                <Label
                                    htmlFor="hand"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-slate-100 bg-white p-4 hover:bg-slate-50 hover:text-slate-900 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 [&:has([data-state=checked])]:border-blue-500 cursor-pointer transition-all h-full"
                                >
                                    <Hand className="mb-2 h-6 w-6 text-slate-500 peer-data-[state=checked]:text-blue-600" />
                                    <span className="font-medium text-center">Through Hand</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="newRegNo" className="text-base font-semibold">New Registration No. (Optional)</Label>
                        <Input
                            id="newRegNo"
                            placeholder="Enter new registration number..."
                            value={newRegNo}
                            onChange={(e) => setNewRegNo(e.target.value)}
                            className="font-mono uppercase"
                        />
                    </div>

                    {/* New Number Plates Issued Toggle */}
                    <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="newPlatesIssued" className="font-bold text-sm text-purple-900 cursor-pointer">
                                    New number plates issue?
                                </Label>
                                <p className="text-[11px] text-purple-700">Has Excise issued new number plates for this vehicle?</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="newPlatesIssued"
                                    className="sr-only peer"
                                    checked={newPlatesIssued}
                                    onChange={(e) => setNewPlatesIssued(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>

                        {newPlatesIssued && (
                            <div className="pt-2 border-t border-purple-200/60 space-y-2">
                                <Label className="text-xs font-semibold text-purple-900">Current Location / Status of New Plates</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {[
                                        { id: "Showroom", label: "Showroom" },
                                        { id: "At Excise", label: "At Excise" },
                                        { id: "Delivered to Customer", label: "Delivered" }
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setNewPlateStatus(opt.id)}
                                            className={`px-2 py-1.5 text-xs font-semibold rounded border transition-colors ${newPlateStatus === opt.id
                                                    ? "bg-purple-600 text-white border-purple-600"
                                                    : "bg-white text-purple-800 border-purple-200 hover:bg-purple-100"
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="details" className="text-base font-semibold">Additional Details</Label>
                        <Textarea
                            id="details"
                            placeholder="Enter courier tracking number, person name, or other relevant details..."
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            className="min-h-[80px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? "Updating..." : "Confirm Return"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
