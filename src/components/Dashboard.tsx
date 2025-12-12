import { useEffect, useState } from "react";
import { ActionPanel } from "./ActionPanel";
import { ProviderTable } from "./ProviderTable";
import { AgentCommandCenter } from "./AgentCommandCenter";
import { ShieldCheck, Download, Activity, Users } from "lucide-react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { signOut } from "firebase/auth";

import { generateDirectoryReport } from "../lib/agentSystem";

export function Dashboard() {
    const [metrics, setMetrics] = useState({ total: 0, avgConfidence: 0 });

    useEffect(() => {
        if (!auth.currentUser) return;
        // Simple listener for metrics (same as table, but we compute aggregates)
        const q = query(collection(db, "providers"), where("userId", "==", auth.currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(d => d.data());
            const total = docs.length;
            const totalConf = docs.reduce((acc, curr: any) => acc + (curr.scoring?.identityScore || 0), 0);
            const avg = total > 0 ? Math.round(totalConf / total) : 0;
            setMetrics({ total, avgConfidence: avg });
        });
        return () => unsubscribe();
    }, []);

    const handleExport = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "providers"));
            const data = querySnapshot.docs.map(doc => doc.data());

            // USE THE MANAGER AGENT TO GENERATE THE REPORT
            const report = generateDirectoryReport(data);

            const jsonString = JSON.stringify(report, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `astra_nova_directory_report_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export directory.");
        }
    };

    return (
        <div className="min-h-screen relative overflow-x-hidden">
            <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-md px-6 py-4">
                <div className="mx-auto max-w-7xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/favicon.svg" alt="AstraNova Logo" className="h-8 w-8 shadow-lg shadow-indigo-500/50 rounded-lg" />
                        <h1 className="text-xl font-bold text-gray-100 tracking-tight text-glow">
                            AstraNova <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-medium decoration-2">Agentic</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors backdrop-blur-sm"
                        >
                            <Download className="h-4 w-4" />
                            Generate Agent Report
                        </button>
                        <button
                            onClick={() => signOut(auth)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg hover:bg-red-500/10 transition-colors backdrop-blur-sm"
                        >
                            Log Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-8 relative z-10">

                {/* Workflow Diagram - Added for Clarity */}
                <div className="mb-10 flex justify-center">
                    <div className="flex items-center gap-4 text-sm font-medium text-gray-400 bg-white/5 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-sm shadow-xl">
                        <div className="flex items-center gap-2 text-indigo-300">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold">1</span>
                            Input
                        </div>
                        <div className="h-px w-8 bg-white/20"></div>
                        <div className="flex items-center gap-2 text-blue-300">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold">2</span>
                            Validation
                        </div>
                        <div className="h-px w-8 bg-white/20"></div>
                        <div className="flex items-center gap-2 text-purple-300">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold">3</span>
                            Enrichment
                        </div>
                        <div className="h-px w-8 bg-white/20"></div>
                        <div className="flex items-center gap-2 text-green-300">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-xs font-bold">4</span>
                            QA Audit
                        </div>
                    </div>
                </div>

                {/* Metrics Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="glass-panel rounded-xl p-4 flex items-center justify-between glass-card-hover group">
                        <div>
                            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Active Agents</label>
                            <p className="text-2xl font-bold text-white mt-1 group-hover:text-indigo-400 transition-colors">3</p>
                            <p className="text-[10px] text-green-400 mt-1 uppercase tracking-wide">Validator • Enrichment • QA</p>
                        </div>
                        <div className="h-10 w-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
                            <Activity className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="glass-panel rounded-xl p-4 flex items-center justify-between glass-card-hover group">
                        <div>
                            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Providers</label>
                            <p className="text-2xl font-bold text-white mt-1 group-hover:text-blue-400 transition-colors">{metrics.total}</p>
                            <p className="text-[10px] text-blue-400 mt-1 uppercase tracking-wide">Live Sync Active</p>
                        </div>
                        <div className="h-10 w-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 shadow-inner group-hover:scale-110 transition-transform">
                            <Users className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="glass-panel rounded-xl p-4 flex items-center justify-between glass-card-hover group">
                        <div>
                            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Avg Confidence</label>
                            <p className="text-2xl font-bold text-white mt-1 group-hover:text-green-400 transition-colors">{metrics.avgConfidence}%</p>
                            <p className="text-[10px] text-purple-400 mt-1 uppercase tracking-wide">High Accuracy Mode</p>
                        </div>
                        <div className="h-10 w-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 shadow-inner group-hover:scale-110 transition-transform">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                    <div className="lg:col-span-1 space-y-6">
                        <ActionPanel />
                    </div>


                    <div className="lg:col-span-3 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                                Validation Queue
                                <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">Real-time</span>
                            </h2>
                            <span className="text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full backdrop-blur-sm animate-pulse">
                                System Active
                            </span>
                        </div>
                        <ProviderTable />

                        {/* Unified Command Center */}
                        <div className="pt-4">
                            <AgentCommandCenter />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
