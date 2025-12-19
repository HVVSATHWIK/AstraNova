import { useEffect, useState, useRef } from "react";
import clsx from "clsx";
import { ShieldAlert, BookOpen, Award, Cpu, Activity, Terminal, CheckCircle2 } from "lucide-react";

interface LogEntry {
    id: string;
    timestamp: string;
    agent: "ORCHESTRATOR" | "VALIDATOR" | "ACQUISITION" | "JUDGE" | "SECURITY" | "ENRICHMENT" | "QA" | "SYSTEM";
    message: string;
    level: "info" | "success" | "warning" | "error";
}

export function AgentCommandCenter() {
    const [activeStage, setActiveStage] = useState<"IDLE" | "SCAN" | "SYNTH" | "AUDIT" | "ALERT">("IDLE");
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [glitch, setGlitch] = useState(false);

    useEffect(() => {
        const handleLog = (event: Event) => {
            const customEvent = event as CustomEvent;
            const agent = customEvent.detail.agent;

            // Trigger visual glitch effect on new data
            setGlitch(true);
            setTimeout(() => setGlitch(false), 200);

            // Update Visual Stage
            if (agent === "SECURITY" || agent === "SYSTEM" || customEvent.detail.level === "error") {
                setActiveStage("ALERT");
            } else if (agent === "VALIDATOR" || agent === "ACQUISITION") setActiveStage("SCAN");
            else if (agent === "JUDGE" || agent === "QA") setActiveStage("AUDIT");
            else if (agent === "ENRICHMENT") setActiveStage("SYNTH");
            else if (agent === "ORCHESTRATOR" && (customEvent.detail.message.toLowerCase().includes("completed") || customEvent.detail.message.toLowerCase().includes("complete"))) setActiveStage("IDLE");

            // Update Logs
            const newLog = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toLocaleTimeString(),
                ...customEvent.detail
            };
            setLogs(prev => [...prev.slice(-20), newLog]); // Keep last 20 for cleaner look
        };

        window.addEventListener('agent-log', handleLog);
        return () => window.removeEventListener('agent-log', handleLog);
    }, []);

    useEffect(() => {
        if (scrollContainerRef.current && logs.length > 0) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
        }
    }, [logs]);

    return (
        <div className="w-full relative group">
            {/* Main Holographic Container */}
            <div className="relative w-full bg-[#0a0a16]/90 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[400px]">

                {/* 1. Left Section: The "Brain" (Visualizer) */}
                <div className="w-full md:w-1/3 relative border-r border-white/5 bg-gradient-to-b from-[#0f172a] to-[#0a0a12] flex flex-col items-center justify-center p-8 overflow-hidden">

                    {/* Animated Background Mesh */}
                    <div className={clsx(
                        "absolute inset-0 opacity-20 transition-all duration-1000",
                        activeStage === "IDLE" ? "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-transparent to-transparent" :
                            activeStage === "ALERT" ? "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-600 via-transparent to-transparent animate-pulse" :
                                activeStage === "SCAN" ? "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900 via-transparent to-transparent" :
                                    activeStage === "SYNTH" ? "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900 via-transparent to-transparent" :
                                        "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900 via-transparent to-transparent"
                    )} />

                    {/* The 3D Core */}
                    <div className="relative z-10">
                        <div className={clsx(
                            "w-40 h-40 rounded-full border-2 flex items-center justify-center relative transition-all duration-700",
                            activeStage === "IDLE" ? "border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.2)]" :
                                activeStage === "ALERT" ? "border-red-500 shadow-[0_0_80px_rgba(239,68,68,0.6)] animate-pulse" :
                                    activeStage === "SCAN" ? "border-blue-500/50 shadow-[0_0_50px_rgba(59,130,246,0.4)] animate-pulse" :
                                        activeStage === "SYNTH" ? "border-purple-500/50 shadow-[0_0_50px_rgba(168,85,247,0.4)] animate-pulse" :
                                            "border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.4)]"
                        )}>
                            {/* Spinning Rings */}
                            <div className={clsx(
                                "absolute inset-0 rounded-full border border-dashed border-white/20 animate-spin-slow transition-all duration-1000",
                                activeStage !== "IDLE" && "border-white/40 duration-500"
                            )} />
                            <div className={clsx(
                                "absolute inset-2 rounded-full border border-dotted border-white/20 animate-reverse-spin", // Uses existing reverse spin or default
                                activeStage !== "IDLE" && "border-opacity-50"
                            )} />

                            {/* Center Icon */}
                            <div className={clsx("transition-transform duration-500", glitch ? "scale-110" : "scale-100")}>
                                {activeStage === "IDLE" && <Cpu className="w-16 h-16 text-indigo-400" />}
                                {activeStage === "ALERT" && <ShieldAlert className="w-20 h-20 text-red-500 animate-pulse" />}
                                {activeStage === "SCAN" && <ShieldAlert className="w-16 h-16 text-blue-400" />}
                                {activeStage === "SYNTH" && <BookOpen className="w-16 h-16 text-purple-400" />}
                                {activeStage === "AUDIT" && <Award className="w-16 h-16 text-emerald-400" />}
                            </div>
                        </div>

                        {/* Connection Line to Terminal */}
                        <div className={clsx(
                            "absolute top-1/2 -right-20 w-20 h-[1px] bg-gradient-to-r from-transparent to-white/10 hidden md:block",
                            activeStage !== "IDLE" && "to-white/50 shadow-[0_0_10px_white]"
                        )} />
                    </div>

                    <div className="mt-8 text-center space-y-1 relative z-10">
                        <h2 className="text-2xl font-bold font-mono tracking-tighter text-white">
                            {activeStage === "IDLE" ? "SYSTEM_READY" : activeStage}
                        </h2>
                        <div className="flex items-center justify-center gap-2">
                            <span className={clsx("w-2 h-2 rounded-full animate-ping",
                                activeStage === "IDLE" ? "bg-indigo-500" : "bg-green-500"
                            )} />
                            <span className="text-xs uppercase tracking-widest text-gray-400">
                                {activeStage === "IDLE" ? "Standing By" : "Processing"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Right Section: The "Stream" (Terminal) */}
                <div className="w-full md:w-2/3 bg-black/60 flex flex-col relative font-mono text-sm">
                    {/* Header Bar */}
                    <div className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-white/5">
                        <div className="flex items-center gap-3">
                            <Terminal className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 font-medium">Agent Event Stream</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                        </div>
                    </div>

                    {/* Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-3 relative" ref={scrollContainerRef}>
                        {/* CRT Scanline Overlay */}
                        <div className="absolute inset-0 pointer-events-none bg-[linear_gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear_gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.02),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] opacity-40 z-20" />

                        {logs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-4">
                                <Activity className="w-12 h-12 text-gray-500" />
                                <p className="text-gray-500">Waiting for workflow events…</p>
                            </div>
                        )}

                        {logs.map((log) => (
                            <div key={log.id} className="group flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <span className="text-gray-600 shrink-0 text-xs py-1">
                                    {log.timestamp}
                                </span>
                                <div className="flex-1 border-l-2 border-white/5 pl-4 pb-2 group-hover:border-white/20 transition-colors">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={clsx(
                                            "text-xs font-bold px-1.5 py-0.5 rounded",
                                            log.agent === "VALIDATOR" ? "bg-blue-500/20 text-blue-400" :
                                                log.agent === "ACQUISITION" ? "bg-sky-500/20 text-sky-300" :
                                                    log.agent === "JUDGE" ? "bg-amber-500/20 text-amber-300" :
                                                        log.agent === "SECURITY" || log.agent === "SYSTEM" ? "bg-red-500/20 text-red-300" :
                                                log.agent === "ENRICHMENT" ? "bg-purple-500/20 text-purple-400" :
                                                    log.agent === "QA" ? "bg-emerald-500/20 text-emerald-400" :
                                                        "bg-indigo-500/20 text-indigo-400"
                                        )}>
                                            {log.agent}
                                        </span>
                                        {log.level === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                    </div>
                                    <p className={clsx(
                                        "leading-relaxed",
                                        log.level === 'error' ? "text-red-400" :
                                            log.level === 'warning' ? "text-yellow-400" :
                                                log.level === 'success' ? "text-emerald-300" :
                                                    "text-gray-300"
                                    )}>
                                        {log.message}
                                    </p>
                                </div>
                            </div>
                        ))}

                    </div>
                </div>
            </div>

            {/* External Decor */}
            <div className="absolute -z-10 -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-blue-500/20 rounded-[2rem] blur-xl opacity-50" />
        </div>
    );
}
