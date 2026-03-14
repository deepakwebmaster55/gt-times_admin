const requireAdminAuth = async (onAuthed) => {
  if (!window.gtSupabase1) return;

  const { data } = await window.gtSupabase1.auth.getSession();
  const session = data?.session;
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  if (typeof onAuthed === "function") {
    onAuthed(session.user);
  }
};

window.requireAdminAuth = requireAdminAuth;
