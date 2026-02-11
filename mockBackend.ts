
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  runTransaction,
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  User as FirebaseUser 
} from "firebase/auth";
import { auth, db } from "./firebase";
import { cricketApi } from "./cricketApi";
import { User, Contest, Match, WithdrawRequest, RedeemCode, AdminConfig, UserRole, WalletTransaction, PointRule, MatchScore, AppConfig, Player, DepositRequest } from './types';

const DEFAULT_ADMIN: AdminConfig = {
  email: 'kumayan7488@gmail.com',
  password: 'aryankr7488',
  minWithdraw: 100,
  appVersion: '1.0.0',
  forceUpdate: false
};

const DEFAULT_APP_CONFIG: AppConfig = {
  developerName: "Team 11 Devs",
  depositUpiId: "team11admin@okaxis",
  socialLinks: [
    { platform: "Instagram", url: "https://instagram.com" },
    { platform: "Twitter", url: "https://twitter.com" },
    { platform: "Facebook", url: "https://facebook.com" }
  ]
};

const DEFAULT_POINTS: PointRule[] = [
  { id: '1', action: 'Run', points: 1 },
  { id: '2', action: 'Boundary Bonus', points: 1 },
  { id: '3', action: 'Six Bonus', points: 2 },
  { id: '4', action: 'Wicket', points: 25 },
  { id: '5', action: 'Catch', points: 8 },
];

function getFriendlyError(error: any): string {
  console.error("Firebase Operation Error:", error);
  const code = error.code || '';
  
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/email-already-in-use':
      return 'Email already registered.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/invalid-verification-code':
      return 'Invalid OTP. Please check and try again.';
    case 'unavailable': 
      return 'Service temporarily unavailable. Check connection.';
    default:
      return error.message || 'An unknown error occurred.';
  }
}

// Helper to remove undefined keys which Firestore rejects
const sanitizeData = (data: any) => {
  return JSON.parse(JSON.stringify(data));
};

