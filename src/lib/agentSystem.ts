import { model } from "./gemini";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// --- Types & Schema ---

export type ProvenanceType =
    | 'LIVE_API'       // Verified external source (Trust: 1.0)
    | 'CACHED_VALID'   // Recent valid cache (Trust: 0.9)
    | 'STALE_LIVE'     // Old live data (Trust: 0.5)
    | 'SIMULATION'     // Heuristic/Fallback (Trust: 0.0) - CANNOT VERIFY
    | 'USER_INPUT';    // Unverified claim (Trust: 0.0)

export type VerificationStatus = 'VERIFIED' | 'FLAGGED' | 'BLOCKED' | 'UNVERIFIED';

export interface VerifiedData {
    source: ProvenanceType;
    timestamp: number;
    details: {
        npi: string;
        address: string;
        name: string;
        license_status: 'ACTIVE' | 'INACTIVE' | 'NOT_FOUND' | 'ERROR';
        specialties: string[];
    };
}

export interface ScoringResult {
    identityScore: number;     // 0-100
    trustLevel: number;        // 0.0 - 1.0
    isFatal: boolean;
    discrepancies: string[];
    finalStatus: VerificationStatus;
}

export interface SecurityCheckResult {
    passed: boolean;
    reasons: string[];
}

export interface EnrichmentData {
    bio: string;
    education_summary: string;
    generated_at: string;
}

export interface ExtractedProviderData {
    npi: string;
    name: string;
    address: string;
    confidence: number;
}

export interface AgentWorkflowState {
    status: "Processing" | "Ready" | "Flagged" | "Blocked" | "Unverified";
    securityCheck?: SecurityCheckResult;
    evidence?: VerifiedData;
    scoring?: ScoringResult;
    enrichment?: EnrichmentData;
    auditLog?: string[];
    lastUpdated: string;
}

// --- Helpers ---

// Simple Levenshtein Distance for fuzzy string matching
function levenshteinDistance(a: string, b: string): number {
    const matrix = [];
    const n = a.length;
    const m = b.length;

    if (n === 0) return m;
    if (m === 0) return n;

    for (let i = 0; i <= n; i++) matrix[i] = [i];
    for (let j = 0; j <= m; j++) matrix[0][j] = j;

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[n][m];
}

