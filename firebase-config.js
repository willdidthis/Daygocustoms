// Online accounts (passwords, unique usernames, synced presets) and multiplayer run on Firebase (free tier).
// Until this is filled in, the game uses browser-only accounts and multiplayer stays off.
//
// To switch it on: create a Firebase project, enable Email/Password sign-in and the Realtime Database, then replace
// null below with the web-app config object Firebase shows you, for example:
//   window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "....firebaseapp.com", databaseURL: "https://...firebaseio.com",
//                              projectId: "...", appId: "..." };
// (This config is meant to be public — security comes from the database rules in database.rules.json.)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAVgyycj2zAG_hwAwQASBmlKQU-3ZR4zY4",
  authDomain: "daygocustoms.firebaseapp.com",
  databaseURL: "https://daygocustoms-default-rtdb.firebaseio.com",
  projectId: "daygocustoms",
  storageBucket: "daygocustoms.firebasestorage.app",
  messagingSenderId: "91843161187",
  appId: "1:91843161187:web:48ed5262164e77c3745c56"
};
