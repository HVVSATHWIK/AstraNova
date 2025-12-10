import { useEffect, useState } from "react";
import clsx from "clsx";
import { ShieldAlert, BookOpen, Award, Cpu } from "lucide-react";

export function Agent3DVisual() {
    const [activeStage, setActiveStage] = useState<"IDLE" | "SCAN" | "SYNTH" | "AUDIT">("IDLE");
    const [message, setMessage] = useState("System Ready");

    useEffect(() => {
        const handleLog = (event: Event) => {
            const customEvent = event as CustomEvent;
            const agent = customEvent.detail.agent;

            if (agent === "VALIDATOR") {
                setActiveStage("SCAN");
                setMessage("Verifying Identity...");
            } else if (agent === "ENRICHMENT") {
                setActiveStage("SYNTH");
                setMessage("Enriching Profile...");
            } else if (agent === "QA") {
                setActiveStage("AUDIT");
                setMessage("Final Quality Check...");
            } else if (agent === "ORCHESTRATOR" && customEvent.detail.message.includes("finished")) {
                setActiveStage("IDLE");
                setMessage("Workflow Complete");
            }
        };

        window.addEventListener('agent-log', handleLog);
        return () => window.removeEventListener('agent-log', handleLog);
    }, []);

    return (
        <div className="h-[300px] w-full perspective-1000 group">
            {/* The Card Container - Tilts on Hover */}
            <div className={clsx(
                "relative w-full h-full transform-style-3d transition-transform duration-500 hover:rotate-x-3 hover:rotate-y-3",
                // "animate-float" // subtle floating
            )}>
                {/* Glass Card Background */}
                <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-6 text-center overflow-hidden">

                    {/* Animated Background Gradient */}
                    <div className={clsx(
                        "absolute inset-0 opacity-20 transition-colors duration-700",
                        activeStage === "IDLE" ? "bg-gradient-to-br from-indigo-500 to-transparent" :
                            activeStage === "SCAN" ? "bg-gradient-to-br from-blue-500 to-transparent" :
                                activeStage === "SYNTH" ? "bg-gradient-to-br from-purple-500 to-transparent" :
                                    "bg-gradient-to-br from-green-500 to-transparent"
                    )} />

                    {/* 3D Content Layer (Popped Out) */}
                    <div className="transform translate-z-16 relative z-10 flex flex-col items-center gap-6">

                        {/* Icon Ring */}
                        <div className={clsx(
                            "w-24 h-24 rounded-full border-4 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.3)] transition-all duration-500",
                            activeStage === "IDLE" ? "border-indigo-500/30 bg-indigo-500/10" :
                                activeStage === "SCAN" ? "border-blue-500/50 bg-blue-500/10 animate-pulse" :
                                    activeStage === "SYNTH" ? "border-purple-500/50 bg-purple-500/10 animate-pulse" :
                                        "border-green-500/50 bg-green-500/10"
                        )}>
                            {activeStage === "IDLE" && <Cpu className="h-10 w-10 text-indigo-400" />}
                            {activeStage === "SCAN" && <ShieldAlert className="h-10 w-10 text-blue-400" />}
                            {activeStage === "SYNTH" && <BookOpen className="h-10 w-10 text-purple-400" />}
                            {activeStage === "AUDIT" && <Award className="h-10 w-10 text-green-400" />}
                        </div>

                        {/* Text Info */}
                        <div className="space-y-2">
                            <h3 className={clsx(
                                "text-2xl font-bold uppercase tracking-wider font-mono",
                                activeStage === "IDLE" ? "text-indigo-300 text-glow-indigo" :
                                    activeStage === "SCAN" ? "text-blue-300 text-glow-blue" :
                                        activeStage === "SYNTH" ? "text-purple-300 text-glow-purple" :
                                            "text-green-300 text-glow-green"
                            )}>
                                {activeStage === "IDLE" ? "AGENT STANDBY" :
                                    activeStage === "SCAN" ? "VALIDATOR AGENT" :
                                        activeStage === "SYNTH" ? "ENRICHMENT AGENT" :
                                            "QA AGENT"}
                            </h3>
                            <p className="text-sm text-gray-400 font-medium">
                                {message}
                            </p>
                        </div>

                        {/* Progress Dots */}
                        <div className="flex gap-2 mt-2">
                            <div className={clsx("w-2 h-2 rounded-full transition-colors", activeStage !== "IDLE" ? "bg-blue-500" : "bg-gray-700")} />
                            <div className={clsx("w-2 h-2 rounded-full transition-colors", ["SYNTH", "AUDIT"].includes(activeStage) ? "bg-purple-500" : "bg-gray-700")} />
                            <div className={clsx("w-2 h-2 rounded-full transition-colors", activeStage === "AUDIT" ? "bg-green-500" : "bg-gray-700")} />
                        </div>
                    </div>

                    {/* Decorative Corner Lines */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
            </div>
        </div>
    );
}
