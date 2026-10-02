/* ==========================================================================
   MedXplore — site behaviour

   Each feature is its own function, started independently. A missing element
   or an unexpected error in one feature can no longer take down the rest of
   the page, which is what happened when this was a single top-to-bottom IIFE.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------------
     CONFIG — where the signup form sends its submissions.

     Leave this empty and the form falls back to opening a pre-filled email,
     so it still works. To collect submissions properly, create a form at
     formspree.io (or getform.io, or Netlify Forms) and paste its endpoint
     URL here. Nothing else needs to change.
     -------------------------------------------------------------------- */
  var FORM_ENDPOINT = '';
  var CONTACT_EMAIL = 'medxplore.mh@gmail.com';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Run a feature in isolation: if it throws, the others still start. */
  function start(name, fn) {
    try {
      fn();
    } catch (err) {
      if (window.console && console.warn) console.warn('[medxplore] ' + name + ' failed:', err);
    }
  }

  /* --------------------------------------------------------------- theme */
  start('theme toggle', function () {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var root = document.documentElement;
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function isDark() {
      var set = root.getAttribute('data-theme');
      return set ? set === 'dark' : systemDark.matches;
    }
    function label() {
      btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
    }
    label();

    /* the logo's <picture> source only sees the OS setting — point it at the choice */
    function syncLogos(theme) {
      document.querySelectorAll('source[data-theme-source]').forEach(function (s) {
        s.media = theme === 'dark' ? 'all' : theme === 'light' ? 'not all' : '(prefers-color-scheme: dark)';
      });
    }

    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      syncLogos(next);
      try { localStorage.setItem('medxplore-theme', next); }
      catch { /* storage blocked (private browsing): the choice lasts this visit only */ }
      label();
    });

    /* if they never chose explicitly, follow the OS when it changes */
    var onSystem = function () { if (!root.getAttribute('data-theme')) label(); };
    if (systemDark.addEventListener) systemDark.addEventListener('change', onSystem);
    else if (systemDark.addListener) systemDark.addListener(onSystem);
  });

  /* -------------------------------------------------------- announcement */
  start('announcement expiry', function () {
    var bar = document.getElementById('announce');
    if (!bar || bar.hidden) return;
    var until = bar.getAttribute('data-until');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until || '')) return;
    /* visible through the whole of that day, in the visitor's own timezone */
    var end = new Date(until + 'T23:59:59');
    if (Date.now() > end.getTime()) bar.hidden = true;
  });

  /* ---------------------------------------------------------------- year */
  start('year', function () {
    var yr = document.getElementById('year');
    if (yr) yr.textContent = new Date().getFullYear();
  });

  /* -------------------------------------------------------------- header */
  start('sticky header', function () {
    var header = document.getElementById('siteHeader');
    if (!header) return;
    var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  });

  /* --------------------------------------------------------- mobile menu */
  start('mobile menu', function () {
    var toggle = document.getElementById('navToggle');
    var menu = document.getElementById('navMenu');
    if (!toggle || !menu) return;

    var close = function () {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    };
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { close(); toggle.focus(); }
    });
  });

  /* ----------------------------------------------------------- scrollspy */
  start('scroll-spy', function () {
    if (!('IntersectionObserver' in window)) return;
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);
    if (!sections.length) return;

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (sec) { spy.observe(sec); });
  });

  /* -------------------------------------------------------------- reveal */
  start('reveal on scroll', function () {
    var targets = document.querySelectorAll(
      '.section-head, .card, .session, .quote, .gap-list, .path, .strip__item, .cta__inner'
    );
    if (!targets.length) return;

    if (reduce || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-in'); });
      return;
    }
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('reveal'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en, i) {
        if (!en.isIntersecting) return;
        var el = en.target;
        setTimeout(function () { el.classList.add('is-in'); }, Math.min(i * 70, 280));
        io.unobserve(el);
      });
      /* a percentage rootMargin scales with the viewport and can leave a tall-viewport
         element permanently below the trigger line — px keeps it predictable */
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0 });
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });

    /* safety net: never leave content invisible if the observer misses an element */
    var sweep = function () {
      Array.prototype.forEach.call(document.querySelectorAll('.reveal:not(.is-in)'), function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
      });
    };
    window.addEventListener('load', function () { setTimeout(sweep, 120); });
    setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll('.reveal:not(.is-in)'), function (el) {
        el.classList.add('is-in');
      });
    }, 6000);
  });

  /* ------------------------------------------------------------ lightbox */
  start('lightbox', function () {
    var shots = Array.prototype.slice.call(document.querySelectorAll('.shot'));
    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lbImg');
    var lbCap = document.getElementById('lbCap');
    var lbClose = document.getElementById('lbClose');
    var lbPrev = document.getElementById('lbPrev');
    var lbNext = document.getElementById('lbNext');
    if (!shots.length || !lb || !lbImg || !lbCap || !lbClose || !lbPrev || !lbNext) return;

    var slides = shots.map(function (btn) {
      var img = btn.querySelector('img');
      var cap = btn.querySelector('.shot__cap');
      return {
        src: img ? img.getAttribute('src') : '',
        alt: img ? img.getAttribute('alt') : '',
        cap: cap ? cap.textContent.trim() : ''
      };
    }).filter(function (s) { return s.src; });
    if (!slides.length) return;

    var index = 0, lastFocus = null;

    function show(i) {
      index = (i + slides.length) % slides.length;
      var s = slides[index];
      lbImg.src = s.src;
      lbImg.alt = s.alt;
      lbCap.textContent = s.cap + '  (' + (index + 1) + ' of ' + slides.length + ')';
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      lb.classList.add('is-open');
      document.body.classList.add('lb-open');
      lbClose.focus();
    }
    function close() {
      lb.classList.remove('is-open');
      document.body.classList.remove('lb-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    shots.forEach(function (btn, i) { btn.addEventListener('click', function () { open(i); }); });
    lbClose.addEventListener('click', close);
    lbPrev.addEventListener('click', function () { show(index - 1); });
    lbNext.addEventListener('click', function () { show(index + 1); });
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb__fig')) close();
    });

    window.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
      else if (e.key === 'Tab') {
        var focusables = [lbClose, lbPrev, lbNext];
        var pos = focusables.indexOf(document.activeElement);
        e.preventDefault();
        var next = e.shiftKey ? pos - 1 : pos + 1;
        focusables[(next + focusables.length) % focusables.length].focus();
      }
    });

    var touchX = null;
    lb.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 45) show(dx > 0 ? index - 1 : index + 1);
      touchX = null;
    }, { passive: true });
  });

  /* --------------------------------------------------------- back to top */
  start('back to top', function () {
    var toTop = document.getElementById('toTop');
    if (!toTop) return;
    var showAt = function () {
      toTop.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.9);
    };
    showAt();
    window.addEventListener('scroll', showAt, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      var brand = document.querySelector('.brand');
      if (brand && brand.focus) brand.focus({ preventScroll: true });
    });
  });

  /* ----------------------------------------------------- speed insights */
  /* Vercel Speed Insights, the plain-HTML way (the npm package is for bundled
     apps; this site has no build step). Vercel serves the script itself, but
     only on its own hosting, so it is skipped everywhere else — local preview,
     the one-file copy opened from disk — rather than logging a failed request.
     Nothing is sent until Speed Insights is switched on in the Vercel dashboard. */
  start('speed insights', function () {
    var host = location.hostname;
    if (!/^https?:$/.test(location.protocol)) return;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /\.localhost$/.test(host)) return;
    window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    var s = document.createElement('script');
    s.defer = true;
    s.src = '/_vercel/speed-insights/script.js';
    document.head.appendChild(s);
  });

  /* --------------------------------------------------------- signup form */
  start('signup form', function () {
    var form = document.getElementById('signupForm');
    var status = document.getElementById('signupStatus');
    if (!form || !status) return;

    var submit = form.querySelector('button[type="submit"]');
    var trap = form.querySelector('[name="website"]');

    function field(name) { return form.querySelector('[name="' + name + '"]'); }

    function setError(input, on) {
      if (!input) return;
      var err = document.getElementById(input.id + '-err');
      input.setAttribute('aria-invalid', on ? 'true' : 'false');
      if (err) err.hidden = !on;
    }

    function validate() {
      var ok = true, first = null;
      var name = field('name'), email = field('email');

      var nameBad = !name || !name.value.trim();
      setError(name, nameBad);
      if (nameBad) { ok = false; first = first || name; }

      /* deliberately loose: something@something.something, no clever regex */
      var emailBad = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
      setError(email, emailBad);
      if (emailBad) { ok = false; first = first || email; }

      if (first && first.focus) first.focus();
      return ok;
    }

    function values() {
      return {
        name: (field('name') || {}).value || '',
        email: (field('email') || {}).value || '',
        grade: (field('grade') || {}).value || '',
        place: (field('place') || {}).value || '',
        note: (field('note') || {}).value || ''
      };
    }

    function say(msg, kind) {
      status.textContent = msg;
      status.classList.remove('is-ok', 'is-err');
      if (kind) status.classList.add(kind);
    }

    function mailtoFallback(v) {
      var body =
        'Name: ' + v.name + '\n' +
        'Email: ' + v.email + '\n' +
        'Grade/year: ' + (v.grade || '—') + '\n' +
        'City & country: ' + (v.place || '—') + '\n\n' +
        (v.note ? v.note + '\n\n' : '') +
        'Sent from the MedXplore website.';
      window.location.href = 'mailto:' + CONTACT_EMAIL +
        '?subject=' + encodeURIComponent("I'd like to join a MedXplore session") +
        '&body=' + encodeURIComponent(body);
      say('Opening your email app with the details filled in — just hit send.', 'is-ok');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* a bot filled the honeypot: pretend it worked, do nothing */
      if (trap && trap.value) { say('Thanks — we’ll be in touch.', 'is-ok'); return; }
      if (!validate()) { say('Please check the highlighted fields.', 'is-err'); return; }

      var v = values();

      if (!FORM_ENDPOINT) { mailtoFallback(v); return; }

      if (submit) { submit.disabled = true; }
      say('Sending…');

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(v)
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        say('You’re on the list. We’ll email you before the next session.', 'is-ok');
      }).catch(function () {
        say('That didn’t send. Opening your email app instead…', 'is-err');
        setTimeout(function () { mailtoFallback(v); }, 900);
      }).then(function () {
        if (submit) { submit.disabled = false; }
      });
    });

    /* clear the error the moment they start fixing it */
    ['name', 'email'].forEach(function (n) {
      var el = field(n);
      if (el) el.addEventListener('input', function () { setError(el, false); });
    });
  });
})();
