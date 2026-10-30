import { createClient } from "@supabase/supabase-js";
import catalog from "./catalog.json";
const config = window.STCK_CONFIG || {};
const client =
  config.supabaseUrl && config.supabaseKey
    ? createClient(config.supabaseUrl, config.supabaseKey)
    : null;
let user = null,
  space = null,
  pending = new Map(),
  syncing = false,
  generation = 0,
  poll = null;
let identityVersion = 0,
  statusTimer;
let previewMode = false,
  inventory = new Map(),
  inventoryCopyNos = new Map(),
  boardRows = [],
  lastDraw = null,
  sharedTokens = 0,
  archivedChallenges = [];
const placementKey = (row) =>
  [row.copy_owner || "preview", row.sticker_id, row.copy_no || 1].join(":");
const status = document.createElement("p");
status.className = "save-status";
status.setAttribute("role", "status");
document.body.append(status);
function say(text) {
  status.textContent = text;
  status.dataset.idle = "false";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status.dataset.idle = "true";
  }, 3400);
  document
    .querySelector(".account-feedback")
    ?.replaceChildren(document.createTextNode(text));
}
function renderWallet() {
  const balance = document.querySelector("#wallet-balance");
  if (balance) balance.textContent = `${sharedTokens} ${sharedTokens === 1 ? "jeton" : "jetons"}`;
}
function syncDailyPouchLink() {
  const link = document.querySelector(".daily-pouch-link");
  if (!link) return;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const claimed = user && localStorage.getItem(`stck:daily-claimed:${user.id}`) === day;
  link.dataset.available = String(!claimed);
  link.textContent = claimed ? "Sticker du jour récupéré" : "Réclamer le sticker du jour";
  link.setAttribute("aria-disabled", String(Boolean(claimed)));
  if (claimed) link.addEventListener("click", (event) => event.preventDefault(), { once: true });
}
document.querySelector(".daily-pouch-link")?.addEventListener("click", (event) => {
  if (event.currentTarget.dataset.available === "false") event.preventDefault();
});
const button = document.createElement("button");
button.className = "account-button";
button.type = "button";
button.setAttribute("aria-label", "Mon espace");
button.title = "Mon espace";
button.innerHTML =
  '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
(
  document.querySelector(".app-header") || document.querySelector(".topbar")
).append(button);
const dialog = document.createElement("dialog");
dialog.className = "account-dialog";
dialog.innerHTML = `<button class="dialog-close" aria-label="Fermer">×</button><h1>Bienvenue chez vous.</h1>
<p class="account-state"></p><p class="account-feedback" role="status"></p><section data-view="login"><p>Un code, et vos stickers se retrouvent.</p>
<form id="login-form"><label>Ton code personnel<input name="code" type="password" autocomplete="current-password" autocapitalize="characters" spellcheck="false" placeholder="STCK-A-…" required></label><button>Entrer</button></form>
<p class="login-note">À garder pour te connecter sur un autre appareil.</p>
<button id="demo" class="secondary">Explorer l’aperçu</button>
<button class="motion-toggle secondary" type="button">Activer le mouvement du téléphone</button><p class="motion-help">La scène se déplace doucement quand tu inclines l’appareil.</p></section>
<section data-view="setup" hidden><p>Votre espace est en cours de préparation. Recharge la page dans un instant.</p></section>
<section data-view="account" hidden><p id="space-description"></p>
<h2>Notifications</h2><p id="push-info"></p><p>Le rappel quotidien t’indique qu’un sticker gratuit est prêt. Chaque téléphone s’active séparément.</p><button id="enable-push">Activer sur cet appareil</button><button id="disable-push" class="secondary">Désactiver sur cet appareil</button>
<form id="preferences-form"><label class="check"><input name="daily" type="checkbox">Rappel quotidien</label><label>À quelle heure ?<input name="time" type="time" value="18:30" required></label><label class="check"><input name="news" type="checkbox">Les nouveautés STCK</label><p id="timezone-label"></p><button>Enregistrer mes préférences</button></form>
<h2>Dernières nouvelles</h2><ul id="inbox"></ul><button id="logout" class="secondary">Se déconnecter</button><button class="motion-toggle secondary" type="button">Activer le mouvement du téléphone</button><p class="motion-help">La scène se déplace doucement quand tu inclines l’appareil.</p></section>`;
document.body.append(dialog);
const $ = (selector) => dialog.querySelector(selector);
function view(name) {
  dialog
    .querySelectorAll("[data-view]")
    .forEach((el) => (el.hidden = el.dataset.view !== name));
}
function show() {
  if (!dialog.open) dialog.showModal();
}
$(".dialog-close").onclick = () => dialog.close();
button.onclick = () => {
  show();
  if (user) refreshAccount().catch(handleError);
};
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
});
function handleError(error) {
  say(
    navigator.onLine
      ? error?.message || "Une erreur est survenue. Réessaie."
      : "Hors connexion. Réessaie quand le réseau revient.",
  );
}
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let orientationEnabled = false,
  orientationFrame = 0,
  tiltX = 0,
  tiltY = 0;
