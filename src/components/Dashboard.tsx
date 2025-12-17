import { useEffect, useState } from "react";
import { ActionPanel } from "./ActionPanel";
import { ProviderTable } from "./ProviderTable";
import { AgentCommandCenter } from "./AgentCommandCenter";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import clsx from "clsx";
import { ShieldCheck, Activity, Users, DollarSign, Clock, FileSpreadsheet, Printer, X, Briefcase, LayoutDashboard, HelpCircle } from "lucide-react";

import { generateDirectoryReport } from "../lib/agentSystem";

const OPS_COST_PER_HOUR_INR = 750;
const MANUAL_MINS_PER_PROVIDER = 15;

export function Dashboard() {
    const [metrics, setMetrics] = useState({ total: 0, avgConfidence: 0 });
    const [roi, setRoi] = useState({ hoursSaved: 0, moneySaved: 0 });
    const [showReport, setShowReport] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [role, setRole] = useState<'specialist' | 'director'>('specialist');
    const [showGuide, setShowGuide] = useState(false);
    const [reviewBeforeSubmit, setReviewBeforeSubmit] = useState(() => {
        try {
            return localStorage.getItem('astranova.reviewBeforeSubmit') === 'true';
        } catch {
            return false;
        }
    });

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

            // ROI Calculations
            const hours = Math.round(total * (MANUAL_MINS_PER_PROVIDER / 60));
            setRoi({
                hoursSaved: hours,
                moneySaved: hours * OPS_COST_PER_HOUR_INR
            });
        });
        return () => unsubscribe();
    }, []);

    const handleExportCSV = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "providers"));
            const data = querySnapshot.docs.map(doc => doc.data());

            // CSV Header
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "NPI,Name,Address,Status,Confidence,Source,LastUpdated\n";

            data.forEach((row: any) => {
                const rowData = [
                    row.npi,
                    `"${row.name}"`, // Quote strings with commas
                    `"${row.address}"`,
                    row.status,
                    row.scoring?.identityScore || 0,
                    row.evidence?.source || "Unknown",
                    row.lastUpdated || ""
                ].join(",");
                csvContent += rowData + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `astranova_data_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("CSV Export Error", e);
            alert("Export failed");
        }
    };

    const handleGenerateReport = async () => {
        const querySnapshot = await getDocs(collection(db, "providers"));
        const data = querySnapshot.docs.map(doc => doc.data());
        const report = generateDirectoryReport(data);
        setReportData(report);
        setShowReport(true);
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
                        {/* Role Toggle */}
                        <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                            <button
                                onClick={() => setRole('specialist')}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2",
                                    role === 'specialist' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                                )}
                            >
                                <LayoutDashboard className="h-3 w-3" /> Ops
                            </button>
                            <button
                                onClick={() => setRole('director')}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2",
                                    role === 'director' ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                                )}
                            >
                                <Briefcase className="h-3 w-3" /> Director
                            </button>
                        </div>
                        <div className="h-6 w-px bg-white/10 mx-2"></div>
                        <button
                            onClick={() => setShowGuide(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors backdrop-blur-sm"
                        >
                            <HelpCircle className="h-4 w-4" />
                            Guide
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors backdrop-blur-sm"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Export CSV
                        </button>
                        <button
                            onClick={handleGenerateReport}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-indigo-500 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            <Printer className="h-4 w-4" />
                            Executive Report
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

            <main className="mx-auto max-w-7xl px-6 py-8 relative">

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

                {/* ROI Dashboard - Business Value */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <div className="glass-panel p-6 rounded-xl flex items-center justify-between border-l-4 border-l-emerald-500">
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Projected Cost Savings</p>
                            <h3 className="text-3xl font-bold text-white flex items-baseline gap-1">
                                <span className="text-emerald-400">₹</span>
                                {roi.moneySaved.toLocaleString()}
                            </h3>
                            <p className="text-[10px] text-gray-500 mt-2">
                                Assumptions: ₹{OPS_COST_PER_HOUR_INR}/hr, {MANUAL_MINS_PER_PROVIDER} mins/provider.
                            </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                            <DollarSign className="h-6 w-6" />
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-xl flex items-center justify-between border-l-4 border-l-blue-500">
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Time Reclaimed</p>
                            <h3 className="text-3xl font-bold text-white flex items-baseline gap-1">
                                {roi.hoursSaved.toLocaleString()}
                                <span className="text-sm font-normal text-gray-400">hours</span>
                            </h3>
                            <p className="text-[10px] text-gray-500 mt-2">
                                Assumptions: ₹{OPS_COST_PER_HOUR_INR}/hr, {MANUAL_MINS_PER_PROVIDER} mins/provider.
                            </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                            <Clock className="h-6 w-6" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                    {role === 'specialist' && (
                        <div className="lg:col-span-1 space-y-6 animate-in slide-in-from-left-4 duration-500">
                            <ActionPanel />
                        </div>
                    )}

                    <div className={clsx(
                        "space-y-6 transition-all duration-500",
                        role === 'specialist' ? "lg:col-span-3" : "lg:col-span-4"
                    )}>
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


                {/* Report Modal */}
                {
                    showReport && reportData && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

                                {/* Modal Header */}
                                <div className="p-6 border-b flex items-center justify-between bg-gray-50">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-6 w-6 text-indigo-600" />
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">Directory Validation Report</h2>
                                            <p className="text-sm text-gray-500">Generated by AstraNova Agentic • {new Date().toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium">
                                            <Printer className="h-4 w-4" /> Print / Save PDF
                                        </button>
                                        <button onClick={() => setShowReport(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Content - Scrollable */}
                                <div className="overflow-y-auto p-8 bg-white text-gray-900 print:p-0">

                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-4 gap-4 mb-8">
                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-xs uppercase font-bold text-gray-500">Total Processed</p>
                                            <p className="text-2xl font-bold text-gray-900">{reportData.total_providers}</p>
                                        </div>
                                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                            <p className="text-xs uppercase font-bold text-green-600">Verified Ready</p>
                                            <p className="text-2xl font-bold text-green-700">{reportData.verified_count}</p>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                                            <p className="text-xs uppercase font-bold text-red-600">Action Required</p>
                                            <p className="text-2xl font-bold text-red-700">{reportData.flagged_count}</p>
                                        </div>
                                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <p className="text-xs uppercase font-bold text-blue-600">Avg Accuracy</p>
                                            <p className="text-2xl font-bold text-blue-700">{Math.round(reportData.avg_confidence)}%</p>
                                        </div>
                                    </div>

                                    {/* Insights */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                        <div className="border rounded-xl p-5 bg-gray-50">
                                            <h3 className="text-sm font-bold text-gray-800 mb-3">Top recurring issues</h3>
                                            {(reportData.top_issues?.length ?? 0) > 0 ? (
                                                <div className="space-y-2">
                                                    {reportData.top_issues.slice(0, 5).map((x: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between gap-4">
                                                            <span className="text-xs text-gray-700 truncate" title={x.issue}>{x.issue}</span>
                                                            <span className="text-xs font-bold text-gray-900 bg-white border rounded px-2 py-0.5 shrink-0">{x.count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 italic">No issues detected in current dataset.</p>
                                            )}
                                        </div>

                                        <div className="border rounded-xl p-5 bg-gray-50">
                                            <h3 className="text-sm font-bold text-gray-800 mb-3">Country distribution</h3>
                                            {(reportData.country_distribution?.length ?? 0) > 0 ? (
                                                <div className="space-y-2">
                                                    {reportData.country_distribution.slice(0, 8).map((x: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between gap-4">
                                                            <span className="text-xs text-gray-700 font-mono">{x.country}</span>
                                                            <span className="text-xs font-bold text-gray-900 bg-white border rounded px-2 py-0.5">{x.count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 italic">No address country signals available.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Flagged Items Table */}
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                                        <ShieldCheck className="h-5 w-5 text-red-500" />
                                        Providers Requiring Attention
                                    </h3>
                                    <div className="border rounded-lg overflow-hidden mb-8">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                                                <tr>
                                                    <th className="px-4 py-3">NPI</th>
                                                    <th className="px-4 py-3">Name</th>
                                                    <th className="px-4 py-3">Issues Identified</th>
                                                    <th className="px-4 py-3 text-right">Confidence</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {reportData.records.filter((r: any) => r.confidence < 80 || r.status !== 'Ready').slice(0, 50).map((record: any, i: number) => (
                                                    <tr key={i} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 font-mono text-gray-500">{record.npi}</td>
                                                        <td className="px-4 py-3 font-medium text-gray-900">{record.name}</td>
                                                        <td className="px-4 py-3 text-red-600">
                                                            <ul className="list-disc list-inside text-xs">
                                                                {record.issues.map((err: string, idx: number) => <li key={idx}>{err}</li>)}
                                                                {record.issues.length === 0 && <li>Manual Review Queue</li>}
                                                            </ul>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-gray-700">{record.confidence}%</td>
                                                    </tr>
                                                ))}
                                                {reportData.records.filter((r: any) => r.confidence < 80 || r.status !== 'Ready').length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">No flagged providers found. Excellent data quality.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t">
                                            Showing top 50 flagged items. Export CSV for full details.
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center text-xs text-gray-400 mt-12 mb-4 border-t pt-4">
                                        This report was generated automatically by the AstraNova AI Audit System. <br />
                                        Confidential - For Internal Use Only.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Guide Modal */}
                {showGuide && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <HelpCircle className="h-6 w-6 text-indigo-600" />
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Quick Guide</h2>
                                        <p className="text-sm text-gray-500">How to use AstraNova end-to-end</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 bg-white text-gray-900 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="border rounded-xl p-4">
                                        <h3 className="text-sm font-bold text-gray-800 mb-2">Workflow</h3>
                                        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                                            <li>Choose an input method: Manual (type/copy-paste), Paste Text, CSV Import, or Scan (image).</li>
                                            <li>Review fields (recommended when unsure), then submit.</li>
                                            <li>Validation checks safety + address quality and records evidence.</li>
                                            <li>Review results and audit details in the Validation Queue.</li>
                                        </ol>
                                        <p className="text-xs text-gray-500 mt-3">
                                            Note: If your source is a PDF, use a screenshot of the relevant page or paste the text into Manual.
                                        </p>
                                    </div>
                                    <div className="border rounded-xl p-4">
                                        <h3 className="text-sm font-bold text-gray-800 mb-2">If data is “weird”</h3>
                                        <p className="text-sm text-gray-700">
                                            Expand a provider row to see <span className="font-semibold">Address Verification</span> and issues.
                                            For India, include City, State/UT, and 6-digit PIN when possible.
                                        </p>
                                    </div>
                                </div>

                                <div className="border rounded-xl p-4 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-800 mb-1">Review before validation</h3>
                                        <p className="text-sm text-gray-700">
                                            If you’re uncertain about scanned/extracted fields, enable this.
                                            Scan will prefill the Manual form so you can edit before submitting.
                                        </p>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 select-none">
                                        <input
                                            type="checkbox"
                                            checked={reviewBeforeSubmit}
                                            onChange={(e) => {
                                                const next = e.target.checked;
                                                setReviewBeforeSubmit(next);
                                                try { localStorage.setItem('astranova.reviewBeforeSubmit', String(next)); } catch { }
                                            }}
                                            className="h-4 w-4"
                                        />
                                        Enable
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
