// src/services/crickapi.ts

export const fetchMatches = async () => {
  try {
    const response = await fetch(
      "https://api.cricapi.com/v1/currentMatches?apikey=9b1799f1-dbd3-4ad8-a4b8-e9050334a9a3&offset=0"
    );

    const data = await response.json();

    if (data.status !== "success") {
      console.error("API Error:", data);
      return [];
    }

    return data.data; // matches array
  } catch (error) {
    console.error("Fetch Error:", error);
    return [];
  }
};
