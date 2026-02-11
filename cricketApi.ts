
import { Match, MatchScore, Player, PlayerRole } from '../types';

const API_KEY = "234c91f8-3972-4fda-a1bc-c7d06c085b0c";
const BASE_URL = "https://api.cricapi.com/v1";

interface ApiMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  score?: [
    { r: number; w: number; o: number },
    { r: number; w: number; o: number }
  ];
  t1?: string; // Team 1 Abbr
  t2?: string; // Team 2 Abbr
}

export const cricketApi = {
  async fetchMatches(): Promise<Partial<Match>[]> {
    try {
      // Changed to /matches to get the full schedule (upcoming matches)
      const response = await fetch(`${BASE_URL}/matches?apikey=${API_KEY}&offset=0`);
      const data = await response.json();

      if (data.status !== "success" || !data.data) {
        console.error("Cricket API Error:", data);
        return [];
      }

      const now = new Date();
      // Filter out old matches (keep from yesterday onwards to show recent results + future)
      const cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Transform API data to our Match App Model
      return data.data
        .filter((m: ApiMatch) => {
          const d = m.dateTimeGMT ? new Date(m.dateTimeGMT) : new Date(m.date);
          return d > cutoffDate;
        })
        .map((m: ApiMatch) => {
          const teamA = m.teams && m.teams.length > 0 ? m.teams[0] : (m.t1 || 'Team A');
          const teamB = m.teams && m.teams.length > 1 ? m.teams[1] : (m.t2 || 'Team B');

          // Determine Status
          let status: 'UPCOMING' | 'LIVE' | 'COMPLETED' = 'UPCOMING';
          const s = m.status.toLowerCase();
          
          if (s.includes('live') || s.includes('started')) status = 'LIVE';
          else if (s.includes('won') || s.includes('ended') || s.includes('finished') || s.includes('result')) status = 'COMPLETED';
          else status = 'UPCOMING';

          // Parse Date
          const matchDate = m.dateTimeGMT ? new Date(m.dateTimeGMT).toISOString() : (m.date || new Date().toISOString());

          // Parse Score (Basic) if available
          let score: MatchScore | undefined = undefined;
          if (m.score && m.score.length > 0) {
             score = {
               runs: m.score[0].r,
               wickets: m.score[0].w,
               overs: m.score[0].o
             };
          }

          return {
            apiId: m.id,
            teamA: teamA,
            teamB: teamB,
            date: matchDate,
            status: status,
            result: status === 'COMPLETED' ? m.status : undefined,
            score: score
          };
        });
    } catch (error) {
      console.error("Failed to fetch matches from API", error);
      return [];
    }
  },

  async fetchMatchScore(matchId: string): Promise<MatchScore | null> {
    try {
      const response = await fetch(`${BASE_URL}/match_score?apikey=${API_KEY}&id=${matchId}`);
      const data = await response.json();
      
      if (data.status === "success" && data.data) {
         const s = data.data.score;
         if(s) {
           return {
             runs: s.r || 0,
             wickets: s.w || 0,
             overs: s.o || 0
           };
         }
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch match score", error);
      return null;
    }
  },

  async fetchSquad(matchId: string): Promise<Player[]> {
    try {
      const response = await fetch(`${BASE_URL}/match_squad?apikey=${API_KEY}&id=${matchId}`);
      const data = await response.json();
      
      if (data.status === "success" && data.data) {
        const players: Player[] = [];
        // The API returns structure like { teamName: [ { name: "...", role: "..." } ] }
        // We need to normalize this. Note: The exact structure of cricapi squad varies, 
        // assuming standard format here.
        
        const teams = Object.keys(data.data).filter(k => k !== 'teamInfo');
        
        teams.forEach(teamName => {
           const teamPlayers = data.data[teamName];
           if (Array.isArray(teamPlayers)) {
              teamPlayers.forEach((p: any) => {
                 let role: PlayerRole = 'BAT';
                 const r = (p.role || '').toLowerCase();
                 if (r.includes('bowl')) role = 'BWL';
                 else if (r.includes('all')) role = 'AR';
                 else if (r.includes('keep')) role = 'WK';

                 players.push({
                   id: p.id || Math.random().toString(36).substr(2, 9),
                   name: p.name,
                   role,
                   credits: 8.5, // Default credit
                   points: 0,
                   teamName: teamName
                 });
              });
           }
        });
        return players;
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch squad", error);
      return [];
    }
  }
};
