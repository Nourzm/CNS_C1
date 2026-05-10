import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scan, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function friendlySignupError(msg: string | undefined): string {
  if (!msg) return "Sign-up failed.";
  const lower = msg.toLowerCase();
  if (lower.includes("@ensia.edu.dz") || lower.includes("database error")) {
    return "Sign-up is restricted to @ensia.edu.dz email addresses.";
  }
  return msg;
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const { session, blockedReason, clearBlockedReason } = useAuth();

  // Show the "not a teacher" message from useAuth, then clear it.
  useEffect(() => {
    if (blockedReason) setLoginError(blockedReason);
    return () => { if (blockedReason) clearBlockedReason(); };
  }, [blockedReason]);

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // signup
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);

  // otp
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  if (session) return <Navigate to="/dashboard" replace />;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      if (error.message.includes("Email not confirmed")) {
        setLoginError("Please verify your email address before logging in.");
      } else {
        setLoginError(error.message);
      }
    }
    // Teacher check happens automatically in useAuth via onAuthStateChange.
    // If not a teacher, useAuth signs them out and sets blockedReason.
    setIsLoggingIn(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingReset(true);
    setForgotError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSendingReset(false);
    if (error) {
      setForgotError(error.message);
      return;
    }
    setForgotSent(true);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningUp(true);
    setSignupError(null);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: { data: { full_name: signupName, role: "teacher" } },
    });
    setIsSigningUp(false);
    if (error) {
      setSignupError(friendlySignupError(error.message));
    } else if (
      data?.user &&
      data.user.identities &&
      data.user.identities.length === 0
    ) {
      // Email already exists in auth but unconfirmed — resend the code and go to OTP screen
      await supabase.auth.resend({ type: "signup", email: signupEmail });
      setShowOtpInput(true);
    } else {
      setShowOtpInput(true);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingOtp(true);
    setOtpError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: signupEmail,
      token: otp,
      type: "email",
    });
    if (error) {
      setOtpError(error.message);
    }
    // Teacher check happens automatically in useAuth via onAuthStateChange.
    // If not a teacher, useAuth signs them out and sets blockedReason.
    setIsVerifyingOtp(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-bold text-xl mb-2"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Scan className="w-6 h-6 text-primary" />
            </div>
            <span>FaceGuard</span>
          </Link>
          <p className="text-muted-foreground text-sm">
            Secure AI-powered authentication
          </p>
        </div>
        <div className="glass rounded-2xl p-8">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              {!forgotMode ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {loginError && (
                    <div className="text-sm font-medium text-destructive">
                      {loginError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@ensia.edu.dz"
                        className="pl-10"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => {
                          setForgotMode(true);
                          setForgotEmail(loginEmail);
                          setForgotSent(false);
                          setForgotError(null);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="········"
                        className="pl-10 pr-10"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full glow-sm"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-medium">
                      Reset your password
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter your @ensia.edu.dz email and we'll send a reset
                      link.
                    </p>
                  </div>
                  {forgotSent ? (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
                      Reset link sent to <strong>{forgotEmail}</strong>. Check
                      your inbox.
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      {forgotError && (
                        <div className="text-sm font-medium text-destructive">
                          {forgotError}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="you@ensia.edu.dz"
                            className="pl-10"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full glow-sm"
                        disabled={isSendingReset}
                      >
                        {isSendingReset ? "Sending..." : "Send reset link"}
                      </Button>
                    </form>
                  )}
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setForgotMode(false)}
                  >
                    ← Back to login
                  </button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="signup">
              {!showOtpInput ? (
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  {signupError && (
                    <div className="text-sm font-medium text-destructive">
                      {signupError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Zoubir Bousnina"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@ensia.edu.dz"
                        className="pl-10"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Only @ensia.edu.dz emails can sign up.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="········"
                        className="pl-10 pr-10"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full glow-sm"
                    disabled={isSigningUp}
                  >
                    {isSigningUp ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-medium text-foreground">
                      Verify your email
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      We've sent a verification code to{" "}
                      <span className="text-primary">{signupEmail}</span>.
                    </p>
                  </div>
                  {otpError && (
                    <div className="text-sm font-medium text-destructive text-center">
                      {otpError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-center block">
                      Verification Code
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      placeholder="········"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="text-center tracking-[0.5em] text-lg font-mono placeholder:tracking-normal"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full glow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={isVerifyingOtp || otp.length < 6}
                  >
                    {isVerifyingOtp ? "Verifying..." : "Verify Code"}
                  </Button>
                  <div className="text-center mt-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setShowOtpInput(false)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Back to sign up
                    </button>
                  </div>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>
  );
}
