import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Trophy, Wallet, User as UserIcon, Settings, Home, Gift, LogOut, CheckCircle, XCircle, Plus, Edit, ChevronLeft, Lock, Users, Activity, FileText, Smartphone, Mail, RefreshCw, Facebook, Instagram, Twitter, Camera, ChevronRight, HelpCircle, Share2, MessageCircle, Eye, EyeOff, Trash2, Link, UserPlus, Banknote, CreditCard, Upload, Clock, Ban } from 'lucide-react';
import { backend } from './services/mockBackend';
import { auth } from './services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { User, UserRole, Contest, WithdrawRequest, Match, WalletTransaction, PointRule, MatchScore, AppConfig, SocialLink, Player, PlayerRole, DepositRequest } from './types';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { AppLayout } from './components/AppLayout';

// --- Contexts ---
const AuthContext = React.createContext<{
  user: User | null;
  role: UserRole;
  login: (email: string, pass: string) => Promise<{success: boolean, error?: string}>;
  register: (email: string, pass: string, name: string, username: string, referralCode?: string) => Promise<{success: boolean, error?: string}>;
  logout: () => void;
  setUser: (u: User | null) => void;
  setRole: (r: UserRole) => void;
}>({
  user: null,
  role: UserRole.GUEST,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
  setUser: () => {},
  setRole: () => {},
});

const useAuth = () => React.useContext(AuthContext);

// --- Components ---

