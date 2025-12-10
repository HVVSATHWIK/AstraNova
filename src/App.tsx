import { useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { signInAnonymously } from "firebase/auth";
import { auth } from "./lib/firebase";

function App() {
  useEffect(() => {
    // Automatically sign in anonymously to satisfy potential "request.auth != null" rules
    signInAnonymously(auth).catch((err) => {
      console.error("Failed to sign in anonymously:", err);
    });
  }, []);

  return <Dashboard />;
}

export default App;
