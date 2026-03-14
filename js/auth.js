const firebaseConfig = (window.GT_ADMIN_CONFIG || {}).firebase || {};

let firebaseApp = null;
let firebaseAuth = null;

if (firebaseConfig.apiKey) {
  firebaseApp = firebase.initializeApp(firebaseConfig);
  firebaseAuth = firebase.auth();
}

window.gtFirebaseAuth = firebaseAuth;

const requireAdminAuth = (onAuthed) => {
  if (!firebaseAuth) {
    return;
  }
  firebaseAuth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (typeof onAuthed === "function") {
      onAuthed(user);
    }
  });
};

window.requireAdminAuth = requireAdminAuth;
