import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Car, Calendar, Zap, Fuel, Settings2, FileText, User, Hash, MapPin, Phone, CreditCard, PenTool } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDate } from "@/lib/dateUtils";
import { useAuth } from "@/context/AuthContext";

interface DocumentDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any;
}

export const DocumentDeliveryModal = ({ isOpen, onClose, vehicle }: DocumentDeliveryModalProps) => {
    const { user, userData } = useAuth();
    const [currentOwner, setCurrentOwner] = useState<any>(null);
    const [regOwner, setRegOwner] = useState<any>(null);
    const [deliveryRecipient, setDeliveryRecipient] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!vehicle) return;

        const fetchClients = async () => {
            if (vehicle.ownerId) {
                try {
                    const snap = await getDoc(doc(db, "clients", vehicle.ownerId));
                    if (snap.exists()) setCurrentOwner(snap.data());
                } catch (e) { console.error(e); }
            } else {
                setCurrentOwner(null);
            }

            if (vehicle.registeredOwnerId) {
                try {
                    const snapRq = await getDoc(doc(db, "clients", vehicle.registeredOwnerId));
                    if (snapRq.exists()) setRegOwner(snapRq.data());
                } catch (e) { console.error(e); }
            } else {
                setRegOwner(null);
            }

            // Fetch Document Delivery Recipient
            if (vehicle.docDeliveredToClientId) {
                try {
                    const snapDr = await getDoc(doc(db, "clients", vehicle.docDeliveredToClientId));
                    if (snapDr.exists()) setDeliveryRecipient(snapDr.data());
                } catch (e) { console.error(e); }
            } else {
                setDeliveryRecipient(null);
            }
        };

        fetchClients();
    }, [vehicle]);

    if (!isOpen || !vehicle) return null;

    const handlePrint = () => {
        window.print();
    };

    const DetailRow = ({ label, value, icon: Icon }: { label: string, value: string | number | undefined, icon?: any }) => (
        <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-2 text-slate-500">
                {Icon && <Icon size={14} />}
                <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 text-right">{value || "Not Set"}</span>
        </div>
    );

    const DeliveryDocument = () => (
        <div className="bg-white p-8 md:p-12 max-w-4xl mx-auto text-slate-900 font-sans relative">

            {/* --- Header --- */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                <div className="flex flex-col">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/carlogo.png" alt="Caruzen" className="h-16 w-auto object-contain mb-4 -ml-2" />
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">Document Delivery Note</h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">Official Handover Document</p>
                </div>
                <div className="text-right space-y-1">
                    <div className="bg-emerald-700 text-white px-4 py-1.5 text-sm font-bold tracking-widest inline-block mb-2">
                        DELIVERED
                    </div>
                    <p className="text-xs text-slate-400 uppercase font-bold">Delivered By</p>
                    <p className="text-sm font-semibold">{userData?.name || user?.displayName || "Staff"}</p>
                    <p className="text-xs text-slate-400 uppercase font-bold mt-2">Delivery Date</p>
                    <p className="text-sm font-mono">{formatDate(new Date().toISOString())}</p>
                </div>
            </div>

            {/* --- Main Vehicle Identity --- */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8 print:border-slate-300">
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Make & Model</p>
                        <h2 className="text-2xl font-bold text-slate-900">{vehicle.brandName} {vehicle.model}</h2>
                        <p className="text-lg text-slate-600">{vehicle.variant}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Registration No.</p>
                            <div className="font-mono text-lg font-bold bg-white border border-slate-200 px-3 py-1 inline-block rounded">
                                {vehicle.registrationNumber || "UNREGISTERED"}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Chassis No.</p>
                            <p className="text-lg font-mono font-bold">{vehicle.chassisNumber}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-8">
                {/* --- Key Specs --- */}
                <div>
                    <h3 className="text-sm font-bold uppercase text-slate-900 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <Settings2 size={16} /> Vehicle Details
                    </h3>
                    <div className="space-y-1">
                        <DetailRow label="Engine Number" value={vehicle.engineNumber} icon={Hash} />
                        <DetailRow label="Exterior Color" value={vehicle.color} icon={Car} />
                        <DetailRow label="Model Year" value={vehicle.modelYear} icon={Calendar} />
                        <DetailRow label="Vehicle CC" value={vehicle.vehicleCC} icon={Zap} />
                        <DetailRow label="Source" value={vehicle.vehicleSource} icon={Fuel} />
                    </div>
                </div>

                {/* --- Recipient Details (Who documents were delivered to) --- */}
                <div>
                    <h3 className="text-sm font-bold uppercase text-slate-900 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <User size={16} /> Documents Delivered To
                    </h3>
                    <div className="space-y-1">
                        <DetailRow label="Recipient Name" value={deliveryRecipient?.name || vehicle.docDeliveredToName || vehicle.ownerName} />
                        <DetailRow label="Phone" value={deliveryRecipient?.phone || vehicle.docDeliveredToPhone || vehicle.ownerContact} icon={Phone} />
                        <DetailRow label="CNIC / ID" value={deliveryRecipient?.cnic} icon={CreditCard} />
                        <DetailRow label="Address" value={deliveryRecipient?.address} icon={MapPin} />
                        {vehicle.deliveryNotes && <DetailRow label="Notes" value={vehicle.deliveryNotes} />}
                    </div>
                </div>
            </div>

            {/* --- Signatures Section --- */}
            <div className="mt-16 mb-8">
                <h3 className="text-sm font-bold uppercase text-slate-900 mb-6 border-b border-slate-200 pb-2 flex items-center gap-2">
                    <PenTool size={16} /> Acknowledgement
                </h3>
                <p className="text-xs text-slate-500 mb-8 italic">
                    By signing below, I acknowledge that I have received the vehicle documents described above in good condition and as agreed.
                </p>

                <div className="grid grid-cols-2 gap-12 mt-12">
                    <div>
                        {deliveryRecipient?.signatureUrl && (
                            <div className="mb-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={deliveryRecipient.signatureUrl}
                                    alt="Client signature"
                                    className="max-h-16 object-contain"
                                />
                            </div>
                        )}
                        <div className="border-t-2 border-slate-300 pt-2">
                            <p className="text-sm font-bold text-slate-900 uppercase">Received By</p>
                            <p className="text-xs text-slate-500 mt-1">Client Signature & Date</p>
                        </div>
                    </div>
                    <div>
                        {userData?.signatureUrl && (
                            <div className="mb-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={userData.signatureUrl}
                                    alt="Staff signature"
                                    className="max-h-16 object-contain"
                                />
                            </div>
                        )}
                        <div className="border-t-2 border-slate-300 pt-2">
                            <p className="text-sm font-bold text-slate-900 uppercase">Authorized By</p>
                            <p className="text-xs text-slate-500 mt-1">Showroom Representative</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Footer --- */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-500 uppercase tracking-wider">
                <div>
                    <p>Caruzen Tracking System</p>
                    <p>Generated by Anzi & Co.</p>
                </div>
                <div className="text-right">
                    <p>Scan for Digital Record</p>
                    <p className="font-mono text-xs text-slate-900">{vehicle.barcode || vehicle.chassisNumber}</p>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <style jsx global>{`
        @media print {
          /* Hide everything in body except our portal */
          body > *:not(#print-portal-root) {
            display: none !important;
          }
          
          /* Ensure body is ready for print */
          body {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Show our portal content */
          #print-portal-root {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white;
            z-index: 9999;
          }
        }
      `}</style>

            {/* Screen Preview Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 print-hide">
                <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl bg-white overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Printer className="text-slate-500" size={20} />
                            <h3 className="font-semibold text-slate-700">Print Preview - Document Delivery Note</h3>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handlePrint} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
                                <Printer size={16} /> Print Note
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X size={18} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-8">
                            <div className="shadow-2xl shadow-slate-200 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white">
                                <DeliveryDocument />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Print Layer - Rendered directly into body to avoid layout issues */}
            {mounted && createPortal(
                <div id="print-portal-root">
                    <DeliveryDocument />
                </div>,
                document.body
            )}
        </>
    );
};
