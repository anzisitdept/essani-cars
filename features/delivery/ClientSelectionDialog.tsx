"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { addToHistory } from "@/utils/vehicleHistory";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Phone, MapPin, CheckCircle, Loader2, Package, FileText, Search, ChevronsUpDown, Check } from "lucide-react";
import { DocumentData } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface Client {
    id: string;
    name: string;
    phone: string;
    email?: string;
    cnic?: string;
    address?: string;
}

interface Vehicle extends DocumentData {
    id: string;
    model: string;
    brandName?: string;
    chassisNumber: string;
    registrationNumber?: string;
    registrationReason?: string;
    fileStatus?: string;
    plateStatus?: string;
}

interface ClientSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: Vehicle | null;
    deliveryType: "DOCUMENT" | "PLATE";
    onSuccess?: () => void;
}

export const ClientSelectionDialog = ({
    isOpen,
    onClose,
    vehicle,
    deliveryType,
    onSuccess
}: ClientSelectionDialogProps) => {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [openCombobox, setOpenCombobox] = useState(false); // Popover state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Fetch clients
    useEffect(() => {
        const q = query(collection(db, "clients"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        });
        return () => unsubscribe();
    }, []);

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedClientId("");
            setSearchTerm("");
            setError("");
        }
    }, [isOpen]);

    const selectedClient = clients.find(c => c.id === selectedClientId);
    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
    );

    const handleConfirmDelivery = async () => {
        if (!selectedClient || !vehicle || !user) return;

        setLoading(true);
        setError("");

        try {
            const deliveryData = {
                deliveryType: deliveryType,
                deliveredTo: {
                    clientId: selectedClient.id,
                    clientName: selectedClient.name,
                    clientPhone: selectedClient.phone,
                    clientAddress: selectedClient.address || ""
                },
                deliveredBy: user.uid,
                deliveredAt: serverTimestamp(),
                previousStatus: deliveryType === "DOCUMENT" ? vehicle.fileStatus : vehicle.plateStatus,
                newStatus: deliveryType === "DOCUMENT" ? "Delivered" : "Delivered to Customer",
                vehicleDetails: {
                    model: `${vehicle.brandName || ""} ${vehicle.model}`.trim(),
                    chassisNumber: vehicle.chassisNumber,
                    registrationNumber: vehicle.registrationNumber || "Unregistered"
                }
            };

            // Create delivery record in subcollection
            const deliveryRef = await addDoc(collection(db, "cars", vehicle.id, "deliveries"), deliveryData);

            // Update vehicle status
            const statusField = deliveryType === "DOCUMENT" ? "fileStatus" : "plateStatus";
            const newStatus = deliveryType === "DOCUMENT" ? "Delivered" : "Delivered to Customer";

            // Prepare update data with delivery-specific fields
            const updateData: any = {
                [statusField]: newStatus,
                updatedAt: serverTimestamp()
            };

            // Store delivery recipient info based on delivery type
            if (deliveryType === "DOCUMENT") {
                updateData.docDeliveredToName = selectedClient.name;
                updateData.docDeliveredToPhone = selectedClient.phone;
                updateData.docDeliveredToClientId = selectedClient.id;
            } else {
                updateData.plateDeliveredToName = selectedClient.name;
                updateData.plateDeliveredToPhone = selectedClient.phone;
                updateData.plateDeliveredToClientId = selectedClient.id;
            }

            await updateDoc(doc(db, "cars", vehicle.id), updateData);

            // Add to Vehicle History
            await addToHistory(
                vehicle.id,
                deliveryType === "DOCUMENT" ? "Document Delivered" : "Plate Delivered",
                `Delivered to ${selectedClient.name} (${selectedClient.phone})`,
                user.uid,
                { deliveryId: deliveryRef.id }
            );

            // Success
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error("Delivery error:", err);
            setError("Failed to process delivery. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!vehicle) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {deliveryType === "DOCUMENT" ? <FileText size={20} /> : <Package size={20} />}
                        Confirm {deliveryType === "DOCUMENT" ? "Document" : "Plate"} Delivery
                    </DialogTitle>
                    <DialogDescription>
                        Select the client receiving this delivery
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Vehicle Summary */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Vehicle Details</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-slate-500">Model:</span>
                                <span className="ml-2 font-semibold">{vehicle.brandName} {vehicle.model}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Chassis:</span>
                                <span className="ml-2 font-mono text-xs">{vehicle.chassisNumber}</span>
                            </div>
                            {vehicle.registrationReason && (
                                <div className="col-span-2">
                                    <span className="text-slate-500">Reason:</span>
                                    <span className="ml-2 font-medium">{vehicle.registrationReason}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Client Selection (Searchable) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select Client *</label>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between bg-white font-normal hover:bg-slate-50 border-slate-200"
                                >
                                    {selectedClient ? (
                                        <span className="truncate flex items-center gap-2">
                                            <span className="font-semibold">{selectedClient.name}</span>
                                            <span className="text-slate-400 text-xs">| {selectedClient.phone}</span>
                                        </span>
                                    ) : (
                                        <span className="text-slate-500">Search & Select Client...</span>
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                                <div className="flex items-center border-b px-3">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <Input
                                        placeholder="Search by name or number..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 border-none focus-visible:ring-0 px-0"
                                    />
                                </div>
                                <div className="max-h-[300px] overflow-y-auto p-1">
                                    {filteredClients.length === 0 ? (
                                        <div className="py-6 text-center text-sm text-slate-500 flex flex-col items-center">
                                            <User className="h-8 w-8 mb-2 opacity-20" />
                                            No client found.
                                        </div>
                                    ) : (
                                        filteredClients.map((client) => (
                                            <div
                                                key={client.id}
                                                onClick={() => {
                                                    setSelectedClientId(client.id);
                                                    setOpenCombobox(false);
                                                    setSearchTerm("");
                                                }}
                                                className={cn(
                                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 cursor-pointer transition-colors",
                                                    selectedClientId === client.id ? "bg-blue-50 text-blue-700" : "text-slate-900"
                                                )}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4 shrink-0",
                                                        selectedClientId === client.id ? "opacity-100 text-blue-600" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{client.name}</span>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Phone size={10} />
                                                        <span>{client.phone}</span>
                                                        {client.address && <span className="truncate max-w-[150px] opacity-70"> • {client.address}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Selected Client Details */}
                    {selectedClient && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle size={16} className="text-green-600" />
                                <h4 className="text-sm font-bold text-green-900">Selected Client</h4>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <User size={14} className="text-green-600" />
                                    <span className="font-semibold">{selectedClient.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-green-600" />
                                    <span>{selectedClient.phone}</span>
                                </div>
                                {selectedClient.address && (
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} className="text-green-600" />
                                        <span>{selectedClient.address}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDelivery}
                        disabled={!selectedClientId || loading}
                        className="bg-slate-900 hover:bg-slate-800"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Confirm Delivery
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
