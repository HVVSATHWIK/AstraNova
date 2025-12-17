import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { runAgentWorkflow, extractDataFromDocument } from "../lib/agentSystem";
import { UserPlus, Sparkles, Database, FileText, Upload, Scan } from "lucide-react";
import clsx from "clsx";

type CsvProviderRow = {
    npi: string;
    name: string;
    address: string;
};

function parseCsvToRows(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
    const text = (csvText || "").replace(/^\uFEFF/, "");
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
                continue;
            }
            if (char === '"') {
                inQuotes = false;
                continue;
            }
            field += char;
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === ',') {
            row.push(field);
            field = "";
            continue;
        }

        if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
            continue;
        }

        if (char === '\r') {
            continue;
        }

        field += char;
    }

    row.push(field);
    rows.push(row);

    const nonEmpty = rows.filter(r => r.some(c => (c || "").trim().length > 0));
    if (nonEmpty.length === 0) return { headers: [], rows: [] };

    const headers = nonEmpty[0].map(h => (h || "").trim());
    const dataRows = nonEmpty.slice(1);
    const objects: Record<string, string>[] = dataRows.map(r => {
        const obj: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
            const key = headers[i];
            if (!key) continue;
            obj[key] = (r[i] ?? "").trim();
        }
        return obj;
    });

    return { headers, rows: objects };
}

function getFirstValue(row: Record<string, string>, keys: string[]): string {
    const lowered: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) lowered[k.toLowerCase().trim()] = v;
    for (const key of keys) {
        const value = lowered[key.toLowerCase().trim()];
        if (value && value.trim()) return value.trim();
    }
    return "";
}

function buildAddressFromColumns(row: Record<string, string>): string {
    const address = getFirstValue(row, ["address", "full_address", "full address"]);
    if (address) return address;

    const line1 = getFirstValue(row, ["address_line1", "address line1", "address1", "address 1"]);
    const line2 = getFirstValue(row, ["address_line2", "address line2", "address2", "address 2"]);
    const city = getFirstValue(row, ["city"]);
    const state = getFirstValue(row, ["state_or_region", "state", "region"]);
    const postal = getFirstValue(row, ["postal_code", "postal code", "postcode", "zip"]);
    const country = getFirstValue(row, ["country"]);

    const parts = [line1, line2, city, state, postal, country].filter(Boolean);
    return parts.join(", ").trim();
}

function rowToProvider(row: Record<string, string>): CsvProviderRow {
    const npi = getFirstValue(row, ["npi", "npi_number", "npi number", "npi_no", "npi no"]);
    const name = getFirstValue(row, ["provider_name", "provider name", "name"]);
    const address = buildAddressFromColumns(row);
    return { npi, name, address };
}

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

    const [csvProviders, setCsvProviders] = useState<CsvProviderRow[]>([]);
    const [csvError, setCsvError] = useState<string>("");
    const [csvSelectedIndex, setCsvSelectedIndex] = useState<number>(-1);

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

        const isCsv = file.type === "text/csv" || /\.csv$/i.test(file.name);
        if (isCsv) {
            alert("This upload expects an image for Scan. To import a CSV dataset, use Manual → Import CSV.");
            return;
        }

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
                    alert("Could not extract data from the uploaded image. Try a clearer photo (include the full address block), or use Manual entry.");
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

    const handleCsvImport = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        setCsvError("");
        setCsvSelectedIndex(-1);

        try {
            const text = await file.text();
            const { headers, rows } = parseCsvToRows(text);
            if (headers.length === 0 || rows.length === 0) {
                setCsvProviders([]);
                setCsvError("CSV looks empty or missing a header row.");
                return;
            }

            const providers = rows
                .slice(0, 500)
                .map(rowToProvider)
                .filter(p => p.name || p.npi || p.address);

            if (providers.length === 0) {
                setCsvProviders([]);
                setCsvError("No usable rows found. Expected columns like: npi, provider_name/name, address (or address_line1/city/state/postal_code/country). ");
                return;
            }

            setCsvProviders(providers);
        } catch (e) {
            console.error("CSV import failed", e);
            setCsvProviders([]);
            setCsvError("Could not read that CSV file.");
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
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-gray-400">Import CSV (prefills form)</label>
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(e) => handleCsvImport(e.target.files)}
                                className="block w-[200px] text-[10px] text-gray-400 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-gray-200 hover:file:bg-white/20"
                            />
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

                    {csvProviders.length > 0 && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] text-gray-400">Select row</label>
                                    <select
                                        value={csvSelectedIndex}
                                        onChange={(e) => {
                                            const idx = Number(e.target.value);
                                            setCsvSelectedIndex(idx);
                                            const selected = csvProviders[idx];
                                            if (!selected) return;
                                            if (selected.npi) setNpi(selected.npi);
                                            if (selected.name) setName(selected.name);
                                            if (selected.address) setAddress(selected.address);
                                        }}
                                        className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value={-1}>Choose a provider…</option>
                                        {csvProviders.map((p, idx) => (
                                            <option key={idx} value={idx}>
                                                {(p.name || "(Unnamed)") + (p.npi ? ` — ${p.npi}` : "")}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="text-[10px] text-gray-500">Loaded {csvProviders.length} rows</div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2">
                                Tip: We only prefill one row at a time. Review and click <span className="text-gray-300">Validate & Add</span>.
                            </p>
                        </div>
                    )}

                    {csvError && (
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
                            <p className="text-[10px] text-rose-200/80">{csvError}</p>
                        </div>
                    )}

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
