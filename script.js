/* =====================================================================
   SANA SHOP — Script du site
   ---------------------------------------------------------------------
   👉 Pour changer le PRIX, le TÉLÉPHONE, le DÉLAI DE LIVRAISON, etc. :
      modifiez seulement l'objet CONFIG juste en dessous.
      Tout le site se met à jour automatiquement.
   ===================================================================== */

const CONFIG = {
  nomProduit: 'Sana Mix 380 ml',
  prix: 9500,                // prix de vente en FCFA (ce que paie le client)
  prixAvant: 12500,          // ancien prix, affiché barré (0 = pas de promo) : la remise en % se calcule seule
  fraisLivraison: 0,         // frais de livraison ajoutés au total (0 = livraison comprise dans le prix)
  devise: 'FCFA',
  telephone: '+223 77 48 13 20', // numéro affiché sur tout le site
  whatsapp: '22377481320',   // numéro WhatsApp, chiffres seulement ('' = caché)
  tiktok: '',                // lien complet du compte TikTok ('' = caché)
  facebook: 'https://www.facebook.com/profile.php?id=61596615803735', // lien complet de la page Facebook ('' = caché)
  email: '',                 // adresse e-mail ('' = cachée)
  afficherAvis: false,       // true = montrer la section « avis clients »
  afficherGrossiste: false,  // true = montrer la section « vente en gros »
  delaiLivraisonJours: 0,    // 0 = livraison le jour même à Bamako, 1 = le lendemain…
  heureLimite: 18,           // commande passée après cette heure : livraison le lendemain
  livraisonLeDimanche: false,
  // Lien de votre Google Sheets (Apps Script) — voir docs/google-sheets.md
  urlGoogleSheets: 'https://script.google.com/macros/s/AKfycby0gJxM8paRmvZkfY5L-q-MY_0h8BX25BCkqjZbHsXOIQhz7NKY7wA-Qam7vJGmz8QYkQ/exec',
  // Pixels publicitaires : collez le numéro (ID) donné par Meta et par TikTok ('' = désactivé)
  metaPixel: '1667162188451715', // Pixel Meta (jeu de données « Sana Shop »)
  tiktokPixel: '',
};

