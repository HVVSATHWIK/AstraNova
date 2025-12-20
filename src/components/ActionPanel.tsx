import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { runAgentWorkflow, extractDataFromDocument, extractDataFromText } from "../lib/agentSystem";
import { UserPlus, Sparkles, Database, FileText, Scan, FileSpreadsheet } from "lucide-react";
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
    const [activeTab, setActiveTab] = useState<'form' | 'paste' | 'csv' | 'upload'>('form');
    const [npi, setNpi] = useState("");
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [scanStatus, setScanStatus] = useState("");
    const [dragActive, setDragActive] = useState(false);

    const [csvProviders, setCsvProviders] = useState<CsvProviderRow[]>([]);
    const [csvError, setCsvError] = useState<string>("");
    const [csvSelectedIndex, setCsvSelectedIndex] = useState<number>(-1);

    const [pasteText, setPasteText] = useState("");
    const [pasteStatus, setPasteStatus] = useState<string>("");
    const [pasteLoading, setPasteLoading] = useState(false);

    const [inputSource, setInputSource] = useState<"MANUAL" | "SCAN" | "CSV" | "PASTE" | "DEMO">("MANUAL");

    const fillDemoData = () => {
        const random = DEMO_PROVIDERS[Math.floor(Math.random() * DEMO_PROVIDERS.length)];
        setNpi(random.npi);
        setName(random.name);
        setAddress(random.address);
        setInputSource("DEMO");
        setActiveTab('form'); // Switch to form to see filled data
    };

    // New: Handle Document Upload
    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];

        const isCsv = file.type === "text/csv" || /\.csv$/i.test(file.name);
        if (isCsv) {
            alert("This upload expects an image for Scan. To import a CSV dataset, use the CSV Import tab.");
            return;
        }

        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        if (isPdf) {
            alert("PDF upload is not supported in Scan yet. Please upload a clear screenshot/photo of the page that contains the provider details (especially the address block), or paste the text in Manual.");
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
                        setInputSource("SCAN");
                        setActiveTab('form');
                        setLoading(false);
                        return;
                    }

                    setScanStatus("Extraction Complete. Validating...");
                    await processSubmission(extracted.npi, extracted.name, extracted.address, "SCAN");
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

    const processSubmission = async (npiVal: string, nameVal: string, addressVal: string, source?: "MANUAL" | "SCAN" | "CSV" | "PASTE" | "DEMO") => {
        try {
            const docData = {
                npi: npiVal,
                name: nameVal,
                address: addressVal,
                status: "Processing",
                createdAt: new Date().toISOString(),
                userId: auth.currentUser?.uid,
                inputSource: source || inputSource,
            };

            const docRef = await addDoc(collection(db, "providers"), docData);
            runAgentWorkflow(docRef.id, { npi: npiVal, name: nameVal, address: addressVal, inputSource: source || inputSource });

            // Reset
            setNpi("");
            setName("");
            setAddress("");
            setScanStatus("");
            setPasteText("");
            setActiveTab('form'); // Switch back to form for feedback
        } catch (error) {
            console.error("Error adding provider:", error);
            alert("Failed to add provider.");
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !address) return;
        setLoading(true);
        await processSubmission(npi, name, address);
    };

    const handlePasteExtract = async () => {
        if (!pasteText.trim()) return;
        setPasteLoading(true);
        setPasteStatus("Extracting fields from pasted text...");
        try {
            const extracted = await extractDataFromText(pasteText);
            if (!extracted) {
                setPasteStatus("Could not extract fields. Try pasting a cleaner block that includes Name and Address.");
                return;
            }

            if (extracted.npi) setNpi(extracted.npi);
            if (extracted.name) setName(extracted.name);
            if (extracted.address) setAddress(extracted.address);
            setInputSource("PASTE");

            setPasteStatus(
                extracted.confidence >= 70
                    ? `Extraction complete (${extracted.confidence}% confidence). Switching to form...`
                    : `Extraction needs review (${extracted.confidence}% confidence). Switching to form...`
            );

            // Short delay to read message then switch
            setTimeout(() => {
                setActiveTab('form');
                setPasteStatus("");
            }, 1000);

        } catch (e) {
            console.error("Paste extraction failed", e);
            setPasteStatus("Paste extraction failed.");
        } finally {
            setPasteLoading(false);
        }
    };

    return (
        <div className="glass-panel rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Header */}
            <div className="mb-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                        <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-100">Add Provider</h2>
                        <p className="text-xs text-gray-500 font-medium">Select an input method to begin</p>
                    </div>
                </div>
                <button
                    onClick={fillDemoData}
                    className="text-[10px] font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded border border-indigo-500/20 transition-colors flex items-center gap-1"
                >
                    <Database className="h-3 w-3" />
                    Demo Fill
                </button>
            </div>

            {/* Premium Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-lg mb-6 relative z-10">
                <button
                    onClick={() => setActiveTab('form')}
                    className={clsx(
                        "py-2 text-[11px] font-semibold rounded-md transition-all flex flex-col items-center justify-center gap-1",
                        activeTab === 'form' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                >
                    <FileText className="h-4 w-4" />
                    Manual
                </button>
                <button
                    onClick={() => setActiveTab('paste')}
                    className={clsx(
                        "py-2 text-[11px] font-semibold rounded-md transition-all flex flex-col items-center justify-center gap-1",
                        activeTab === 'paste' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                >
                    <FileText className="h-4 w-4" /> {/* Fallback icon if Clipboard not avail, using FileText representing Text */}
                    Paste Text
                </button>
                <button
                    onClick={() => setActiveTab('csv')}
                    className={clsx(
                        "py-2 text-[11px] font-semibold rounded-md transition-all flex flex-col items-center justify-center gap-1",
                        activeTab === 'csv' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                >
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV Import
                </button>
                <button
                    onClick={() => setActiveTab('upload')}
                    className={clsx(
                        "py-2 text-[11px] font-semibold rounded-md transition-all flex flex-col items-center justify-center gap-1",
                        activeTab === 'upload' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                >
                    <Scan className="h-4 w-4" />
                    Scan
                </button>
            </div>

            {/* TAB CONTENT AREA */}
            <div className="relative z-10 min-h-[300px]">

                {/* 1. MANUAL TAB */}
                {activeTab === 'form' && (
                    <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-gray-400 uppercase tracking-wider">Provider ID</label>
                                <input
                                    type="text"
                                    value={npi}
                                    onChange={(e) => { setNpi(e.target.value); setInputSource("MANUAL"); }}
                                    placeholder="NPI (10 digits)"
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-gray-400 uppercase tracking-wider">Provider Name <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); setInputSource("MANUAL"); }}
                                    placeholder="e.g. Dr. Jane Doe"
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-gray-400 uppercase tracking-wider">Full Address <span className="text-rose-500">*</span></label>
                            <textarea
                                value={address}
                                onChange={(e) => { setAddress(e.target.value); setInputSource("MANUAL"); }}
                                placeholder="e.g. 2nd Floor, Aster Clinic, MG Road, Bengaluru, Karnataka 560001, India"
                                rows={4}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                            />
                            <p className="text-[10px] text-gray-500 mt-2">
                                For best results, include <span className="text-gray-400">City</span>, <span className="text-gray-400">State</span>, and <span className="text-gray-400">PIN/Zip Code</span>.
                            </p>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className={clsx(
                                    "flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                )}
                            >
                                {loading ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" />
                                        Validate & Add Provider
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* 2. PASTE TAB */}
                {activeTab === 'paste' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-gray-200">AI Text Extraction</h3>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Paste any unformatted text block (email signature, website snippet, or messy list).
                                        Our AI will identify the name, NPI, and address automatically.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <textarea
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                placeholder="Paste provider details here..."
                                rows={8}
                                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[10px] text-gray-500 flex-1">
                                {pasteStatus || "Ready to extract."}
                            </p>
                            <button
                                onClick={handlePasteExtract}
                                disabled={pasteLoading || !pasteText.trim()}
                                className={clsx(
                                    "px-6 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                                    pasteLoading || !pasteText.trim()
                                        ? "bg-white/5 text-gray-500 cursor-not-allowed"
                                        : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md"
                                )}
                            >
                                {pasteLoading ? "Analyzing..." : "Extract Fields"}
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. CSV TAB */}
                {activeTab === 'csv' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-gray-200">Import Dataset</h3>
                                <p className="text-xs text-gray-500">
                                    Upload a CSV file to prefill the manual form.
                                </p>
                            </div>
                            <a
                                href="/providers.csv"
                                download
                                className="flex items-center gap-1.5 text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-md text-indigo-300 transition-colors"
                            >
                                <FileSpreadsheet className="h-3 w-3" />
                                Download Template
                            </a>
                        </div>

                        <div className="relative group">
                            <input
                                id="csv-upload"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(e) => handleCsvImport(e.target.files)}
                                className="hidden"
                            />
                            <label
                                htmlFor="csv-upload"
                                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-xl bg-black/20 hover:bg-white/5 hover:border-indigo-500/50 transition-all cursor-pointer group-hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                            >
                                <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-indigo-400 group-hover:scale-110 transition-all mb-2">
                                    <FileSpreadsheet className="h-5 w-5" />
                                </div>
                                <p className="text-xs font-semibold text-gray-300">Click to upload CSV</p>
                            </label>
                        </div>

                        {csvError && (
                            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-[11px] text-rose-300">
                                {csvError}
                            </div>
                        )}

                        {csvProviders.length > 0 && (
                            <div className="space-y-2 animate-in slide-in-from-bottom-2">
                                <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                                    <span>Select a row to process</span>
                                    <span className="font-mono text-indigo-400">{csvProviders.length} records</span>
                                </div>
                                <select
                                    value={csvSelectedIndex}
                                    onChange={(e) => {
                                        const idx = Number(e.target.value);
                                        setCsvSelectedIndex(idx);
                                        const selected = csvProviders[idx];
                                        if (!selected) return;
                                        setNpi(selected.npi || "");
                                        setName(selected.name || "");
                                        setAddress(selected.address || "");
                                        setInputSource("CSV");
                                        setActiveTab('form'); // Auto-switch to form
                                    }}
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none"
                                >
                                    <option value={-1}>-- Choose a provider from CSV --</option>
                                    {csvProviders.map((p, idx) => (
                                        <option key={idx} value={idx}>
                                            {p.name || "(No Name)"} {p.npi ? `(${p.npi})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. SCAN TAB */}
                {activeTab === 'upload' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div
                            className={clsx(
                                "border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer relative overflow-hidden",
                                dragActive ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 bg-black/20 hover:border-indigo-500/30 hover:bg-white/5",
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
                                accept="image/*,application/pdf,.pdf"
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />

                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center w-full h-full justify-center z-10">
                                <div className={clsx("h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-transform duration-500", dragActive ? "scale-110 bg-indigo-500 text-white" : "bg-white/5 text-gray-400 group-hover:text-indigo-400")}>
                                    <Scan className="h-8 w-8" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-200 mb-1">Upload Document</h3>
                                <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                                    Drag & drop ID card, letterhead, or form
                                </p>
                            </label>

                            {/* Scanning Animation Overlay */}
                            {loading && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                    <div className="h-24 w-24 relative">
                                        <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-lg"></div>
                                        <div className="absolute left-0 top-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
                                    </div>
                                    <p className="mt-6 text-xs font-bold text-indigo-400 animate-pulse tracking-wider">{scanStatus || "ANALYZING..."}</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg flex gap-3">
                            <div className="shrink-0 mt-0.5">
                                <Sparkles className="h-4 w-4 text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[11px] font-bold text-blue-300">Intelligent Extraction</h4>
                                <p className="text-[10px] text-blue-200/60 leading-relaxed">
                                    Supports images (JPG, PNG). For PDFs, please use a screenshot.
                                    Our vision model automatically detects NPI, Name, and Address blocks.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
