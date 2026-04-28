// FILE: /public/assets/js/firebase-realtime.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, orderBy, query, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const runtimeConfig = window.APP_FIREBASE || {};

function hasFirebaseConfig(config) {
  return Boolean(
    config.enabled &&
    config.projectId &&
    config.apiKey &&
    config.authDomain
  );
}

function renderRealtimeInbox(container, docs) {
  if (!container) return;

  if (!docs.length) {
    container.innerHTML = '<div class="wa-empty-note">No Firestore conversation mirror data yet.</div>';
    return;
  }

  const items = docs.map((doc) => {
    const data = doc.data();
    const contactName = data.contactName || "Unknown contact";
    const phoneNumber = data.phoneNumber || "";
    const preview = data.lastMessagePreview || "No preview yet";
    return `
      <a class="wa-account-item" href="/conversations/${doc.id}">
        <span class="wa-account-avatar">${contactName.slice(0, 1).toUpperCase()}</span>
        <span>
          <strong>${escapeHtml(contactName)}</strong>
          <small>${escapeHtml(phoneNumber)} • ${escapeHtml(preview)}</small>
        </span>
      </a>
    `;
  });

  container.innerHTML = items.join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function initRealtimeInbox() {
  const panel = document.querySelector("[data-firebase-inbox]");
  if (!panel || !hasFirebaseConfig(runtimeConfig) || !runtimeConfig.enableAnonAuth) {
    return;
  }

  const tenantId = panel.getAttribute("data-tenant-id");
  if (!tenantId) {
    return;
  }

  const firebaseApp = initializeApp({
    apiKey: runtimeConfig.apiKey,
    authDomain: runtimeConfig.authDomain,
    projectId: runtimeConfig.projectId,
    storageBucket: runtimeConfig.storageBucket || undefined,
    messagingSenderId: runtimeConfig.messagingSenderId || undefined,
    appId: runtimeConfig.appId || undefined,
  });

  const auth = getAuth(firebaseApp);
  await signInAnonymously(auth);

  const db = getFirestore(firebaseApp);
  const conversationsRef = collection(db, "tenants", tenantId, "conversations");
  const conversationsQuery = query(conversationsRef, orderBy("updatedAt", "desc"), limit(20));

  onSnapshot(conversationsQuery, (snapshot) => {
    renderRealtimeInbox(panel, snapshot.docs);
  });
}

initRealtimeInbox().catch((error) => {
  console.error("Firebase realtime inbox failed to initialize", error);
});