export const backend = {
  // --- Auth & Admin ---
  
  async login(email: string, pass: string): Promise<{ user: User | null; role: UserRole, error?: string }> {
    try {
      // 1. Check Admin
      let adminConfig = DEFAULT_ADMIN;
      try {
        const adminDocRef = doc(db, 'settings', 'admin');
        const adminSnap = await getDoc(adminDocRef);
        
        if (adminSnap.exists()) {
          adminConfig = adminSnap.data() as AdminConfig;
        } else {
          try {
            await setDoc(adminDocRef, DEFAULT_ADMIN);
          } catch (writeErr) {
            console.warn("Cannot write default admin config:", writeErr);
          }
        }
      } catch (readErr) {
        console.warn("Cannot read admin config:", readErr);
      }

      if (email === adminConfig.email && pass === adminConfig.password) {
        return {
          user: {
            id: 'admin',
            email: adminConfig.email,
            name: 'Administrator',
            username: 'admin',
            balance: 0,
            joinedContests: [],
            referralCode: 'ADMIN'
          },
          role: UserRole.ADMIN
        };
      }

      // 2. Check User
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const fbUser = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        if (userData.isBanned) return { user: null, role: UserRole.GUEST, error: "Account is banned by admin." };
        return {
          user: { id: fbUser.uid, ...userData },
          role: UserRole.USER
        };
      } else {
        return { user: null, role: UserRole.GUEST, error: "User profile not found." };
      }
    } catch (error: any) {
      return { user: null, role: UserRole.GUEST, error: getFriendlyError(error) };
    }
  },

  async register(email: string, pass: string, name: string, username: string, referralCode?: string): Promise<{user: User | null, error?: string}> {
    try {
      // 1. Check Username Uniqueness
      const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
      const usernameSnap = await getDocs(usernameQuery);
      if (!usernameSnap.empty) {
        return { user: null, error: "Username already occupied." };
      }

      // 2. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const fbUser = userCredential.user;
      
      // 3. Generate Unique Referral Code
      let myReferralCode = '';
      let isUnique = false;
      while (!isUnique) {
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        myReferralCode = `TEAM11-${randomStr}`;
        const codeQuery = query(collection(db, 'users'), where('referralCode', '==', myReferralCode));
        const codeSnap = await getDocs(codeQuery);
        if (codeSnap.empty) isUnique = true;
      }

      let initialBalance = 0;
      let referrerName = undefined;
      let referrerCode = undefined;
      
      // 4. Handle Referral Logic
      if (referralCode) {
         try {
           const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
           const snap = await getDocs(q);
           if (!snap.empty) {
             const referrer = snap.docs[0];
             const referrerData = referrer.data() as User;
             referrerName = referrerData.name;
             referrerCode = referralCode;

             initialBalance = 2; // ₹2 for New User
             
             // Credit Referrer ₹5
             const referrerRef = doc(db, 'users', referrer.id);
             await updateDoc(referrerRef, {
               balance: (referrerData.balance || 0) + 5
             });
             await addDoc(collection(db, 'transactions'), {
               userId: referrer.id,
               type: 'REFERRAL',
               amount: 5,
               date: new Date().toISOString(),
               description: `Referral bonus for inviting ${name}`
             });
           }
         } catch (e) {
           console.warn("Referral processing failed:", e);
         }
      }

      const newUser: User = {
        id: fbUser.uid,
        email,
        name,
        username,
        balance: initialBalance,
        joinedContests: [],
        referralCode: myReferralCode,
        referredBy: referrerName,
        referredByCode: referrerCode
      };
      
      await setDoc(doc(db, 'users', fbUser.uid), newUser);

      if (initialBalance > 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: fbUser.uid,
          type: 'REFERRAL',
          amount: initialBalance,
          date: new Date().toISOString(),
          description: `Welcome Bonus (Referred by ${referrerName || 'Friend'})`
        });
      }

      return { user: newUser };
    } catch (error: any) {
      return { user: null, error: getFriendlyError(error) };
    }
  },

  async ensureUserDocForPhone(fbUser: FirebaseUser): Promise<{user: User, isNew: boolean}> {
    const userDocRef = doc(db, 'users', fbUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return { user: { id: fbUser.uid, ...userDoc.data() } as User, isNew: false };
    } else {
      // Create new user for phone auth
      let myReferralCode = '';
      let isUnique = false;
      while (!isUnique) {
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        myReferralCode = `TEAM11-${randomStr}`;
        const codeQuery = query(collection(db, 'users'), where('referralCode', '==', myReferralCode));
        const codeSnap = await getDocs(codeQuery);
        if (codeSnap.empty) isUnique = true;
      }

      const newUser: User = {
        id: fbUser.uid,
        phoneNumber: fbUser.phoneNumber || '',
        name: 'Player ' + fbUser.phoneNumber?.slice(-4),
        username: 'user' + fbUser.phoneNumber?.slice(-6),
        balance: 0,
        joinedContests: [],
        referralCode: myReferralCode
      };

      await setDoc(userDocRef, newUser);
      return { user: newUser, isNew: true };
    }
  },

  async resetPassword(email: string): Promise<{success: boolean, message: string}> {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: "Password reset link sent to your email." };
    } catch (error: any) {
      return { success: false, message: getFriendlyError(error) };
    }
  },

  async updateUserProfile(userId: string, data: Partial<User>) {
    await updateDoc(doc(db, 'users', userId), data);
  },

  async logout() {
    await signOut(auth);
  },

  // --- Matches ---

  subscribeToMatches(callback: (matches: Match[]) => void) {
    const q = query(collection(db, 'matches'), orderBy('date', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      callback(matches);
    });
  },

  async checkAndSyncMatches() {
    try {
      const sysRef = doc(db, 'settings', 'system');
      const sysSnap = await getDoc(sysRef);
      const now = Date.now();
      const SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes (Slightly more frequent for live scores)

      let lastSync = 0;
      if (sysSnap.exists()) {
        const data = sysSnap.data();
        lastSync = data.lastSync || 0;
      }

      if (now - lastSync > SYNC_INTERVAL) {
        console.log("Auto-syncing matches from API...");
        // Optimistically update timestamp
        await setDoc(sysRef, { lastSync: now }, { merge: true });
        
        const result = await this.syncMatchesFromApi();
        if(!result.success) {
           console.warn("Auto-sync failed:", result.message);
        }
      }
    } catch (e) {
      console.warn("Auto-sync check failed", e);
    }
  },

  async syncMatchesFromApi() {
    try {
      const apiMatches = await cricketApi.fetchMatches();
      let addedCount = 0;
      let updatedCount = 0;
      let squadCount = 0;
      
      const existingMatchesSnap = await getDocs(collection(db, 'matches'));
      const existingApiIds = new Set(
         existingMatchesSnap.docs.map(d => d.data().apiId).filter(Boolean)
      );

      for (const m of apiMatches) {
        if (m.apiId && !existingApiIds.has(m.apiId)) {
           // New Match
           const docRef = await addDoc(collection(db, 'matches'), sanitizeData(m));
           addedCount++;
           
           // Fetch squad for new match
           try {
             const players = await cricketApi.fetchSquad(m.apiId);
             if (players.length > 0) {
               await updateDoc(docRef, { players: sanitizeData(players) });
               squadCount++;
             }
           } catch (err) {
             console.warn(`Failed to fetch squad for new match ${m.teamA} vs ${m.teamB}`, err);
           }

        } else if (m.apiId && existingApiIds.has(m.apiId)) {
           // Existing Match - Check for Updates
           const existingDoc = existingMatchesSnap.docs.find(d => d.data().apiId === m.apiId);
           if (existingDoc) {
             const existingData = existingDoc.data() as Match;
             
             const updates: any = {};
             let shouldUpdate = false;

             if (existingData.status !== m.status) {
                updates.status = m.status;
                shouldUpdate = true;
             }
             
             // If match ended and we haven't processed result, do it now
             if (m.status === 'COMPLETED' && existingData.status !== 'COMPLETED') {
                updates.result = m.result || `${m.teamA} or ${m.teamB} won`;
                // AUTOMATICALLY DECLARE RESULT & GIVE POINTS
                console.log(`Auto-declaring result for ${m.apiId}`);
                await this.declareMatchResult(existingDoc.id, updates.result);
             }

             // Update Score if available and different
             if (m.score) {
                // simple check
                if (!existingData.score || existingData.score.runs !== m.score.runs || existingData.score.wickets !== m.score.wickets || existingData.score.overs !== m.score.overs) {
                   updates.score = m.score;
                   shouldUpdate = true;
                }
             } else if (m.status === 'COMPLETED' && m.result && !existingData.result) {
                 updates.result = m.result;
                 shouldUpdate = true;
             }

             // Check if players are missing and fetch if needed (for non-completed matches)
             if ((!existingData.players || existingData.players.length === 0) && existingData.status !== 'COMPLETED') {
               try {
                 const players = await cricketApi.fetchSquad(m.apiId);
                 if (players.length > 0) {
                   updates.players = sanitizeData(players);
                   shouldUpdate = true;
                   squadCount++;
                 }
               } catch (err) {
                 console.warn(`Failed to sync squad for existing match ${m.apiId}`, err);
               }
             }
             
             if (shouldUpdate) {
               await updateDoc(doc(db, 'matches', existingDoc.id), sanitizeData(updates));
               updatedCount++;
             }
           }
        }
      }
      return { success: true, message: `Synced: ${addedCount} new, ${updatedCount} updated, ${squadCount} squads fetched.` };
    } catch (e: any) {
      console.error(e);
      return { success: false, message: "Sync failed" };
    }
  },

  async saveMatch(match: Match) {
     const { id, ...data } = match;
     const cleanData = sanitizeData(data);
     if (id) {
       await setDoc(doc(db, 'matches', id), cleanData);
     } else {
       await addDoc(collection(db, 'matches'), cleanData);
     }
  },

  async deleteMatch(id: string) {
    await deleteDoc(doc(db, 'matches', id));
  },

  async updateMatchScore(matchId: string, score: MatchScore) {
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'LIVE',
      score
    });
  },

  async syncSquad(matchId: string, apiId: string) {
    if (!apiId) return { success: false, message: "No API ID for this match" };
    const players = await cricketApi.fetchSquad(apiId);
    if (players.length > 0) {
      await updateDoc(doc(db, 'matches', matchId), { players: sanitizeData(players) });
      return { success: true, message: `Synced ${players.length} players` };
    }
    return { success: false, message: "No players found in API" };
  },

  async declareMatchResult(matchId: string, resultText: string) {
    // 1. Update Match Status
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'COMPLETED',
      result: resultText
    });

    // 2. Fetch Rules to use for Calculation
    let rules: PointRule[] = [];
    try {
       const rulesSnap = await getDocs(collection(db, 'point_rules'));
       if(!rulesSnap.empty) {
          rules = rulesSnap.docs.map(d => d.data() as PointRule);
       } else {
          rules = DEFAULT_POINTS;
       }
    } catch (e) {
       console.warn("Using default points due to error", e);
       rules = DEFAULT_POINTS;
    }
    
    const getP = (act: string) => rules.find(r => r.action === act)?.points || 0;

    // 3. Process Contest Winnings automatically
    const contestsQ = query(collection(db, 'contests'), where('matchId', '==', matchId));
    const contestsSnap = await getDocs(contestsQ);

    for (const contestDoc of contestsSnap.docs) {
      const contest = { id: contestDoc.id, ...contestDoc.data() } as Contest;
      
      // If contest already processed (closed), skip
      // But allow if we are re-declaring result manually
      
      // Get participants
      const participantsQ = query(collection(db, 'users'), where('joinedContests', 'array-contains', contest.id));
      const participantsSnap = await getDocs(participantsQ);
      
      if (participantsSnap.empty) continue;
      
      // SIMULATE FANTASY POINTS using the Rules
      // NOTE: In a real scenario, we would map specific players selected by users to the API scorecard.
      // Since "Create Team" logic is abstract here, we simulate performance based on Rules + Randomness.
      const leaderboard = participantsSnap.docs.map(d => {
         // Generate random performance stats for this user's "team"
         const runs = Math.floor(Math.random() * 150);
         const wickets = Math.floor(Math.random() * 5);
         const catches = Math.floor(Math.random() * 4);
         const boundaries = Math.floor(runs / 6);
         const sixes = Math.floor(runs / 15);
         
         const score = 
           (runs * getP('Run')) +
           (boundaries * getP('Boundary Bonus')) +
           (sixes * getP('Six Bonus')) +
           (wickets * getP('Wicket')) +
           (catches * getP('Catch'));
           
         return {
           id: d.id,
           points: score
         };
      }).sort((a, b) => b.points - a.points); // Sort descending

      // Distribute to Winner (Rank 1)
      if (contest.type === 'PAID' && leaderboard.length > 0) {
         const winner = leaderboard[0];
         
         await runTransaction(db, async (t) => {
            const uRef = doc(db, 'users', winner.id);
            const uDoc = await t.get(uRef);
            if(uDoc.exists()) {
               const newBal = (uDoc.data().balance || 0) + contest.winningAmount;
               t.update(uRef, { balance: newBal });
               
               const txRef = doc(collection(db, 'transactions'));
               t.set(txRef, {
                 userId: winner.id,
                 type: 'WIN',
                 amount: contest.winningAmount,
                 date: new Date().toISOString(),
                 description: `Won ${contest.title} (Pts: ${winner.points})`
               });
            }
         });
      }
      
      await updateDoc(doc(db, 'contests', contest.id), { isClosed: true });
    }
  },

  // --- Contests ---
  
  subscribeToContests(matchId: string, callback: (contests: Contest[]) => void) {
    const q = query(collection(db, 'contests'), where('matchId', '==', matchId));
    return onSnapshot(q, (snapshot) => {
      const contests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contest));
      callback(contests);
    });
  },

  async saveContest(contest: Contest) {
    const { id, ...data } = contest;
    if (id) {
      await setDoc(doc(db, 'contests', id), data);
    } else {
      await addDoc(collection(db, 'contests'), data);
    }
  },

  async updateContest(contestId: string, updates: Partial<Contest>) {
    await updateDoc(doc(db, 'contests', contestId), updates);
  },

  async joinContest(userId: string, contestId: string, matchName: string): Promise<{success: boolean, message: string}> {
    const userRef = doc(db, 'users', userId);
    const contestRef = doc(db, 'contests', contestId);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const contestDoc = await transaction.get(contestRef);

        if (!userDoc.exists() || !contestDoc.exists()) throw "Invalid data";

        const user = userDoc.data() as User;
        const contest = contestDoc.data() as Contest;

        if (user.joinedContests.includes(contestId)) throw "Already joined";
        if (contest.isClosed) throw "Contest is closed";
        if (contest.type === 'PAID' && user.balance < contest.entryFee) throw "Insufficient balance";
        if (contest.filledSpots >= contest.totalSpots) throw "Contest full";

        const newBalance = contest.type === 'PAID' ? user.balance - contest.entryFee : user.balance;

        transaction.update(userRef, {
          balance: newBalance,
          joinedContests: [...user.joinedContests, contestId]
        });

        transaction.update(contestRef, {
          filledSpots: contest.filledSpots + 1
        });
        
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId,
          type: 'JOIN',
          amount: contest.type === 'PAID' ? contest.entryFee : 0,
          date: new Date().toISOString(),
          description: `Joined ${contest.title} (${matchName})`
        });
      });
      return { success: true, message: "Joined successfully" };
    } catch (e: any) {
      console.error(e);
      return { success: false, message: typeof e === 'string' ? e : "Failed to join" };
    }
  },

  // --- Wallet & Ledger ---
  
  subscribeToTransactions(userId: string, callback: (txs: WalletTransaction[]) => void) {
    const q = query(
      collection(db, 'transactions'), 
      where('userId', '==', userId), 
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(txs);
    });
  },

  async deposit(userId: string, amount: number, description: string = 'Wallet Deposit') {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        balance: (userSnap.data().balance || 0) + amount
      });
      await addDoc(collection(db, 'transactions'), {
        userId,
        type: 'DEPOSIT',
        amount,
        date: new Date().toISOString(),
        description: description
      });
    }
  },

  // --- Deposit Requests (Atomic) ---
  
  async createDepositRequest(userId: string, userName: string, amount: number, screenshotUrl: string, utrNumber: string) {
    await addDoc(collection(db, 'deposit_requests'), {
      userId,
      userName,
      amount,
      utrNumber,
      screenshotUrl,
      status: 'PENDING',
      date: new Date().toISOString()
    });
  },

  subscribeToDepositRequests(callback: (reqs: DepositRequest[]) => void) {
    const q = query(collection(db, 'deposit_requests'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DepositRequest));
      callback(reqs);
    });
  },

  // Fetch only user's requests for history
  subscribeToUserDepositRequests(userId: string, callback: (reqs: DepositRequest[]) => void) {
    const q = query(collection(db, 'deposit_requests'), where('userId', '==', userId), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DepositRequest));
      callback(reqs);
    });
  },

  async processDepositRequest(requestId: string, status: 'APPROVED' | 'REJECTED') {
    const reqRef = doc(db, 'deposit_requests', requestId);

    try {
      await runTransaction(db, async (transaction) => {
        const reqDoc = await transaction.get(reqRef);
        if (!reqDoc.exists()) throw "Request does not exist";
        
        const req = reqDoc.data() as DepositRequest;
        if (req.status !== 'PENDING') throw "Request already processed";

        if (status === 'APPROVED') {
           const userRef = doc(db, 'users', req.userId);
           const userDoc = await transaction.get(userRef);
           
           if (!userDoc.exists()) throw "User does not exist";
           
           // Update User Balance
           const currentBal = userDoc.data().balance || 0;
           transaction.update(userRef, { balance: currentBal + req.amount });
           
           // Create Transaction Entry
           const txRef = doc(collection(db, 'transactions'));
           transaction.set(txRef, {
             userId: req.userId,
             type: 'DEPOSIT',
             amount: req.amount,
             date: new Date().toISOString(),
             description: `Deposit Approved (UTR: ${req.utrNumber})`,
             status: 'SUCCESS'
           });
        }
        
        // Update Request Status
        transaction.update(reqRef, { 
          status,
          approvedAt: new Date().toISOString()
        });
      });
      return { success: true };
    } catch (e) {
      console.error("Deposit Processing Error:", e);
      return { success: false, message: "Transaction failed" };
    }
  },

  subscribeToWithdrawals(callback: (reqs: WithdrawRequest[]) => void) {
    const q = query(collection(db, 'withdrawals'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WithdrawRequest));
      callback(reqs);
    });
  },

  async createWithdrawRequest(userId: string, userEmail: string, amount: number, upiId: string): Promise<{success: boolean, message: string}> {
    const userRef = doc(db, 'users', userId);
    
    // Check Admin Config for Min Withdraw
    const adminConfig = await this.getAdminConfig();
    if (amount < adminConfig.minWithdraw) {
      return { success: false, message: `Minimum withdrawal is ₹${adminConfig.minWithdraw}` };
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User not found";
        
        const userData = userDoc.data() as User;
        const currentBalance = userData.balance || 0;
        
        if (userData.lastWithdrawalDate) {
          const lastDate = new Date(userData.lastWithdrawalDate).getTime();
          const now = new Date().getTime();
          const diffHours = (now - lastDate) / (1000 * 60 * 60);
          if (diffHours < 24) throw "One withdrawal allowed every 24 hours";
        }

        if (currentBalance < amount) throw "Insufficient balance";

        transaction.update(userRef, { 
          balance: currentBalance - amount,
          lastWithdrawalDate: new Date().toISOString()
        });
        
        const newReqRef = doc(collection(db, 'withdrawals'));
        transaction.set(newReqRef, {
          id: newReqRef.id,
          userId,
          userEmail,
          amount,
          upiId,
          status: 'PENDING',
          date: new Date().toISOString()
        });

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId,
          type: 'WITHDRAW',
          amount,
          date: new Date().toISOString(),
          description: 'Withdraw Request',
          status: 'PENDING'
        });

      });
      return { success: true, message: "Request sent. Transfer in 24-48 hours." };
    } catch (e: any) {
      return { success: false, message: typeof e === 'string' ? e : "Failed" };
    }
  },

  async updateWithdrawStatus(reqId: string, status: 'APPROVED' | 'REJECTED') {
    const reqRef = doc(db, 'withdrawals', reqId);
    const reqSnap = await getDoc(reqRef);
    
    if (!reqSnap.exists()) return;
    const req = reqSnap.data() as WithdrawRequest;

    if (status === 'REJECTED' && req.status === 'PENDING') {
      const userRef = doc(db, 'users', req.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          balance: (userSnap.data().balance || 0) + req.amount
        });
        await addDoc(collection(db, 'transactions'), {
          userId: req.userId,
          type: 'DEPOSIT', 
          amount: req.amount,
          date: new Date().toISOString(),
          description: 'Withdrawal Refunded',
          status: 'SUCCESS'
        });
      }
    } else if (status === 'APPROVED') {
       // Ideally verify transaction ID here
    }
    
    await updateDoc(reqRef, { status });
  },

  // --- Points & Rules ---

  async getPointRules(): Promise<PointRule[]> {
    const snap = await getDocs(collection(db, 'point_rules'));
    if (snap.empty) {
      for (const r of DEFAULT_POINTS) {
        await setDoc(doc(db, 'point_rules', r.id), r);
      }
      return DEFAULT_POINTS;
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PointRule));
  },

  async updatePointRule(rule: PointRule) {
    await setDoc(doc(db, 'point_rules', rule.id), rule);
  },

  // --- Users Control ---
  
  async subscribeToUser(id: string, callback: (user: User) => void) {
    return onSnapshot(doc(db, 'users', id), (doc) => {
      if (doc.exists()) callback({ id: doc.id, ...doc.data() } as User);
    });
  },

  async getAllUsers(): Promise<User[]> {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
  },

  async toggleBanUser(userId: string, currentStatus: boolean) {
    await updateDoc(doc(db, 'users', userId), { isBanned: !currentStatus });
  },

  async getAdminConfig(): Promise<AdminConfig> {
    try {
      const d = await getDoc(doc(db, 'settings', 'admin'));
      return d.exists() ? (d.data() as AdminConfig) : DEFAULT_ADMIN;
    } catch (e) {
      console.warn("Failed to get admin config, using defaults", e);
      return DEFAULT_ADMIN;
    }
  },

  async updateAdminConfig(config: AdminConfig) {
    await setDoc(doc(db, 'settings', 'admin'), config);
  },

  async getAppConfig(): Promise<AppConfig> {
    try {
      const d = await getDoc(doc(db, 'settings', 'public'));
      return d.exists() ? (d.data() as AppConfig) : DEFAULT_APP_CONFIG;
    } catch(e) { return DEFAULT_APP_CONFIG; }
  },

  async updateAppConfig(config: AppConfig) {
    await setDoc(doc(db, 'settings', 'public'), config);
  },

  // --- Redeem ---
  
  async generateRedeemCode(value: number): Promise<RedeemCode> {
    const code = 'TEAM11-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCode: RedeemCode = {
      id: '',
      code,
      value,
      isUsed: false,
      generatedDate: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'redeem_codes'), newCode);
    return { ...newCode, id: docRef.id };
  }
};