function setTilt(x, y) {
  tiltX = Math.max(-1, Math.min(1, x));
  tiltY = Math.max(-1, Math.min(1, y));
  if (orientationFrame) return;
  orientationFrame = requestAnimationFrame(() => {
    orientationFrame = 0;
    document.documentElement.style.setProperty("--tilt-x", `${tiltX * 7}px`);
    document.documentElement.style.setProperty("--tilt-y", `${tiltY * 5}px`);
  });
}
function onOrientation(event) {
  if (reduceMotion.matches || !Number.isFinite(event.gamma)) return;
  const angle = screen.orientation?.angle || 0;
  const horizontal =
    angle === 90 ? event.beta : angle === 270 ? -event.beta : event.gamma;
  const vertical =
    angle === 90 ? -event.gamma : angle === 270 ? event.gamma : event.beta;
  setTilt(horizontal / 35, vertical / 45);
}
function motionLabel() {
  dialog.querySelectorAll(".motion-toggle").forEach((control) => {
    control.textContent = orientationEnabled
      ? "Désactiver le mouvement du téléphone"
      : "Activer le mouvement du téléphone";
    control.setAttribute("aria-pressed", String(orientationEnabled));
    control.disabled = reduceMotion.matches;
  });
}
dialog.querySelectorAll(".motion-toggle").forEach((control) =>
  control.addEventListener("click", async () => {
    if (orientationEnabled) {
      window.removeEventListener("deviceorientation", onOrientation);
      orientationEnabled = false;
      setTilt(0, 0);
      localStorage.removeItem("stck:phone-motion");
      motionLabel();
      return say("Mouvement du téléphone désactivé.");
    }
    try {
      if (typeof DeviceOrientationEvent === "undefined")
        throw Error("Capteur indisponible");
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") throw Error("Permission refusée");
      }
      window.addEventListener("deviceorientation", onOrientation, {
        passive: true,
      });
      orientationEnabled = true;
      localStorage.setItem("stck:phone-motion", "true");
      motionLabel();
      say("Incline doucement ton téléphone pour voir la scène bouger.");
    } catch {
      say("Le capteur n’est pas disponible. L’animation douce reste active.");
    }
  }),
);
reduceMotion.addEventListener?.("change", motionLabel);
motionLabel();
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
function busy(form, value) {
  form.querySelectorAll("button").forEach((b) => (b.disabled = value));
}
$("#login-form").onsubmit = async (e) => {
  e.preventDefault();
  if (!client)
    return say("La connexion sera disponible après la mise en ligne.");
  busy(e.target, true);
  try {
    const code = String(new FormData(e.target).get("code"))
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    const match = /^STCK-([AB])-(?:[A-F0-9]{4}-){3}[A-F0-9]{4}$/.exec(code);
    if (!match)
      throw Error("Ce code n’est pas reconnu. Vérifie-le puis réessaie.");
    await checked(
      client.auth.signInWithPassword({
        email: `participant-${match[1].toLowerCase()}@stck.invalid`,
        password: code,
      }),
    );
    e.target.reset();
    say("Connexion réussie.");
  } catch (error) {
    handleError(
      error?.message === "Invalid login credentials"
        ? Error("Ce code n’est pas reconnu. Vérifie-le puis réessaie.")
        : error,
    );
  } finally {
    busy(e.target, false);
  }
};
$("#demo").onclick = () => {
  dialog.close();
  startPreview();
  restoreBoard(readLocal());
  say("Aperçu des planches de stickers.");
};
$("#logout").onclick = async () => {
  try {
    if (pending.size) await flush();
    if (pending.size)
      throw Error(
        "Le collage attend une sauvegarde. Réessaie avant de te déconnecter.",
      );
    await disablePush();
    await checked(client.auth.signOut({ scope: "local" }));
    location.reload();
  } catch (error) {
    handleError(error);
  }
};
function localKey() {
  return user && space
    ? "stck:board:" + user.id + ":" + space.id
    : "stck:preview:board";
}
function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(localKey()) || "[]");
  } catch {
    return [];
  }
}
function cache(rows) {
  try {
    localStorage.setItem(localKey(), JSON.stringify(rows));
  } catch {
    say("Le stockage de cet appareil est indisponible.");
  }
}
function setDiscoveries(ids = []) {
  inventory = new Map();
  ids.forEach((id) =>
    inventory.set(id, Math.min(3, (inventory.get(id) || 0) + 1)),
  );
  inventoryCopyNos = new Map(
    [...inventory].map(([id, count]) => [id, Array.from({ length: count }, (_, i) => i + 1)]),
  );
  document.dispatchEvent(new CustomEvent("stck:discoveries", { detail: ids }));
  document.body.dataset.collectionReady = "true";
  refreshStock();
}
function refreshStock() {
  const owner = user?.id || "preview";
  const stock = catalog.map((item) => {
    const copyNos = inventoryCopyNos.get(item.id) || [];
    const used = new Set(
      boardRows
        .filter(
          (row) =>
            !row.removed &&
            row.sticker_id === item.id &&
            (row.copy_owner || "preview") === owner,
        )
        .map((row) => row.copy_no || 1),
    );
    return {
      sticker_id: item.id,
      copy_owner: owner,
      count: copyNos.length,
      available: copyNos.filter(
        (n) => !used.has(n),
      ),
    };
  });
  document.dispatchEvent(new CustomEvent("stck:stock", { detail: stock }));
}
function startPreview() {
  previewMode = true;
  renderWallet();
  sessionStorage.setItem("stck:preview-mode", "true");
  let counts = {};
  try {
    counts = JSON.parse(sessionStorage.getItem("stck:preview-stock") || "{}");
  } catch {}
  setDiscoveries(
    catalog.flatMap((item) =>
      Array(Math.min(3, counts[item.id] || 0)).fill(item.id),
    ),
  );
  restoreBoard(readLocal());
}
function clearIdentity() {
  identityVersion++;
  previewMode = false;
  sharedTokens = 0;
  archivedChallenges = [];
  inventoryCopyNos = new Map();
  renderWallet();
  document.dispatchEvent(new Event("stck:identity"));
  setDiscoveries([]);
  restoreBoard([]);
  $("#space-description").textContent = "";
  $("#inbox").replaceChildren();
}
const bridge = {
  catalog,
  ready: false,
  requestDraw: async () => {
    if (!client || previewMode) {
      const values = crypto.getRandomValues(new Uint32Array(2));
      const rare = values[0] / 4294967296 < 0.1;
      const pool = catalog.filter((item) => item.rare === rare);
      const item = pool[Math.floor((values[1] / 4294967296) * pool.length)];
      const count = inventory.get(item.id) || 0;
      lastDraw = {
        sticker_id: item.id,
        kept: count < 3,
        quantity: Math.min(3, count + 1),
      };
      inventory.set(item.id, lastDraw.quantity);
      sessionStorage.setItem(
        "stck:preview-stock",
        JSON.stringify(Object.fromEntries(inventory)),
      );
      return { ...item, ...lastDraw };
    }
    if (!user || !space) {
      show();
      throw Error("Entre ton code pour conserver tes pochettes.");
    }
    const uid = user.id,
      version = identityVersion;
    const daily = new URLSearchParams(location.search).get("daily") === "1";
    if (daily) {
      lastDraw = await checked(client.rpc("claim_daily_pouch"));
      if (!lastDraw?.claimed) throw Error("Sticker du jour déjà récupéré. Reviens demain.");
      localStorage.setItem(`stck:daily-claimed:${uid}`, new Intl.DateTimeFormat("en-CA", {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
        year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date()));
      syncDailyPouchLink();
    } else {
      const key = "stck:pending-draw:" + uid;
      let request = sessionStorage.getItem(key);
      if (!request) {
        request = crypto.randomUUID();
        sessionStorage.setItem(key, request);
      }
      lastDraw = await checked(client.rpc("draw_pouch", { p_request: request }));
    }
    sharedTokens = lastDraw.tokens ?? sharedTokens;
    renderWallet();
    const id = lastDraw.sticker_id;
    if (uid !== user?.id || version !== identityVersion)
      throw Error("Le compte a changé. Rouvre ta pochette.");
    const item = catalog.find((x) => x.id === id);
    if (!item) throw Error("Sticker inconnu. Recharge l’application.");
    return { ...item, ...lastDraw };
  },
  drawRevealed: () => {
    if (!client || previewMode) {
      setDiscoveries([...inventory].flatMap(([id, count]) => Array(count).fill(id)));
      say("Aperçu · sticker ajouté à cette collection locale.");
      return;
    }
    if (user && !new URLSearchParams(location.search).has("daily")) sessionStorage.removeItem("stck:pending-draw:" + user.id);
    say(lastDraw?.free ? "Sticker du jour ajouté à ta collection." :
      lastDraw?.kept
        ? lastDraw.quantity > 1
          ? `${lastDraw.quantity} exemplaires dans ta collection.`
          : "Nouveau sticker dans ta collection."
        : "Déjà 3 exemplaires : ce doublon disparaît.",
    );
    refreshDiscoveries().catch(handleError);
  },
  getWallet: () => sharedTokens,
};
window.STCK = bridge;
function restoreBoard(rows) {
  boardRows = rows;
  document.dispatchEvent(
    new CustomEvent("stck:restore", { detail: rows.map(decoratePlacement) }),
  );
  refreshStock();
}
function decoratePlacement(row) {
  const author = row.placed_by;
  return {
    ...row,
    challenge_status: row.challenge_status || "open",
    ownCopy: previewMode || row.copy_owner === user?.id,
    challengeAuthorIsMe: author
      ? author === user?.id
      : previewMode,
    challengeAcceptedByMe: row.accepted_by
      ? row.accepted_by === user?.id || (previewMode && row.accepted_by === "preview-partner")
      : false,
    authorMark: author
      ? author === space?.owner_id
        ? "A"
        : "B"
      : previewMode
        ? "A"
        : "",
    authorLabel: author
      ? author === user?.id
        ? "Posé par toi"
        : "Posé par l’autre participant"
      : previewMode
        ? "Posé dans l’aperçu"
        : "",
  };
}
async function loadSpace() {
  const uid = user.id,
    version = identityVersion;
  const data = await checked(
    client
      .from("spaces")
      .select("id,owner_id,partner_id,left_label,right_label,tokens")
      .maybeSingle(),
  );
  if (user?.id !== uid || version !== identityVersion) return;
  space = data;
  if (!space) {
    view("setup");
    show();
    return;
  }
  sharedTokens = space.tokens || 0;
  renderWallet();
  view("account");
  bridge.ready = true;
  const expired = await checked(client.rpc("expire_challenges"));
  const rows = await checked(
    client
      .from("placements")
      .select("sticker_id,zone,x,y,placed_by,copy_owner,copy_no,copy_request_id,challenge_status,accepted_by,completed_at,expires_at")
      .eq("space_id", space.id),
  );
  if (uid !== user?.id || version !== identityVersion) return;
  restoreBoard(rows);
  await refreshWalletAndArchive();
  await refreshDiscoveries();
  await refreshAccount();
  clearInterval(poll);
  poll = setInterval(() => {
    if (
      !document.hidden &&
      !pending.size &&
      !syncing &&
      !document.querySelector('[data-lifted="true"]')
    )
      reloadBoard().catch(() => {});
  }, 30000);
  say(expired ? `${expired} défi(s) expiré(s) : les stickers sont revenus à leur collection.` : "Espace synchronisé");
}
async function reloadBoard() {
  if (!space || !user) return;
  const expired = await checked(client.rpc("expire_challenges"));
  if (expired) say(`${expired} défi(s) expiré(s) : les stickers sont revenus à leur collection.`);
  const sid = space.id,
    uid = user.id,
    version = identityVersion;
  const rows = await checked(
    client
      .from("placements")
      .select("sticker_id,zone,x,y,placed_by,copy_owner,copy_no,copy_request_id,challenge_status,accepted_by,completed_at,expires_at")
      .eq("space_id", sid),
  );
  if (
    space?.id === sid &&
    user?.id === uid &&
    version === identityVersion &&
    !pending.size &&
    !syncing
  ) {
    restoreBoard(rows);
    await refreshWalletAndArchive();
  }
}
async function refreshWalletAndArchive() {
  if (!space || !user) return;
  const sid=space.id, uid=user.id, version=identityVersion;
  const [wallet, archive] = await Promise.all([
    checked(client.from("spaces").select("tokens").eq("id",sid).single()),
    checked(client.from("challenge_archive").select("sticker_id,completed_at").eq("space_id",sid).order("completed_at",{ascending:false}).limit(500)),
  ]);
  if (user?.id !== uid || space?.id !== sid || version !== identityVersion) return;
  sharedTokens=wallet.tokens||0;
  archivedChallenges=archive;
  renderWallet();
}
async function refreshDiscoveries() {
  if (!user) return;
  const uid = user.id,
    version = identityVersion;
  const draws = await checked(
    client
      .from("pouch_draws")
      .select("sticker_id,copy_no")
      .eq("user_id", uid)
      .eq("kept", true)
      .order("created_at", { ascending: true })
      .limit(2000),
  );
  if (user?.id !== uid || version !== identityVersion) return;
  const owned = new Set(draws.map((x) => x.sticker_id));
  setDiscoveries(draws.map((x) => x.sticker_id));
  inventoryCopyNos = new Map();
  for (const draw of draws) {
    const slots = inventoryCopyNos.get(draw.sticker_id) || [];
    if (draw.copy_no) slots.push(draw.copy_no);
    inventoryCopyNos.set(draw.sticker_id, slots);
  }
  refreshStock();
  $("#space-description").textContent =
    `${draws.length} stickers dans ta collection privée · table partagée`;
}
document.addEventListener("stck:placement", (event) => {
  const row = event.detail;
  if (client && !previewMode && (!user || !space)) {
    show();
    restoreBoard([]);
    return;
  }
  if (!user || !space) {
    const rows = readLocal().filter(
      (x) => placementKey(x) !== placementKey(row),
    );
    if (!row.removed) rows.push(row);
    cache(rows);
    restoreBoard(rows);
    say("Aperçu conservé sur cet appareil");
    return;
  }
  const decorated = decoratePlacement({
    ...row,
    placed_by: row.placed_by || user.id,
  });
  document.dispatchEvent(
    new CustomEvent("stck:restore-one", { detail: decorated }),
  );
  boardRows = boardRows.filter((x) => placementKey(x) !== placementKey(row));
  if (!row.removed) boardRows.push(decorated);
  refreshStock();
  pending.set(placementKey(row), { ...decorated, version: ++generation });
  savePending();
  flush().catch(handleError);
});
document.addEventListener("stck:challenge-action", async (event) => {
  const { action, ...snapshot } = event.detail;
  const key = placementKey(snapshot);
  const current = boardRows.find((row) => placementKey(row) === key);
  if (!current) return;
  if (client && !previewMode && !current.copy_request_id)
    return say("Le sticker finit de se sauvegarder. Réouvre le défi dans un instant.");
  const currentStatus = current.challenge_status || "open";
  const wantedStatus = action === "accept" ? "accepted" : action === "done" ? "done" : "open";
  if (previewMode || !user || !space) {
    if (action === "accept" && currentStatus !== "open") return say("Ce défi a déjà évolué.");
    if (action !== "accept" && (currentStatus !== "accepted" || current.accepted_by !== "preview-partner")) return say("Seule la personne qui a relevé le défi peut changer son statut.");
    const changed = decoratePlacement({
      ...current,
      challenge_status: wantedStatus,
      accepted_by: action === "accept" ? "preview-partner" : action === "reopen" ? null : current.accepted_by,
      completed_at: action === "done" ? new Date().toISOString() : null,
    });
    boardRows = boardRows.map((row) => placementKey(row) === key ? changed : row);
    if (action === "done") { boardRows = boardRows.filter((row) => placementKey(row) !== key); sharedTokens++; archivedChallenges.unshift({sticker_id:current.sticker_id,completed_at:new Date().toISOString()}); renderWallet(); }
    cache(boardRows);
    document.dispatchEvent(new CustomEvent("stck:restore-one", { detail: action === "done" ? { ...current, removed: true } : changed }));
    return say(action === "accept" ? "Tu as choisi de relever ce défi." : action === "done" ? "Défi marqué comme réalisé ensemble." : "Tu as changé d’avis, le défi reste en attente.");
  }
  if (action === "accept" && (currentStatus !== "open" || current.placed_by === user.id)) return say("Ce défi n’est plus disponible pour toi.");
  if (action !== "accept" && (currentStatus !== "accepted" || current.accepted_by !== user.id)) return say("Seule la personne qui l’a relevé peut changer son statut.");
  try {
    if (action === "done") {
      const result = await checked(client.rpc("complete_challenge", {
        p_space: space.id, p_sticker: current.sticker_id,
        p_copy_owner: current.copy_owner, p_copy_no: current.copy_no,
        p_copy_request: current.copy_request_id,
      }));
      boardRows = boardRows.filter((row) => placementKey(row) !== key);
      sharedTokens = result.tokens ?? sharedTokens;
      document.dispatchEvent(new CustomEvent("stck:restore-one", { detail: { ...current, removed: true } }));
      await refreshWalletAndArchive();
      await refreshDiscoveries();
      say("Défi archivé : +1 jeton pour votre duo.");
      return;
    }
    let query = client.from("placements").update({ challenge_status: wantedStatus })
      .eq("space_id", space.id)
      .eq("sticker_id", current.sticker_id)
      .eq("copy_owner", current.copy_owner)
      .eq("copy_no", current.copy_no)
      .eq("challenge_status", currentStatus);
    if (currentStatus === "accepted") query = query.eq("accepted_by", current.accepted_by);
    query = query.eq("copy_request_id", current.copy_request_id);
    const updated = await checked(query.select("sticker_id,zone,x,y,placed_by,copy_owner,copy_no,copy_request_id,challenge_status,accepted_by,completed_at,expires_at").maybeSingle());
    if (!updated) {
      await reloadBoard();
      throw Error("Ce défi vient d’évoluer sur l’autre téléphone. Regarde son nouveau statut.");
    }
    const changed = decoratePlacement(updated);
    boardRows = boardRows.map((row) => placementKey(row) === key ? changed : row);
    document.dispatchEvent(new CustomEvent("stck:restore-one", { detail: changed }));
    say(action === "accept" ? "Tu as choisi de relever ce défi." : action === "done" ? "Défi marqué comme réalisé ensemble." : "Tu as changé d’avis, le défi reste en attente.");
  } catch (error) {
    handleError(error);
  }
});
function pendingKey() {
  return "stck:pending:" + user.id + ":" + space.id;
}
function savePending() {
  try {
    localStorage.setItem(pendingKey(), JSON.stringify([...pending.values()]));
  } catch {
    say("Garde cette page ouverte jusqu’à la sauvegarde.");
  }
}
async function flush() {
  if (syncing || !user || !space || !pending.size) return;
  syncing = true;
  const uid = user.id,
    sid = space.id,
    version = identityVersion;
  say("Sauvegarde…");
  try {
    for (const row of [...pending.values()]) {
      if (user?.id !== uid || space?.id !== sid || version !== identityVersion)
        return;
      const target = (query) =>
        query
          .eq("space_id", sid)
          .eq("sticker_id", row.sticker_id)
          .eq("copy_owner", row.copy_owner)
          .eq("copy_no", row.copy_no);
      if (row.removed)
        await checked(target(client.from("placements").delete()));
      else if (row.copy_owner !== uid)
        await checked(
          target(
            client.from("placements").update({ zone: 0, x: row.x, y: row.y }),
          ),
        );
      else {
        const saved = await checked(
          client.from("placements").upsert({
            space_id: sid,
            sticker_id: row.sticker_id,
            copy_owner: uid,
            copy_no: row.copy_no,
            zone: 0,
            x: row.x,
            y: row.y,
          }).select("sticker_id,zone,x,y,placed_by,copy_owner,copy_no,copy_request_id,challenge_status,accepted_by,completed_at,expires_at").single(),
        );
        const decorated = decoratePlacement(saved);
        boardRows = boardRows.map((item) => placementKey(item) === placementKey(row) ? decorated : item);
        document.dispatchEvent(new CustomEvent("stck:restore-one", { detail: decorated }));
      }
      if (user?.id !== uid || space?.id !== sid || version !== identityVersion)
        return;
      if (pending.get(placementKey(row))?.version === row.version)
        pending.delete(placementKey(row));
      savePending();
    }
    say(pending.size ? "Sauvegarde en cours…" : "Collage sauvegardé");
  } catch (error) {
    say("Sauvegarde en attente. Elle reprendra avec le réseau.");
    throw error;
  } finally {
    syncing = false;
  }
  if (pending.size) await flush();
}
window.addEventListener("online", () => flush().catch(handleError));
window.addEventListener("beforeunload", (e) => {
  if (pending.size) {
    e.preventDefault();
    e.returnValue = "";
  }
});
setInterval(() => {
  if (pending.size) flush().catch(() => {});
  }, 30000);
function pushSupport() {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return "Sur iPhone, ajoute STCK à l’écran d’accueil avec le menu Partager de Safari, puis ouvre l’application.";
  if (Notification.permission === "denied")
    return "Les notifications sont bloquées dans les réglages de ce navigateur.";
  return "Les notifications restent discrètes et ne montrent pas le contenu de tes stickers.";
}
function base64Bytes(value) {
  const str = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(str, (c) => c.charCodeAt(0));
}
async function enablePush() {
  if (!client || !user) return;
  if (!("PushManager" in window)) throw Error(pushSupport());
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error("Les notifications n’ont pas été autorisées.");
  const registration = await navigator.serviceWorker.ready;
  const key = await checked(client.rpc("push_public_key"));
  if (!key) throw Error("Les notifications ne sont pas encore configurées.");
  let subscription = await registration.pushManager.getSubscription();
  let created = false;
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64Bytes(key),
    });
    created = true;
  }
  const data = subscription.toJSON();
  try {
    await checked(
      client.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
        },
        { onConflict: "endpoint" },
      ),
    );
  } catch (error) {
    if (created) await subscription.unsubscribe();
    throw error;
  }
  say(
    "Notifications activées sur cet appareil. Choisis tes rappels ci-dessous.",
  );
  await refreshAccount();
}
async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  if (sub && user) {
    await checked(
      client.from("push_subscriptions").delete().eq("endpoint", sub.endpoint),
    );
    await sub.unsubscribe();
  }
  say("Notifications désactivées sur cet appareil.");
}
$("#enable-push").onclick = () => enablePush().catch(handleError);
$("#disable-push").onclick = () =>
  disablePush().then(refreshAccount).catch(handleError);
