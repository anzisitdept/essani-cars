"use client";

import { useMemo, useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    CarFront, Calendar, Fuel, Zap, Ban, CheckCircle2,
    FileText, User, Printer, ScanBarcode, Pencil, Trash2,
    ShieldCheck, Truck, AlertTriangle, Image as ImageIcon, Phone, Mail, CreditCard, MapPin, Settings2, Copy, Check
} from "lucide-react";
import { VehicleDetailModal } from "./VehicleDetailModal";
import { DocStatusDialog } from "./DocStatusDialog";
import { PlateStatusDialog } from "./PlateStatusDialog";
import { cn } from "@/lib/utils";

interface VehicleGameCardProps {
    vehicle: any;
    onEdit: (v: any) => void;
    onDelete: (id: string) => void;
    onPrintDetail: (v: any) => void;
    onPrintDelivery: (v: any) => void;
    onPrintBarcode: (v: any) => void;
    onOpenAssets: (v: any) => void;

}

const ClientField = ({ label, value, icon: Icon }: { label: string, value?: string, icon: any }) => {
    const [copied, setCopied] = useState(false);
    if (!value) return null;

    return (
        <div className="flex items-start gap-2 group">
            <Icon size={14} className="text-slate-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">{label}</p>
                <div className="flex items-center justify-between gap-1">
                    <p className="font-medium truncate pr-1">{value}</p>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(value);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 shrink-0"
                        title="Copy to clipboard"
                    >
                        {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const VehicleGameCard = ({ vehicle, onEdit, onDelete, onPrintDetail, onPrintDelivery, onPrintBarcode, onOpenAssets }: VehicleGameCardProps) => {
    const [clientDetails, setClientDetails] = useState<any>({});
    const [loadingClients, setLoadingClients] = useState<Set<string>>(new Set());
    const [showDetail, setShowDetail] = useState(false);
    const [showDocStatus, setShowDocStatus] = useState(false);
    const [showPlateDialog, setShowPlateDialog] = useState(false);

    // Status Color Logic (Neon/Gaming Palette - Light Mode)


    // Document Status Color Logic
    const docStatusColor = useMemo(() => {
        const s = (vehicle.fileStatus || "").toLowerCase();
        if (s.includes("delivered")) return "text-emerald-700 border-emerald-200 bg-emerald-50";
        if (s.includes("excise")) return "text-purple-700 border-purple-200 bg-purple-50";
        if (s.includes("returned")) return "text-amber-700 border-amber-200 bg-amber-50";
        if (s.includes("showroom") || s.includes("applied")) return "text-blue-700 border-blue-200 bg-blue-50";
        return "text-slate-600 border-slate-200 bg-slate-100";
    }, [vehicle.fileStatus]);

    // Keep Glow Logic based on execution status if needed, or default
    const glowColor = useMemo(() => {
        switch (vehicle.currentStatus) {
            case 'SHOWROOM': return "from-cyan-400 to-blue-500";
            case 'DELIVERED': return "from-emerald-400 to-green-500";
            case 'TRANSIT': return "from-indigo-400 to-purple-500";
            case 'EXCISE': return "from-purple-400 to-pink-500";
            default: return "from-slate-400 to-slate-500";
        }
    }, [vehicle.currentStatus]);

    // Fetch client details when needed
    const fetchClientDetails = async (clientId: string) => {
        if (!clientId || clientDetails[clientId] || loadingClients.has(clientId)) return;

        setLoadingClients(prev => new Set(prev).add(clientId));
        try {
            const clientDoc = await getDoc(doc(db, "clients", clientId));
            if (clientDoc.exists()) {
                setClientDetails((prev: any) => ({
                    ...prev,
                    [clientId]: { id: clientId, ...clientDoc.data() }
                }));
            }
        } catch (error) {
            console.error("Error fetching client:", error);
        } finally {
            setLoadingClients(prev => {
                const newSet = new Set(prev);
                newSet.delete(clientId);
                return newSet;
            });
        }
    };

    // Client Popover Component
    const ClientPopover = ({ clientId, clientName, children }: { clientId?: string; clientName: string; children: React.ReactNode }) => {
        if (!clientId) return <>{children}</>;

        const client = clientDetails[clientId];

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        className="hover:underline cursor-pointer focus:outline-none"
                        onClick={() => fetchClientDetails(clientId)}
                    >
                        {children}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                    {client ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <User size={18} className="text-blue-600" />
                                <h4 className="font-bold text-sm">Client Details</h4>
                            </div>
                            <div className="space-y-2 text-sm">
                                <ClientField label="Name" value={client.name} icon={User} />
                                <ClientField label="Father Name" value={client.fatherName} icon={User} />
                                <ClientField label="Phone" value={client.phone} icon={Phone} />
                                <ClientField label="Email" value={client.email} icon={Mail} />
                                <ClientField label="CNIC" value={client.cnic} icon={CreditCard} />
                                <ClientField label="Address" value={client.address} icon={MapPin} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        );
    };

    return (
        <div className="relative group perspective-1000">
            {/* Glow Effect - Subtle on Light Mode */}
            <div className={cn(
                "absolute -inset-0.5 bg-gradient-to-r rounded-xl opacity-0 group-hover:opacity-100 transition duration-500",
                vehicle.currentStatus === 'SHOWROOM' ? "from-cyan-400 to-blue-500" :
                    vehicle.currentStatus === 'DELIVERED' ? "from-emerald-400 to-green-500" :
                        "from-indigo-400 to-purple-500"
            )}></div>

            {/* Main Card Content */}
            <div className={cn(
                "relative flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-xl",
                "transition-all duration-300 hover:transform hover:-translate-y-1"
            )}>

                {/* --- 1. Header Section (Hero) --- */}
                <div className="relative p-4 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full select-none", docStatusColor)}>
                                        {vehicle.fileStatus || 'Not Applied'}
                                    </Badge>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowDocStatus(true);
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors z-20 relative"
                                        title="Update Document Status"
                                    >
                                        <FileText size={12} />
                                    </button>
                                </div>
                                {vehicle.registrationNumber && (
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                        {vehicle.registrationNumber}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                {vehicle.brandName} <span className="text-slate-500 font-normal">{vehicle.model}</span>
                            </h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">
                                {vehicle.variant || "Base Edition"}
                            </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
                            <CarFront size={20} />
                        </div>
                    </div>
                </div>

                {/* --- 2. Stats Grid (Tech Specs) --- */}
                <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                    <div className="p-3 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1.5"><Calendar size={12} /> Year</span>
                            <span className="text-slate-900 font-mono font-medium">{vehicle.year}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1.5"><Fuel size={12} /> Fuel</span>
                            <span className="text-slate-900 font-mono font-medium">{vehicle.fuelType}</span>
                        </div>
                    </div>
                    <div className="p-3 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1.5"><Zap size={12} /> Trans</span>
                            <span className="text-slate-900 font-mono font-medium">{vehicle.transmission?.substring(0, 4)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: vehicle.color || '#fff' }}></div> Color</span>
                            <span className="text-slate-900 font-mono font-medium truncate max-w-[60px]" title={vehicle.color}>{vehicle.color}</span>
                        </div>
                    </div>
                </div>

                {/* --- 3. Diagnostics (Workflow Status) --- */}
                <div className="p-4 space-y-3 bg-white">
                    {/* Document Status */}
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={14} className={vehicle.docsApplied === false ? "text-red-500" : "text-blue-500"} />
                                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Docs</span>
                            </div>
                            <span className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                vehicle.docsApplied === false ? "text-red-600 bg-red-50" : "text-blue-600 bg-blue-50"
                            )}>
                                {vehicle.docsApplied === false ? "MISSING" : (vehicle.fileStatus || "APPLIED").toUpperCase()}
                            </span>
                        </div>
                        {/* Excise Type Display */}
                        {vehicle.fileStatus === "At Excise" && vehicle.exciseType && (
                            <div className="flex items-center gap-1.5 pl-5 pt-1">
                                <span className="text-[9px] text-purple-600 font-medium bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 truncate w-full">
                                    {vehicle.exciseType}
                                </span>
                            </div>
                        )}
                        {/* Excise Type Details */}
                        {vehicle.fileStatus === "At Excise" && (
                            <div className="pl-5 pt-1 space-y-1">
                                {vehicle.exciseMethod && (
                                    <div className="flex items-center gap-1.5">
                                        <Truck size={10} className="text-purple-600" />
                                        <span className="text-[9px] text-purple-700 font-medium">
                                            {vehicle.exciseMethod}
                                        </span>
                                    </div>
                                )}
                                {vehicle.exciseDetails && (
                                    <span className="block text-[9px] text-slate-500 bg-slate-50 p-1 rounded border border-slate-100 line-clamp-2" title={vehicle.exciseDetails}>
                                        {vehicle.exciseDetails}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Returned to Showroom Details */}
                        {vehicle.fileStatus === "Returned Back to Showroom" && (
                            <div className="pl-5 pt-1 space-y-1">
                                {vehicle.returnedToShowroomMethod && (
                                    <div className="flex items-center gap-1.5">
                                        <Truck size={10} className="text-amber-600" />
                                        <span className="text-[9px] text-amber-700 font-medium">
                                            {vehicle.returnedToShowroomMethod}
                                        </span>
                                    </div>
                                )}
                                {vehicle.returnedToShowroomDetails && (
                                    <div className="text-[9px] text-slate-500 bg-slate-50 p-1 rounded border border-slate-100 line-clamp-2" title={vehicle.returnedToShowroomDetails}>
                                        {vehicle.returnedToShowroomDetails}
                                    </div>
                                )}
                            </div>
                        )}

                        {vehicle.fileStatus?.toLowerCase().includes("delivered") && vehicle.docDeliveredToName && (
                            <div className="flex items-center gap-1.5 pl-5">
                                <User size={10} className="text-emerald-600" />
                                <ClientPopover clientId={vehicle.docDeliveredToClientId} clientName={vehicle.docDeliveredToName}>
                                    <span className="text-[9px] text-emerald-700 font-medium truncate" title={vehicle.docDeliveredToName}>
                                        To: {vehicle.docDeliveredToName}
                                    </span>
                                </ClientPopover>
                            </div>
                        )}
                    </div>

                    {/* Plate Status */}
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard size={14} className={vehicle.plateStatus === 'Never Applied' ? "text-slate-400" : "text-purple-500"} />
                                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Plates</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className={cn(
                                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                    vehicle.plateStatus === 'Never Applied' ? "text-slate-500 bg-slate-100" : "text-purple-600 bg-purple-50"
                                )}>
                                    {(vehicle.plateStatus || "NEVER APPLIED").toUpperCase()}
                                </span>
                                {vehicle.plateStatus !== 'Never Applied' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPlateDialog(true);
                                        }}
                                        className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors z-20 relative"
                                        title="Update Plate Status"
                                    >
                                        <Settings2 size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {vehicle.plateStatus?.toLowerCase().includes("delivered") && vehicle.plateDeliveredToName && (
                            <div className="flex items-center gap-1.5 pl-5">
                                <User size={10} className="text-emerald-600" />
                                <ClientPopover clientId={vehicle.plateDeliveredToClientId} clientName={vehicle.plateDeliveredToName}>
                                    <span className="text-[9px] text-emerald-700 font-medium truncate" title={vehicle.plateDeliveredToName}>
                                        To: {vehicle.plateDeliveredToName}
                                    </span>
                                </ClientPopover>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- 4. Identity Block (Terminal Style) --- */}
                <div className="px-4 pb-4">
                    <div className="bg-slate-50/80 border border-slate-200 rounded p-2 font-mono text-[10px] space-y-1">
                        <div className="flex justify-between">
                            <span className="text-slate-500">CHASSIS:</span>
                            <span className="text-slate-900 font-medium">{vehicle.chassisNumber}</span>
                        </div>
                        {vehicle.registrationReason && (
                            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                                <span className="text-slate-500">REG. REASON:</span>
                                <span className="text-slate-900 font-medium">{vehicle.registrationReason}</span>
                            </div>
                        )}
                        {vehicle.vehicleCC && (
                            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                                <span className="text-slate-500">ENGINE CC:</span>
                                <span className="text-slate-900 font-medium">{vehicle.vehicleCC}</span>
                            </div>
                        )}
                        {vehicle.ownerName && (
                            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                                <span className="text-slate-500">CURRENT OWNER:</span>
                                <ClientPopover clientId={vehicle.ownerId} clientName={vehicle.ownerName}>
                                    <span className="text-blue-600 font-medium truncate max-w-[120px]" title={vehicle.ownerName}>
                                        {vehicle.ownerName}
                                    </span>
                                </ClientPopover>
                            </div>
                        )}
                        {vehicle.registeredOwnerName && (
                            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                                <span className="text-slate-500">REG. OWNER:</span>
                                <ClientPopover clientId={vehicle.registeredOwnerId} clientName={vehicle.registeredOwnerName}>
                                    <span className="text-purple-600 font-medium truncate max-w-[120px]" title={vehicle.registeredOwnerName}>
                                        {vehicle.registeredOwnerName}
                                    </span>
                                </ClientPopover>
                            </div>
                        )}
                        {vehicle.currentStatus === 'DELIVERED' && vehicle.deliveredToName && (
                            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                                <span className="text-slate-500">DELIVERED TO:</span>
                                <ClientPopover clientId={vehicle.deliveredToClientId} clientName={vehicle.deliveredToName}>
                                    <span className="text-emerald-600 font-medium truncate max-w-[120px]" title={vehicle.deliveredToName}>
                                        {vehicle.deliveredToName}
                                    </span>
                                </ClientPopover>
                            </div>
                        )}
                        {vehicle.barcode && (
                            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                                <span className="text-slate-500">BARCODE:</span>
                                <span className="text-yellow-600 font-medium">{vehicle.barcode}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- 5. Action Footer --- */}
                <div className="mt-auto p-3 border-t border-slate-100 bg-slate-50/50 flex gap-2">
                    <Button onClick={() => onPrintDetail(vehicle)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50">
                        <Printer size={16} />
                    </Button>
                    {vehicle.fileStatus?.toLowerCase().includes('delivered') && (
                        <Button onClick={() => onPrintDelivery(vehicle)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" title="Print Delivery Note">
                            <FileText size={16} />
                        </Button>
                    )}
                    <Button onClick={() => onPrintBarcode(vehicle)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50">
                        <ScanBarcode size={16} />
                    </Button>
                    <Button onClick={() => onOpenAssets(vehicle)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-purple-600 hover:bg-purple-50" title="Manage Assets">
                        <ImageIcon size={16} />
                    </Button>
                    <div className="ml-auto flex gap-2">
                        <Button onClick={() => onEdit(vehicle)} variant="ghost" size="sm" className="h-8 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-200">
                            <Pencil size={12} className="mr-1" /> EDIT
                        </Button>
                        <Button onClick={() => onDelete(vehicle.id)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 size={16} />
                        </Button>
                    </div>
                </div>

            </div>
            {/* Modals */}
            <VehicleDetailModal
                isOpen={showDetail}
                onClose={() => setShowDetail(false)}
                vehicle={vehicle}
            />
            {showDocStatus && (
                <DocStatusDialog
                    isOpen={showDocStatus}
                    onClose={() => setShowDocStatus(false)}
                    vehicle={vehicle}
                />
            )}
            {showPlateDialog && (
                <PlateStatusDialog
                    isOpen={showPlateDialog}
                    onClose={() => setShowPlateDialog(false)}
                    vehicle={vehicle}
                />
            )}
        </div>
    );
};
