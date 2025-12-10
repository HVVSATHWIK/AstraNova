import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { runAgentWorkflow } from "../lib/agentSystem";
import { UserPlus, Sparkles, Database } from "lucide-react";
import clsx from "clsx";

const DEMO_PROVIDERS = [
    {
        npi: "1487000001",
        name: "Dr. Sarah Smith",
        address: "450 Sutter St, San Francisco, CA 94108"
    },
    {
        npi: "9999999999", // Invalid NPI (Flagged)
        name: "Dr. Gregory House",
        address: "221B Baker Street, London (Invalid)"
    },
    {
        npi: "1826493021",
        name: "Dr. Meredith Grey",
        address: "1500 4th Ave, Seattle, WA"
    }
];

export function ActionPanel() {
    const [npi, setNpi] = useState("");
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);

    const fillDemoData = () => {
        const random = DEMO_PROVIDERS[Math.floor(Math.random() * DEMO_PROVIDERS.length)];
        setNpi(random.npi);
        setName(random.name);
        setAddress(random.address);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!npi || !name || !address) return;

        try {
            setLoading(true);

            const docData = {
                npi,
                name,
                address,
                status: "Processing",
                createdAt: new Date().toISOString(),
            };

            // 1. Add to Firestore
            const docRef = await addDoc(collection(db, "providers"), docData);

            // 2. Trigger AI Agent (Client-side)
            runAgentWorkflow(docRef.id, { npi, name, address });

            // Reset form
            setNpi("");
            setName("");
            setAddress("");
        } catch (error) {
            console.error("Error adding provider:", error);
            alert("Failed to add provider.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="mb-4 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <UserPlus className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-100">Add Provider</h2>
                </div>
                <button
                    onClick={fillDemoData}
                    type="button"
                    className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors"
                >
                    <Database className="h-3 w-3" />
                    Demo Fill
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-400">
                        NPI Number
                    </label>
                    <input
                        type="text"
                        value={npi}
                        onChange={(e) => setNpi(e.target.value)}
                        placeholder="e.g. 1234567890"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-400">
                        Provider Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Dr. Jane Doe"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-400">
                        Address
                    </label>
                    <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g. 123 Medical Plaza, Metro City"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={clsx(
                        "flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
                    )}
                >
                    {loading ? (
                        "Processing..."
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4" />
                            Validate & Add
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
