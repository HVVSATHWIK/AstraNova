import { useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import clsx from "clsx";
import { LogIn, Key, Mail, CheckCircle2, ShieldCheck, Activity } from "lucide-react";

export function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err: unknown) {
            console.error("Google Login Error:", err);
            const msg = err instanceof Error ? err.message : "Failed to sign in with Google";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: unknown) {
            console.error("Email Auth Error:", err);
            const msg = err instanceof Error ? err.message : `Failed to ${isSignUp ? 'sign up' : 'sign in'}`;
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a16] p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] opacity-20 pointer-events-none" />

            <div className="w-full max-w-md relative z-10">

                {/* Brand Header */}
                <div className="text-center mb-8 space-y-2">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.3)] mb-4">
                        <img src="/favicon.svg" alt="Logo" className="h-10 w-10 drop-shadow-lg" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Astra<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Nova</span>
                    </h1>
                    <p className="text-gray-400 text-sm">Secure Agentic Verification Platform</p>
                </div>

                <div className="glass-panel rounded-2xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl">
                    <div className="space-y-6">

                        {/* Auth Mode Toggle */}
                        <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-lg">
                            <button
                                onClick={() => setIsSignUp(false)}
                                className={clsx("py-2 text-sm font-medium rounded-md transition-all",
                                    !isSignUp ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => setIsSignUp(true)}
                                className={clsx("py-2 text-sm font-medium rounded-md transition-all",
                                    isSignUp ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                Register
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                                <Key className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleEmailAuth} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Email Access</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                        placeholder="agent@astranova.ai"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Secure Token</label>
                                <div className="relative group">
                                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? <Activity className="h-4 w-4 animate-spin" /> : (isSignUp ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />)}
                                {isSignUp ? "Create Identity" : "Authenticate"}
                            </button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0f1219] px-2 text-gray-500">Or continue with</span>
                            </div>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-2.5 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 4.63c1.69 0 3.26.58 4.54 1.8l3.41-3.41C17.96 1.05 15.17 0 12 0 7.7 0 3.99 2.47 2.18 5.75l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google Workspace
                        </button>
                    </div>
                </div>

                {/* Security Badge */}
                <div className="mt-8 flex justify-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-1000">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                        <ShieldCheck className="h-4 w-4" />
                        End-to-End Encrypted
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                        <CheckCircle2 className="h-4 w-4" />
                        SOC2 Compliant
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper icon
import { UserPlus } from "lucide-react";
