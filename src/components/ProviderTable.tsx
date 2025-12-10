import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CheckCircle, AlertCircle, Loader2, BookOpen, ShieldAlert, Award, Inbox } from "lucide-react";
import clsx from "clsx";

interface AgentWorkflowState {
    id: string;
    npi: string;
    name: string;
    address: string;
    status: "Validation" | "Enrichment" | "QA" | "Ready" | "Flagged" | "Processing";
    validationResult?: {
        status: "Verified" | "Flagged";
        confidence: number;
        reason: string;
    };
    enrichmentData?: {
        education: string;
        languages: string[];
        specialties: string[];
        bio: string;
    };
    qaReport?: {
        flagged: boolean;
        auditLog: string[];
        finalConfidence: number;
        discrepancies: string[];
        notes: string;
    };
    createdAt: string;
}

export function ProviderTable() {
    const [providers, setProviders] = useState<AgentWorkflowState[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "providers"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as AgentWorkflowState[];
            setProviders(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="glass-panel rounded-xl overflow-hidden min-h-[400px]">
            <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-white/5 text-xs uppercase text-gray-300 backdrop-blur-sm border-b border-white/5">
                    <tr>
                        <th className="px-6 py-4 font-semibold tracking-wider">NPI</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Provider Name</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Current Agent</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Confidence</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {isLoading ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                                    <p>Connecting to Agent Network...</p>
                                </div>
                            </td>
                        </tr>
                    ) : providers.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                <div className="flex flex-col items-center gap-3 opacity-60">
                                    <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                                        <Inbox className="h-6 w-6 text-gray-400" />
                                    </div>
                                    <p>No validation jobs active.</p>
                                    <p className="text-xs">Enter an NPI above to start the agent swarm.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        providers.map((p) => (
                            <>
                                <tr
                                    key={p.id}
                                    className={clsx(
                                        "transition-colors cursor-pointer group",
                                        expandedId === p.id ? "bg-white/10" : "hover:bg-white/5"
                                    )}
                                    onClick={() => toggleExpand(p.id)}
                                >
                                    <td className="px-6 py-4 font-medium text-gray-200 font-mono group-hover:text-white transition-colors">{p.npi}</td>
                                    <td className="px-6 py-4 text-gray-300 group-hover:text-white transition-colors">{p.name}</td>
                                    <td className="px-6 py-4">
                                        <div
                                            className={clsx(
                                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border backdrop-blur-sm shadow-sm",
                                                {
                                                    "bg-green-500/10 text-green-300 border-green-500/20": p.status === "Ready",
                                                    "bg-red-500/10 text-red-300 border-red-500/20": p.status === "Flagged",
                                                    "bg-indigo-500/10 text-indigo-300 border-indigo-500/20": ["Processing", "Validation", "Enrichment", "QA"].includes(p.status),
                                                }
                                            )}
                                        >
                                            {p.status === "Ready" && <CheckCircle className="h-3 w-3" />}
                                            {p.status === "Flagged" && <AlertCircle className="h-3 w-3" />}
                                            {["Processing", "Validation", "Enrichment", "QA"].includes(p.status) && (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            )}
                                            {p.status}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">
                                        <div className="flex items-center gap-3">
                                            <div className="w-16 h-1.5 bg-gray-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                                                <div
                                                    className={clsx("h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.5)]", {
                                                        "bg-gradient-to-r from-green-600 to-green-400": (p.qaReport?.finalConfidence ?? 0) > 80,
                                                        "bg-gradient-to-r from-yellow-600 to-yellow-400": (p.qaReport?.finalConfidence ?? 0) <= 80,
                                                    })}
                                                    style={{ width: `${p.qaReport?.finalConfidence ?? p.validationResult?.confidence ?? 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono">{p.qaReport?.finalConfidence ?? p.validationResult?.confidence ?? "-"}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-indigo-400 font-medium text-xs hover:text-indigo-300 transition-colors">
                                        {expandedId === p.id ? "Hide Details" : "View Details"}
                                    </td>
                                </tr>
                                {expandedId === p.id && (
                                    <tr className="bg-white/5 border-t border-white/5 relative">
                                        <td colSpan={5} className="px-6 py-6">
                                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 animate-in fade-in slide-in-from-top-2 duration-300">
                                                {/* Validation Section */}
                                                <div className="rounded-xl border border-white/10 bg-black/40 p-5 shadow-inner">
                                                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-blue-300 border-b border-white/5 pb-2 text-xs uppercase tracking-wider">
                                                        <ShieldAlert className="h-4 w-4" />
                                                        Validation Agent
                                                    </h4>
                                                    {p.validationResult ? (
                                                        <div className="space-y-2 text-xs text-gray-300">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-gray-500">Status</span>
                                                                <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border",
                                                                    p.validationResult.status === 'Verified' ? "bg-green-500/10 text-green-300 border-green-500/20" : "bg-red-500/10 text-red-300 border-red-500/20"
                                                                )}>
                                                                    {p.validationResult.status?.toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div className="pt-2">
                                                                <span className="text-gray-500 block mb-1">Logic/Reasoning</span>
                                                                <p className="opacity-80 leading-relaxed bg-white/5 p-2 rounded border border-white/5">{p.validationResult.reason}</p>
                                                            </div>
                                                        </div>
                                                    ) : <span className="text-xs text-gray-600 italic">Waiting for agent to process...</span>}
                                                </div>

                                                {/* Enrichment Section */}
                                                <div className="rounded-xl border border-white/10 bg-black/40 p-5 shadow-inner">
                                                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-purple-300 border-b border-white/5 pb-2 text-xs uppercase tracking-wider">
                                                        <BookOpen className="h-4 w-4" />
                                                        Enrichment Agent
                                                    </h4>
                                                    {p.enrichmentData ? (
                                                        <div className="space-y-3 text-xs text-gray-300">
                                                            <div>
                                                                <span className="text-gray-500 block mb-1">Synthesized Bio</span>
                                                                <p className="line-clamp-4 italic opacity-80 leading-relaxed bg-white/5 p-2 rounded border border-white/5">{p.enrichmentData.bio}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 block mb-1">Education</span>
                                                                <p className="font-medium">{p.enrichmentData.education}</p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                                {p.enrichmentData.languages?.map(l => (
                                                                    <span key={l} className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md text-[10px] shadow-sm">{l}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : <span className="text-xs text-gray-600 italic">Waiting for agent to process...</span>}
                                                </div>

                                                {/* QA Section */}
                                                <div className="rounded-xl border border-white/10 bg-black/40 p-5 shadow-inner">
                                                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-green-300 border-b border-white/5 pb-2 text-xs uppercase tracking-wider">
                                                        <Award className="h-4 w-4" />
                                                        QA Agent
                                                    </h4>
                                                    {p.qaReport ? (
                                                        <div className="space-y-3 text-xs text-gray-300">
                                                            <p className="bg-green-500/10 p-3 rounded-lg text-green-100 border border-green-500/20 leading-relaxed shadow-sm">
                                                                <span className="font-bold block mb-1 text-green-400">Assessment:</span>
                                                                {p.qaReport.notes}
                                                            </p>
                                                            <div className="mt-2 pl-2 border-l-2 border-white/10">
                                                                <p className="text-[10px] uppercase text-gray-500 mb-1 font-bold">Audit Log</p>
                                                                <ul className="list-none space-y-1.5">
                                                                    {p.qaReport.auditLog?.map((log, i) => (
                                                                        <li key={i} className="flex items-start gap-2 text-gray-400">
                                                                            <CheckCircle className="h-3 w-3 text-green-500/50 mt-0.5 shrink-0" />
                                                                            {log}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    ) : <span className="text-xs text-gray-600 italic">Waiting for agent to process...</span>}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
