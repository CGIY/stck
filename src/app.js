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
const status = document.createElement("p");
status.className = "save-status";
status.setAttribute("role", "status");
document.body.append(status);
function say(text) {
  status.textContent = text;
  document
    .querySelector(".account-feedback")
    ?.replaceChildren(document.createTextNode(text));
}
const button = document.createElement("button");
button.className = "account-button";
button.type = "button";
button.textContent = "Mon espace";
(
  document.querySelector(".app-header") || document.querySelector(".topbar")
).append(button);
const dialog = document.createElement("dialog");
dialog.className = "account-dialog";
dialog.innerHTML = `<button class="dialog-close" aria-label="Fermer">×</button><h1>Ton espace STCK</h1>
<p class="account-state"></p><p class="account-feedback" role="status"></p><section data-view="login"><p>Retrouve tes collages et tes pochettes sur tes appareils.</p>
<form id="login-form"><label>Ton adresse e-mail<input name="email" type="email" autocomplete="email" required></label><button>Recevoir un lien de connexion</button></form>
<button id="demo" class="secondary">Explorer l’aperçu</button></section>
<section data-view="setup" hidden><p>Crée votre bibliothèque, puis invite la personne avec qui tu veux la partager.</p>
<form id="space-form"><label>À gauche<input name="left" maxlength="30" value="Moi" required></label><label>À droite<input name="right" maxlength="30" value="Toi" required></label><button>Créer notre espace</button></form>
<form id="join-form"><label>Code d’invitation<input name="code" autocomplete="off" required></label><button class="secondary">Rejoindre un espace</button></form></section>
<section data-view="account" hidden><p id="space-description"></p><button id="invite" class="secondary">Créer une invitation</button><p id="invite-code"></p>
<h2>Notifications</h2><p id="push-info"></p><button id="enable-push">Activer sur cet appareil</button><button id="disable-push" class="secondary">Désactiver sur cet appareil</button>
<form id="preferences-form"><label class="check"><input name="daily" type="checkbox">Rappel quotidien</label><label>À quelle heure ?<input name="time" type="time" value="18:30" required></label><label class="check"><input name="news" type="checkbox">Les nouveautés STCK</label><p id="timezone-label"></p><button>Enregistrer mes préférences</button></form>
<h2>Dernières nouvelles</h2><ul id="inbox"></ul><button id="logout" class="secondary">Se déconnecter</button></section>`;
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
    const email = new FormData(e.target).get("email");
    await checked(
      client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: new URL("index.html", location.href).href },
      }),
    );
    say("Lien envoyé. Ouvre-le sur cet appareil pour te connecter.");
  } catch (error) {
    handleError(error);
  } finally {
    busy(e.target, false);
  }
};
$("#demo").onclick = () => {
  dialog.close();
  say("Aperçu : tes changements restent sur cet appareil.");
};
$("#space-form").onsubmit = async (e) => {
  e.preventDefault();
  busy(e.target, true);
  try {
    const d = new FormData(e.target);
    await checked(
      client.rpc("create_space", {
        p_left: d.get("left"),
        p_right: d.get("right"),
      }),
    );
    await loadSpace();
    dialog.close();
  } catch (error) {
    handleError(error);
  } finally {
    busy(e.target, false);
  }
};
$("#join-form").onsubmit = async (e) => {
  e.preventDefault();
  busy(e.target, true);
  try {
    await checked(
      client.rpc("join_space", {
        p_token: new FormData(e.target).get("code").trim(),
      }),
    );
    await loadSpace();
    dialog.close();
  } catch (error) {
    handleError(error);
  } finally {
    busy(e.target, false);
  }
};
$("#invite").onclick = async () => {
  try {
    const token = await checked(client.rpc("invite_partner"));
    $("#invite-code").textContent = "Code valable 48 h : " + token;
    try {
      await navigator.clipboard.writeText(token);
      say("Code copié. Partage-le avec la personne à inviter.");
    } catch {
      say("Copie le code pour inviter ton partenaire.");
    }
  } catch (error) {
    handleError(error);
  }
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
const bridge = {
  catalog,
  ready: false,
  requestDraw: async () => {
    if (!client)
      return catalog[
        crypto.getRandomValues(new Uint32Array(1))[0] % catalog.length
      ];
    if (!user || !space) {
      show();
      throw Error(
        "Connecte-toi et choisis un espace pour conserver tes pochettes.",
      );
    }
    const key = "stck:pending-draw:" + user.id;
    let request = sessionStorage.getItem(key);
    if (!request) {
      request = crypto.randomUUID();
      sessionStorage.setItem(key, request);
    }
    const id = await checked(client.rpc("open_pouch", { p_request: request }));
    const item = catalog.find((x) => x.id === id);
    if (!item) throw Error("Sticker inconnu. Recharge l’application.");
    return item;
  },
  drawRevealed: () => {
    if (!client) {
      say(
        "Sticker aperçu · connecte-toi après la mise en ligne pour le conserver.",
      );
      return;
    }
    if (user) sessionStorage.removeItem("stck:pending-draw:" + user.id);
    say("Sticker conservé dans tes découvertes.");
    refreshDiscoveries().catch(handleError);
  },
};
window.STCK = bridge;
function restoreBoard(rows) {
  document.dispatchEvent(new CustomEvent("stck:restore", { detail: rows }));
}
async function loadSpace() {
  const uid = user.id;
  const data = await checked(
    client
      .from("spaces")
      .select("id,owner_id,partner_id,left_label,right_label")
      .maybeSingle(),
  );
  if (user?.id !== uid) return;
  space = data;
  if (!space) {
    view("setup");
    show();
    return;
  }
  view("account");
  bridge.ready = true;
  const zones = document.querySelectorAll(".drop-half");
  [space.left_label, space.right_label].forEach((label, i) => {
    if (zones[i]) {
      zones[i].querySelector("strong").textContent = label;
      zones[i].setAttribute("aria-label", "Zone de collage de " + label);
    }
  });
  restoreBoard(
    await checked(
      client
        .from("placements")
        .select("sticker_id,zone,x,y")
        .eq("space_id", space.id),
    ),
  );
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
  }, 15000);
  say("Espace synchronisé");
}
async function reloadBoard() {
  if (!space || !user) return;
  const sid = space.id;
  const rows = await checked(
    client.from("placements").select("sticker_id,zone,x,y").eq("space_id", sid),
  );
  if (space?.id === sid && !pending.size && !syncing) restoreBoard(rows);
}
async function refreshDiscoveries() {
  if (!user) return;
  const draws = await checked(
    client
      .from("pouch_draws")
      .select("sticker_id")
      .order("created_at", { ascending: false })
      .limit(2000),
  );
  const owned = new Set(draws.map((x) => x.sticker_id));
  document.querySelectorAll(".peel-sticker").forEach((el) => {
    el.dataset.discovered = String(owned.has(el.dataset.stickerId));
  });
  $("#space-description").textContent =
    `${owned.size} / 32 stickers découverts · ${space?.partner_id ? "Bibliothèque à deux" : "Ton espace est prêt à être partagé"}`;
}
document.addEventListener("stck:placement", (event) => {
  const row = event.detail;
  if (!user || !space) {
    const rows = readLocal().filter((x) => x.sticker_id !== row.sticker_id);
    if (!row.removed) rows.push(row);
    cache(rows);
    say("Collage conservé sur cet appareil");
    return;
  }
  pending.set(row.sticker_id, { ...row, version: ++generation });
  savePending();
  flush().catch(handleError);
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
  say("Sauvegarde…");
  try {
    for (const row of [...pending.values()]) {
      if (row.removed)
        await checked(
          client
            .from("placements")
            .delete()
            .eq("space_id", space.id)
            .eq("sticker_id", row.sticker_id),
        );
      else
        await checked(
          client
            .from("placements")
            .upsert({
              space_id: space.id,
              sticker_id: row.sticker_id,
              zone: row.zone,
              x: row.x,
              y: row.y,
            }),
        );
      if (pending.get(row.sticker_id)?.version === row.version)
        pending.delete(row.sticker_id);
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
}, 15000);
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
      client
        .from("push_subscriptions")
        .upsert(
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
      client
        .from("notification_preferences")
        .upsert({
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
  $(".account-state").textContent = user.email;
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
  const form = $("#preferences-form");
  if (preferences) {
    form.elements.daily.checked = preferences.daily;
    form.elements.news.checked = preferences.news;
    form.elements.time.value = preferences.reminder_time.slice(0, 5);
  }
  $("#invite").hidden = space.owner_id !== user.id || !!space.partner_id;
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
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      user = null;
      space = null;
      pending.clear();
      clearInterval(poll);
      bridge.ready = false;
      restoreBoard([]);
      view("login");
      show();
    } else if (session?.user?.id !== user?.id) {
      location.reload();
    }
  });
  if (!user) {
    view("login");
    show();
    restoreBoard(readLocal());
    return;
  }
  await loadSpace();
  if (space) {
    try {
      pending = new Map(
        JSON.parse(localStorage.getItem(pendingKey()) || "[]").map((row) => [
          row.sticker_id,
          row,
        ]),
      );
      generation = Math.max(
        0,
        ...[...pending.values()].map((row) => row.version || 0),
      );
      for (const row of pending.values())
        document.dispatchEvent(
          new CustomEvent("stck:restore-one", { detail: row }),
        );
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