$("#preferences-form").onsubmit = async (e) => {
  e.preventDefault();
  busy(e.target, true);
  try {
    const d = new FormData(e.target);
    await checked(
      client.from("notification_preferences").upsert({
        user_id: user.id,
        daily: d.has("daily"),
        news: d.has("news"),
        reminder_time: d.get("time"),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    );
    say("Préférences enregistrées.");
  } catch (error) {
    handleError(error);
  } finally {
    busy(e.target, false);
  }
};
async function refreshAccount() {
  if (!user) return;
  const uid = user.id,
    version = identityVersion;
  $(".account-state").textContent =
    user.user_metadata?.display_name || "Mon compte";
  $("#push-info").textContent = pushSupport();
  $("#timezone-label").textContent =
    "Heure locale : " + Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!space) return;
  const [preferences, notifications] = await Promise.all([
    checked(client.from("notification_preferences").select("*").maybeSingle()),
    checked(
      client
        .from("notifications")
        .select("id,title,body,created_at,read_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ),
  ]);
  if (user?.id !== uid || version !== identityVersion) return;
  const form = $("#preferences-form");
  if (preferences) {
    form.elements.daily.checked = preferences.daily;
    form.elements.news.checked = preferences.news;
    form.elements.time.value = preferences.reminder_time.slice(0, 5);
  }
  $("#inbox").replaceChildren();
  if (!notifications.length) {
    const li = document.createElement("li");
    li.textContent = "Les nouvelles apparaîtront ici.";
    $("#inbox").append(li);
  }
  for (const n of notifications) {
    const li = document.createElement("li"),
      title = document.createElement("strong"),
      body = document.createElement("p");
    title.textContent = n.title;
    body.textContent = n.body;
    li.append(title, body);
    $("#inbox").append(li);
  }
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    $("#disable-push").hidden = !sub;
    $("#enable-push").textContent = sub
      ? "Réactiver cet appareil"
      : "Activer sur cet appareil";
  }
}
async function init() {
  clearIdentity();
  if ("serviceWorker" in navigator && location.protocol !== "file:")
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() => say("L’installation de l’application est indisponible."));
  if (!client) {
    $("#login-form button").disabled = true;
    say("Aperçu local · connexion et notifications à configurer");
    restoreBoard(readLocal());
    return;
  }
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  user = data.session?.user || null;
  syncDailyPouchLink();
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      user = null;
      space = null;
      clearIdentity();
      pending.clear();
      clearInterval(poll);
      bridge.ready = false;
      restoreBoard([]);
      view("login");
      show();
    } else if (session?.user?.id !== user?.id) {
      clearIdentity();
      location.reload();
    }
  });
  if (!user && sessionStorage.getItem("stck:preview-mode") === "true") {
    startPreview();
    return;
  }
  if (!user) {
    view("login");
    show();
    restoreBoard([]);
    return;
  }
  sessionStorage.removeItem("stck:preview-mode");
  await loadSpace();
  if (space) {
    try {
      pending = new Map(
        JSON.parse(localStorage.getItem(pendingKey()) || "[]").map((row) => [
          placementKey(row),
          row,
        ]),
      );
      generation = Math.max(
        0,
        ...[...pending.values()].map((row) => row.version || 0),
      );
      const merged = new Map(boardRows.map((row) => [placementKey(row), row]));
      for (const row of pending.values()) {
        if (row.removed) merged.delete(placementKey(row));
        else merged.set(placementKey(row), row);
      }
      restoreBoard([...merged.values()]);
    } catch {
      pending = new Map();
    }
    await flush();
  }
}
if (document.readyState === "loading")
  document.addEventListener(
    "DOMContentLoaded",
    () => init().catch(handleError),
    { once: true },
  );
else init().catch(handleError);
