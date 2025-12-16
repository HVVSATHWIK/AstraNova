
export const SYNTHETIC_BATCH = [
    // 1. Valid Providers (High Quality)
    { npi: "1487000001", name: "Dr. Sarah Smith", address: "450 Sutter St, San Francisco, CA 94108" },
    { npi: "1234567890", name: "Dr. James Wilson", address: "100 Broadway, New York, NY 10005" },
    { npi: "1029384756", name: "Dr. Emily Chen", address: "500 University Ave, Palo Alto, CA 94301" },
    { npi: "1928374650", name: "Dr. Michael Ross", address: "789 Pine St, Seattle, WA 98101" },
    { npi: "1122334455", name: "Dr. Lisa Cuddy", address: "1 Plainsboro Rd, Princeton, NJ 08540" },
    { npi: "1567890123", name: "Dr. Gregory House", address: "221B Baker St, London, UK" }, // Will likely flag address
    { npi: "1678901234", name: "Dr. John Dorian", address: "123 Sacred Heart Dr, San DiFrangeles, CA" },
    { npi: "1789012345", name: "Dr. Chris Turk", address: "456 Surgery Ln, Chicago, IL 60611" },
    { npi: "1890123456", name: "Dr. Elliot Reid", address: "789 Endocrinology Blvd, Boston, MA 02115" },
    { npi: "1901234567", name: "Dr. Perry Cox", address: "101 Anger Mgmt Way, Miami, FL 33101" },

    // 2. "Sabotage" / Red Flag Cases (00000 Zip, Invalid NPIs)
    { npi: "9999999999", name: "Dr. Test Bot", address: "00000 Null Island, Null" }, // Fatal Sabotage
    { npi: "12345", name: "Dr. Short NPI", address: "123 Fake St, Springfield, IL" }, // Security Block
    { npi: "1111111111", name: "Dr. Fake Entry", address: "999 Error Way, 00000" }, // Zip Sabotage

    // 3. Mixed Quality (For variety)
    { npi: "1234567891", name: "Dr. Alice Spring", address: "PO Box 123, Rural Route, NV" },
    { npi: "1234567892", name: "Dr. Bob Summer", address: "Unknown Location" },
    { npi: "1234567893", name: "Dr. Charlie Winter", address: "777 Lucky Strike, Las Vegas, NV 89109" },
    { npi: "1234567894", name: "Dr. David Fall", address: "888 Golden Gate, San Francisco, CA" },
    { npi: "1234567895", name: "Dr. Eva Seasons", address: "12 Month St, Calendar, TX" },

    // ... Fillers used for high volume
    ...Array.from({ length: 32 }).map((_, i) => ({
        npi: `15${i.toString().padStart(8, '0')}`,
        name: `Dr. Auto Gen ${i + 1}`,
        address: `${100 + i} Simulation Blvd, Tech City, CA 94000`
    }))
];
