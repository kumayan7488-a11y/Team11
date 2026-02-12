// services/cricketApi.ts

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  status: string;
  date: string;
  score?: {
    runs: number;
    wickets: number;
    overs: number;
  };
}

export interface Player {
  id: string;
  name: string;
  role: "WK" | "BAT" | "AR" | "BWL";
  teamName: string;
}

const API_KEY = "9b1799f1-dbd3-4ad8-a4b8-e9050334a9a3";
const offset = "0"
const BASE_URL = "https://api.cricapi.com/v1";

export const cricketApi = {

  // 🔥 1️⃣ Current Matches
  async fetchCurrentMatches(): Promise<Match[]> {
    try {
      const res = await fetch(
        `${BASE_URL}/currentMatches?apikey=${API_KEY}&offset=0`
      );
      const data = await res.json();

      if (data.status !== "success") return [];

      return data.data.map((m: any) => ({
        id: m.id,
        teamA: m.teams?.[0] || "Team A",
        teamB: m.teams?.[1] || "Team B",
        status: m.status,
        date: m.dateTimeGMT || m.date,
        score:
          m.score && m.score.length
            ? {
                runs: m.score[0].r,
                wickets: m.score[0].w,
                overs: m.score[0].o
              }
            : undefined
      }));

    } catch (err) {
      console.error("fetchCurrentMatches error:", err);
      return [];
    }
  },

  // 🔥 2️⃣ All Matches
  async fetchMatches(): Promise<Match[]> {
    try {
      const res = await fetch(
        `${BASE_URL}/matches?apikey=${API_KEY}&offset=0`
      );
      const data = await res.json();

      if (data.status !== "success") return [];

      return data.data.map((m: any) => ({
        id: m.id,
        teamA: m.teams?.[0] || "Team A",
        teamB: m.teams?.[1] || "Team B",
        status: m.status,
        date: m.dateTimeGMT || m.date
      }));

    } catch (err) {
      console.error("fetchMatches error:", err);
      return [];
    }
  },

  // 🔥 3️⃣ Match Score
  async fetchMatchScore(matchId: string) {
    try {
      const res = await fetch(
        `${BASE_URL}/match_score?apikey=${API_KEY}&id=${matchId}`
      );
      const data = await res.json();

      if (data.status === "success" && data.data?.score) {
        const s = data.data.score;
        return {
          runs: s.r || 0,
          wickets: s.w || 0,
          overs: s.o || 0
        };
      }

      return null;

    } catch (err) {
      console.error("fetchMatchScore error:", err);
      return null;
    }
  },

  // 🔥 4️⃣ Match Squad
  async fetchSquad(matchId: string): Promise<Player[]> {
    try {
      const res = await fetch(
        `${BASE_URL}/match_squad?apikey=${API_KEY}&id=${matchId}`
      );
      const data = await res.json();

      if (data.status !== "success") return [];

      const players: Player[] = [];

      Object.keys(data.data).forEach((teamName) => {
        if (teamName === "teamInfo") return;

        const teamPlayers = data.data[teamName];

        if (Array.isArray(teamPlayers)) {
          teamPlayers.forEach((p: any) => {

            let role: "WK" | "BAT" | "AR" | "BWL" = "BAT";
            const r = (p.role || "").toLowerCase();

            if (r.includes("bowl")) role = "BWL";
            else if (r.includes("all")) role = "AR";
            else if (r.includes("keep")) role = "WK";

            players.push({
              id: p.id || Math.random().toString(36).slice(2),
              name: p.name,
              role,
              teamName
            });
          });
        }
      });

      return players;

    } catch (err) {
      console.error("fetchSquad error:", err);
      return [];
    }
  }

};