const MatchCard: React.FC<{ match: Match; onClick: () => void }> = ({ match, onClick }) => {
  if (!match) return null;

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'LIVE': return 'bg-red-600 animate-pulse';
      case 'COMPLETED': return 'bg-gray-500';
      default: return 'bg-blue-600';
    }
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all active:scale-95 cursor-pointer relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg ${getStatusColor(match.status)}`}>
        {match.status}
      </div>
      
      <div className="text-xs text-gray-500 text-center mb-2 border-b border-gray-100 pb-2">
        {new Date(match.date).toLocaleString()}
      </div>
      
      <div className="flex justify-between items-center px-4">
        <div className="font-bold text-lg w-12 text-left truncate">{match.teamA}</div>
        <div className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-full">VS</div>
        <div className="font-bold text-lg w-12 text-right truncate">{match.teamB}</div>
      </div>

      {match.status === 'LIVE' ? (
        <div className="mt-3 text-center bg-red-50 p-2 rounded-lg border border-red-100">
          {!match.score ? (
            <div className="text-xs text-gray-500 animate-pulse">Loading Live Score...</div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-red-700">
                {match.score.runs}/{match.score.wickets}
              </span>
              <span className="text-xs text-gray-600">
                ({match.score.overs} Overs)
              </span>
            </div>
          )}
        </div>
      ) : match.status === 'COMPLETED' ? (
        <div className="mt-3 text-center bg-gray-50 p-2 rounded-lg border border-gray-100">
             <div className="text-xs font-bold text-gray-600">Match Completed</div>
             {match.result && <div className="text-[10px] text-gray-500">{match.result}</div>}
        </div>
      ) : (
        <div className="mt-3 text-center">
           <span className="text-xs text-green-600 font-medium">Mega Contest Available</span>
        </div>
      )}
    </div>
  );
};

// --- Pages: Auth ---
const SplashScreen = () => {
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();
  
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="h-full w-full bg-red-600 flex flex-col items-center justify-center animate-fade-in">
        <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-2xl animate-bounce">
          <Trophy size={80} className="text-red-600" />
        </div>
      </div>
    );
  }

  if (role === UserRole.ADMIN) return <Navigate to="/admin/dashboard" />;
  if (role === UserRole.USER) return <Navigate to="/user/home" />;
  return <Navigate to="/auth/login" />;
};

const LoginPage = () => {
  const { login, role, setUser, setRole, logout } = useAuth();
  const navigate = useNavigate();
  
  // Email State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Forgot Password State
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // Use simple sanitizer to prevent saving circular objects
  const sanitizeUser = (u: User): User => ({
    id: u.id,
    email: u.email,
    phoneNumber: u.phoneNumber,
    username: u.username,
    name: u.name,
    balance: u.balance,
    joinedContests: u.joinedContests || [],
    referralCode: u.referralCode,
    referredBy: u.referredBy,
    referredByCode: u.referredByCode,
    isBanned: u.isBanned,
    lastWithdrawalDate: u.lastWithdrawalDate,
    avatar: u.avatar
  });

  useEffect(() => {
    if (role === UserRole.USER) navigate('/user/home');
    if (role === UserRole.ADMIN) navigate('/admin/dashboard');
  }, [role, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await login(email, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Login failed');
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) return setError("Enter email first.");
    setLoading(true);
    const res = await backend.resetPassword(forgotEmail);
    setLoading(false);
    if(res.success) {
       alert(res.message);
       setShowForgot(false);
    } else {
       setError(res.message);
    }
  };

  if (showForgot) {
    return (
      <div className="h-full bg-white p-8 flex flex-col justify-center max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4">Reset Password</h2>
        <p className="text-gray-500 text-sm mb-6">Enter your registered email to receive a password reset link.</p>
        <Input 
          type="email" 
          label="Email Address" 
          value={forgotEmail} 
          onChange={e => setForgotEmail(e.target.value)} 
          placeholder="name@example.com"
        />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <div className="mt-6 flex gap-3">
           <Button variant="secondary" onClick={() => setShowForgot(false)} fullWidth>Cancel</Button>
           <Button onClick={handleForgotPassword} disabled={loading} fullWidth>{loading ? 'Sending...' : 'Send Link'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white p-8 flex flex-col justify-center max-w-md mx-auto relative">
      <div className="mb-6 text-center">
        <div className="inline-block p-4 bg-red-50 rounded-full mb-4">
           <Trophy className="w-12 h-12 text-red-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Team 11</h2>
        <p className="text-gray-500">Fantasy Cricket App</p>
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <Input 
          type="email" 
          label="Email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          required 
          placeholder="Enter email"
        />
        <Input 
          type={showPassword ? "text" : "password"}
          label="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          required 
          placeholder="Enter password"
          endIcon={showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          onEndIconClick={() => setShowPassword(!showPassword)}
        />
        <div className="text-right">
           <span onClick={() => { setShowForgot(true); setError(''); }} className="text-sm text-red-600 font-bold cursor-pointer hover:underline">Forgot Password?</span>
        </div>
        {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? 'Authenticating...' : 'Login'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        New here? <span onClick={() => navigate('/auth/register')} className="text-red-600 font-bold cursor-pointer hover:underline">Create Account</span>
      </p>
    </div>
  );
};

const RegisterPage = () => {
  const { register, role } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referral, setReferral] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role === UserRole.USER) navigate('/user/home');
  }, [role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await register(email, password, name, username, referral);
    setLoading(false);
    if (!res.success) {
      setError(res.error || "Registration failed");
    }
  };

  return (
    <div className="h-full bg-white p-8 flex flex-col justify-center max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900">Join Team 11</h2>
        <p className="text-gray-500">Play Fantasy Cricket!</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input type="text" label="Full Name" value={name} onChange={e => setName(e.target.value)} required placeholder="John Doe" />
        <Input type="text" label="Username (Unique)" value={username} onChange={e => setUsername(e.target.value)} required placeholder="john123" />
        <Input type="email" label="Email Address" value={email} onChange={e => setEmail(e.target.value)} required placeholder="john@example.com" />
        <Input 
          type={showPassword ? "text" : "password"}
          label="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          required 
          placeholder="******" 
          endIcon={showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          onEndIconClick={() => setShowPassword(!showPassword)}
        />
        <Input type="text" label="Referral Code (Optional)" value={referral} onChange={e => setReferral(e.target.value)} placeholder="Enter code" />
        
        {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
        <Button type="submit" fullWidth disabled={loading}>{loading ? 'Creating Account...' : 'Register'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account? <span onClick={() => navigate('/auth/login')} className="text-red-600 font-bold cursor-pointer hover:underline">Login</span>
      </p>
    </div>
  );
};

// --- Pages: User ---
const UserNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = (path: string) => location.pathname.includes(path) ? 'text-red-600' : 'text-gray-400';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 pb-6 max-w-md mx-auto shadow-lg z-20">
      <button onClick={() => navigate('/user/home')} className={`flex flex-col items-center ${active('/home')}`}>
        <Home size={24} />
        <span className="text-[10px] font-bold mt-1">Home</span>
      </button>
      <button onClick={() => navigate('/user/wallet')} className={`flex flex-col items-center ${active('/wallet')}`}>
        <Wallet size={24} />
        <span className="text-[10px] font-bold mt-1">Wallet</span>
      </button>
      <button onClick={() => navigate('/user/rewards')} className={`flex flex-col items-center ${active('/rewards')}`}>
        <Gift size={24} />
        <span className="text-[10px] font-bold mt-1">Rewards</span>
      </button>
    </nav>
  );
};

const UserHome = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Enable auto-sync of matches
    backend.checkAndSyncMatches();

    const unsub = backend.subscribeToMatches(setMatches);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  return (
    <AppLayout 
      title="Team 11" 
      headerRight={
         <div onClick={() => navigate('/user/about')} className="cursor-pointer">
           {user?.avatar ? (
             <img src={user.avatar} alt="Profile" className="w-9 h-9 rounded-full border-2 border-red-200 shadow-sm bg-white" />
           ) : (
             <div className="w-9 h-9 bg-white text-red-600 rounded-full flex items-center justify-center font-bold border-2 border-red-200 shadow-sm">
               {user?.name?.charAt(0).toUpperCase() || <UserIcon size={20} />}
             </div>
           )}
         </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-700 to-red-500 rounded-xl p-4 text-white shadow-lg mb-2 relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-20 bg-white/10 skew-x-12"></div>
          <h2 className="text-xl font-bold italic">IPL 2025</h2>
          <p className="text-red-100 text-sm mb-3">Mega Contest is LIVE!</p>
          <button className="bg-white text-red-600 px-4 py-1 rounded-full text-xs font-bold shadow-md">Play Now</button>
        </div>

        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
          <Activity size={18} className="text-red-600" /> Upcoming Matches
        </h3>
        
        {matches.length === 0 && <p className="text-gray-500 text-center py-8">No upcoming matches.</p>}
        
        <div className="space-y-3">
          {matches.map(match => (
            <MatchCard 
              key={match.id}
              match={match}
              onClick={() => navigate(`/user/match/${match.id}`)}
            />
          ))}
        </div>
      </div>
      <UserNav />
    </AppLayout>
  );
};

const UserMatchContests = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<'contests' | 'squad'>('contests');

  useEffect(() => {
    // We need the match data to show squad
    const unsubMatch = backend.subscribeToMatches((ms) => {
       setMatches(ms);
    });
    const unsubContest = backend.subscribeToContests(id!, setContests);
    return () => {
       unsubMatch();
       unsubContest();
    };
  }, [id]);

  const match = matches.find(m => m.id === id);

  const handleJoin = async (contest: Contest) => {
    if(!user) return;
    if(window.confirm(`Join this contest for ₹${contest.entryFee}?`)) {
       const res = await backend.joinContest(user.id, contest.id, "Match");
       alert(res.message);
    }
  };

  return (
     <AppLayout showHeader={false}>
        <div className="bg-red-600 text-white p-4 pb-12 sticky top-0 z-10 shadow-lg">
           <div className="flex items-center gap-4 mb-4">
             <ChevronLeft onClick={() => navigate(-1)} className="cursor-pointer" />
             <h1 className="font-bold text-lg">{match ? `${match.teamA} vs ${match.teamB}` : 'Match'}</h1>
           </div>
           
           <div className="flex bg-red-700/50 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('contests')} 
                className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'contests' ? 'bg-white text-red-600 shadow' : 'text-white/70'}`}
              >
                Contests
              </button>
              <button 
                onClick={() => setActiveTab('squad')} 
                className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'squad' ? 'bg-white text-red-600 shadow' : 'text-white/70'}`}
              >
                Squads
              </button>
           </div>
        </div>
        
        <div className="-mt-8 px-4 space-y-4 rounded-t-3xl bg-gray-50 min-h-screen pt-6 pb-20">
           {activeTab === 'contests' ? (
             <>
               {contests.length === 0 && <p className="text-center text-gray-500 mt-10">No contests added yet.</p>}
               {contests.map(c => {
                 const isJoined = user?.joinedContests.includes(c.id);
                 const isFull = c.filledSpots >= c.totalSpots;
                 const isClosed = c.isClosed || isFull;
                 
                 return (
                   <div key={c.id} className={`bg-white rounded-lg shadow p-4 border-l-4 ${c.type === 'PRACTICE' ? 'border-blue-500' : 'border-red-500'} ${isClosed ? 'opacity-75' : ''}`}>
                     <div className="flex justify-between mb-2">
                       <span className="text-xs font-bold text-gray-500">{c.type === 'PRACTICE' ? 'Practice Contest' : 'Paid Contest'}</span>
                       {isJoined && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 rounded">Joined</span>}
                     </div>
                     <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="text-xs text-gray-400">Prize Pool</p>
                          <p className="font-bold text-lg text-gray-900">₹{c.winningAmount}</p>
                        </div>
                        <Button 
                          className={`py-1 px-4 text-sm ${c.type === 'PRACTICE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                          onClick={() => handleJoin(c)}
                          disabled={isJoined || isClosed}
                        >
                          {isJoined ? 'Joined' : isClosed ? 'Closed' : c.type === 'PRACTICE' ? 'Join Free' : `₹${c.entryFee}`}
                        </Button>
                     </div>
                     <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className="bg-gray-400 h-full transition-all" style={{width: `${(c.filledSpots/c.totalSpots)*100}%`}}></div>
                     </div>
                     <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                       <span className="font-semibold text-gray-700">{c.filledSpots}/{c.totalSpots} spots filled</span>
                       <span className={c.totalSpots - c.filledSpots < 5 ? 'text-red-500 font-bold' : ''}>{c.totalSpots - c.filledSpots} spots left</span>
                     </div>
                   </div>
                 )
               })}
             </>
           ) : (
             <div className="space-y-3">
                {!match?.players || match.players.length === 0 ? (
                   <div className="text-center py-10 text-gray-500">
                      <Users size={48} className="mx-auto mb-2 text-gray-300" />
                      <p>Squads not announced yet.</p>
                   </div>
                ) : (
                   match.players.map(p => (
                      <div key={p.id} className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs ${p.teamName === match.teamA ? 'bg-blue-600' : 'bg-yellow-600'}`}>
                               {p.role}
                            </div>
                            <div>
                               <div className="font-bold text-sm">{p.name}</div>
                               <div className="text-xs text-gray-500">{p.teamName} • {p.role === 'BAT' ? 'Batsman' : p.role === 'BWL' ? 'Bowler' : p.role === 'AR' ? 'All-Rounder' : 'Wicket Keeper'}</div>
                            </div>
                         </div>
                         <div className="font-bold text-sm text-gray-700">{p.credits} Cr</div>
                      </div>
                   ))
                )}
             </div>
           )}
        </div>
     </AppLayout>
  );
}

const UserWallet = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'balance' | 'history'>('balance');
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upi, setUpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  
  // Deposit Modal
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  useEffect(() => {
    if(user) {
      const unsubTx = backend.subscribeToTransactions(user.id, setTransactions);
      const unsubReq = backend.subscribeToUserDepositRequests(user.id, setDepositRequests);
      return () => {
         unsubTx();
         unsubReq();
      };
    }
  }, [user]);

  useEffect(() => {
     backend.getAppConfig().then(setAppConfig);
  }, []);

  const handleInitiateDeposit = () => {
    if (!user || !amount || isNaN(Number(amount)) || Number(amount) < 1) {
       alert("Please enter a valid amount.");
       return;
    }
    setShowDepositModal(true);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if(file) {
        // Use URL.createObjectURL for preview in this environment
        const url = URL.createObjectURL(file);
        setScreenshot(url);
     }
  };

  const submitDepositRequest = async () => {
    if(!user || !screenshot || !utr) {
      alert("Please enter Amount, UTR Number, and upload Screenshot.");
      return;
    }
    setLoading(true);
    // In a real app, upload the file to Firebase Storage here.
    // For this mock:
    await backend.createDepositRequest(user.id, user.name, Number(amount), screenshot, utr); 
    setLoading(false);
    setShowDepositModal(false);
    setAmount('');
    setUtr('');
    setScreenshot(null);
    alert("Deposit Request Sent! Admin will verify and credit your wallet.");
  };

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount || !upi) return;
    setLoading(true);
    const res = await backend.createWithdrawRequest(user.id, user.email || user.phoneNumber || 'User', Number(withdrawAmount), upi);
    setLoading(false);
    alert(res.message);
    if(res.success) {
      setWithdrawAmount('');
      setUpi('');
    }
  };

  // Combine History
  const combinedHistory = [
     ...transactions.map(t => ({ 
        id: t.id, 
        type: t.type, 
        amount: t.amount, 
        date: t.date, 
        description: t.description, 
        status: t.status || 'SUCCESS' 
     })),
     ...depositRequests
       .filter(r => r.status !== 'APPROVED') // Don't show approved requests here as they are in transactions
       .map(r => ({
         id: r.id,
         type: 'DEPOSIT_REQ',
         amount: r.amount,
         date: r.date,
         description: `Deposit Request (UTR: ${r.utrNumber})`,
         status: r.status
     }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <AppLayout title="Wallet">
      <div className="flex bg-white border-b sticky top-0 z-10">
        <button onClick={() => setActiveTab('balance')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'balance' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>Balance</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'history' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>History</button>
      </div>

      {activeTab === 'balance' ? (
        <div className="p-6 space-y-6">
          <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
             <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full"></div>
             <p className="text-gray-400 text-xs mb-1">Total Balance</p>
             <h2 className="text-4xl font-bold">₹{user?.balance || 0}</h2>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Add Cash</h3>
            <div className="flex gap-2 mb-2">
               {[100, 200, 500].map(amt => (
                  <button key={amt} onClick={() => setAmount(amt.toString())} className="px-3 py-1 rounded-full border border-gray-300 text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">
                     + ₹{amt}
                  </button>
               ))}
            </div>
            <div className="flex gap-2">
              <Input type="number" placeholder="Enter Amount" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <Button fullWidth onClick={handleInitiateDeposit}>Request Deposit</Button>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-bold text-gray-800">Withdraw Winnings</h3>
            <Input type="number" placeholder="Amount (Min ₹100)" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
            <Input type="text" placeholder="UPI ID (e.g. 9876543210@ybl)" value={upi} onChange={e => setUpi(e.target.value)} />
            <Button fullWidth variant="outline" onClick={handleWithdraw} disabled={loading}>{loading ? 'Verifying...' : 'Withdraw'}</Button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {combinedHistory.length === 0 && <p className="text-center text-gray-400 py-10">No history yet.</p>}
          {combinedHistory.map((item: any) => {
             const isPositive = ['DEPOSIT', 'WIN', 'REFERRAL', 'DEPOSIT_REQ'].includes(item.type) && item.status !== 'REJECTED';
             const isPending = item.status === 'PENDING';
             const isRejected = item.status === 'REJECTED';
             
             return (
              <div key={item.id} className="p-4 flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800">{item.description}</p>
                  <p className="text-xs text-gray-400">{new Date(item.date).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className={`font-bold block ${isRejected ? 'text-gray-400 line-through' : isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : '-'}₹{item.amount}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isPending ? 'bg-orange-100 text-orange-600' : isRejected ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Deposit Request Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-lg">Deposit Request</h3>
                 <XCircle className="cursor-pointer text-gray-400 hover:text-red-600" onClick={() => !loading && setShowDepositModal(false)} />
              </div>
              
              <div className="space-y-4">
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-800 font-bold uppercase mb-1">Transfer Amount</p>
                    <p className="text-3xl font-bold text-blue-900 mb-4">₹{amount}</p>
                    
                    <p className="text-xs text-gray-500 mb-1">Send to UPI ID:</p>
                    <div className="flex items-center gap-2 bg-white p-2 rounded border border-blue-100">
                       <code className="flex-1 font-mono text-sm">{appConfig?.depositUpiId || 'admin@upi'}</code>
                       <button className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold" onClick={() => navigator.clipboard.writeText(appConfig?.depositUpiId || '')}>COPY</button>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <Input label="UTR / Transaction Ref No." placeholder="Enter 12 digit UTR" value={utr} onChange={e => setUtr(e.target.value)} />
                    
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">Upload Payment Screenshot</label>
                       <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-red-400 transition cursor-pointer relative">
                          <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          {screenshot ? (
                             <div className="flex flex-col items-center">
                                <img src={screenshot} alt="Preview" className="h-32 object-contain mb-2 rounded" />
                                <span className="text-xs text-green-600 font-bold">Image Selected</span>
                             </div>
                          ) : (
                             <div className="flex flex-col items-center text-gray-400">
                                <Upload size={32} className="mb-2" />
                                <span className="text-sm">Click to Upload</span>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>

                 <Button fullWidth onClick={submitDepositRequest} disabled={loading || !screenshot || !utr}>
                    {loading ? 'Submitting...' : 'Submit Request'}
                 </Button>
              </div>
           </div>
        </div>
      )}
      
      <UserNav />
    </AppLayout>
  );
};

const UserRewards = () => {
  const { user } = useAuth();
  
  return (
    <AppLayout title="Refer & Earn">
      <div className="p-6 text-center space-y-6">
         <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="Refer" className="w-32 h-32 mx-auto" />
         <h2 className="text-2xl font-bold text-gray-900">Invite Friends & Earn</h2>
         <p className="text-gray-500">Share your unique code. You get ₹5, they get ₹2!</p>
         
         <div className="bg-red-50 border-2 border-dashed border-red-200 p-4 rounded-xl">
            <p className="text-xs text-red-500 uppercase font-bold mb-2">Your Referral Code</p>
            <div className="text-3xl font-black text-gray-800 tracking-widest">{user?.referralCode}</div>
         </div>
         
         <Button fullWidth onClick={() => {
           navigator.clipboard.writeText(user?.referralCode || '');
           alert("Code Copied!");
         }}>Copy Code</Button>
      </div>
      <UserNav />
    </AppLayout>
  );
};

const UserAbout = () => {
  const { logout, user } = useAuth();
  const [pointsRules, setPointsRules] = useState<PointRule[]>([]);
  const [showAvatars, setShowAvatars] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  // View State
  const [currentView, setCurrentView] = useState<'main' | 'follow' | 'contact'>('main');
  
  const navigate = useNavigate();

  useEffect(() => {
     backend.getPointRules().then(setPointsRules);
     backend.getAppConfig().then(setAppConfig);
  }, []);

  const avatars = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Cricket1&clothing=blazerAndShirt',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Cricket2&clothing=collarAndSweater',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Cricket3&clothing=graphicShirt',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Cricket4&clothing=hoodie',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Cricket5&clothing=overall',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Cricket6&clothing=shirtCrewNeck',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Cricket7&clothing=shirtScoopNeck',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Cricket8&clothing=shirtVNeck',
  ];

  const handleUpdateAvatar = async (url: string) => {
    if (!user) return;
    await backend.updateUserProfile(user.id, { avatar: url });
    setShowAvatars(false);
    // User context will auto-update via listener in AuthProvider
  };

  // Helper for rendering list items
  const SettingItem: React.FC<{ 
    icon: any, 
    label: string, 
    onClick?: () => void, 
    subLabel?: string, 
    external?: boolean, 
    arrow?: boolean,
    className?: string
  }> = ({ icon: Icon, label, onClick, subLabel, external, arrow = true, className = '' }) => (
    <div onClick={onClick} className={`flex items-center p-4 bg-white hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors group ${className}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 transition-colors ${className.includes('text-red-600') ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600 group-hover:bg-red-50 group-hover:text-red-600'}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <h4 className={`font-semibold text-sm ${className.includes('text-red-600') ? 'text-red-600' : 'text-gray-900'}`}>{label}</h4>
        {subLabel && <p className="text-xs text-gray-500 mt-0.5">{subLabel}</p>}
      </div>
      {external ? <div className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded">OPEN</div> : arrow && <ChevronRight size={18} className="text-gray-300 group-hover:text-red-400 transition-colors" />}
    </div>
  );

  return (
    <AppLayout showHeader={false}>
      
      {currentView === 'main' ? (
        <>
          {/* Main Profile Header */}
          <div className="bg-red-600 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
             {/* ... existing header code ... */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
             <div className="flex justify-between items-start">
                 <div onClick={() => navigate(-1)} className="p-2 bg-white/20 rounded-full cursor-pointer hover:bg-white/30 transition">
                   <ChevronLeft size={20} />
                 </div>
                 <div onClick={() => {
                   logout();
                   navigate('/auth/login');
                 }} className="p-2 bg-red-800/50 rounded-full cursor-pointer hover:bg-red-800 transition">
                   <LogOut size={20} />
                 </div>
             </div>
             <div className="flex flex-col items-center mt-4">
                {/* Avatar */}
                <div className="relative group cursor-pointer" onClick={() => setShowAvatars(true)}>
                  {/* ... avatar img ... */}
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-100 object-cover" />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center text-4xl font-bold text-gray-400">
                      {user?.name?.charAt(0)}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 bg-white text-red-600 p-2 rounded-full shadow-md hover:bg-gray-100 transition">
                    <Camera size={16} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mt-3">{user?.name}</h2>
                <p className="text-red-100 text-sm opacity-90">@{user?.username}</p>
             </div>
          </div>

          <div className="px-4 -mt-8 pb-24 space-y-6">
            {/* Stats Card */}
            <div className="bg-white rounded-xl shadow-md p-4 flex justify-between items-center text-center divide-x border border-gray-100">
               <div className="flex-1">
                  <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Balance</div>
                  <div className="text-lg font-bold text-green-600">₹{user?.balance}</div>
               </div>
               <div className="flex-1">
                  <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Ref Code</div>
                  <div className="text-lg font-bold text-gray-800">{user?.referralCode}</div>
               </div>
            </div>

            {/* Menu Groups */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                 <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">Account</div>
                 <SettingItem icon={UserIcon} label="Personal Info" subLabel={user?.email || user?.phoneNumber} />
                 <SettingItem icon={Wallet} label="My Wallet" onClick={() => navigate('/user/wallet')} />
                 <SettingItem icon={Users} label="Change Avatar" onClick={() => setShowAvatars(true)} />
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                 <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">Support & More</div>
                 <SettingItem icon={HelpCircle} label="Fantasy Point System" onClick={() => alert("Scoring: " + pointsRules.map(r => `${r.action}: ${r.points}`).join(', '))} />
                 <SettingItem icon={Mail} label="Contact Us" onClick={() => setCurrentView('contact')} />
                 <SettingItem icon={Share2} label="Follow Us" onClick={() => setCurrentView('follow')} />
              </div>

               {/* Logout Button */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                 <SettingItem 
                   icon={LogOut} 
                   label="Logout" 
                   onClick={() => {
                      logout();
                      navigate('/auth/login');
                   }} 
                   className="text-red-600"
                   arrow={false}
                 />
              </div>
            </div>
            
            <div className="text-center text-xs text-gray-400 pb-4">
              <p>Developed by <span className="font-bold">{appConfig?.developerName || 'Team 11 Devs'}</span></p>
              <p>App Version 1.2.0</p>
            </div>
          </div>
        </>
      ) : (
        // Sub Views (Follow Us / Contact Us)
        <div className="bg-gray-50 min-h-full">
            <div className="bg-red-600 text-white p-4 pt-12 shadow-md sticky top-0 z-10 flex items-center gap-3">
               <button onClick={() => setCurrentView('main')} className="p-1 rounded-full hover:bg-white/20">
                  <ChevronLeft size={24} />
               </button>
               <h2 className="text-lg font-bold">{currentView === 'follow' ? 'Follow Us' : 'Contact Us'}</h2>
            </div>
            
            <div className="p-4 space-y-4">
               {currentView === 'follow' && (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    {appConfig?.socialLinks.map((link, idx) => (
                      <SettingItem 
                         key={idx}
                         icon={Link} 
                         label={link.platform} 
                         subLabel={link.url} 
                         external 
                         onClick={() => window.open(link.url, '_blank')} 
                      />
                    ))}
                    {(!appConfig?.socialLinks || appConfig.socialLinks.length === 0) && (
                       <div className="p-4 text-center text-gray-500">No links available</div>
                    )}
                  </div>
               )}

               {currentView === 'contact' && (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    <SettingItem icon={Mail} label="Email Support" subLabel="kumayan7488@gmail.com" external onClick={() => window.open('mailto:kumayan7488@gmail.com')} />
                    <SettingItem icon={Smartphone} label="Helpline" subLabel="+91 98765 43210 (10 AM - 6 PM)" external onClick={() => window.open('tel:+919876543210')} />
                    <SettingItem icon={MessageCircle} label="WhatsApp Chat" subLabel="Chat with us" external onClick={() => window.open('https://wa.me/919876543210')} />
                  </div>
               )}
            </div>
        </div>
      )}

      {/* Avatar Selection Modal */}
      {showAvatars && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="font-bold text-lg">Choose Avatar</h3>
                 <XCircle className="cursor-pointer text-gray-500 hover:text-red-600" onClick={() => setShowAvatars(false)} />
              </div>
              <div className="p-6 grid grid-cols-3 gap-4 bg-gray-50 max-h-[60vh] overflow-y-auto">
                 {avatars.map((url, i) => (
                   <div key={i} onClick={() => handleUpdateAvatar(url)} className="aspect-square rounded-full border-2 border-transparent hover:border-red-600 cursor-pointer p-1 bg-white shadow-sm transition hover:scale-105 active:scale-95">
                      <img src={url} alt={`Avatar ${i}`} className="w-full h-full rounded-full" />
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}
      
      {currentView === 'main' && <UserNav />}
    </AppLayout>
  );
};

// --- Admin ---
const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  
  const navItems = [
    { label: 'Dash', path: '/admin/dashboard', icon: Activity },
    { label: 'Matches', path: '/admin/matches', icon: Trophy },
    { label: 'Withdraws', path: '/admin/withdrawals', icon: Wallet },
    { label: 'Deposits', path: '/admin/deposits', icon: CreditCard },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white hidden md:flex flex-col">
        <div className="p-6 font-bold text-xl text-red-500 tracking-wider">TEAM 11 <span className="text-xs text-white block font-normal">Admin Panel</span></div>
        <nav className="flex-1 px-4 space-y-2">
           {navItems.map(item => (
             <button 
               key={item.path} 
               onClick={() => navigate(item.path)}
               className={`flex items-center w-full p-3 rounded-lg transition-colors ${location.pathname.includes(item.path) ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
             >
               <item.icon size={18} className="mr-3"/> {item.label}
             </button>
           ))}
        </nav>
        <button onClick={() => { logout(); navigate('/auth/login'); }} className="p-4 text-gray-400 hover:text-white flex items-center w-full text-left">
          <LogOut size={18} className="mr-2"/> Logout
        </button>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
         <header className="md:hidden bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
            <span className="font-bold text-red-500">TEAM 11 ADMIN</span>
            <LogOut size={20} onClick={() => { logout(); navigate('/auth/login'); }} />
         </header>
         <main className="flex-1 overflow-auto p-4 md:p-8">
            {children}
         </main>
         <div className="md:hidden bg-white border-t p-2 flex justify-between shrink-0 overflow-x-auto">
           {navItems.map(item => (
             <button key={item.path} onClick={() => navigate(item.path)} className={`p-2 flex flex-col items-center min-w-[60px] ${location.pathname.includes(item.path) ? 'text-red-600' : 'text-gray-400'}`}>
               <item.icon size={20} />
               <span className="text-[10px] mt-1">{item.label}</span>
             </button>
           ))}
         </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [withdraws, setWithdraws] = useState<WithdrawRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    backend.getAllUsers().then(setUsers);
    const unsubW = backend.subscribeToWithdrawals(setWithdraws);
    const unsubM = backend.subscribeToMatches(setMatches);
    return () => { 
      if (typeof unsubW === 'function') unsubW();
      if (typeof unsubM === 'function') unsubM();
    }
  }, []);

  const totalDeposit = users.reduce((acc, u) => acc + u.balance, 0); 
  const pendingW = withdraws.filter(w => w.status === 'PENDING').length;
  const activeM = matches.filter(m => m.status !== 'COMPLETED').length;

  return (
    <AdminLayout>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
         <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
            <div className="text-gray-500 text-xs font-bold uppercase">Total Users</div>
            <div className="text-2xl font-bold">{users.length}</div>
         </div>
         <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
            <div className="text-gray-500 text-xs font-bold uppercase">Wallet Liability</div>
            <div className="text-2xl font-bold">₹{totalDeposit}</div>
         </div>
         <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500">
            <div className="text-gray-500 text-xs font-bold uppercase">Withdraw Req</div>
            <div className="text-2xl font-bold">{pendingW}</div>
         </div>
         <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
            <div className="text-gray-500 text-xs font-bold uppercase">Active Matches</div>
            <div className="text-2xl font-bold">{activeM}</div>
         </div>
      </div>
    </AdminLayout>
  );
};

