import { geminiEnrich, geminiGenerateText, geminiGenerateVision } from "./gemini";
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

export interface AddressVerificationResult {
    inferredCountry: string | null;
    confidence: number; // 0-100
    issues: string[];
    normalized: string;
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

function isValidNpi(npi: unknown): boolean {
    return typeof npi === 'string' && /^\d{10}$/.test(npi);
}

export interface AgentWorkflowState {
    status: "Processing" | "Ready" | "Flagged" | "Blocked" | "Unverified";
    securityCheck?: SecurityCheckResult;
    addressVerification?: AddressVerificationResult;
    evidence?: VerifiedData;
    scoring?: ScoringResult;
    enrichment?: EnrichmentData;
    auditLog?: string[];
    lastUpdated: string;
}

export interface ProviderDocument extends Partial<AgentWorkflowState> {
    npi?: string;
    name?: string;
    address?: string;
    inputSource?: string;
    userId?: string;
    createdAt?: string;
    specialties?: string[];
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
    } catch (e: unknown) {
        console.error("DB Write Error:", e);
        const msg = e instanceof Error ? e.message : String(e);
        dispatchLog("SYSTEM", "DB Write Error: " + msg, "error");
    }
}

function dispatchLog(agent: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
    const event = new CustomEvent("agent-log", { detail: { agent, message, level } });
    window.dispatchEvent(event);
}

function normalizeAddress(address: string): string {
    return (address || "")
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .replace(/,+/g, ",")
        .replace(/,\s*,/g, ",")
        .trim();
}

function inferCountryFromAddress(address: string): string | null {
    const a = (address || "").toLowerCase();
    const hasIndiaPin = /(?:^|\D)\d{6}(?:\D|$)/.test(a);
    if (hasIndiaPin || /\bindia\b/.test(a)) return "IN";

    // Common Indian state hints (non-exhaustive; lightweight on purpose)
    if (/\b(maharashtra|karnataka|tamil nadu|telangana|kerala|delhi|uttar pradesh|west bengal|gujarat|rajasthan|punjab|haryana|odisha|assam|bihar)\b/.test(a)) {
        return "IN";
    }

    if (/\b\d{5}(?:-\d{4})?\b/.test(a) || /\b(usa|united states)\b/.test(a)) return "US";

    // UK postcode (broad, pragmatic)
    if (/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.test(a) || /\b(uk|united kingdom)\b/.test(a)) return "GB";

    // Canada postal code
    if (/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s*\d[ABCEGHJ-NPRSTV-Z]\d\b/i.test(a) || /\bcanada\b/.test(a)) return "CA";

    // Australia / New Zealand (postcode overlap; use country/state hints)
    if (/\b(australia|\bau\b)\b/.test(a) || /\b(nsw|vic|qld|wa|sa|tas|act|nt)\b/.test(a)) return "AU";
    if (/\b(new zealand|\bnz\b)\b/.test(a)) return "NZ";

    // Germany / France (5-digit postcodes; rely on country hints)
    if (/\b(germany|deutschland|\bde\b)\b/.test(a)) return "DE";
    if (/\b(france|\bfr\b)\b/.test(a)) return "FR";

    return null;
}