(function () {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  // Sur votre ordinateur (mode test), on affiche des repères d'aide.
  const isLocal = location.protocol === 'file:' ||
    ['localhost', '127.0.0.1', ''].includes(location.hostname);
  if (isLocal) root.classList.add('dev');

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const money = (n) => n.toLocaleString('fr-FR').replace(/[  \s]/g, ' ') + ' ' + CONFIG.devise;
  const telHref = (t) => 'tel:' + t.replace(/[^\d+]/g, '');

  /* ---------- 1. Prix, remise, téléphone, dates ---------- */
  const remise = CONFIG.prixAvant > CONFIG.prix
    ? Math.round((1 - CONFIG.prix / CONFIG.prixAvant) * 100) : 0;

  $$('[data-prix]').forEach((el) => { el.textContent = money(CONFIG.prix); });
  $$('[data-prix-avant]').forEach((el) => {
    if (remise) el.textContent = money(CONFIG.prixAvant); else el.hidden = true;
  });
  $$('[data-remise]').forEach((el) => {
    if (remise) el.textContent = '-' + remise + '\u00a0%'; else el.hidden = true;
  });
  $$('[data-tel]').forEach((el) => {
    el.textContent = CONFIG.telephone;
    if (el.tagName === 'A') el.href = telHref(CONFIG.telephone);
  });
  $$('[data-tel-link]').forEach((a) => { a.href = telHref(CONFIG.telephone); });
  /* Liens de contact : un lien vide dans CONFIG est caché automatiquement */
  const liens = {
    whatsapp: CONFIG.whatsapp && 'https://wa.me/' + CONFIG.whatsapp,
    tiktok: CONFIG.tiktok,
    facebook: CONFIG.facebook,
    email: CONFIG.email && 'mailto:' + CONFIG.email,
    suivre: CONFIG.tiktok || CONFIG.facebook,
  };
  $$('[data-lien]').forEach((a) => {
    const url = liens[a.dataset.lien];
    if (url) a.href = url; else a.style.display = 'none';
  });

  /* Sections à montrer ou cacher depuis CONFIG */
  const blocs = {
    avis: CONFIG.afficherAvis,
    gros: CONFIG.afficherGrossiste,
    reseaux: Boolean(CONFIG.tiktok || CONFIG.facebook),
  };
  $$('[data-bloc]').forEach((el) => {
    if (!blocs[el.dataset.bloc]) el.style.display = 'none';
  });

  $$('[data-annee]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Livraison : le jour même, ou le lendemain si la commande arrive après l'heure limite
  function texteLivraison(maintenant) {
    const d = new Date(maintenant);
    if (d.getHours() >= CONFIG.heureLimite) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + CONFIG.delaiLivraisonJours);
    if (!CONFIG.livraisonLeDimanche && d.getDay() === 0) d.setDate(d.getDate() + 1);
    const jour = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const ecart = Math.round((jour(d) - jour(maintenant)) / 86400000);
    if (ecart === 0) return 'aujourd\'hui';
    if (ecart === 1) return 'demain';
    return 'le ' + new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  }
  $$('[data-livraison]').forEach((el) => { el.textContent = texteLivraison(new Date()); });
  $$('[data-heure-limite]').forEach((el) => { el.textContent = CONFIG.heureLimite + ' h'; });

  /* ---------- 1b. D'où vient le visiteur (publicité TikTok, Facebook…) ---------- */
  // Les liens des publicités portent ?utm_source=tiktok ou ?utm_source=facebook.
  // La provenance est gardée 7 jours dans le navigateur, puis envoyée avec la commande.
  const NOMS_SOURCES = {
    tiktok: 'TikTok', facebook: 'Facebook', fb: 'Facebook', instagram: 'Instagram', ig: 'Instagram',
    messenger: 'Messenger', msg: 'Messenger', whatsapp: 'WhatsApp',
  };
  function sourceDepuisUrl(search, referrer) {
    const q = new URLSearchParams(search);
    const utm = (q.get('utm_source') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    if (utm) return NOMS_SOURCES[utm] || utm.charAt(0).toUpperCase() + utm.slice(1);
    if (q.has('ttclid')) return 'TikTok';
    if (q.has('fbclid')) return 'Facebook';
    const ref = referrer || '';
    if (/tiktok\./i.test(ref)) return 'TikTok';
    if (/instagram\./i.test(ref)) return 'Instagram';
    if (/facebook\.|\bfb\.(com|me)/i.test(ref)) return 'Facebook';
    return '';
  }
  const CLE_SOURCE = 'sana-source';
  const SEPT_JOURS = 7 * 24 * 3600 * 1000;
  const sourceArrivee = sourceDepuisUrl(location.search, document.referrer);
  if (sourceArrivee) {
    try { localStorage.setItem(CLE_SOURCE, JSON.stringify({ s: sourceArrivee, t: Date.now() })); } catch (err) { /* stockage indisponible */ }
  }
  function sourceVisite() {
    if (sourceArrivee) return sourceArrivee;
    try {
      const v = JSON.parse(localStorage.getItem(CLE_SOURCE) || 'null');
      if (v && v.s && Date.now() - v.t < SEPT_JOURS) return v.s;
    } catch (err) { /* stockage indisponible */ }
    return 'Direct';
  }

  /* ---------- 1c. Pixels publicitaires (Meta et TikTok) ---------- */
  // Actifs seulement si leur numéro est rempli dans CONFIG, et jamais sur votre PC
  // (sauf avec ?testpixel dans l'adresse, pour les essais).
  const pixelsAutorises = !isLocal || /[?&]testpixel\b/.test(location.search);
  const avecMeta = Boolean(CONFIG.metaPixel) && pixelsAutorises;
  const avecTiktok = Boolean(CONFIG.tiktokPixel) && pixelsAutorises;
  if (avecMeta) {
    /* Code officiel du pixel Meta */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CONFIG.metaPixel);
    window.fbq('track', 'PageView');
  }
  if (avecTiktok) {
    /* Code officiel du pixel TikTok */
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
      ttq.setAndDefer = function (o, m) { o[m] = function () { o.push([m].concat(Array.prototype.slice.call(arguments, 0))); }; };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id) { for (var e = ttq._i[id] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; };
      ttq.load = function (id, opts) {
        var u = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = u; ttq._t = ttq._t || {}; ttq._t[id] = +new Date; ttq._o = ttq._o || {}; ttq._o[id] = opts || {};
        var s = d.createElement('script'); s.type = 'text/javascript'; s.async = !0; s.src = u + '?sdkid=' + id + '&lib=' + t;
        var f = d.getElementsByTagName('script')[0]; f.parentNode.insertBefore(s, f);
      };
    }(window, document, 'ttq');
    window.ttq.load(CONFIG.tiktokPixel);
    window.ttq.page();
  }
  const donneesPixel = (quantite, valeur) => ({
    meta: { content_name: CONFIG.nomProduit, content_type: 'product', content_ids: ['sana-mix-380'], num_items: quantite, value: valeur, currency: 'XOF' },
    tiktok: { content_id: 'sana-mix-380', content_type: 'product', content_name: CONFIG.nomProduit, quantity: quantite, price: CONFIG.prix, value: valeur, currency: 'XOF' },
  });
  function suivre(evenementMeta, evenementsTiktok, d) {
    if (avecMeta && window.fbq) window.fbq('track', evenementMeta, d.meta);
    if (avecTiktok && window.ttq) evenementsTiktok.forEach((ev) => window.ttq.track(ev, d.tiktok));
  }
  if (/produit\.html$/.test(location.pathname)) suivre('ViewContent', ['ViewContent'], donneesPixel(1, CONFIG.prix));

  // Pour les essais sur votre PC uniquement
  if (isLocal) window.__sanaTest = { texteLivraison, sourceDepuisUrl, sourceVisite };

  /* ---------- 2. Bandeaux qui défilent ---------- */
  $$('.marquee').forEach((m) => {
    const track = $('.marquee__track', m);
    if (!track) return;
    const original = Array.from(track.children);
    const cloneSet = () => original.forEach((item) => {
      const c = item.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
    // Assez d'éléments pour remplir l'écran, puis une copie pour une boucle sans saut.
    let guard = 0;
    while (track.scrollWidth < m.clientWidth && guard++ < 8) cloneSet();
    Array.from(track.children).forEach((item) => {
      const c = item.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
    const half = track.scrollWidth / 2;
    track.style.setProperty('--marquee-speed', Math.max(12, half / 45) + 's');
  });

  /* ---------- 3. Menu du téléphone ---------- */
  const drawer = $('#drawer');
  if (drawer) {
    const openers = $$('[data-menu-open]');
    const setOpen = (open) => {
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      openers.forEach((b) => b.setAttribute('aria-expanded', String(open)));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) $('[data-menu-close].icon-btn', drawer)?.focus();
    };
    openers.forEach((b) => b.addEventListener('click', () => setOpen(true)));
    $$('[data-menu-close]', drawer).forEach((b) => b.addEventListener('click', () => setOpen(false)));
    $$('a', drawer).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) setOpen(false);
    });
  }

  /* ---------- 4. Choix de la couleur (synchronisé partout) ---------- */
  // Les photos des couleurs sont chargées une seule fois, puis le changement est immédiat.
  const imgCache = {};
  const preload = (src) => imgCache[src] || (imgCache[src] = new Promise((ok) => {
    const im = new Image();
    im.onload = im.onerror = () => ok();
    im.src = src;
  }));
  const onProductPage = /produit\.html$/.test(location.pathname);
  let currentColor = null;
  function setColor(name, instant) {
    const swatch = $$('[data-color]').find((s) => s.dataset.color === name);
    if (!swatch) return;
    currentColor = name;
    $$('[data-color]').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.color === name)));
    $$('[data-color-label]').forEach((el) => { el.textContent = name; });
    $$('[data-color-select]').forEach((sel) => { if (sel.value !== name) sel.value = name; });
    // Page d'accueil : les liens vers la page d'achat gardent la couleur choisie
    if (!onProductPage) {
      $$('a[href^="produit.html"]').forEach((a) => {
        const [path, hash] = a.getAttribute('href').split('#');
        a.setAttribute('href', path.split('?')[0] + '?couleur=' + encodeURIComponent(name) + (hash ? '#' + hash : ''));
      });
    }
    const src = swatch.dataset.img;
    // L'ancienne photo reste affichée tant que la nouvelle n'est pas prête
    preload(src).then(() => {
      if (currentColor !== name) return;
      $$('[data-color-img]').forEach((img) => {
        if (img.getAttribute('src') === src) return;
        if (instant) { img.src = src; return; }
        img.classList.add('is-swapping');
        setTimeout(() => { img.src = src; img.classList.remove('is-swapping'); }, 160);
      });
    });
  }
  $$('[data-color]').forEach((s) => s.addEventListener('click', () => setColor(s.dataset.color)));
  $$('[data-color-select]').forEach((sel) => sel.addEventListener('change', () => setColor(sel.value)));
  // Couleur choisie sur la page d'accueil (lien « produit.html?couleur=Rose »)
  const couleurDemandee = new URLSearchParams(location.search).get('couleur');
  if (couleurDemandee) setColor(couleurDemandee, true);
  // Après l'affichage de la page, les autres couleurs se chargent en arrière-plan
  window.addEventListener('load', () => setTimeout(() => {
    $$('[data-color]').forEach((s) => { if (s.dataset.img) preload(s.dataset.img); });
  }, 1500));

  /* ---------- 5. Galerie de photos (page produit) ---------- */
  $$('[data-gallery]').forEach((g) => {
    const track = $('.gallery__track', g);
    const slides = $$('.gallery__slide', g);
    const thumbs = $$('[data-thumb]', g);
    if (!track || !slides.length) return;
    let current = 0;
    const go = (i) => {
      const n = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[n].offsetLeft, behavior: 'smooth' });
    };
    const sync = () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i === current) return;
      current = i;
      thumbs.forEach((t, k) => t.classList.toggle('is-active', k === i));
      thumbs[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
    $('[data-prev]', g)?.addEventListener('click', () => go(current - 1));
    $('[data-next]', g)?.addEventListener('click', () => go(current + 1));
    thumbs.forEach((t, k) => t.addEventListener('click', () => go(k)));
    // Quand on change de couleur, on revient sur la 1re photo
    $$('[data-color], [data-color-select]').forEach((el) => {
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'click', () => go(0));
    });
  });

  /* ---------- 6. Avis clients (un à la fois) ---------- */
  $$('[data-quotes]').forEach((box) => {
    const items = $$('.quote', box);
    const dotsBox = box.parentElement && $('[data-dots]', box.parentElement);
    if (items.length < 2) return;
    let i = 0;
    let timer = 0;
    const dots = items.map((_, k) => {
      if (!dotsBox) return null;
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'dot' + (k === 0 ? ' is-active' : '');
      d.setAttribute('aria-label', 'Avis ' + (k + 1));
      d.addEventListener('click', () => { show(k); restart(); });
      dotsBox.appendChild(d);
      return d;
    });
    function show(n) {
      i = (n + items.length) % items.length;
      items.forEach((q, k) => q.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d && d.classList.toggle('is-active', k === i));
    }
    const restart = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), 6000); };
    $('[data-prev]', box)?.addEventListener('click', () => { show(i - 1); restart(); });
    $('[data-next]', box)?.addEventListener('click', () => { show(i + 1); restart(); });
    box.addEventListener('mouseenter', () => clearInterval(timer));
    box.addEventListener('mouseleave', restart);
    restart();
  });

  /* ---------- 7. Apparition douce + vidéos qui jouent seulement à l'écran ---------- */
  const hasIO = 'IntersectionObserver' in window;
  const reveals = $$('.reveal');
  const captureMode = /[?&]capture\b/.test(location.search); // pour les captures d'écran de test
  if (captureMode) {
    root.classList.remove('js');
    reveals.forEach((el) => el.classList.add('is-visible'));
  } else if (hasIO) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  $$('video[data-slot]').forEach((v) => {
    const holder = v.parentElement;
    const missing = () => holder.classList.add('media-missing');
    v.addEventListener('error', missing);
    if (v.error || v.networkState === 3) missing();
    v.muted = true;
    if (v.hasAttribute('autoplay')) return; // la vidéo d'accueil joue tout de suite
    if (!hasIO) { v.play().catch(() => {}); return; }
    // Les autres vidéos ne se chargent que quand on les voit (économise internet)
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    }, { threshold: 0.25 }).observe(v);
  });

  /* ---------- 8. Bouton flottant + barre d'achat en haut ---------- */
  const floatBtn = $('.float-cta');
  const stickyBar = $('.sticky-buy');
  const trigger = $('[data-cta-trigger]');
  const orderSection = $('#commande');
  let pastTrigger = false;
  let orderInView = false;
  const refreshCta = () => {
    const show = pastTrigger && !orderInView;
    floatBtn?.classList.toggle('is-visible', show);
    stickyBar?.classList.toggle('is-visible', show);
  };
  if (hasIO && trigger) {
    new IntersectionObserver(([e]) => {
      pastTrigger = !e.isIntersecting && e.boundingClientRect.top < 0;
      refreshCta();
    }).observe(trigger);
  }
  if (hasIO && orderSection) {
    new IntersectionObserver(([e]) => { orderInView = e.isIntersecting; refreshCta(); }, { threshold: 0.05 }).observe(orderSection);
  }

  /* ---------- 9. Formulaire de commande ---------- */
  const form = $('#order-form');
  if (!form) return;

  const qtyInput = form.elements.quantite;
  const totalEl = $('[data-total]');
  const fraisNote = $('[data-frais-note]');
  const errorBox = $('.form-error', form);
  const submitBtn = $('[type="submit"]', form);
  const submitLabel = submitBtn.textContent;

  const getQty = () => {
    let q = parseInt(qtyInput.value, 10);
    if (!Number.isFinite(q) || q < 1) q = 1;
    if (q > 20) q = 20;
    return q;
  };
  const total = () => getQty() * CONFIG.prix + (CONFIG.fraisLivraison || 0);
  const updateTotal = () => {
    qtyInput.value = getQty();
    if (totalEl) totalEl.textContent = money(total());
    if (fraisNote && CONFIG.fraisLivraison > 0) {
      fraisNote.hidden = false;
      fraisNote.textContent = 'dont livraison : ' + money(CONFIG.fraisLivraison);
    }
  };
  $$('[data-qty]', form).forEach((b) => b.addEventListener('click', () => {
    qtyInput.value = getQty() + Number(b.dataset.qty);
    updateTotal();
  }));
  qtyInput.addEventListener('change', updateTotal);
  updateTotal();
  // Premier clic dans le formulaire : « début de commande » pour les pixels
  form.addEventListener('focusin', () => suivre('InitiateCheckout', ['InitiateCheckout'], donneesPixel(1, CONFIG.prix)), { once: true });

  // Numéro malien : 8 chiffres (on accepte aussi +223 / 00223 devant)
  const cleanPhone = (v) => v.replace(/\D/g, '').replace(/^(00223|223)/, '');
  const rules = {
    nom: (v) => v.trim().length >= 2 || 'Merci d\'indiquer votre nom.',
    telephone: (v) => cleanPhone(v).length === 8 || 'Numéro à 8 chiffres, par exemple 70 00 00 00.',
    adresse: (v) => v.trim().length >= 3 || 'Merci d\'indiquer votre quartier ou votre adresse.',
  };
  const check = (name) => {
    const input = form.elements[name];
    const res = rules[name](input.value);
    const field = input.closest('.field');
    const ok = res === true;
    field.classList.toggle('has-error', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    $('.field__error', field).textContent = ok ? '' : res;
    return ok;
  };
  Object.keys(rules).forEach((name) => {
    const input = form.elements[name];
    input.addEventListener('blur', () => { if (input.value) check(name); });
    input.addEventListener('input', () => {
      if (input.closest('.field').classList.contains('has-error')) check(name);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('is-visible');
    const results = Object.keys(rules).map(check);
    if (results.includes(false)) {
      $('.has-error input, .has-error textarea', form)?.focus();
      return;
    }

    const q = getQty();
    const tel = cleanPhone(form.elements.telephone.value);
    const commande = {
      date: new Date().toLocaleString('fr-FR'),
      produit: CONFIG.nomProduit,
      nom: form.elements.nom.value.trim(),
      telephone: '+223 ' + tel.replace(/(\d{2})(?=\d)/g, '$1 ').trim(),
      adresse: form.elements.adresse.value.trim(),
      couleur: form.elements.couleur.value,
      quantite: q,
      total: total(),
      message: form.elements.message.value.trim(),
      page: location.pathname.split('/').pop() || 'index.html',
      source: sourceVisite(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    if (CONFIG.urlGoogleSheets) {
      try {
        await fetch(CONFIG.urlGoogleSheets, {
          method: 'POST',
          mode: 'no-cors',
          body: new URLSearchParams(commande),
        });
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
        errorBox.textContent = 'Problème de connexion : la commande n\'est pas partie. Vérifiez votre connexion internet et réessayez, ou appelez-nous au ' + CONFIG.telephone + '.';
        errorBox.classList.add('is-visible');
        return;
      }
      suivre('Purchase', ['PlaceAnOrder', 'CompletePayment'], donneesPixel(q, commande.total));
    } else {
      console.warn('[Sana Shop] Mode test : CONFIG.urlGoogleSheets est vide, la commande n\'est envoyée nulle part.', commande);
    }

    const success = $('#order-success');
    $('[data-success-name]', success).textContent = commande.nom.split(' ')[0];
    $('[data-success-tel]', success).textContent = commande.telephone;
    $('.test-notice', success).hidden = Boolean(CONFIG.urlGoogleSheets);
    form.hidden = true;
    success.hidden = false;
    success.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();
