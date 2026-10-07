"use client";
import { X, Printer, CarFront, CheckCircle, FileText, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dateUtils";
import { DocumentData } from "firebase/firestore";

export type DeliveryType = 'VEHICLE' | 'FILE' | 'PLATE';

interface Car extends DocumentData {
  id: string;
  chassisNumber: string;
  engineNumber?: string;
  model: string;
  ownerName: string;
  ownerContact?: string;
  registrationNumber?: string;
  currentStatus?: string; // Made optional to fix type error
  fileStatus?: string;
  plateStatus?: string;
}

interface DeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  car: Car | null;
  type: DeliveryType;
}

export const DeliveryModal = ({ isOpen, onClose, car, type }: DeliveryModalProps) => {
  if (!isOpen || !car) return null;

  const handlePrint = () => {
    window.print();
  };

  // --- Dynamic Content Configuration ---
  const getContent = () => {
    switch (type) {
      case 'FILE':
        return {
          title: "File Handover Note",
          subtitle: "Original Documents Transfer",
          icon: <FileText size={32} />,
          status: car.fileStatus || "N/A",
          declaration: `I, ${car.ownerName}, acknowledge the receipt of the original vehicle file and related transfer documents. I have verified the contents and found them to be complete.`
        };
      case 'PLATE':
        return {
          title: "Plates Handover Note",
          subtitle: "Official Number Plates Delivery",
          icon: <CreditCard size={32} />,
          status: car.plateStatus || "N/A",
          declaration: `I, ${car.ownerName}, confirm the receipt of the official number plates for the vehicle mentioned above. The plates are in good condition and match the registration details.`
        };
      default: // VEHICLE
        return {
          title: "Vehicle Delivery Note",
          subtitle: "Official Vehicle Handover",
          icon: <CarFront size={32} />,
          status: "DELIVERED TO CLIENT", // Use hardcoded status for vehicle delivery since main status is removed
          declaration: `I, ${car.ownerName}, hereby confirm that I have inspected the vehicle described above and received it in good order and condition. I acknowledge that all necessary accessories and keys have been handed over.`
        };
    }
  };

  const content = getContent();

  const DeliveryDocument = () => (
    <div className="bg-white p-8 md:p-12 max-w-3xl mx-auto text-slate-900 font-sans relative">
      
      {/* --- Header --- */}
      <div className="flex flex-col items-center justify-center mb-10">
        <div className="h-20 w-60 text-white flex items-center justify-center mb-3  print:text-slate-900 print:bg-transparent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/carlogo.png" alt="Essani Logo" className="h-20 w-60" />
        </div>
      </div>

      {/* Document Title & Date */}
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold uppercase text-slate-900 leading-none">{content.title}</h2>
          <p className="text-sm text-slate-500 font-medium mt-2">{content.subtitle}</p>
        </div>
        <div className="text-right">
           <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Date of Issue</p>
           <p className="text-lg font-mono font-medium">{formatDate(new Date().toISOString())}</p>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-8 flex items-center gap-3 text-slate-800 bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-transparent print:border-slate-300">
        <CheckCircle className="w-5 h-5 text-slate-900" />
        <div>
            <p className="text-xs uppercase text-slate-500 font-bold">Current Status</p>
            <p className="font-bold text-sm uppercase">{content.status}</p>
        </div>
      </div>

      {/* Vehicle Reference */}
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase text-slate-900 mb-4 border-b border-slate-100 pb-2 tracking-wide">Reference Vehicle</h3>
        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Model</p>
            <p className="font-semibold text-lg">{car.model}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Chassis Number</p>
            <p className="font-mono text-lg">{car.chassisNumber}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Registration No.</p>
            <p className="font-mono text-lg">{car.registrationNumber || "Unregistered"}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">System ID</p>
            <p className="font-mono text-lg">{car.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Owner / Receiver Details */}
      <div className="mb-12">
        <h3 className="text-sm font-bold uppercase text-slate-900 mb-4 border-b border-slate-100 pb-2 tracking-wide">Receiver Information</h3>
        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Name</p>
            <p className="font-semibold text-lg">{car.ownerName}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Contact Info</p>
            <p className="font-medium text-lg">{car.ownerContact || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Declaration */}
      <div className="mb-16 p-6 border border-slate-200 rounded-lg print:border-slate-300">
        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Acknowledgement</p>
        <p className="text-sm leading-relaxed text-justify text-slate-800">
          {content.declaration}
        </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-16 pt-8">
        <div className="border-t-2 border-slate-300 pt-2">
          <p className="font-bold text-sm uppercase text-slate-900">Client Signature</p>
          <div className="mt-8 border-b border-dotted border-slate-300 w-2/3"></div>
          <p className="text-xs text-slate-400 mt-1">Date</p>
        </div>
        <div className="border-t-2 border-slate-300 pt-2">
          <p className="font-bold text-sm uppercase text-slate-900">Authorized Manager</p>
          <p className="text-xs text-slate-500 mt-1 pt-2">Digitally Generated: {formatDate(new Date().toISOString())}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 pt-6 border-t border-slate-100 text-center">
        <p className="text-[10px] text-slate-700 uppercase tracking-widest">Essani Tracking System &bull; Official Record &bull; {type} RECEIPT</p>
        <p><b>Developed By: Anzi &. Co</b></p>
      </div>
    </div>
  );

  return (
    <>
      {/* Screen Preview Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
        <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl bg-white overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Printer className="text-slate-500" size={20} />
              <h3 className="font-semibold text-slate-700">{content.title} Preview</h3>
            </div>
            <div className="flex gap-2">
                <Button onClick={handlePrint} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
                    <Printer size={16} /> Print
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X size={18} />
                </Button>
            </div>
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-8">
                <div className="shadow-2xl shadow-slate-200 rounded-xl overflow-hidden ring-1 ring-slate-200">
                    <DeliveryDocument />
                </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Print-Only Layer */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:w-screen print:h-screen print:overflow-visible">
        <DeliveryDocument />
      </div>
    </>
  );
};