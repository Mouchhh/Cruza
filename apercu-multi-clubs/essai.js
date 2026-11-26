const base = "https://nzmkeylibdcqmgqopesu.supabase.co";
const login = document.getElementById("connexion");
const space = document.getElementById("espace");
const club = document.getElementById("club");
const documents = document.getElementById("documents");
const list = document.getElementById("liste");
const form = document.getElementById("nouvelle");
const status = document.getElementById("etat");
let session, key, generation = 0, loadVersion = 0;

async function request(path, options = {}) {
  const { method = "GET", data } = options;
  const headers = { apikey: key, Accept: "application/json" };
  if (session) headers.Authorization = "Bearer " + session;
  if (data) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method, headers, body: data ? JSON.stringify(data) : undefined,
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("Supabase a refusé la demande (" + response.status + ").");
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

function closeSession() {
  generation++;
  session = key = undefined;
  club.replaceChildren();
  list.replaceChildren();
  form.reset();
  space.hidden = true;
  login.hidden = false;
  status.textContent = "";
}
document.getElementById("quitter").onclick = closeSession;

async function showDocuments() {
  const id = club.value, owner = generation, version = ++loadVersion;
  list.replaceChildren();
  documents.hidden = !id;
  document.getElementById("vide").hidden = !!id;
  if (!id) return;
  const rows = await request("/rest/v1/cruza_documents?select=title,shared&kind=eq.seance&club_id=eq." + encodeURIComponent(id) + "&order=title&limit=100");
  if (owner !== generation || version !== loadVersion) return;
  list.replaceChildren(...rows.map(row => {
    const line = document.createElement("li");
    line.textContent = row.title + (row.shared ? " · Partagée" : " · Privée");
    return line;
  }));
  if (!rows.length) list.textContent = "Aucune séance visible.";
}
club.onchange = () => showDocuments().catch(error => { status.textContent = error.message; });

login.onsubmit = async event => {
  event.preventDefault();
  const button = login.querySelector("button");
  button.disabled = true;
  key = login.elements.key.value.trim();
  const credentials = { email: login.elements.email.value.trim(), password: login.elements.password.value };
  login.elements.password.value = "";
  try {
    const result = await request("/auth/v1/token?grant_type=password", { method: "POST", data: credentials });
    if (typeof result.access_token !== "string") throw Error("Connexion non confirmée.");
    session = result.access_token;
    const clubs = await request("/rest/v1/cruza_clubs?select=id,name&order=name");
    club.replaceChildren(...clubs.map(row => new Option(row.name, row.id)));
    login.hidden = true;
    space.hidden = false;
    status.textContent = "";
    await showDocuments();
  } catch (error) {
    closeSession();
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

form.onsubmit = async event => {
  event.preventDefault();
  const id = club.value, owner = generation, title = form.elements.title.value.trim();
  if (!id || !title) return;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await request("/rest/v1/cruza_documents", {
      method: "POST", data: { club_id: id, kind: "seance", title, payload: { test: true }, shared: form.elements.shared.checked },
    });
    if (owner !== generation) return;
    form.reset();
    if (club.value === id) await showDocuments();
    if (owner === generation) status.textContent = "Séance fictive enregistrée.";
  } catch (error) {
    if (owner === generation) status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
