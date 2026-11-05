"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Copy, TriangleAlert, CheckCircle2, Database, FolderTree } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { inspectWebsiteData } from "@/lib/websiteSync";

/**
 * "Inspect website data" — shows how the existing data in the public website
 * project (`essani-cars-pk`) is actually laid out, so we can pinpoint why
 * existing new cars are (or aren't) being picked up by the module.
 */
export const WebsiteDataInspector = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const data = await inspectWebsiteData();
      if (data?.error) throw new Error(data.error);
      setReport(data);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard?.writeText(JSON.stringify(report, null, 2))
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  const kindIcon = (shape: any) => {
    if (!shape) return null;
    if (shape.kind === "brand") return <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />;
    if (shape.kind === "car") return <TriangleAlert size={13} className="text-amber-600 shrink-0" />;
    return <TriangleAlert size={13} className="text-slate-400 shrink-0" />;
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database size={16} /> Inspect essani-cars-pk data layout
          </DialogTitle>
          <DialogDescription>
            Read-only look at where the website project&apos;s existing data actually lives —
            explains why the Brands &amp; New Cars list may not match what you expect.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Reading structure from essani-cars-pk...
            </div>
          )}
          {!loading && error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-start gap-2">
              <TriangleAlert size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {!loading && report && (
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Firestore database:</span>
                <span className="font-mono text-xs font-bold text-slate-800">{report.databaseId}</span>
                {report.databaseId !== "(default)" && (
                  <Badge className="bg-amber-100 text-amber-800 border-0">non-default</Badge>
                )}
              </div>

              {/* new_cars */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-700 border-b pb-1 mb-2">
                  new_cars — {report.new_cars?.totalDocs ?? "?"} doc(s)
                </h4>
                {!report.new_cars?.docs?.length ? (
                  <p className="text-xs text-slate-400">No documents in <span className="font-mono">new_cars</span> on this database.</p>
                ) : (
                  <div className="space-y-2">
                    {report.new_cars.docs.map((doc: any) => (
                      <div key={doc.id} className="p-2.5 bg-white border border-slate-100 rounded-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          {kindIcon(doc.shape)}
                          <span className="font-mono text-xs font-bold text-slate-800">{doc.id}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${doc.shape?.kind === "brand" ? "bg-emerald-100 text-emerald-700" : doc.shape?.kind === "car" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                            doc looks like: {doc.shape?.kind}
                          </span>
                        </div>
                        {doc.shape?.reasons?.length > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1">{doc.shape.reasons.join(" • ")}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">fields: {doc.fieldKeys?.join(", ") || "—"}</p>
                        <div className="text-[11px] mt-1 font-mono text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <FolderTree size={11} />
                          subcollections:
                          {doc.subcollections?.length
                            ? doc.subcollections.map((s: any, i: number) => (
                                <span key={i} className="bg-slate-100 px-1.5 py-0.5 rounded">
                                  {s.id} ({s.docs >= 0 ? s.docs : "?"})
                                </span>
                              ))
                            : "none"}
                        </div>
                      </div>
                    ))}
                    {report.new_cars.totalDocs > report.new_cars.docs.length && (
                      <p className="text-[10px] text-slate-400">+ {report.new_cars.totalDocs - report.new_cars.docs.length} more doc(s) not shown</p>
                    )}
                  </div>
                )}
              </div>

              {/* collectionGroup cars */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-700 border-b pb-1 mb-2">cars subcollections (anywhere)</h4>
                {typeof report.collectionGroup_cars?.totalDocs === "number" ? (
                  <div className="text-xs text-slate-600">
                    {report.collectionGroup_cars.totalDocs} car doc(s) total.
                    {report.collectionGroup_cars.samplePaths?.length > 0 && (
                      <p className="font-mono text-[10px] text-slate-400 mt-1 break-all">
                        e.g. {report.collectionGroup_cars.samplePaths.join(" • ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">None or unreadable — {(report.collectionGroup_cars?.error) || "no cars subcollections found"}</p>
                )}
              </div>

              {/* alternates */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-700 border-b pb-1 mb-2">alternative collections</h4>
                <div className="space-y-1">
                  {report.alternativeCollections?.map((alt: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-slate-700 w-32">{alt.collection}</span>
                      {alt.error ? (
                        <span className="text-red-600">{alt.error}</span>
                      ) : (
                        <>
                          <Badge className={alt.totalDocs > 0 ? "bg-blue-100 text-blue-700 border-0" : "bg-slate-100 text-slate-500 border-0"}>
                            {alt.totalDocs} doc(s)
                          </Badge>
                          {alt.sampleDocIds?.length > 0 && (
                            <span className="font-mono text-[10px] text-slate-400 truncate">{alt.sampleDocIds.join(", ")}</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* used cars */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-700 border-b pb-1 mb-2">used_cars</h4>
                <p className="text-xs text-slate-600">{typeof report.used_cars?.totalDocs === "number" ? report.used_cars.totalDocs : "unreadable"} doc(s)</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!report}
            title="Copy the raw inspection report as JSON">
            <Copy size={13} /> {copied ? "Copied!" : "Copy JSON"}
          </Button>
          <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-2">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Run inspection
          </Button>
          <Button size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
