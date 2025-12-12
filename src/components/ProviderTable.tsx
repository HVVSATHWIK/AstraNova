import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CheckCircle, AlertCircle, Loader2, BookOpen, ShieldAlert, Award, Inbox, ChevronDown, Activity } from "lucide-react";
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

const WorkflowStepper = ({ status }: { status: AgentWorkflowState['status'] }) => {
    const steps = ["Validation", "Enrichment", "QA"];
    const currentStepIndex =
        status === "Validation" ? 0 :
            status === "Enrichment" ? 1 :
                status === "QA" ? 2 :
                    (status === "Ready" || status === "Flagged") ? 3 : -1;

    return (
        <div className="flex items-center gap-2">
            {steps.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isCompleted = idx < currentStepIndex;

                return (
                    <div key={step} className="flex items-center">
                        <div className={clsx(
                            "h-2 w-8 rounded-full transition-all duration-500",
                            isCompleted ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" :
                                isActive ? "bg-indigo-400 animate-pulse" : "bg-white/10"
                        )} />
                    </div>
                );
            })}
            <div className="ml-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                {status === "Processing" ? "Starting..." : currentStepIndex === 3 ? "Complete" : steps[currentStepIndex] || status}
            </div>
        </div>
    );
};

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

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="glass-panel rounded-2xl overflow-hidden min-h-[400px] border border-white/5 shadow-2xl">
            <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-[#0f172a]/60 backdrop-blur-md text-[10px] uppercase text-gray-400 font-bold tracking-widest border-b border-indigo-500/10">
                    <tr>
                        <th className="px-6 py-5">Provider Details</th>
                        <th className="px-6 py-5">Agent Workflow</th>
                        <th className="px-6 py-5">Confidence</th>
                        <th className="px-6 py-5 text-right">Status</th>
                        <th className="px-6 py-5 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {isLoading ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-20 text-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative">
                                        <div className="h-10 w-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse" />
                                        </div>
                                    </div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider animate-pulse">Syncing with Agent Swarm...</p>
                                </div>
                            </td>
                        </tr>
                    ) : providers.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-24 text-center">
                                <div className="flex flex-col items-center gap-4 opacity-50 hover:opacity-100 transition-opacity duration-500">
                                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center border border-white/5 shadow-inner">
                                        <Inbox className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-gray-300 font-medium">No Validations Yet</p>
                                        <p className="text-xs text-gray-500">Use the Input Panel to start a workflow.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        providers.map((p) => (
                            <>
                                <tr
                                    key={p.id}
                                    className={clsx(
                                        "group transition-all duration-300",
                                        expandedId === p.id ? "bg-indigo-500/5 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]" : "hover:bg-white/[0.02]"
                                    )}
                                >
                                    {/* Name & NPI */}
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-200 group-hover:text-white transition-colors text-base">{p.name}</span>
                                            <span className="text-[10px] font-mono text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded w-fit mt-1 border border-indigo-500/20">
                                                NPI: {p.npi}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Visual Stepper */}
                                    <td className="px-6 py-5">
                                        <WorkflowStepper status={p.status} />
                                    </td>

                                    {/* Confidence Bar */}
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden shadow-inner border border-white/5">
                                                <div
                                                    className={clsx("h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_currentColor]", {
                                                        "bg-emerald-500 text-emerald-500": (p.qaReport?.finalConfidence ?? 0) > 80,
                                                        "bg-amber-500 text-amber-500": (p.qaReport?.finalConfidence ?? 0) <= 80 && (p.qaReport?.finalConfidence ?? 0) > 40,
                                                        "bg-red-500 text-red-500": (p.qaReport?.finalConfidence ?? 0) <= 40,
                                                    })}
                                                    style={{ width: `${p.qaReport?.finalConfidence ?? p.validationResult?.confidence ?? 0}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-mono font-bold text-gray-300">
                                                {p.qaReport?.finalConfidence ?? p.validationResult?.confidence ?? "-"}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* Badge Status */}
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex justify-end">
                                            <div
                                                className={clsx(
                                                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider border shadow-lg backdrop-blur-md",
                                                    {
                                                        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-900/20": p.status === "Ready",
                                                        "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-900/20": p.status === "Flagged",
                                                        "bg-indigo-500/10 text-indigo-300 border-indigo-500/20 shadow-indigo-900/20": ["Processing", "Validation", "Enrichment", "QA"].includes(p.status),
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
                                        </div>
                                    </td>

                                    {/* Action Button */}
                                    <td className="px-6 py-5 text-center">
                                        <button
                                            onClick={(e) => toggleExpand(p.id, e)}
                                            className={clsx(
                                                "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-300 border",
                                                expandedId === p.id
                                                    ? "bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] rotate-180"
                                                    : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                                            )}
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>

                                {/* Expanded Detail View */}
                                {expandedId === p.id && (
                                    <tr className="relative">
                                        <td colSpan={5} className="p-0">
                                            <div className="bg-[#0f172a]/40 bg-[url('/grid-pattern.svg')] backdrop-blur-md shadow-inner border-y border-indigo-500/20 p-6 animate-in slide-in-from-top-4 duration-300">

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                                    {/* Card 1: Validation */}
                                                    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-1 hover:border-blue-500/30 transition-colors">
                                                        <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
                                                        <div className="relative p-5">
                                                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                                                <h4 className="flex items-center gap-2 font-bold text-blue-300 text-xs uppercase tracking-wider">
                                                                    <ShieldAlert className="h-4 w-4" /> Validator
                                                                </h4>
                                                                {p.validationResult && (
                                                                    <span className={clsx("h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                                                                        p.validationResult.status === 'Verified' ? "bg-green-400 text-green-400" : "bg-red-400 text-red-400"
                                                                    )} />
                                                                )}
                                                            </div>
                                                            {p.validationResult ? (
                                                                <div className="space-y-3">
                                                                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                                                        <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Status</span>
                                                                        <span className={clsx("text-sm font-medium",
                                                                            p.validationResult.status === 'Verified' ? "text-green-300" : "text-red-300"
                                                                        )}>{p.validationResult.status}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Reasoning</span>
                                                                        <p className="text-xs text-gray-300 leading-relaxed font-light">{p.validationResult.reason}</p>
                                                                    </div>
                                                                </div>
                                                            ) : <div className="h-20 flex items-center justify-center text-xs text-gray-600 italic">Initiating protocol...</div>}
                                                        </div>
                                                    </div>

                                                    {/* Card 2: Enrichment */}
                                                    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-1 hover:border-purple-500/30 transition-colors">
                                                        <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors" />
                                                        <div className="relative p-5">
                                                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                                                <h4 className="flex items-center gap-2 font-bold text-purple-300 text-xs uppercase tracking-wider">
                                                                    <BookOpen className="h-4 w-4" /> Researcher
                                                                </h4>
                                                                <Activity className="h-3 w-3 text-purple-400 animate-pulse" />
                                                            </div>
                                                            {p.enrichmentData ? (
                                                                <div className="space-y-4">
                                                                    <div className="space-y-1">
                                                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Education</span>
                                                                        <p className="text-xs text-white font-medium">{p.enrichmentData.education}</p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Bio Synthesis</span>
                                                                        <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3 bg-white/5 p-2 rounded">{p.enrichmentData.bio}</p>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {p.enrichmentData.specialties?.slice(0, 3).map(s => (
                                                                            <span key={s} className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[9px] text-purple-300">{s}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : <div className="h-20 flex items-center justify-center text-xs text-gray-600 italic">Gathering intel...</div>}
                                                        </div>
                                                    </div>

                                                    {/* Card 3: QA */}
                                                    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-1 hover:border-green-500/30 transition-colors">
                                                        <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors" />
                                                        <div className="relative p-5">
                                                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                                                <h4 className="flex items-center gap-2 font-bold text-green-300 text-xs uppercase tracking-wider">
                                                                    <Award className="h-4 w-4" /> Auditor
                                                                </h4>
                                                                {p.qaReport && (
                                                                    <span className="text-xs font-mono font-bold text-green-400">{p.qaReport.finalConfidence}%</span>
                                                                )}
                                                            </div>
                                                            {p.qaReport ? (
                                                                <div className="space-y-3">
                                                                    <div className="bg-green-950/30 p-2.5 rounded-lg border border-green-500/10">
                                                                        <span className="text-[10px] text-green-500 uppercase font-bold block mb-1">Final Decision</span>
                                                                        <p className="text-xs text-green-100">{p.qaReport.notes}</p>
                                                                    </div>
                                                                    <div className="pl-2 border-l border-white/10 space-y-1">
                                                                        {p.qaReport.auditLog?.slice(0, 3).map((log, i) => (
                                                                            <div key={i} className="flex items-center gap-2 text-[10px] text-gray-400">
                                                                                <div className="h-1 w-1 bg-gray-500 rounded-full" />
                                                                                <span className="truncate">{log}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : <div className="h-20 flex items-center justify-center text-xs text-gray-600 italic">Auditing data...</div>}
                                                        </div>
                                                    </div>

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