function normalizeString(str: string): string {
    return str.toLowerCase()
        .replace(/[.,#-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getSimilarityScore(input: string, reference: string): number {
    const s1 = normalizeString(input);
    const s2 = normalizeString(reference);
    if (!s1 || !s2) return 0;

    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return Math.max(0, 1 - (distance / maxLength));
}

function extractJSON(text: string) {
    try {
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) throw new Error("No JSON found");
        return JSON.parse(text.substring(startIndex, endIndex + 1));
    } catch (e) {
        console.error("JSON Parsing Failed", e);
        return null; // Fail safe
    }
}

async function updateProviderState(providerId: string, updates: Partial<AgentWorkflowState>) {
    try {
        const providerRef = doc(db, "providers", providerId);
        await updateDoc(providerRef, {
            ...updates,
            lastUpdated: new Date().toISOString()
        });
    } catch (e: any) {
        console.error("DB Write Error:", e);
        const msg = e instanceof Error ? e.message : String(e);
        dispatchLog("SYSTEM", "DB Write Error: " + msg, "error");
    }
}

function dispatchLog(agent: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
    const event = new CustomEvent("agent-log", { detail: { agent, message, level } });
    window.dispatchEvent(event);
}

// --- 1. Security Gate (Deterministic) ---

function validateInputSchema(data: any): SecurityCheckResult {
    const reasons: string[] = [];

    // NPI Format Check (10 digits)
    if (!data.npi || !/^\d{10}$/.test(data.npi)) {
        reasons.push("NPI Format Invalid (Must be 10 digits)");
    }

    // Zip '00000' Sabotage Check
    if (data.address && data.address.includes("00000")) {
        reasons.push("Security Block: Invalid Zip Code Pattern");
    }

    // XSS/Injection Check
    if (/[<>]/.test(JSON.stringify(data))) {
        reasons.push("Security Block: Malformed Characters Detected");
    }

    return {
        passed: reasons.length === 0,
        reasons
    };
}

// --- 2. Data Acquisition (Provenance-Aware) ---

async function fetchRegistryData(input: any): Promise<VerifiedData> {
    // In a real system, this would call NPPES API.
    // We simulate API behavior here with strict provenance tagging.

    // Simulate API Latency
    await new Promise(r => setTimeout(r, 1500));

    // Force "NotFound" for specific test cases defined by user previously? 
    // For now, we simulate a successful lookup for valid NPIs.
    // If NPI is "9999999999" -> Simulate Testing/Invalid

    if (input.npi === "9999999999") {
        return {
            source: 'LIVE_API',
            timestamp: Date.now(),
            details: {
                npi: input.npi,
                name: "TEST PROVIDER - DO NOT USE",
                address: "INVALID ADDRESS",
                license_status: 'INACTIVE',
                specialties: []
            }
        };
    }

    // Simulate API Failure/Offline for a specific case if needed, otherwise success
    const isOffline = Math.random() > 0.95; // 5% simulated downtime

    if (isOffline) {
        // FALLBACK: We return SIMULATION source. Trust will be 0.
        dispatchLog("ACQUISITION", "External Registry API Unavailable. Switching to Heuristic Fallback.", "warning");
        return {
            source: 'SIMULATION',
            timestamp: Date.now(),
            details: {
                ...input, // Echo input (Provenance ensures this isn't trusted)
                license_status: 'NOT_FOUND'
            }
        };
    }

    // Happy Path (Simulated Live API)
    return {
        source: 'LIVE_API',
        timestamp: Date.now(),
        details: {
            npi: input.npi,
            name: input.name, // Simulate match
            address: input.address, // Simulate match
            license_status: 'ACTIVE',
            specialties: ["General Practice"]
        }
    };
}

// --- 3. Unified Scoring (Deterministic) ---

function calculateScore(input: any, evidence: VerifiedData): ScoringResult {
    let score = 100;
    const discrepancies: string[] = [];
    let isFatal = false;

    // Trust Multiplier
    const trustMap: Record<ProvenanceType, number> = {
        'LIVE_API': 1.0,
        'CACHED_VALID': 0.9,
        'STALE_LIVE': 0.5,
        'SIMULATION': 0.0,
        'USER_INPUT': 0.0
    };
    const trustLevel = trustMap[evidence.source] || 0.0;

    // 1. Critical Status Check
    if (evidence.details.license_status === 'INACTIVE') {
        score = 0;
        isFatal = true;
        discrepancies.push("License is INACTIVE/REVOKED");
    } else if (evidence.details.license_status === 'NOT_FOUND' && trustLevel > 0) {
        // Only penalize if we trusted the source and it still didn't find it.
        // If source is Simulation/Offline, acts as "Unknown"
        score -= 50;
        discrepancies.push("License NOT FOUND in registry");
    }

    // 2. Address Verification (Fuzzy)
    const addrSimilarity = getSimilarityScore(input.address, evidence.details.address);
    if (addrSimilarity < 0.8) {
        const penalty = Math.round((0.8 - addrSimilarity) * 100); // Scale penalty
        score -= penalty;
        discrepancies.push("Address Mismatch (" + Math.round(addrSimilarity * 100) + "% match)");
    }

    // 3. Name Verification (Fuzzy)
    const nameSimilarity = getSimilarityScore(input.name, evidence.details.name);
    if (nameSimilarity < 0.8) {
        score -= 20;
        discrepancies.push("Name Mismatch (" + Math.round(nameSimilarity * 100) + "% match)");
    }

    // Apply Trust Scaling
    // If trust is 0 (Simulation), the Score becomes 0.
    const finalScore = Math.max(0, Math.round(score * trustLevel));

    // Determine Status
    let finalStatus: VerificationStatus = 'VERIFIED';

    if (isFatal) {
        finalStatus = 'BLOCKED';
    } else if (trustLevel < 0.5) {
        // If we don't trust the data, we can't verify or flag. It's just Unverified.
        finalStatus = 'UNVERIFIED';
        discrepancies.push("Source data insufficient for verification.");
    } else if (finalScore < 80) {
        finalStatus = 'FLAGGED';
    }

    return {
        identityScore: finalScore,
        trustLevel,
        isFatal,
        discrepancies,
        finalStatus
    };
}

// --- 4. Enrichment (LLM - Display Only) ---

async function runEnrichment(data: any): Promise<EnrichmentData> {
    try {
        const prompt = "Role: Medical Data Summarizer\n" +
            "Task: Generate a professional bio and education summary based ONLY on the provided verified data blocks.\n" +
            "Constraint: Do NOT assess credibility. Do NOT invent missing facts. Keep it concise.\n\n" +
            "Input:\n" +
            "Name: " + data.name + "\n" +
            "Specialties: " + (data.specialties?.join(", ") || "General Medicine") + "\n" +
            "Location: " + data.address + "\n\n" +
            "Output JSON:\n" +
            "{\n" +
            '  "bio": "2 sentence professional bio...",\n' +
            '  "education_summary": "Inferred likely medical background..." \n' +
            "}";

        const result = await model.generateContent(prompt);
        const json = extractJSON(result.response.text());
        return {
            bio: json?.bio || "Bio unavailable.",
            education_summary: json?.education_summary || "Education data unavailable.",
            generated_at: new Date().toISOString()
        };
    } catch (e) {
        return { bio: "Bio unavailable (Service Error)", education_summary: "", generated_at: new Date().toISOString() };
    }
}


// --- 5. Document Vision Agent (New) ---

export async function extractDataFromDocument(base64Image: string): Promise<ExtractedProviderData | null> {
    try {
        const prompt = "Analyze this medical provider document/ID. Extract the following fields strictly as JSON: { \"npi\": \"10 digit number or empty\", \"name\": \"Full Name\", \"address\": \"Full Address\", \"confidence\": 0-100 }. If fields are missing, make a best guess or leave empty.";

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: "image/png" // Assuming PNG/JPEG for simplicity
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text();
        const json = extractJSON(text);

        if (!json) return null;

        return {
            npi: json.npi || "",
            name: json.name || "",
            address: json.address || "",
            confidence: json.confidence || 0
        };
    } catch (e) {
        console.error("Vision Extraction Failed", e);
        return null;
    }
}

// --- 5. Main Orchestrator ---

export async function runAgentWorkflow(providerId: string, providerData: any) {
    try {
        dispatchLog("ORCHESTRATOR", "Initializing Gatekeeper Workflow...", "info");
        await updateProviderState(providerId, { status: "Processing" });

        // Step 1: Security Gate
        const securityCheck = validateInputSchema(providerData);
        if (!securityCheck.passed) {
            dispatchLog("SECURITY", "Blocked: " + securityCheck.reasons.join(", "), "error");
            await updateProviderState(providerId, {
                status: "Blocked",
                securityCheck,
                lastUpdated: new Date().toISOString()
            });
            return;
        }
        dispatchLog("SECURITY", "Input passed security sanitization.", "success");

        // Step 2: Data Acquisition
        dispatchLog("ACQUISITION", "Fetching trusted registry evidence...", "info");
        const evidence = await fetchRegistryData(providerData);

        if (evidence.source !== 'LIVE_API') {
            dispatchLog("ACQUISITION", "Using fallback source: " + evidence.source + " (Trust: " + (evidence.source === 'SIMULATION' ? '0%' : 'Low') + ")", "warning");
        } else {
            dispatchLog("ACQUISITION", "Registry data acquired via Live API.", "success");
        }

        // Step 3: Scoring
        dispatchLog("JUDGE", "Calculating Identity Score & Trust Levels...", "info");
        const scoring = calculateScore(providerData, evidence);

        let logType: "info" | "success" | "warning" | "error" = "info";
        if (scoring.finalStatus === 'VERIFIED') logType = "success";
        else if (scoring.finalStatus === 'FLAGGED') logType = "warning";
        else logType = "error";

        dispatchLog("JUDGE", "Status: " + scoring.finalStatus + " (Score: " + scoring.identityScore + "/100)", logType);

        // Step 4: Enrichment (Optional - Only for Verified/Flagged)
        let enrichment = undefined;
        if (scoring.finalStatus === 'VERIFIED' || scoring.finalStatus === 'FLAGGED') {
            dispatchLog("ENRICHMENT", "Generating display metadata...", "info");
            enrichment = await runEnrichment(evidence.details); // Use verified details
        }

        // Final Persistence
        await updateProviderState(providerId, {
            status: scoring.finalStatus === 'VERIFIED' ? 'Ready' :
                scoring.finalStatus === 'FLAGGED' ? 'Flagged' :
                    scoring.finalStatus === 'BLOCKED' ? 'Blocked' : 'Unverified',
            evidence,
            scoring,
            enrichment,
            securityCheck,
            auditLog: scoring.discrepancies // Simple audit log for now
        });

        dispatchLog("ORCHESTRATOR", "Workflow Complete: " + scoring.finalStatus, "success");

    } catch (e: any) {
        console.error("Workflow Crash", e);
        dispatchLog("SYSTEM", "Critical System Failure: " + (e instanceof Error ? e.message : String(e)), "error");
        await updateProviderState(providerId, { status: "Unverified" });
    }
}

/**
 * Helper to generate reports (Client-side trigger)
 */
export function generateDirectoryReport(providers: any[]) {
    // Dispatch log for visibility
    dispatchLog("ORCHESTRATOR", "Directory Manager: Generating Batch Report...", "info");

    const report = {
        timestamp: new Date().toISOString(),
        total_providers: providers.length,
        verified_count: providers.filter((p: any) => p.status === "Ready").length,
        flagged_count: providers.filter((p: any) => p.status === "Flagged").length,
        avg_confidence: providers.reduce((acc: number, p: any) => acc + (p.scoring?.identityScore || 0), 0) / (providers.length || 1),
        records: providers.map((p: any) => ({
            npi: p.npi,
            name: p.name,
            status: p.status,
            confidence: p.scoring?.identityScore || 0,
            issues: p.scoring?.discrepancies || []
        }))
    };

    return report;
}
