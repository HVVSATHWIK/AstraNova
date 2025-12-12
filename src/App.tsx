import { useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "./lib/firebase";
import { Loader2 } from "lucide-react";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a16] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
        <span className="text-xs uppercase tracking-widest text-gray-500 animate-pulse">Initializing Secure Environment...</span>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginPage />;
}

export default App;
