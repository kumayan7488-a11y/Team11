import { Match, MatchScore, Player, PlayerRole } from '../types';

const API_KEY = "9b1799f1-dbd3-4ad8-a4b8-e9050334a9a3";
// (अगर चाहो तो तुम अपने दूसरे key को भी इस्तेमाल कर सकते हो)
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
  score?: any[];
  teamInfo?: any[];
}

export const cricketApi = {

  async fetchMatches(): Promise<Partial<Match>[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/matches?apikey=${API_KEY}&offset=0`
      );
      const data = await response.json();
      if (data.status !== "success" || !data.data) return [];

      const now = new Date();
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      return data.data
        .filter((m: ApiMatch) => {
          const dt = m.dateTimeGMT
            ? new Date(m.dateTimeGMT)
            : new Date(m.date);
          return dt > cutoff;
        })
        .map((m: ApiMatch) => ({
          apiId: m.id,
          teamA: m.teams?.[0] || "",
          teamB: m.teams?.[1] || "",
          date: m.dateTimeGMT || m.date,
          status: m.status,
          score: m.score && m.score.length
            ? { runs: m.score[0].r, wickets: m.score[0].w, overs: m.score[0].o }
            : undefined,
        }));
    } catch (error) {
      console.error("fetchMatches error", error);
      return [];
    }
  },

  // 🆕 New: Fetch Current (Live/Recent) Matches
  async fetchCurrentMatches(): Promise<Partial<Match>[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/currentMatches?apikey=${API_KEY}&offset=0`
      );
      const data = await response.json();

      if (data.status !== "success" || !data.data) return [];

      return data.data.map((m: ApiMatch) => ({
        apiId: m.id,
        teamA: m.teams?.[0] || "",
        teamB: m.teams?.[1] || "",
        date: m.dateTimeGMT || m.date,
        status: m.status,
        score: m.score && m.score.length
          ? { runs: m.score[0].r, wickets: m.score[0].w, overs: m.score[0].o }
          : undefined,
      }));

    } catch (error) {
      console.error("fetchCurrentMatches error", error);
      return [];
    }
  },

  async fetchMatchScore(matchId: string): Promise<MatchScore | null> {
    try {
      const response = await fetch(
        `${BASE_URL}/match_score?apikey=${API_KEY}&id=${matchId}`
      );
      const data = await response.json();
      if (data.status === "success" && data.data?.score) {
        const s = data.data.score;
        return { runs: s.r || 0, wickets: s.w || 0, overs: s.o || 0 };
      }
      return null;
    } catch (error) {
      console.error("fetchMatchScore error", error);
      return null;
    }
  },

  async fetchSquad(matchId: string): Promise<Player[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/match_squad?apikey=${API_KEY}&id=${matchId}`
      );
      const data = await response.json();
      if (data.status === "success" && data.data) {
        const players: Player[] = [];

        Object.keys(data.data).forEach((teamName) => {
          if (teamName === "teamInfo") return;
          const teamPlayers = data.data[teamName];
          if (Array.isArray(teamPlayers)) {
            teamPlayers.forEach((p: any) => {
              let role: PlayerRole = "BAT";
              const r = (p.role || "").toLowerCase();
              if (r.includes("bowl")) role = "BWL";
              else if (r.includes("all")) role = "AR";
              else if (r.includes("keep")) role = "WK";

              players.push({
                id: p.id || Math.random().toString(36).slice(2),
                name: p.name,
                role,
                credits: 8.5,
                points: 0,
                teamName,
              });
            });
          }
        });
        return players;
      }
      return [];
    } catch (error) {
      console.error("fetchSquad error", error);
      return [];
    }
  },
};
