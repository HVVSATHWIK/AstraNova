import { useEffect, useState, Fragment } from "react";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { CheckCircle, AlertCircle, Loader2, BookOpen, ShieldAlert, Award, Inbox, ChevronDown, Activity, XCircle, HelpCircle } from "lucide-react";
import clsx from "clsx";

interface AgentWorkflowState {
    id: string;
    npi: string;
    name: string;
    address: string;
    status: "Processing" | "Ready" | "Flagged" | "Blocked" | "Unverified";
    securityCheck?: {
        passed: boolean;
        reasons: string[];
    };
    evidence?: {
        source: string;
        details: any;
    };
    scoring?: {
        identityScore: number;
        trustLevel: number;
        isFatal: boolean;
        discrepancies: string[];
        finalStatus: string;
    };
    enrichment?: {
        bio: string;
        education_summary: string;
    };
    createdAt: string;
}

const WorkflowStepper = ({ status }: { status: AgentWorkflowState['status'] }) => {
    // Simplified workflow visualization
    const steps = ["Gatekeeper", "Acquisition", "Scoring"];
    const isComplete = status !== "Processing";

    return (
        <div className="flex items-center gap-2">
            {steps.map((step, idx) => {
                const isFinished = isComplete;
                // Simple pulse if processing
                const isActive = !isComplete && idx === 1;

                return (
                    <div key={step} className="flex items-center">
                        <div className={clsx(
                            "h-2 w-8 rounded-full transition-all duration-500",
                            isFinished ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" :
                                isActive ? "bg-indigo-400 animate-pulse" : "bg-white/10"
                        )} />
                    </div>
                );
            })}
            <div className="ml-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                {status === "Processing" ? "Processing..." : "Complete"}
            </div>
        </div>
    );
};

