"use client";
import { X, Printer, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  details?: {
    model: string;
    chassis: string;
  };
}

export const BarcodeModal = ({ isOpen, onClose, value, details }: BarcodeModalProps) => {
  if (!isOpen || !value) return null;

  // Using bwip-js online API for barcode generation (Code 128)
  const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${value}&scale=3&includetext&background=ffffff&padding=10`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Screen Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
        <Card className="w-full max-w-sm bg-white overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">Print Barcode</h3>
            <Button variant="ghost" size="icon" onClick={onClose}><X size={18}/></Button>
          </div>

          <div className="p-8 flex flex-col items-center justify-center space-y-6">
            <div className="text-center space-y-1">
              <p className="font-bold text-lg text-slate-900">{details?.model}</p>
              <p className="font-mono text-xs text-slate-500">{details?.chassis}</p>
            </div>

            <div className="border-2 border-dashed border-slate-200 p-4 rounded-xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={barcodeUrl} 
                alt="Vehicle Barcode" 
                className="w-full h-auto mix-blend-multiply"
              />
            </div>

            <Button onClick={handlePrint} className="w-full bg-slate-900 hover:bg-slate-800 gap-2">
              <Printer size={16} /> Print Label
            </Button>
          </div>
        </Card>
      </div>

      {/* Print-Only Layer (Optimized for Label Printers) */}
      <div className="hidden print:flex print:fixed print:inset-0 print:items-center print:justify-center print:bg-white print:z-[9999]">
        <div className="flex flex-col items-center justify-center p-4 text-center">
            <h1 className="font-bold text-2xl mb-2">{details?.model}</h1>
            <p className="font-mono text-sm mb-4">{details?.chassis}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={barcodeUrl} 
              alt="Barcode" 
              className="w-[80mm] h-auto" // Standard label width
            />
            <p className="text-[10px] mt-2">Essani Tracking System</p>
        </div>
      </div>
    </>
  );
};