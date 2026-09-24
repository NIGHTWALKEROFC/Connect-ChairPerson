/**
 * firebase-config.js
 *
 * Replace the placeholder values below with YOUR Firebase project's config.
 * You get these values from: Firebase Console -> Project settings -> General
 *   -> "Your apps" -> Web app -> SDK setup and configuration -> "Config".
 *
 * This file is safe to be public in your GitHub repo. Firebase web config
 * values are not secret keys — access is controlled by Firestore "rules"
 * (see firestore.rules in this project) and by who has an admin login,
 * not by hiding this file.
 */

const firebaseConfig = {
  apiKey: "AIzaSyCiZjaYMw7mZctWrs81d9I3GOZ03vxtHK0",
  authDomain: "complaint-website-47f71.firebaseapp.com",
  projectId: "complaint-website-47f71",
  storageBucket: "complaint-website-47f71.firebasestorage.app",
  messagingSenderId: "617956844837",
  appId: "1:617956844837:web:487dc1c0549b5742d166cc"
};

// Initialize Firebase (compat SDK, loaded via <script> tags in index.html / admin.html)
var db, auth;
try {
  if (typeof firebase === "undefined") {
    throw new Error("The firebase object is undefined — the Firebase SDK <script> tags didn't load. Check your internet connection, ad-blocker, or the script tags in the HTML file.");
  }
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
} catch (err) {
  console.error("Firebase init failed:", err);
}

// NOTE: Firebase Storage is intentionally NOT used in this project.
// Storage requires the paid "Blaze" plan even for small usage.
// Firestore, Hosting, and Authentication are free forever on the "Spark" plan.
// File attachments are instead saved as base64 text directly inside the
// Firestore complaint document (see js/main.js) — this stays 100% free,
// with a smaller size limit (700KB) because Firestore documents max out at 1MB.
