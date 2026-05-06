import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { LogIn, UserPlus, Mail, Lock, Phone, Github, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area'; // Wait, I don't have ScrollArea. I'll use div with overflow-y-auto.

const TERMS_AND_CONDITIONS = `
Safety Crowd – Terms and Conditions
1. Acceptance of Terms
By downloading, accessing, or using the Safety Crowd mobile application (“App”), you agree to comply with and be bound by these Terms and Conditions. If you do not agree, please discontinue use immediately.

2. User Categories
The App provides distinct access levels:
Attendee: Uses crowd monitoring, SOS, and safety navigation features.
Organizer – Manager: Manages events, monitors zones, and dispatches staff.
Organizer – Staff: Responds to SOS alerts and assists in crowd control.
Each role has specific permissions and responsibilities defined by the event organizer.

3. Account Registration & Authentication
Users must provide accurate information during registration.
Authentication may occur via email/password, social login (Google/Facebook), or phone number with OTP verification.
“Remember Me” extends session validity up to 30 days using secure tokens (JWT or session cookies).
You are responsible for maintaining the confidentiality of your credentials.

4. Data Collection & Privacy
The App collects GPS location data to provide real-time crowd density and safety routing.
SOS triggers share your coordinates with authorized event organizers and staff only.
Data is encrypted in transit and stored securely.
For full details, refer to the Privacy Policy (linked within the App).

5. User Conduct
You agree not to:
Misuse the App for false SOS alerts or unauthorized data access.
Interfere with real-time monitoring systems.
Circumvent authentication or impersonate other users.
Violation may result in suspension or permanent account termination.

6. Safety Disclaimer
While Safety Crowd provides real-time crowd density and safety alerts, it does not guarantee absolute safety. Users are advised to follow official event instructions and emergency protocols.

7. Intellectual Property
All content, designs, and algorithms within Safety Crowd are owned by the developer. Unauthorized reproduction or reverse engineering is prohibited.

8. Limitation of Liability
The App and its developers are not liable for:
Injuries, damages, or losses arising from crowd incidents.
GPS inaccuracies or network delays.
Misuse of SOS or location data by third parties.

9. Termination
Accounts may be suspended or terminated for violating these Terms or engaging in fraudulent activity.

10. Updates & Modifications
The developer reserves the right to modify these Terms at any time. Continued use after updates constitutes acceptance of the revised Terms.

11. Governing Law
These Terms are governed by the laws of Malaysia, and any disputes shall be resolved under its jurisdiction.
`;

export function AuthForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<any>(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [signupMethod, setSignupMethod] = useState<'email' | 'phone'>('email');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const resetOtpState = () => {
    setShowOtpInput(false);
    setOtp('');
    setVerificationId(null);
  };

  const validatePassword = (pass: string) => pass.length >= 8;

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  };

  const handleSendOTP = async (phoneNumber: string) => {
    if (!phoneNumber) {
      toast.error(t('enter_phone'));
      return;
    }
    setLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setVerificationId(confirmation);
      setShowOtpInput(true);
      toast.success(t('otp_sent'));
    } catch (error: any) {
      toast.error(error.message);
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      toast.error(t('enter_otp'));
      return;
    }
    setLoading(true);
    try {
      await verificationId.confirm(otp);
      toast.success(t('phone_verified'));
    } catch (error: any) {
      toast.error(t('invalid_otp'));
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (error: any) => {
    if (error.code === 'auth/network-request-failed') {
      toast.error(t('network_error_title'), {
        description: t('network_error_description'),
        duration: 8000
      });
    } else {
      toast.error(error.message);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      toast.error(t('terms_privacy_notice'));
      return;
    }
    if (signupMethod === 'email') {
      if (!validatePassword(password)) {
        toast.error(t('pass_req_error'));
        return;
      }
      setLoading(true);
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success(t('account_created'));
      } catch (error: any) {
        handleAuthError(error);
      } finally {
        setLoading(false);
      }
    } else {
      if (showOtpInput) {
        handleVerifyOTP();
      } else {
        handleSendOTP(phone);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMethod === 'email') {
      setLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success(t('logged_in'));
      } catch (error: any) {
        handleAuthError(error);
      } finally {
        setLoading(false);
      }
    } else {
      if (showOtpInput) {
        handleVerifyOTP();
      } else {
        handleSendOTP(phone);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success(t('google_login'));
    } catch (error: any) {
      handleAuthError(error);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error(t('enter_email'));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(t('reset_email_sent'));
    } catch (error: any) {
      handleAuthError(error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto p-4"
    >
      <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">{t('crowdguard')}</CardTitle>
          <CardDescription>{t('tagline')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full" onValueChange={resetOtpState}>
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">{t('login')}</TabsTrigger>
              <TabsTrigger value="signup">{t('signup')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <div className="space-y-4">
                <div className="flex justify-center mb-4">
                  <Tabs 
                    value={loginMethod} 
                    onValueChange={(v) => {
                      setLoginMethod(v as any);
                      resetOtpState();
                    }}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="email">{t('email')}</TabsTrigger>
                      <TabsTrigger value="phone">{t('phone')}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {loginMethod === 'email' ? (
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="m@example.com" 
                          className="pl-10"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-phone">{t('phone')}</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="login-phone" 
                            type="tel" 
                            placeholder="+1 (555) 000-0000" 
                            className="pl-10"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required 
                            disabled={showOtpInput}
                          />
                        </div>
                      </div>
                      {showOtpInput && (
                        <div className="space-y-2">
                          <Label htmlFor="login-otp">{t('enter_otp')}</Label>
                          <Input 
                            id="login-otp" 
                            type="text" 
                            placeholder="123456" 
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required 
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {loginMethod === 'email' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">{t('password')}</Label>
                        <Button 
                          variant="link" 
                          className="px-0 font-normal text-xs" 
                          onClick={handleResetPassword}
                          type="button"
                        >
                          {t('forgot_password')}
                        </Button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="password" 
                          type={showPassword ? "text" : "password"} 
                          className="pl-10 pr-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-slate-900 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <Button className="w-full" type="submit" disabled={loading}>
                    {loading ? t('processing') : (
                      loginMethod === 'email' ? t('login') : (showOtpInput ? t('verify_otp') : t('request_otp'))
                    )}
                  </Button>
                  <div id="recaptcha-container"></div>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <div className="space-y-4">
                <div className="flex justify-center mb-4">
                  <Tabs 
                    value={signupMethod} 
                    onValueChange={(v) => {
                      setSignupMethod(v as any);
                      resetOtpState();
                    }}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="email">{t('email')}</TabsTrigger>
                      <TabsTrigger value="phone">{t('phone')}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    {signupMethod === 'email' ? (
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">{t('email')}</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="signup-email" 
                            type="email" 
                            placeholder="m@example.com" 
                            className="pl-10"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">{t('phone')}</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input 
                              id="phone" 
                              type="tel" 
                              placeholder="+1 (555) 000-0000" 
                              className="pl-10"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              required 
                              disabled={showOtpInput}
                            />
                          </div>
                        </div>
                        {showOtpInput && (
                          <div className="space-y-2">
                            <Label htmlFor="signup-otp">{t('enter_otp')}</Label>
                            <Input 
                              id="signup-otp" 
                              type="text" 
                              placeholder="123456" 
                              value={otp}
                              onChange={(e) => setOtp(e.target.value)}
                              required 
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {signupMethod === 'email' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">{t('password')} (min 8 chars)</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input 
                              id="signup-password" 
                              type={showPassword ? "text" : "password"} 
                              className="pl-10 pr-10"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required 
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3 text-muted-foreground hover:text-slate-900 transition-colors"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2 py-2">
                          <input 
                            type="checkbox" 
                            id="terms" 
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                          />
                          <label htmlFor="terms" className="text-xs text-slate-600">
                            {t('terms_conditions')}
                            <Dialog>
                              <DialogTrigger asChild>
                                <button type="button" className="text-blue-600 underline hover:text-blue-800 ml-1">{t('terms_conditions')}</button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                                <DialogHeader>
                                  <DialogTitle>{t('terms_conditions')}</DialogTitle>
                                  <DialogDescription>{t('terms_read_carefully')}</DialogDescription>
                                </DialogHeader>
                                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-lg text-xs leading-relaxed whitespace-pre-wrap">
                                  {TERMS_AND_CONDITIONS}
                                </div>
                                <DialogFooter>
                                  <Button onClick={() => setAgreedToTerms(true)}>{t('accept')}</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </label>
                        </div>
                      </div>
                    )}
                    <Button className="w-full" type="submit" disabled={loading}>
                      {loading ? t('processing') : (
                        signupMethod === 'email' ? t('signup') : (showOtpInput ? t('verify_otp') : t('request_otp'))
                      )}
                    </Button>
                  </form>
              </div>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">{t('continue_with')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Button variant="outline" onClick={handleGoogleLogin} className="w-full">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {t('continue_google')}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground">
          {t('terms_privacy_notice')}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