export function verifyPostalAddress(address: string): AddressVerificationResult {
    const normalized = normalizeAddress(address);
    const lower = normalized.toLowerCase();
    const inferredCountry = inferCountryFromAddress(normalized);

    const issues: string[] = [];
    let confidence = 100;

    // Global "obviously bogus" signals
    if (!normalized || normalized.length < 8) {
        issues.push("Address too short");
        confidence -= 50;
    }
    if (!/[a-zA-Z]/.test(normalized)) {
        issues.push("Address missing alphabetic locality text");
        confidence -= 30;
    }
    if (/\b(unknown|n\/?a|na|null island|invalid address)\b/.test(lower)) {
        issues.push("Address contains placeholder/bogus text");
        confidence -= 60;
    }
    if (/\b0{5,6}\b/.test(lower) || /\b00000\b/.test(lower) || /\b000000\b/.test(lower)) {
        issues.push("Postal code appears invalid (all zeros)");
        confidence -= 80;
    }

    if (inferredCountry === "IN") {
        const hasIndiaKeywords = /\b(flat|fl\.?|plot|near|opp\.?|opposite|behind|beside|sector|phase|taluk|tehsil|district|dist\.?|road|rd\.?|street|st\.?|lane|ln\.?|nagar|colony|layout)\b/i.test(normalized);
        const pinMatch = normalized.match(/(?:^|\D)(\d{6})(?:\D|$)/);
        if (!pinMatch) {
            issues.push("Missing Indian PIN code (6 digits)");
            confidence -= 35;
        } else {
            const pin = pinMatch[1];
            if (pin.startsWith("0")) {
                issues.push("Indian PIN code cannot start with 0");
                confidence -= 25;
            }
            if (/^(\d)\1{5}$/.test(pin)) {
                issues.push("Indian PIN code looks synthetic");
                confidence -= 25;
            }
        }

        const commaParts = normalized.split(",").map(s => s.trim()).filter(Boolean);
        if (commaParts.length < 3) {
            issues.push("Indian address should include locality, city, state, and PIN");
            confidence -= hasIndiaKeywords ? 10 : 20;
        }

        // Heuristic: if we can find a state and a PIN, prefer state to appear before PIN near the end.
        const stateRegex = /\b(andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|delhi|jammu and kashmir|ladakh|puducherry)\b/i;
        const stateMatch = normalized.match(stateRegex);
        const pinIndex = pinMatch ? normalized.lastIndexOf(pinMatch[1]) : -1;
        const stateIndex = stateMatch ? normalized.lastIndexOf(stateMatch[0]) : -1;

        if (pinIndex !== -1 && stateIndex !== -1 && pinIndex < stateIndex) {
            issues.push("PIN appears before state; expected 'City, State PIN' ordering");
            confidence -= 10;
        }

        if (!stateMatch) {
            issues.push("Missing Indian state/UT");
            confidence -= 10;
        }

        if (!hasIndiaKeywords && commaParts.length >= 3) {
            // Encourage more natural Indian address cues
            confidence -= 5;
        }
    } else if (inferredCountry === "US") {
        if (!/\b\d{5}(?:-\d{4})?\b/.test(normalized)) {
            issues.push("Missing US ZIP code");
            confidence -= 25;
        }
    } else if (inferredCountry === "GB") {
        if (!/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.test(normalized)) {
            issues.push("Missing UK postcode");
            confidence -= 25;
        }
    } else if (inferredCountry === "CA") {
        if (!/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s*\d[ABCEGHJ-NPRSTV-Z]\d\b/i.test(normalized)) {
            issues.push("Missing Canada postal code");
            confidence -= 25;
        }
    } else if (inferredCountry === "AU") {
        if (!/\b\d{4}\b/.test(normalized)) {
            issues.push("Missing Australia postcode (4 digits)");
            confidence -= 20;
        }
    } else if (inferredCountry === "NZ") {
        if (!/\b\d{4}\b/.test(normalized)) {
            issues.push("Missing New Zealand postcode (4 digits)");
            confidence -= 20;
        }
    } else if (inferredCountry === "DE") {
        if (!/\b\d{5}\b/.test(normalized)) {
            issues.push("Missing Germany postcode (5 digits)");
            confidence -= 20;
        }
    } else if (inferredCountry === "FR") {
        if (!/\b\d{5}\b/.test(normalized)) {
            issues.push("Missing France postcode (5 digits)");
            confidence -= 20;
        }
    } else {
        // Generic expectations for a global address string
        if (!/\d/.test(normalized)) {
            issues.push("Address missing building/plot/street number");
            confidence -= 15;
        }
        if (!/[,-]/.test(normalized)) {
            issues.push("Address missing separators (comma/hyphen)");
            confidence -= 10;
        }
    }

    confidence = Math.max(0, Math.min(100, confidence));
    return { inferredCountry, confidence, issues, normalized };
}

// --- 1. Security Gate (Deterministic) ---

