import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { runAgentWorkflow, extractDataFromDocument } from "../lib/agentSystem";
import { UserPlus, Sparkles, Database, FileText, Upload, Scan } from "lucide-react";
import clsx from "clsx";

const DEMO_PROVIDERS = [
    {
        npi: "1487000001",
        name: "Dr. Ananya Sharma",
        address: "2nd Floor, Aster Clinic, MG Road, Bengaluru, Karnataka 560001, India"
    },
    {
        npi: "9999999999", // Invalid NPI (Flagged)
        name: "Dr. Test Bot",
        address: "00000 Null Island, Null"
    },
    {
        npi: "1826493021",
        name: "Dr. Rohan Iyer",
        address: "Apollo Hospitals, Greams Lane, Chennai, Tamil Nadu 600006, India"
    }
];

export function ActionPanel() {
    const [activeTab, setActiveTab] = useState<'form' | 'upload'>('form');
    const [npi, setNpi] = useState("");
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [scanStatus, setScanStatus] = useState("");
    const [dragActive, setDragActive] = useState(false);

    const fillDemoData = () => {
        const random = DEMO_PROVIDERS[Math.floor(Math.random() * DEMO_PROVIDERS.length)];
        setNpi(random.npi);
        setName(random.name);
        setAddress(random.address);
    };

    // New: Handle Document Upload
    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];

        try {
            setLoading(true);
            setScanStatus("Scanning Document (AI Vision)...");

            // Convert to Base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];

                // Call Agent
                const extracted = await extractDataFromDocument(base64);

                if (extracted) {
                    let reviewBeforeSubmit = false;
                    try {
                        reviewBeforeSubmit = localStorage.getItem('astranova.reviewBeforeSubmit') === 'true';
                    } catch {
                        reviewBeforeSubmit = false;
                    }

                    if (reviewBeforeSubmit) {
                        setScanStatus("");
                        setNpi(extracted.npi);
                        setName(extracted.name);
                        setAddress(extracted.address);
                        setActiveTab('form');
                        setLoading(false);
                        return;
                    }

                    setScanStatus("Extraction Complete. Validating...");
                    await processSubmission(extracted.npi, extracted.name, extracted.address);
                } else {
                    alert("Could not extract data from document.");
                    setScanStatus("");
                    setLoading(false);
                }
            };
        } catch (e) {
            console.error("Upload failed", e);
            setScanStatus("Error scanning document.");
            setLoading(false);
        }
    };

    const processSubmission = async (npiVal: string, nameVal: string, addressVal: string) => {
        try {
            const docData = {
                npi: npiVal,
                name: nameVal,
                address: addressVal,
                status: "Processing",
                createdAt: new Date().toISOString(),
                userId: auth.currentUser?.uid,
            };

            const docRef = await addDoc(collection(db, "providers"), docData);
            runAgentWorkflow(docRef.id, { npi: npiVal, name: nameVal, address: addressVal });

            // Reset
            setNpi("");
            setName("");
            setAddress("");
            setScanStatus("");
            setActiveTab('form'); // Switch back to view list effectively? No, stay here but clear.
        } catch (error) {
            console.error("Error adding provider:", error);
            alert("Failed to add provider.");
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!npi || !name || !address) return;
        setLoading(true);
        await processSubmission(npi, name, address);
    };

    return (
        <div className="glass-panel rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Header */}
            <div className="mb-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <UserPlus className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-100">Add Provider</h2>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-black/40 rounded-lg mb-6 relative z-10">
                <button
                    onClick={() => setActiveTab('form')}
                    className={clsx("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2",
                        activeTab === 'form' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                    )}
                >
                    <FileText className="h-3 w-3" /> Manual
                </button>
                <button
                    onClick={() => setActiveTab('upload')}
                    className={clsx("flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2",
                        activeTab === 'upload' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                    )}
                >
                    <Scan className="h-3 w-3" /> Scan
                </button>
            </div>

            {/* Manual Form */}
            {activeTab === 'form' && (
                <form onSubmit={handleSubmit} className="space-y-4 relative z-10 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-end">
                        <button
                            onClick={fillDemoData}
                            type="button"
                            className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors"
                        >
                            <Database className="h-3 w-3" />
                            Demo Fill
                        </button>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-400">NPI Number</label>
                        <input
                            type="text"
                            value={npi}
                            onChange={(e) => setNpi(e.target.value)}
                            placeholder="e.g. 1234567890"
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-400">Provider Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Dr. Jane Doe"
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-400">Address</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="e.g. 2nd Floor, Aster Clinic, MG Road, Bengaluru, Karnataka 560001, India"
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                            India tip: include <span className="text-gray-400">City, State, PIN</span>. Optional (if available): Flat/Plot, Near landmark, District/Taluk.
                            <br />
                            Global tip: include <span className="text-gray-400">postcode</span> and <span className="text-gray-400">country</span> when formats vary.
                        </p>
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
            )}

            {/* Upload Area */}
            {activeTab === 'upload' && (
                <div className="relative z-10 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div
                        className={clsx(
                            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer",
                            dragActive ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 hover:border-white/20 hover:bg-white/5",
                            loading && "opacity-50 pointer-events-none"
                        )}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                            handleFileUpload(e.dataTransfer.files);
                        }}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e.target.files)}
                        />

                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                            <div className="h-12 w-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                                <Upload className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-200 mb-1">Upload Provider ID / Form</h3>
                            <p className="text-xs text-gray-500 mb-4">Drag & drop or click to browse</p>
                            <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-1 rounded">Supports: PNG, JPG</span>
                        </label>
                    </div>

                    {loading && (
                        <div className="mt-4 text-center">
                            <p className="text-xs text-indigo-400 animate-pulse font-medium">{scanStatus}</p>
                            <div className="h-1 w-full bg-gray-800 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-indigo-500 w-1/2 animate-[shimmer_1s_infinite_linear]" />
                            </div>
                        </div>
                    )}

                    <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <h4 className="flex items-center gap-2 text-xs font-bold text-blue-300 mb-1">
                            <Scan className="h-3 w-3" /> AI Extraction Agent
                        </h4>
                        <p className="text-[10px] text-blue-200/70">
                            Upload a clear photo/scan of a provider ID, letterhead, visiting card, or application form.
                            The Vision Agent extracts <span className="text-blue-200">NPI (10 digits)</span>, <span className="text-blue-200">Name</span>, and <span className="text-blue-200">Address</span> (including PIN/postcode if present).
                            If the output looks off, re-upload with a clearer address block or use the Manual tab.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
