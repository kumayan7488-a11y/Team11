import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCoHxJLYTDPF8S-YFjn8r22vbrornCxKqo",
  authDomain: "gaks-50783.firebaseapp.com",
  databaseURL: "https://gaks-50783-default-rtdb.firebaseio.com",
  projectId: "gaks-50783",
  storageBucket: "gaks-50783.firebasestorage.app",
  messagingSenderId: "562066262708",
  appId: "1:562066262708:web:4b230feabe97bc85d365e1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);