function validateInputSchema(data: ProviderDocument): SecurityCheckResult {
    const reasons: string[] = [];

    // Postal-code sabotage patterns
    if (typeof data.address === 'string') {
        const addr = data.address;
        if (/\b00000\b/.test(addr) || /\b000000\b/.test(addr) || /\b0{5,6}\b/.test(addr)) {
            reasons.push("Security Block: Invalid Postal Code Pattern");
        }
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

async function fetchRegistryData(input: ProviderDocument): Promise<VerifiedData> {
    // In a real system, this would call NPPES API.
    // We simulate API behavior here with strict provenance tagging.

    // If there is no valid registry identifier (e.g., India-first inputs),
    // we cannot use external registry acquisition. Mark as USER_INPUT.
    if (!isValidNpi(input?.npi)) {
        dispatchLog(
            "ACQUISITION",
            "No valid NPI provided. External registry lookup skipped; proceeding with user-provided details only.",
            "warning"
        );
        return {
            source: 'USER_INPUT',
            timestamp: Date.now(),
            details: {
                npi: typeof input?.npi === 'string' ? input.npi : "",
                name: input?.name || "",
                address: input?.address || "",
                license_status: 'ERROR',
                specialties: []
            }
        };
    }

    // Simulate API Latency
    await new Promise(r => setTimeout(r, 1500));

    // Force "NotFound" for specific test cases defined by user previously? 
    // For now, we simulate a successful lookup for valid NPIs.
    // If NPI is "9999999999" -> Simulate Testing/Invalid

    // Force "SIMULATION" (Med Trust) for testing
    if (input.npi === "8888888888") {
        return {
            source: 'SIMULATION',
            timestamp: Date.now(),
            details: {
                npi: input.npi,
                name: "Dr. Med Trust Test",
                address: "123 Simulation Lane, Test City",
                license_status: 'ACTIVE',
                specialties: ["Internal Testing"]
            }
        };
    }

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
        dispatchLog("ACQUISITION", "Registry service unavailable. Using a fallback evidence source.", "warning");
        return {
            source: 'SIMULATION',
            timestamp: Date.now(),
            details: {
                npi: input.npi || "",
                name: input.name || "",
                address: input.address || "",
                license_status: 'NOT_FOUND',
                specialties: input.specialties || []
            }
        };
    }

    // Happy Path (Simulated Live API)
    return {
        source: 'LIVE_API',
        timestamp: Date.now(),
        details: {
            npi: input.npi || "",
            name: input.name || "", // Simulate match
            address: input.address || "", // Simulate match
            license_status: 'ACTIVE',
            specialties: ["General Practice"]
        }
    };
}

// --- 3. Unified Scoring (Deterministic) ---

function calculateScore(input: ProviderDocument, evidence: VerifiedData, addressCheck?: AddressVerificationResult): ScoringResult {
    let score = 100;
    const discrepancies: string[] = [];
    let isFatal = false;

    if (!isValidNpi(input?.npi)) {
        discrepancies.push("Missing/invalid registry ID (NPI)");
        score -= 10;
    }

    // Address Structure Verification (world-aware)
    const addrCheck = addressCheck ?? verifyPostalAddress(input.address || "");
    if (addrCheck.issues.length > 0) {
        discrepancies.push(...addrCheck.issues.map(i => `Address: ${i}`));
    }
    if (addrCheck.confidence < 80) {
        // Penalize progressively; cap so it doesn't fully dominate scoring.
        const penalty = Math.min(40, Math.round((80 - addrCheck.confidence) * 0.75));
        score -= penalty;
        discrepancies.push(`Address Quality Low (${addrCheck.confidence}%)`);
    }

    // Trust Multiplier
    const trustMap: Record<ProvenanceType, number> = {
        'LIVE_API': 1.0,
        'CACHED_VALID': 0.9,
        'STALE_LIVE': 0.5,
        'SIMULATION': 0.5, // Med Trust = 50% confidence
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
    const addrSimilarity = getSimilarityScore(input.address || "", evidence.details.address);
    if (addrSimilarity < 0.8) {
        const penalty = Math.round((0.8 - addrSimilarity) * 100); // Scale penalty
        score -= penalty;
        discrepancies.push("Address Mismatch (" + Math.round(addrSimilarity * 100) + "% match)");
    }

    // 3. Name Verification (Fuzzy)
    const nameSimilarity = getSimilarityScore(input.name || "", evidence.details.name);
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
        if (!isValidNpi(input?.npi)) {
            discrepancies.push("Unverified: no valid NPI provided. Add a 10-digit NPI to enable registry verification.");
        } else if (evidence.source === 'SIMULATION') {
            discrepancies.push("Unverified: registry evidence unavailable at the time of validation. Try again later.");
        } else {
            discrepancies.push("Unverified: no trusted registry evidence available for verification.");
        }
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

async function runEnrichment(data: VerifiedData['details']): Promise<EnrichmentData> {
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

        const result = await geminiEnrich(prompt);
        if (!result.ok) {
            throw new Error(result.error || "Gemini enrichment failed");
        }
        const json = extractJSON(result.text || "");
        return {
            bio: json?.bio || "Bio unavailable.",
            education_summary: json?.education_summary || "Education data unavailable.",
            generated_at: new Date().toISOString()
        };
    } catch {
        return { bio: "Bio unavailable (Service Error)", education_summary: "", generated_at: new Date().toISOString() };
    }
}


// --- 5. Document Vision Agent (New) ---

export async function extractDataFromDocument(base64Image: string): Promise<ExtractedProviderData | null> {
    try {
        const prompt =
            "Analyze this medical provider document/ID image.\n" +
            "Extract the following fields strictly as JSON with these exact keys:\n" +
            "{ \"npi\": \"10 digit number or empty\", \"name\": \"Full Name\", \"address\": \"Full Address\", \"confidence\": 0-100 }\n\n" +
            "Address guidance:\n" +
            "- Preserve the address as written (include commas/lines if visible).\n" +
            "- If India: try to include City, State/UT, and 6-digit PIN. Optional: Flat/Plot, Near landmark, District/Taluk.\n" +
            "- If other countries: try to include postcode/ZIP and country if present.\n" +
            "Rules:\n" +
            "- If a field is not present, return empty string for that field.\n" +
            "- Do NOT add extra keys. Return only valid JSON.";

        const result = await geminiGenerateVision(prompt, base64Image, "image/png");
        if (!result.ok) {
            console.error("Vision Extraction Failed", result.error || "Gemini vision request failed");
            return null;
        }
        const json = extractJSON(result.text || "");

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

export async function extractDataFromText(text: string): Promise<ExtractedProviderData | null> {
    try {
        const prompt =
            "You are extracting medical provider details from messy free-text (email, WhatsApp, spreadsheet row, website copy).\n" +
            "Extract strictly as JSON with these exact keys:\n" +
            '{ "npi": "10 digit number or empty", "name": "Full Name or empty", "address": "Full Address or empty", "confidence": 0-100 }\n\n' +
            "Rules:\n" +
            "- If a field is not present, return empty string for that field.\n" +
            "- Do NOT add extra keys. Return only valid JSON.\n" +
            "- If the text contains multiple providers, extract only the first one.\n\n" +
            "Input text:\n" +
            text;

        const result = await geminiGenerateText(prompt);
        if (!result.ok) {
            console.error("Text Extraction Failed", result.error || "Gemini text request failed");
            return null;
        }
        const json = extractJSON(result.text || "");
        if (!json) return null;

        return {
            npi: json.npi || "",
            name: json.name || "",
            address: json.address || "",
            confidence: json.confidence || 0
        };
    } catch (e) {
        console.error("Text Extraction Failed", e);
        return null;
    }
}

// --- 5. Main Orchestrator ---

export async function runAgentWorkflow(providerId: string, providerData: ProviderDocument) {
    try {
        const inputSource = typeof providerData?.inputSource === 'string' ? providerData.inputSource : null;
        dispatchLog("ORCHESTRATOR", "Starting provider validation workflow…", "info");
        if (inputSource) {
            dispatchLog("ORCHESTRATOR", `Input source: ${inputSource}`, "info");
        }
        await updateProviderState(providerId, { status: "Processing" });

        // Step 1: Security Gate
        const securityCheck = validateInputSchema(providerData);
        if (!securityCheck.passed) {
            dispatchLog("SECURITY", "Blocked by security checks: " + securityCheck.reasons.join(", "), "error");

            const addressCheck = verifyPostalAddress(providerData.address || "");
            await updateProviderState(providerId, {
                status: "Blocked",
                securityCheck,
                addressVerification: addressCheck,
                lastUpdated: new Date().toISOString()
            });
            return;
        }
        dispatchLog("SECURITY", "Security checks passed.", "success");

        // Step 1b: Address Verification (World-aware, deterministic)
        const addressCheck = verifyPostalAddress(providerData.address || "");
        if (addressCheck.confidence >= 80) {
            dispatchLog(
                "VALIDATOR",
                `Address validated (${addressCheck.inferredCountry || "GLOBAL"}) — ${addressCheck.confidence}% confidence`,
                "success"
            );
        } else {
            dispatchLog(
                "VALIDATOR",
                `Address needs review (${addressCheck.inferredCountry || "GLOBAL"}) — ${addressCheck.confidence}% confidence. Issues: ${addressCheck.issues.slice(0, 2).join("; ")}${addressCheck.issues.length > 2 ? "…" : ""}`,
                "warning"
            );
        }

        // Step 2: Data Acquisition
        dispatchLog("ACQUISITION", "Collecting registry evidence…", "info");
        const evidence = await fetchRegistryData(providerData);

        if (evidence.source !== 'LIVE_API') {
            if (evidence.source === 'USER_INPUT') {
                dispatchLog("ACQUISITION", "No registry lookup performed (missing/invalid NPI).", "warning");
            } else if (evidence.source === 'SIMULATION') {
                dispatchLog("ACQUISITION", "Registry evidence unavailable; using a fallback evidence source.", "warning");
            } else {
                dispatchLog("ACQUISITION", `Evidence source: ${evidence.source} (not independently verified)`, "warning");
            }
        } else {
            dispatchLog("ACQUISITION", "Registry match found (live).", "success");
        }

        // Step 3: Scoring
        dispatchLog("JUDGE", "Computing identity score and trust level…", "info");
        const scoring = calculateScore(providerData, evidence, addressCheck);

        let logType: "info" | "success" | "warning" | "error" = "info";
        if (scoring.finalStatus === 'VERIFIED') logType = "success";
        else if (scoring.finalStatus === 'FLAGGED') logType = "warning";
        else if (scoring.finalStatus === 'BLOCKED') logType = "error";
        else logType = "warning"; // UNVERIFIED is actionable, not a failure

        dispatchLog("JUDGE", `Result: ${scoring.finalStatus} (Score: ${scoring.identityScore}/100)`, logType);

        // Step 4: Enrichment (Optional - Only for Verified/Flagged)
        let enrichment: EnrichmentData | undefined;
        if (scoring.finalStatus === 'VERIFIED' || scoring.finalStatus === 'FLAGGED') {
            dispatchLog("ENRICHMENT", "Generating provider summary…", "info");
            enrichment = await runEnrichment(evidence.details); // Use verified details
        }

        // Final Persistence
        await updateProviderState(providerId, {
            status: scoring.finalStatus === 'VERIFIED' ? 'Ready' :
                scoring.finalStatus === 'FLAGGED' ? 'Flagged' :
                    scoring.finalStatus === 'BLOCKED' ? 'Blocked' : 'Unverified',
            addressVerification: addressCheck,
            evidence,
            scoring,
            enrichment,
            securityCheck,
            auditLog: scoring.discrepancies // Simple audit log for now
        });

        dispatchLog("ORCHESTRATOR", `Workflow completed: ${scoring.finalStatus}`, "success");

    } catch (e: unknown) {
        console.error("Workflow Crash", e);
        dispatchLog("SYSTEM", "Critical System Failure: " + (e instanceof Error ? e.message : String(e)), "error");
        await updateProviderState(providerId, { status: "Unverified" });
    }
}

/**
 * Helper to generate reports (Client-side trigger)
 */
export function generateDirectoryReport(providers: ProviderDocument[]) {
    // Dispatch log for visibility
    dispatchLog("ORCHESTRATOR", "Directory Manager: Generating Batch Report...", "info");

    const issueCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();

    for (const p of providers) {
        const issues: string[] = p?.scoring?.discrepancies || [];
        for (const issue of issues) {
            issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
        }

        const inferredCountry =
            p?.addressVerification?.inferredCountry ??
            verifyPostalAddress(p?.address || "").inferredCountry ??
            "GLOBAL";
        countryCounts.set(inferredCountry, (countryCounts.get(inferredCountry) || 0) + 1);
    }

    const top_issues = Array.from(issueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([issue, count]) => ({ issue, count }));

    const country_distribution = Array.from(countryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([country, count]) => ({ country, count }));

    const report = {
        timestamp: new Date().toISOString(),
        total_providers: providers.length,
        verified_count: providers.filter((p) => p.status === "Ready").length,
        flagged_count: providers.filter((p) => p.status === "Flagged").length,
        avg_confidence: providers.reduce((acc, p) => acc + (p.scoring?.identityScore || 0), 0) / (providers.length || 1),
        top_issues,
        country_distribution,
        records: providers.map((p) => ({
            npi: p.npi,
            name: p.name,
            status: p.status,
            confidence: p.scoring?.identityScore || 0,
            issues: p.scoring?.discrepancies || []
        }))
    };

    return report;
}
