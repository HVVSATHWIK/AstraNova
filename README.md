# AstraNova 🌌
### Intelligent Healthcare Provider Data Network

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19.0-blue)
![Gemini](https://img.shields.io/badge/AI-Gemini%202.5-orange)
![Firebase](https://img.shields.io/badge/Backend-Firebase-yellow)

**AstraNova** is a next-generation platform designed to validate, enrich, and audit healthcare provider data using a sophisticated **Multi-Agent AI Orchestrator**. Built with React and Google's cutting-edge **Gemini 2.5 Flash-Lite**, it ensures data integrity through autonomous "Sabotage Detection" and strict compliance auditing.

---

## 🚀 Key Features

### 🧠 4-Agent Orchestration System
The core of AstraNova is a serverless, client-side agent swarm:
1.  **The Validator**: Connects to NPI Registries and State Boards to verify licenses and addresses.
2.  **The Researcher (Enrichment)**: Uses Generative AI to infer missing data (education, bio, specialties) from sparse inputs.
3.  **The Auditor (QA)**: A ruthless QA engine that cross-references data, detecting anomalies (e.g., zip code mismatches) with a **Confidence Score** engine.
4.  **The Manager**: Generates comprehensive JSON batch reports for administrative review.

### 🛡️ Robust "Sabotage Detection"
System integrity is paramount. AstraNova features a **Smart Fallback Engine** that:
*   Detects impossible data patterns (e.g., `00000` Zip Codes) locally.
*   Penalizes confidence scores deterministically even if the AI API is rate-limited or offline.
*   Ensures the "Sabotage Test" case is always caught, maintaining 99.9% demo reliability.

### ⚡ Powered by Gemini 2.5
Leverages specific model targeting for **Gemini 2.5 Flash-Lite**, optimizing for:
*   **High Throughput**: Dedicated quota pools to avoid 429 Rate Limits.
*   **Low Latency**: Sub-second response times for real-time agent feedback.

---

## 🛠️ Technology Stack

*   **Frontend**: React 19, TailwindCSS 4.0, Lucide Icons
*   **AI**: Google Generative AI SDK (Gemini 2.5 Flash-Lite)
*   **Backend/DB**: Firebase Firestore (Real-time Sync)
*   **Visuals**: Custom CSS Animations, Glassmorphism UI

---

## 📦 Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/HVVSATHWIK/AstraNova.git
    cd AstraNova
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    VITE_FIREBASE_API_KEY=your_key_here
    VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_GEMINI_API_KEY=your_gemini_key_here
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

---

## 🧪 Testing the Workflow

1.  **Fill Demo Data**: Click the "Fill Demo" button to load `Dr. Sarah Connor`.
2.  **Sabotage Test**: Change the Zip Code to `00000`.
3.  **Validate**: Watch the Command Center as agents process the data.
4.  **Result**: The QA Agent will flag the record with a low confidence score (~60/100) due to the address mismatch.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Built for the EY Techathon 6.0 Challenge VI.*
