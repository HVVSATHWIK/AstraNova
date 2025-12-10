import { useEffect, useState, useRef } from "react";
import { Terminal } from "lucide-react";

interface LogEntry {
    id: string;
    timestamp: string;
    agent: "ORCHESTRATOR" | "VALIDATOR" | "ENRICHMENT" | "QA";
    message: string;
    level: "info" | "success" | "warning" | "error";
}

export function AgentTerminal() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleLog = (event: Event) => {
            const customEvent = event as CustomEvent;
            const newLog = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toLocaleTimeString(),
                ...customEvent.detail
            };
            setLogs(prev => [...prev.slice(-50), newLog]); // Keep last 50 logs
        };

        window.addEventListener('agent-log', handleLog);
        return () => window.removeEventListener('agent-log', handleLog);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    return (
        <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-[300px] border border-indigo-500/20 shadow-2xl bg-[#0a0a12]">
            {/* Header */}
            <div className="bg-[#1a1a2e] px-4 py-2 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-sans text-gray-200 font-semibold tracking-wide">Live System Activity</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] text-gray-400 font-medium">Online</span>
                    </div>
                </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 bg-black/50 scrollbar-thin scrollbar-thumb-indigo-500/20 scrollbar-track-transparent">
                {logs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping mb-4" />
                        <p>Waiting for workflow trigger...</p>
                    </div>
                )}

                {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 hover:bg-white/5 p-0.5 rounded transition-colors animate-in slide-in-from-left-2 duration-200">
                        <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                        <span className={`font-bold shrink-0 w-24 ${log.agent === 'ORCHESTRATOR' ? 'text-indigo-400' :
                            log.agent === 'VALIDATOR' ? 'text-blue-400' :
                                log.agent === 'ENRICHMENT' ? 'text-purple-400' :
                                    'text-green-400'
                            }`}>
                            {log.agent}
                        </span>
                        <span className={`break-all ${log.level === 'error' ? 'text-red-400' :
                            log.level === 'warning' ? 'text-yellow-400' :
                                log.level === 'success' ? 'text-green-300' :
                                    'text-gray-300'
                            }`}>
                            {log.message}
                            <span className="animate-pulse ml-1 opacity-50">_</span>
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
