"use client";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CarFront, Calendar, Fuel, Settings2, ImageIcon, 
  Camera, Eye, EyeOff, ShieldCheck,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WebsiteVehicleCardProps {
  vehicle: any;
  onOpenDetails: (vehicle: any) => void;
  onToggleVisibility?: (vehicle: any) => void;
  isTogglingVisibility?: boolean;
}

export const WebsiteVehicleCard = ({
  vehicle,
  onOpenDetails,
  onToggleVisibility,
  isTogglingVisibility = false
}: WebsiteVehicleCardProps) => {
  // Image values may be URL strings or objects containing a `url` field.
  const assets = (vehicle.images || vehicle.assets || [])
    .map((img: any) => (typeof img === "string" ? img : img?.url || ""))
    .filter(Boolean);
  const brandName = vehicle.make || vehicle.brandName || "Unknown Brand";
  const modelName = vehicle.model || "Unknown Model";
  const registrationNo = vehicle.registrationNo || vehicle.registrationNumber || "Unregistered";
  const modelYear = vehicle.year || vehicle.modelYear || "N/A";
  const chassisNo = vehicle.chassisNo || vehicle.chassisNumber || "N/A";
  const engineNo = vehicle.engineNo || vehicle.engineNumber || "N/A";
  const isHidden = vehicle.isHidden === true || vehicle.status === "Hidden";

  // Color mappings based on color name
  const colorBubbleStyle = useMemo(() => {
    const colName = (vehicle.color || "").toLowerCase();
    
    // Check common colors
    if (colName.includes("white")) return "bg-white border-slate-300";
    if (colName.includes("black")) return "bg-slate-900 border-slate-900";
    if (colName.includes("silver") || colName.includes("gray") || colName.includes("grey")) return "bg-slate-300 border-slate-400";
    if (colName.includes("red")) return "bg-red-500 border-red-600";
    if (colName.includes("blue")) return "bg-blue-500 border-blue-600";
    if (colName.includes("bronze") || colName.includes("brown") || colName.includes("gold")) return "bg-amber-600 border-amber-700";
    
    // Fallback based on text color hex if present, or generic white
    return "bg-slate-100 border-slate-300";
  }, [vehicle.color]);

  return (
    <div className="relative group/card h-full">
      {/* Background glow animation */}
      <div className={`absolute -inset-0.5 rounded-2xl opacity-0 group-hover/card:opacity-100 transition duration-500 blur-sm z-0 ${
        isHidden
          ? "bg-gradient-to-r from-amber-500 to-orange-500"
          : "bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500"
      }`}></div>
      
      {/* Card Content container */}
      <div className={`relative h-full flex flex-col border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 z-10 ${
        isHidden
          ? "bg-white border-amber-200/90 ring-1 ring-amber-100"
          : "bg-white border-slate-100"
      }`}>
        
        {/* Card Header (Image Preview & Brand info) */}
        <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden shrink-0">
          {assets.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={assets[0]} 
              alt={`${brandName} ${modelName}`} 
              className={`w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500 ${
                isHidden ? "grayscale-[30%] opacity-90" : ""
              }`} 
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-slate-500 space-y-2.5">
              <div className="p-3 bg-slate-800/80 rounded-full text-slate-400 border border-slate-700/50">
                <CarFront size={28} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">No Image Uploaded</span>
            </div>
          )}

          {/* Overlay tags */}
          <div className="absolute top-3 left-3 right-3 flex max-sm:flex-wrap justify-between items-center z-10 gap-1.5">
            <div className="flex items-center gap-1.5">
              <Badge className="bg-slate-900/90 text-white border-0 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider backdrop-blur-sm">
                {vehicle.registrationReason || vehicle.type || "Purchase"}
              </Badge>

              {isHidden && (
                <Badge className="bg-amber-500/90 text-white border-0 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider flex items-center gap-1 backdrop-blur-sm">
                  <EyeOff size={10} />
                  Hidden
                </Badge>
              )}
            </div>

            {assets.length > 0 && (
              <Badge className="bg-blue-600/90 text-white border-0 text-[10px] font-extrabold px-2 py-0.5 rounded-md tracking-wider flex items-center gap-1 backdrop-blur-sm">
                <ImageIcon size={10} />
                {assets.length} {assets.length === 1 ? 'Photo' : 'Photos'}
              </Badge>
            )}
          </div>

          {/* Hover Overlay Button to Open Details directly */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 max-sm:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20 gap-2">
            <Button
              onClick={() => onOpenDetails(vehicle)}
              className="gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-lg border-0 transform translate-y-2 group-hover/card:translate-y-0 transition-all duration-300 active:scale-95"
            >
              <Camera size={14} className="text-blue-600 animate-pulse" />
              Manage Info & Pictures
            </Button>
          </div>
        </div>

        {/* Brand & Identity Segment */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex-1">
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
              {brandName} <span className="font-normal text-slate-500">{modelName}</span>
            </h3>
            
            {registrationNo && (
              <span className="text-[11px] font-bold text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shadow-sm">
                {registrationNo}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {vehicle.variant || "Standard Edition"}
            </p>
            {vehicle.askingPrice && (
              <p className="text-xs font-mono font-black text-emerald-700">
                Rs. {Number(vehicle.askingPrice).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Specifications Grid */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 shrink-0">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs leading-none">
              <span className="text-slate-400 flex items-center gap-1.5"><Calendar size={12} /> Year</span>
              <span className="text-slate-800 font-bold font-mono">{modelYear}</span>
            </div>
            <div className="flex items-center justify-between text-xs leading-none">
              <span className="text-slate-400 flex items-center gap-1.5"><Fuel size={12} /> Fuel</span>
              <span className="text-slate-800 font-bold">{vehicle.fuelType || "N/A"}</span>
            </div>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs leading-none">
              <span className="text-slate-400 flex items-center gap-1.5"><Settings2 size={12} /> Trans</span>
              <span className="text-slate-800 font-bold truncate max-w-[50px]">{vehicle.transmission || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between text-xs leading-none">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full border shadow-sm shrink-0 inline-block", colorBubbleStyle)} /> 
                Color
              </span>
              <span className="text-slate-800 font-bold truncate max-w-[60px]" title={vehicle.color}>{vehicle.color || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Chassis & Technical details box */}
        <div className="p-3 px-4 shrink-0 bg-slate-50/20">
          <div className="bg-slate-50 border border-slate-150 rounded-lg p-2 font-mono text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold">CHASSIS:</span>
              <span className="text-slate-800 font-bold truncate max-w-[150px]">{chassisNo}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
              <span className="text-slate-400 font-bold">ENGINE:</span>
              <span className="text-slate-800 font-bold truncate max-w-[150px]">{engineNo}</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-auto p-3.5 pt-2 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 gap-2 max-sm:flex-wrap">
          {/* Status badge */}
          {isHidden ? (
            <div className="flex items-center gap-1 text-[11px] text-amber-700 font-bold uppercase tracking-wider">
              <EyeOff size={13} className="text-amber-500 shrink-0" />
              <span>Hidden</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
              <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
              <span>Live Online</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Toggle Hide / Unhide Button */}
            {onToggleVisibility && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(vehicle);
                }}
                disabled={isTogglingVisibility}
                variant="outline"
                size="sm"
                className={`h-8 text-xs font-bold rounded-xl px-2.5 flex items-center gap-1 transition-all ${
                  isHidden
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                    : "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"
                }`}
                title={isHidden ? "Show this car on the public website" : "Hide this car from the public website"}
              >
                {isTogglingVisibility ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isHidden ? (
                  <Eye size={12} />
                ) : (
                  <EyeOff size={12} />
                )}
                <span>{isHidden ? "Unhide" : "Hide"}</span>
              </Button>
            )}

            {/* Manage Details button */}
            <Button 
              onClick={() => onOpenDetails(vehicle)}
              variant="ghost" 
              size="sm"
              className="h-8 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/80 rounded-xl px-2.5 transition-colors flex items-center gap-1 border border-blue-100"
            >
              <Camera size={12} className="shrink-0" />
              <span>Manage</span>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

