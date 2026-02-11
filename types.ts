
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  GUEST = 'GUEST',
}

export interface User {
  id: string;
  email?: string;
  phoneNumber?: string;
  username: string;
  name: string;
  balance: number;
  joinedContests: string[]; // Contest IDs
  referralCode: string;
  referredBy?: string; // Name of referrer
  referredByCode?: string;
  isBanned?: boolean;
  lastWithdrawalDate?: string;
  avatar?: string; // URL of the selected avatar
}

export interface MatchScore {
  runs: number;
  wickets: number;
  overs: number;
}

export type PlayerRole = 'BAT' | 'BWL' | 'AR' | 'WK';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  credits: number;
  points: number; // Fantasy points scored in this match
  teamName: string; // Which team they belong to (e.g., "CSK" or "MI")
  imageUrl?: string;
}

export interface Match {
  id: string;
  apiId?: string; // External API ID
  teamA: string;
  teamB: string;
  date: string;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED';
  result?: string; // e.g. "CSK won"
  score?: MatchScore;
  players?: Player[]; // Squad list
}

export interface Contest {
  id: string;
  matchId: string;
  title: string;
  type: 'PAID' | 'PRACTICE';
  entryFee: number;
  winningAmount: number;
  adminCommission: number;
  totalSpots: number;
  filledSpots: number;
  isClosed?: boolean;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'JOIN' | 'WIN' | 'REFERRAL';
  amount: number;
  date: string;
  description: string;
  status?: 'SUCCESS' | 'FAILED' | 'PENDING'; // Optional, mostly for display if we merge lists
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  upiId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  date: string;
}

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  utrNumber: string; // Added UTR
  screenshotUrl?: string; 
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  date: string;
  approvedAt?: string;
  adminNote?: string;
}

export interface RedeemCode {
  id: string;
  code: string;
  value: number;
  isUsed: boolean;
  generatedDate: string;
}

export interface AdminConfig {
  email: string;
  password: string;
  minWithdraw: number;
  appVersion: string;
  forceUpdate: boolean;
}

export interface SocialLink {
  platform: string; // e.g. "Instagram", "Twitter"
  url: string;
}

export interface AppConfig {
  developerName: string;
  socialLinks: SocialLink[];
  depositUpiId?: string; // The UPI ID users should send money to
}

export interface PointRule {
  id: string;
  action: string; // e.g. "Run", "Wicket"
  points: number;
}