const AdminMatches = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [date, setDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [contestForm, setContestForm] = useState<Partial<Contest>>({});
  const [matchContests, setMatchContests] = useState<Contest[]>([]);
  const [scoreForm, setScoreForm] = useState<MatchScore>({ runs: 0, wickets: 0, overs: 0 });
  
  // Player Management
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<PlayerRole>('BAT');
  const [newPlayerCredit, setNewPlayerCredit] = useState(8.5);
  const [newPlayerTeam, setNewPlayerTeam] = useState('A'); // 'A' or 'B'

  useEffect(() => {
    const unsub = backend.subscribeToMatches(setMatches);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  useEffect(() => {
    if (selectedMatch) {
      const unsub = backend.subscribeToContests(selectedMatch.id, setMatchContests);
      if (selectedMatch.score) {
         setScoreForm(selectedMatch.score);
      } else {
         setScoreForm({ runs: 0, wickets: 0, overs: 0 });
      }
      return () => unsub();
    }
  }, [selectedMatch]);

  const handleSyncMatches = async () => {
    setIsSyncing(true);
    const res = await backend.syncMatchesFromApi();
    setIsSyncing(false);
    alert(res.message);
  };

  const handleCreateMatch = async () => {
    if(!teamA || !teamB || !date) return;
    await backend.saveMatch({
      id: '',
      teamA, teamB, date,
      status: 'UPCOMING'
    });
    setIsCreating(false);
    setTeamA(''); setTeamB(''); setDate('');
  };

  const handleDeleteMatch = async (id: string) => {
    if(window.confirm("Are you sure you want to delete this match?")) {
      await backend.deleteMatch(id);
    }
  };

  const handleAddContest = async () => {
    if(!selectedMatch || !contestForm.entryFee) return;
    await backend.saveContest({
      id: '',
      matchId: selectedMatch.id,
      title: 'Contest',
      type: contestForm.entryFee === 0 ? 'PRACTICE' : 'PAID',
      entryFee: Number(contestForm.entryFee),
      winningAmount: Number(contestForm.winningAmount),
      adminCommission: 10,
      totalSpots: Number(contestForm.totalSpots),
      filledSpots: 0,
      isClosed: false
    });
    setContestForm({});
  };

  const handleDeclareResult = async (m: Match) => {
    const result = prompt("Enter Result (e.g. CSK Won):");
    if(result) {
       await backend.declareMatchResult(m.id, result);
       alert("Result Declared. Winnings distributed automatically to top performers.");
    }
  };

  const handleUpdateScore = async () => {
     if(!selectedMatch) return;
     await backend.updateMatchScore(selectedMatch.id, scoreForm);
     alert("Match Score Updated (LIVE)");
  };
  
  const handleAddPlayer = async () => {
     if(!selectedMatch || !newPlayerName) return;
     
     const teamName = newPlayerTeam === 'A' ? selectedMatch.teamA : selectedMatch.teamB;
     const newPlayer: Player = {
        id: Math.random().toString(36).substr(2, 9),
        name: newPlayerName,
        role: newPlayerRole,
        credits: newPlayerCredit,
        points: 0,
        teamName
     };
     
     const currentPlayers = selectedMatch.players || [];
     const updatedPlayers = [...currentPlayers, newPlayer];
     
     await backend.saveMatch({...selectedMatch, players: updatedPlayers});
     // Local update for immediate feedback
     setSelectedMatch({...selectedMatch, players: updatedPlayers});
     setNewPlayerName('');
  };

  const handleSyncSquad = async () => {
     if (!selectedMatch || !selectedMatch.apiId) {
        alert("This match does not have an API ID or is not selected.");
        return;
     }
     
     const res = await backend.syncSquad(selectedMatch.id, selectedMatch.apiId);
     alert(res.message);
     // Note: Real-time update will come via subscription if we were subscribing to single match, 
     // but here we are subscribing to all matches list. The list will update.
     // We need to re-find the selected match from the list to see updates or close/reopen modal.
     // For simplicity, let's just close modal
     setSelectedMatch(null); 
  };

  return (
    <AdminLayout>
       <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Match Management</h2>
          <div className="flex gap-2">
             <Button onClick={handleSyncMatches} disabled={isSyncing} variant="secondary" size="sm">
               {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />} 
               <span className="ml-2">{isSyncing ? 'Syncing...' : 'Sync Matches'}</span>
             </Button>
             <Button onClick={() => setIsCreating(true)} size="sm"><Plus size={16}/> New Match</Button>
          </div>
       </div>

       {isCreating && (
         <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
            <h3 className="font-bold mb-3">Create Match</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
               <Input placeholder="Team A (e.g. CSK)" value={teamA} onChange={e => setTeamA(e.target.value)} />
               <Input placeholder="Team B (e.g. MI)" value={teamB} onChange={e => setTeamB(e.target.value)} />
               <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
               <Button variant="secondary" onClick={() => setIsCreating(false)}>Cancel</Button>
               <Button onClick={handleCreateMatch}>Save Match</Button>
            </div>
         </div>
       )}

       {selectedMatch && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
           <div className="bg-white p-6 rounded-lg w-full max-w-md my-8 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Manage: {selectedMatch.teamA} vs {selectedMatch.teamB}</h3>
                <XCircle className="cursor-pointer text-gray-500" onClick={() => setSelectedMatch(null)} />
             </div>
             
             {/* Squad Management Section */}
             <div className="mb-6 border-b pb-6">
                <div className="flex justify-between items-center mb-3">
                   <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2"><UserPlus size={16}/> Squad Management</h4>
                   <Button size="sm" variant="outline" onClick={handleSyncSquad} disabled={!selectedMatch.apiId}>Sync Squad from API</Button>
                </div>
                
                <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-3">
                   <div className="grid grid-cols-2 gap-2 mb-2">
                      <Input placeholder="Player Name" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} />
                      <select className="p-2 rounded border" value={newPlayerRole} onChange={(e) => setNewPlayerRole(e.target.value as any)}>
                         <option value="BAT">Batsman</option>
                         <option value="BWL">Bowler</option>
                         <option value="AR">All-Rounder</option>
                         <option value="WK">Wicket Keeper</option>
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-2 mb-2">
                      <Input type="number" placeholder="Credits (e.g. 9.0)" value={newPlayerCredit} onChange={e => setNewPlayerCredit(Number(e.target.value))} />
                      <div className="flex items-center gap-2 text-sm bg-white p-2 border rounded">
                         <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="team" checked={newPlayerTeam === 'A'} onChange={() => setNewPlayerTeam('A')} /> {selectedMatch.teamA}
                         </label>
                         <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="team" checked={newPlayerTeam === 'B'} onChange={() => setNewPlayerTeam('B')} /> {selectedMatch.teamB}
                         </label>
                      </div>
                   </div>
                   <Button fullWidth size="sm" onClick={handleAddPlayer}>Add Player</Button>
                </div>

                <div className="max-h-32 overflow-y-auto border rounded bg-white">
                   {!selectedMatch.players || selectedMatch.players.length === 0 ? (
                      <p className="text-center text-xs text-gray-400 py-4">No players added.</p>
                   ) : (
                      selectedMatch.players.map((p, idx) => (
                         <div key={idx} className="flex justify-between items-center p-2 border-b text-xs">
                            <span className="font-bold w-1/3 truncate">{p.name}</span>
                            <span className="w-1/6">{p.role}</span>
                            <span className="w-1/4 truncate text-gray-500">{p.teamName}</span>
                            <span className="w-1/6 text-right">{p.credits} Cr</span>
                         </div>
                      ))
                   )}
                </div>
             </div>

             <div className="bg-red-50 p-3 rounded mb-4 border border-red-100">
                <h4 className="font-bold text-sm text-red-800 mb-2 flex items-center gap-2"><Activity size={14}/> Live Score Control</h4>
                <div className="flex gap-2 mb-2">
                   <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-gray-500">Runs</label>
                      <input className="w-full p-1 rounded border" type="number" value={scoreForm.runs} onChange={e => setScoreForm({...scoreForm, runs: Number(e.target.value)})} />
                   </div>
                   <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-gray-500">Wkts</label>
                      <input className="w-full p-1 rounded border" type="number" value={scoreForm.wickets} onChange={e => setScoreForm({...scoreForm, wickets: Number(e.target.value)})} />
                   </div>
                   <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-gray-500">Overs</label>
                      <input className="w-full p-1 rounded border" type="number" value={scoreForm.overs} onChange={e => setScoreForm({...scoreForm, overs: Number(e.target.value)})} />
                   </div>
                </div>
                <Button fullWidth size="sm" onClick={handleUpdateScore}>Update Live Score</Button>
             </div>

             <div className="space-y-3 mb-6 border-t pt-4">
               <h4 className="font-bold text-sm text-gray-700">Add New Contest</h4>
               <Input label="Entry Fee (0 for Practice)" type="number" value={contestForm.entryFee || ''} onChange={e => setContestForm({...contestForm, entryFee: Number(e.target.value)})} />
               <Input label="Winning Amount" type="number" value={contestForm.winningAmount || ''} onChange={e => setContestForm({...contestForm, winningAmount: Number(e.target.value)})} />
               <Input label="Total Spots" type="number" value={contestForm.totalSpots || ''} onChange={e => setContestForm({...contestForm, totalSpots: Number(e.target.value)})} />
               <Button fullWidth onClick={handleAddContest} disabled={!contestForm.totalSpots}>Add Contest</Button>
             </div>

             <div className="border-t pt-4">
                <h4 className="font-bold text-sm text-gray-700 mb-2">Existing Contests</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                   {matchContests.map(c => (
                     <div key={c.id} className="bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                        <div className="flex justify-between items-center mb-1">
                           <span className="font-bold">₹{c.entryFee}</span>
                           <span className={`${c.isClosed ? 'text-red-600' : 'text-green-600'} font-bold text-xs uppercase`}>
                             {c.isClosed ? 'Closed' : 'Open'}
                           </span>
                        </div>
                        <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
                           <span>Spots: {c.filledSpots}/{c.totalSpots}</span>
                           <span>Win: ₹{c.winningAmount}</span>
                        </div>
                        <div className="flex gap-2">
                           <button 
                             className="flex-1 bg-white border border-gray-300 py-1 px-2 rounded hover:bg-gray-100 text-xs"
                             onClick={() => {
                               const spots = prompt("Update Total Spots:", c.totalSpots.toString());
                               if(spots && !isNaN(parseInt(spots))) backend.updateContest(c.id, { totalSpots: parseInt(spots) });
                             }}
                           >
                             Edit Spots
                           </button>
                           <button 
                             className={`flex-1 py-1 px-2 rounded text-white text-xs ${c.isClosed ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                             onClick={() => backend.updateContest(c.id, { isClosed: !c.isClosed })}
                           >
                             {c.isClosed ? 'Re-Open' : 'Close'}
                           </button>
                        </div>
                     </div>
                   ))}
                   {matchContests.length === 0 && <p className="text-gray-400 text-xs text-center">No contests yet.</p>}
                </div>
             </div>
           </div>
         </div>
       )}

       <div className="space-y-4">
         {matches.map(m => (
           <div key={m.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative group">
              <div className="absolute top-2 right-2 flex gap-2">
                  <button onClick={() => handleDeleteMatch(m.id)} className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200" title="Delete Match">
                     <Trash2 size={16} />
                  </button>
              </div>
              <div className="flex justify-between items-start pt-4">
                 <div>
                    <div className="font-bold text-lg">{m.teamA} vs {m.teamB}</div>
                    <div className="text-sm text-gray-500">{new Date(m.date).toLocaleString()}</div>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${m.status === 'COMPLETED' ? 'bg-gray-100' : 'bg-green-100 text-green-700'}`}>{m.status}</span>
                    {m.status === 'LIVE' && m.score && (
                       <div className="text-xs text-red-600 font-bold mt-1">
                          {m.score.runs}/{m.score.wickets} ({m.score.overs})
                       </div>
                    )}
                 </div>
                 <div className="flex gap-2 mt-6">
                    {m.status !== 'COMPLETED' && (
                       <>
                         <Button size="sm" variant="outline" onClick={() => setSelectedMatch(m)}>Manage</Button>
                         <Button size="sm" onClick={() => handleDeclareResult(m)}>Result</Button>
                       </>
                    )}
                 </div>
              </div>
           </div>
         ))}
       </div>
    </AdminLayout>
  );
};

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  
  useEffect(() => {
    backend.getAllUsers().then(setUsers);
  }, []);

  const handleBan = async (u: User) => {
    if(window.confirm(`${u.isBanned ? 'Unban' : 'Ban'} ${u.name}?`)) {
      await backend.toggleBanUser(u.id, !!u.isBanned);
      backend.getAllUsers().then(setUsers);
    }
  };

  const handleAddMoney = async (u: User) => {
     const amt = prompt(`Enter amount to add to ${u.name}'s wallet:`);
     if(amt && !isNaN(Number(amt))) {
        await backend.deposit(u.id, Number(amt), "Admin Credit");
        alert(`₹${amt} added to ${u.name}`);
        // refresh
        backend.getAllUsers().then(setUsers);
     }
  };

  return (
    <AdminLayout>
      <h2 className="text-2xl font-bold mb-6">User Management</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left text-sm">
           <thead className="bg-gray-50 font-bold text-gray-500">
             <tr>
               <th className="p-3">Name</th>
               <th className="p-3">Username</th>
               <th className="p-3">Balance</th>
               <th className="p-3">Action</th>
             </tr>
           </thead>
           <tbody>
             {users.map(u => (
               <tr key={u.id} className="border-t">
                 <td className="p-3">
                   <div className="font-bold">{u.name}</div>
                   <div className="text-xs text-gray-400">{u.email || u.phoneNumber}</div>
                 </td>
                 <td className="p-3">@{u.username}</td>
                 <td className="p-3">₹{u.balance}</td>
                 <td className="p-3 flex gap-2">
                   <Button size="sm" variant="success" onClick={() => handleAddMoney(u)} className="px-2 py-1 h-8"><Banknote size={14}/></Button>
                   <Button size="sm" variant="danger" onClick={() => handleBan(u)} className="px-2 py-1 h-8">{u.isBanned ? 'Unban' : 'Ban'}</Button>
                 </td>
               </tr>
             ))}
           </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

const AdminWithdrawals = () => {
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);

  useEffect(() => {
    const unsub = backend.subscribeToWithdrawals(setRequests);
    return () => {
       if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    if(status === 'APPROVED' && !window.confirm("Confirm you have manually transferred the money via UPI?")) return;
    await backend.updateWithdrawStatus(id, status);
  };

  return (
    <AdminLayout>
      <h2 className="text-2xl font-bold mb-6">Withdrawals</h2>
      <div className="space-y-3">
        {requests.map(r => (
           <div key={r.id} className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                 <div className="font-bold">{r.userEmail}</div>
                 <div className="text-sm font-mono bg-gray-100 inline-block px-2 py-1 rounded mt-1">UPI: {r.upiId}</div>
                 <div className="text-xs text-gray-400 mt-1">{new Date(r.date).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                 <div className="text-2xl font-bold text-red-600">₹{r.amount}</div>
                 <div className={`text-xs font-bold uppercase ${r.status === 'PENDING' ? 'text-orange-500' : r.status === 'APPROVED' ? 'text-green-600' : 'text-red-500'}`}>{r.status}</div>
              </div>
              {r.status === 'PENDING' && (
                <div className="flex gap-2">
                   <Button size="sm" onClick={() => handleStatus(r.id, 'APPROVED')}>Approve</Button>
                   <Button size="sm" variant="danger" onClick={() => handleStatus(r.id, 'REJECTED')}>Reject</Button>
                </div>
              )}
           </div>
        ))}
      </div>
    </AdminLayout>
  );
};

const AdminDeposits = () => {
   const [requests, setRequests] = useState<DepositRequest[]>([]);
   const [viewScreenshot, setViewScreenshot] = useState<string | null>(null);
   const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

   useEffect(() => {
      const unsub = backend.subscribeToDepositRequests(setRequests);
      return () => { if(typeof unsub === 'function') unsub(); };
   }, []);

   const handleProcess = async (req: DepositRequest, status: 'APPROVED' | 'REJECTED') => {
      if(status === 'APPROVED') {
         if(!window.confirm(`Approve ₹${req.amount} for ${req.userName}?`)) return;
      }
      const res = await backend.processDepositRequest(req.id, status);
      if(!res.success) alert("Error: " + res.message);
   };

   const filteredRequests = requests.filter(r => filter === 'ALL' || r.status === filter);

   return (
      <AdminLayout>
         <h2 className="text-2xl font-bold mb-6">Deposit Requests</h2>
         
         <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
               <button 
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-red-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
               >
                  {f}
               </button>
            ))}
         </div>

         <div className="space-y-3">
            {filteredRequests.length === 0 && <p className="text-gray-500">No requests found.</p>}
            {filteredRequests.map(r => (
               <div key={r.id} className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border border-gray-100">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                     <div className="p-3 bg-blue-50 text-blue-600 rounded-full shrink-0">
                        <CreditCard size={24} />
                     </div>
                     <div className="min-w-0">
                        <div className="font-bold text-lg truncate">{r.userName}</div>
                        <div className="text-sm text-gray-500 truncate">ID: {r.userId.substring(0,8)}...</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                           <Clock size={10} /> {new Date(r.date).toLocaleString()}
                        </div>
                        <div className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded inline-block mt-1 truncate max-w-[200px]" title={r.utrNumber}>
                           UTR: {r.utrNumber}
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                     <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">₹{r.amount}</div>
                        <div className={`text-xs font-bold uppercase ${r.status === 'PENDING' ? 'text-orange-500' : r.status === 'APPROVED' ? 'text-green-600' : 'text-red-500'}`}>{r.status}</div>
                     </div>
                     
                     <div className="flex flex-col gap-2">
                        {r.screenshotUrl && (
                           <Button size="sm" variant="secondary" onClick={() => setViewScreenshot(r.screenshotUrl || null)}>Proof</Button>
                        )}
                        {r.status === 'PENDING' && (
                           <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleProcess(r, 'APPROVED')}>Approve</Button>
                              <Button size="sm" variant="danger" onClick={() => handleProcess(r, 'REJECTED')}>Reject</Button>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Screenshot Modal */}
         {viewScreenshot && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setViewScreenshot(null)}>
               <div className="relative max-w-full max-h-full">
                  <img src={viewScreenshot} className="max-w-[90vw] max-h-[90vh] rounded" alt="Proof" />
                  <button className="absolute top-2 right-2 bg-white rounded-full p-2 text-black hover:bg-gray-200" onClick={() => setViewScreenshot(null)}><XCircle /></button>
               </div>
            </div>
         )}
      </AdminLayout>
   );
};

const AdminSettings = () => {
   const [config, setConfig] = useState({email: '', password: '', minWithdraw: 100});
   const [appConfig, setAppConfig] = useState<AppConfig>({ developerName: '', socialLinks: [], depositUpiId: '' });
   
   const [newLinkPlatform, setNewLinkPlatform] = useState('');
   const [newLinkUrl, setNewLinkUrl] = useState('');

   useEffect(() => {
     backend.getAdminConfig().then(c => setConfig(c as any));
     backend.getAppConfig().then(setAppConfig);
   }, []);
   
   const handleSavePrivate = async () => {
      await backend.updateAdminConfig(config as any);
      alert("Private Settings Saved");
   };

   const handleSavePublic = async () => {
      await backend.updateAppConfig(appConfig);
      alert("Public Settings Saved");
   };

   const addLink = () => {
      if(newLinkPlatform && newLinkUrl) {
         setAppConfig({
            ...appConfig,
            socialLinks: [...appConfig.socialLinks, { platform: newLinkPlatform, url: newLinkUrl }]
         });
         setNewLinkPlatform('');
         setNewLinkUrl('');
      }
   };

   const removeLink = (idx: number) => {
      const newLinks = [...appConfig.socialLinks];
      newLinks.splice(idx, 1);
      setAppConfig({...appConfig, socialLinks: newLinks});
   };

   return (
     <AdminLayout>
       <h2 className="text-2xl font-bold mb-6">Settings</h2>
       
       <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow space-y-4 h-fit">
             <h3 className="font-bold text-lg mb-2 text-red-600">Private Admin Config</h3>
             <Input label="Admin Email" value={config.email} onChange={e => setConfig({...config, email: e.target.value})} />
             <Input label="Admin Password" type="password" value={config.password} onChange={e => setConfig({...config, password: e.target.value})} />
             <Input label="Min Withdraw Limit (₹)" type="number" value={config.minWithdraw} onChange={e => setConfig({...config, minWithdraw: Number(e.target.value)})} />
             <Button onClick={handleSavePrivate} fullWidth>Update Private Settings</Button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow space-y-4 h-fit">
             <h3 className="font-bold text-lg mb-2 text-blue-600">Public App Config</h3>
             <Input label="Developer Name" value={appConfig.developerName} onChange={e => setAppConfig({...appConfig, developerName: e.target.value})} />
             <Input label="Deposit UPI ID (User sees this)" value={appConfig.depositUpiId || ''} onChange={e => setAppConfig({...appConfig, depositUpiId: e.target.value})} />
             
             <div className="border-t pt-4">
               <label className="text-sm font-bold text-gray-700 block mb-2">Social Media Links</label>
               <div className="space-y-2 mb-3">
                  {appConfig.socialLinks.map((link, i) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                       <div className="text-sm">
                          <span className="font-bold">{link.platform}:</span> <span className="text-gray-500 truncate">{link.url}</span>
                       </div>
                       <Trash2 size={16} className="text-red-500 cursor-pointer" onClick={() => removeLink(i)} />
                    </div>
                  ))}
               </div>
               <div className="flex gap-2">
                  <Input placeholder="Platform (e.g. Insta)" value={newLinkPlatform} onChange={e => setNewLinkPlatform(e.target.value)} />
                  <Input placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
                  <Button size="sm" onClick={addLink}><Plus size={20}/></Button>
               </div>
             </div>

             <Button onClick={handleSavePublic} fullWidth variant="secondary">Update Public Settings</Button>
          </div>
       </div>
     </AdminLayout>
   );
};

// --- Auth Provider ---
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(UserRole.GUEST);
  const [loaded, setLoaded] = useState(false);

  // Helper to ensure we don't save circular objects (like DOM refs or Firebase internal objects) to localStorage
  const sanitizeUser = (u: User): User => ({
    id: u.id,
    email: u.email,
    phoneNumber: u.phoneNumber,
    username: u.username,
    name: u.name,
    balance: u.balance,
    joinedContests: u.joinedContests || [],
    referralCode: u.referralCode,
    referredBy: u.referredBy,
    referredByCode: u.referredByCode,
    isBanned: u.isBanned,
    lastWithdrawalDate: u.lastWithdrawalDate,
    avatar: u.avatar
  });

  useEffect(() => {
    let unsubscribe: any;
    const savedUser = localStorage.getItem('currentUser');
    const savedRole = localStorage.getItem('currentRole');
    
    if (savedUser && savedRole) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        setRole(savedRole as UserRole);
        
        if (savedRole === UserRole.USER) {
          backend.subscribeToUser(u.id, (updatedUser) => {
            if(updatedUser) {
               // Use sanitizer before saving
               const cleanUser = sanitizeUser(updatedUser);
               setUser(cleanUser);
               localStorage.setItem('currentUser', JSON.stringify(cleanUser));
            }
          }).then(unsub => { unsubscribe = unsub; }).catch(console.error);
        }
      } catch (e) {
        console.error("Failed to parse saved user", e);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentRole');
      }
    }
    setLoaded(true);
    return () => { if(typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await backend.login(email, pass);
    if (res.user) {
      const cleanUser = sanitizeUser(res.user);
      setUser(cleanUser);
      setRole(res.role);
      localStorage.setItem('currentUser', JSON.stringify(cleanUser));
      localStorage.setItem('currentRole', res.role);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const register = async (email: string, pass: string, name: string, username: string, referralCode?: string) => {
    const res = await backend.register(email, pass, name, username, referralCode);
    if (res.user) {
      const cleanUser = sanitizeUser(res.user);
      setUser(cleanUser);
      setRole(UserRole.USER);
      localStorage.setItem('currentUser', JSON.stringify(cleanUser));
      localStorage.setItem('currentRole', UserRole.USER);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const logout = async () => {
    await backend.logout();
    setUser(null);
    setRole(UserRole.GUEST);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentRole');
  };

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ user, role, login, register, logout, setUser, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const App = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />

          <Route path="/user/home" element={<UserHome />} />
          <Route path="/user/match/:id" element={<UserMatchContests />} />
          <Route path="/user/wallet" element={<UserWallet />} />
          <Route path="/user/rewards" element={<UserRewards />} />
          <Route path="/user/about" element={<UserAbout />} />

          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/matches" element={<AdminMatches />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
          <Route path="/admin/deposits" element={<AdminDeposits />} />
          <Route path="/admin/settings" element={<AdminSettings />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
};