export function ProviderTable() {
    const [providers, setProviders] = useState<AgentWorkflowState[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(
            collection(db, "providers"),
            where("userId", "==", auth.currentUser.uid),
            orderBy("createdAt", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as AgentWorkflowState[];
            setProviders(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Data Sync Error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 shadow-2xl w-full flex flex-col h-[600px]">
            {/* Header - Sticky */}
            <div className="bg-[#0f172a] backdrop-blur-md border-b border-indigo-500/10 z-10">
                <table className="w-full table-fixed text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">
                        <tr>
                            <th className="px-6 py-4 w-[25%]">Provider Details</th>
                            <th className="px-6 py-4 w-[30%]">Agent Workflow</th>
                            <th className="px-6 py-4 w-[20%]">Confidence</th>
                            <th className="px-6 py-4 w-[15%] text-right">Status</th>
                            <th className="px-6 py-4 w-[10%] text-center">Action</th>
                        </tr>
                    </thead>
                </table>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full table-fixed text-left text-sm text-gray-400">
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
                                <Fragment key={p.id}>
                                    <tr
                                        className={clsx(
                                            "group transition-all duration-300",
                                            expandedId === p.id ? "bg-indigo-500/5 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]" : "hover:bg-white/[0.02]"
                                        )}
                                    >
                                        {/* Name & NPI */}
                                        <td className="px-6 py-4 overflow-hidden w-[25%]">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-200 group-hover:text-white transition-colors text-base truncate block" title={p.name}>{p.name}</span>
                                                <span className="text-[10px] font-mono text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded w-fit mt-1 border border-indigo-500/20 truncate">
                                                    NPI: {p.npi}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Visual Stepper */}
                                        <td className="px-6 py-4 w-[30%]">
                                            <WorkflowStepper status={p.status} />
                                        </td>

                                        {/* Confidence Bar */}
                                        <td className="px-6 py-4 w-[20%]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden shadow-inner border border-white/5 shrink-0">
                                                    <div
                                                        className={clsx("h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_currentColor]", {
                                                            "bg-emerald-500 text-emerald-500": (p.scoring?.identityScore ?? 0) > 80,
                                                            "bg-amber-500 text-amber-500": (p.scoring?.identityScore ?? 0) <= 80 && (p.scoring?.identityScore ?? 0) > 40,
                                                            "bg-red-500 text-red-500": (p.scoring?.identityScore ?? 0) <= 40,
                                                        })}
                                                        style={{ width: `${p.scoring?.identityScore ?? 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-mono font-bold text-gray-300">
                                                    {p.scoring?.identityScore ?? "-"}%
                                                </span>
                                            </div>
                                        </td>

                                        {/* Badge Status */}
                                        <td className="px-6 py-4 w-[15%] text-right">
                                            <div className="flex justify-end">
                                                <div
                                                    className={clsx(
                                                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider border shadow-lg backdrop-blur-md truncate max-w-full",
                                                        {
                                                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-900/20": p.status === "Ready",
                                                            "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-900/20": p.status === "Flagged",
                                                            "bg-red-900/20 text-red-500 border-red-500/20 shadow-red-900/20": p.status === "Blocked",
                                                            "bg-gray-500/10 text-gray-400 border-gray-500/20 shadow-gray-900/20": p.status === "Unverified",
                                                            "bg-indigo-500/10 text-indigo-300 border-indigo-500/20 shadow-indigo-900/20": ["Processing", "Validation", "Enrichment", "QA"].includes(p.status),
                                                        }
                                                    )}
                                                >
                                                    {p.status === "Ready" && <CheckCircle className="h-3 w-3 shrink-0" />}
                                                    {p.status === "Flagged" && <AlertCircle className="h-3 w-3 shrink-0" />}
                                                    {p.status === "Blocked" && <XCircle className="h-3 w-3 shrink-0" />}
                                                    {p.status === "Unverified" && <HelpCircle className="h-3 w-3 shrink-0" />}
                                                    {["Processing"].includes(p.status) && (
                                                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                                    )}
                                                    <span className="truncate">{p.status}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Action Button */}
                                        <td className="px-6 py-4 w-[10%] text-center">
                                            <button
                                                onClick={(e) => toggleExpand(p.id, e)}
                                                className={clsx(
                                                    "h-8 w-8 rounded-lg inline-flex items-center justify-center transition-all duration-300 border",
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
                                            <td colSpan={5} className="p-0 border-t border-indigo-500/20">
                                                <div className="bg-[#0f172a]/40 bg-[url('/grid-pattern.svg')] backdrop-blur-md shadow-inner p-6 animate-in slide-in-from-top-4 duration-300 overflow-hidden">

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                                        {/* Card 1: Evidence & Security */}
                                                        <div className="group flex flex-col relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-1 hover:border-blue-500/30 transition-colors h-full">
                                                            <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
                                                            <div className="relative p-5 h-full flex flex-col">
                                                                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                                                    <h4 className="flex items-center gap-2 font-bold text-blue-300 text-xs uppercase tracking-wider">
                                                                        <ShieldAlert className="h-4 w-4 shrink-0" /> Gatekeeper
                                                                        {/* Source Trust Badge */}
                                                                        {p.evidence?.source && (
                                                                            <span className={clsx(
                                                                                "ml-auto text-[10px] px-2 py-0.5 rounded-full border shadow-sm font-bold flex items-center gap-1",
                                                                                p.evidence.source === 'LIVE_API' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                                                                                    p.evidence.source === 'SIMULATION' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                                                        "bg-gray-500/10 text-gray-400 border-white/10"
                                                                            )}>
                                                                                <span className={clsx("h-1.5 w-1.5 rounded-full",
                                                                                    p.evidence.source === 'LIVE_API' ? "bg-green-400" :
                                                                                        p.evidence.source === 'SIMULATION' ? "bg-amber-400" : "bg-gray-400"
                                                                                )} />
                                                                                {p.evidence.source === 'LIVE_API' ? "HIGH TRUST" :
                                                                                    p.evidence.source === 'SIMULATION' ? "MED TRUST" : "LOW TRUST"}
                                                                            </span>
                                                                        )}
                                                                    </h4>
                                                                    {p.securityCheck && (
                                                                        <span className={clsx("hidden h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]", // Hidden because we moved the dot inside badge
                                                                            p.securityCheck.passed ? "bg-green-400 text-green-400" : "bg-red-400 text-red-400"
                                                                        )} />
                                                                    )}
                                                                </div>
                                                                {p.evidence ? (
                                                                    <div className="space-y-3 flex-1">
                                                                        <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Source Provenance</span>
                                                                            <span className={clsx("text-sm font-medium",
                                                                                p.evidence.source === 'LIVE_API' ? "text-green-300" : "text-amber-300"
                                                                            )}>{p.evidence.source}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Trust Level</span>
                                                                            <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                                                                <div className="bg-blue-400 h-full" style={{ width: `${(p.scoring?.trustLevel ?? 0) * 100}%` }} />
                                                                            </div>
                                                                        </div>

                                                                        {!p.securityCheck?.passed && (
                                                                            <div className="bg-red-900/20 border border-red-500/20 p-2 rounded text-[10px] text-red-300">
                                                                                {p.securityCheck?.reasons.join(", ")}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : <div className="h-20 flex items-center justify-center text-xs text-gray-600 italic">Initiating protocol...</div>}
                                                            </div>
                                                        </div>

                                                        {/* Card 2: Enrichment */}
                                                        <div className="group flex flex-col relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-1 hover:border-purple-500/30 transition-colors h-full">
                                                            <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors" />
                                                            <div className="relative p-5 h-full flex flex-col">
                                                                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                                                    <h4 className="flex items-center gap-2 font-bold text-purple-300 text-xs uppercase tracking-wider">
                                                                        <BookOpen className="h-4 w-4 shrink-0" /> Researcher
                                                                    </h4>
                                                                    <Activity className="h-3 w-3 text-purple-400 animate-pulse" />
                                                                </div>
                                                                {p.enrichment ? (
                                                                    <div className="space-y-4 flex-1">
                                                                        <div className="space-y-1">
                                                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Education</span>
                                                                            <p className="text-xs text-white font-medium break-words">{p.enrichment.education_summary}</p>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Bio Synthesis</span>
                                                                            <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-4 bg-white/5 p-2 rounded">{p.enrichment.bio}</p>
                                                                        </div>
                                                                        {p.evidence?.details?.specialties && (
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {p.evidence.details.specialties.slice(0, 3).map((s: string) => (
                                                                                    <span key={s} className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[9px] text-purple-300">{s}</span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-20 flex flex-col items-center justify-center text-xs text-gray-600 italic gap-2">
                                                                        {p.status === 'Blocked' ? (
                                                                            <>
                                                                                <XCircle className="h-4 w-4 text-gray-600" />
                                                                                <span>Skipped due to Security Block</span>
                                                                            </>
                                                                        ) : (
                                                                            "Gathering intel..."
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Card 3: Auditor (Scoring) */}
                                                        <div className="group flex flex-col relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-1 hover:border-green-500/30 transition-colors h-full">
                                                            <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors" />
                                                            <div className="relative p-5 h-full flex flex-col">
                                                                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                                                    <h4 className="flex items-center gap-2 font-bold text-green-300 text-xs uppercase tracking-wider">
                                                                        <Award className="h-4 w-4 shrink-0" /> Auditor
                                                                    </h4>
                                                                    {p.scoring && (
                                                                        <span className="text-xs font-mono font-bold text-green-400">{p.scoring.identityScore}%</span>
                                                                    )}
                                                                </div>
                                                                {p.scoring ? (
                                                                    <div className="space-y-3 flex-1">
                                                                        <div className="bg-green-950/30 p-2.5 rounded-lg border border-green-500/10">
                                                                            <span className="text-[10px] text-green-500 uppercase font-bold block mb-1">Status</span>
                                                                            <p className="text-xs text-green-100 break-words">{p.scoring.finalStatus}</p>
                                                                        </div>
                                                                        <div className="pl-2 border-l border-white/10 space-y-1">
                                                                            {p.scoring.discrepancies?.map((log, i) => (
                                                                                <div key={i} className="flex items-center gap-2 text-[10px] text-gray-400">
                                                                                    <div className="h-1 w-1 bg-yellow-500 rounded-full shrink-0" />
                                                                                    <span className="truncate">{log}</span>
                                                                                </div>
                                                                            ))}
                                                                            {p.scoring.discrepancies?.length === 0 && (
                                                                                <span className="text-[10px] text-gray-500 italic">No discrepancies found.</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-20 flex flex-col items-center justify-center text-xs text-gray-600 italic gap-2">
                                                                        {p.status === 'Blocked' ? (
                                                                            <>
                                                                                <XCircle className="h-4 w-4 text-gray-600" />
                                                                                <span>Skipped due to Security Block</span>
                                                                            </>
                                                                        ) : (
                                                                            "Auditing data..."
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
