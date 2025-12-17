
export const SYNTHETIC_BATCH = [
    // 1. Valid Providers (High Quality)
    { npi: "1487000001", name: "Dr. Ananya Sharma", address: "2nd Floor, Aster Clinic, MG Road, Bengaluru, Karnataka 560001, India" },
    { npi: "1234567890", name: "Dr. Arjun Mehta", address: "Apollo Hospitals, Greams Lane, Chennai, Tamil Nadu 600006, India" },
    { npi: "1029384756", name: "Dr. Priya Nair", address: "KIMS Hospital, Anayara, Thiruvananthapuram, Kerala 695029, India" },
    { npi: "1928374650", name: "Dr. Vikram Singh", address: "Max Super Speciality Hospital, Saket, New Delhi, Delhi 110017, India" },
    { npi: "1122334455", name: "Dr. Neha Gupta", address: "Fortis Hospital, Anandapur, Kolkata, West Bengal 700107, India" },
    // A few global examples (different formats)
    { npi: "1567890123", name: "Dr. Amelia Carter", address: "10 Downing St, London SW1A 2AA, UK" },
    { npi: "1678901234", name: "Dr. Liam O'Connor", address: "1 Harbour Sq, Toronto, ON M5J 2N8, Canada" },
    { npi: "1789012345", name: "Dr. Sofia Rossi", address: "Via Roma 12, 00100 Roma RM, Italy" },
    { npi: "1890123456", name: "Dr. Kenji Tanaka", address: "1-1 Chiyoda, Chiyoda City, Tokyo 100-0001, Japan" },
    { npi: "1901234567", name: "Dr. Aisha Khan", address: "Sheikh Zayed Rd, Dubai, UAE" },

    // 2. "Sabotage" / Red Flag Cases (00000 Zip, Invalid NPIs)
    { npi: "9999999999", name: "Dr. Test Bot", address: "00000 Null Island, Null" }, // Fatal Sabotage
    { npi: "12345", name: "Dr. Short NPI", address: "123 Fake St, Springfield, IL" }, // Security Block
    { npi: "1111111111", name: "Dr. Fake Entry", address: "999 Error Way, 00000" }, // Zip Sabotage

    // 3. Mixed Quality (For variety)
    { npi: "1234567891", name: "Dr. Alice Spring", address: "PO Box 123, Panaji, Goa 403001, India" },
    { npi: "1234567892", name: "Dr. Bob Summer", address: "Unknown Location" },
    { npi: "1234567893", name: "Dr. Charlie Winter", address: "777 Lucky Strike, Las Vegas, NV 89109, USA" },
    { npi: "1234567894", name: "Dr. David Fall", address: "No. 5, Park Street, Pune, Maharashtra 411001, India" },
    { npi: "1234567895", name: "Dr. Eva Seasons", address: "12 Month St, Calendar, TX" },

    // ... Fillers used for high volume
    ...Array.from({ length: 32 }).map((_, i) => ({
        npi: `15${i.toString().padStart(8, '0')}`,
        name: `Dr. Auto Gen ${i + 1}`,
        address: `${100 + i}, Tech Park Road, Whitefield, Bengaluru, Karnataka 5600${(10 + (i % 80)).toString().padStart(2, '0')}, India`
    }))
];
