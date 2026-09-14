/* JS minimal — menu mobile + dergim formulari. Pa varesi, pa build step. */
(function () {
  'use strict';

  /**
   * TODO: krijo nje form te ri ne https://formspree.io dhe ngjit endpoint-in ketu.
   * Deri atehere formulari tregon mesazhin e gabimit dhe e fton perdoruesin te telefonoje.
   */
  var FORM_ENDPOINT = 'https://formspree.io/f/XXXXXXXX';

  // -------------------------------------------------------------- menu mobile
  var toggle = document.getElementById('menu-toggle');
  var menu = document.getElementById('mobile-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', toggle.dataset[open ? 'labelOpen' : 'labelClose']);
      menu.classList.toggle('hidden', open);
    });

    // Mbyll menune kur ekrani kalon ne desktop, qe te mos mbetet gjendje e ngecur
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (e) {
      if (e.matches) {
        menu.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', toggle.dataset.labelOpen);
      }
    });
  }

  // ------------------------------------------------------------------ formular
  var form = document.getElementById('contact-form');
  if (!form) return;

  var button = form.querySelector('button[type="submit"]');
  var successBox = document.getElementById('form-success');
  var errorBox = document.getElementById('form-error');

  function setBusy(busy) {
    button.disabled = busy;
    button.textContent = busy ? button.dataset.labelSending : button.dataset.labelIdle;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    successBox.classList.add('hidden');
    errorBox.classList.add('hidden');
    setBusy(true);

    fetch(FORM_ENDPOINT, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        form.reset();
        successBox.classList.remove('hidden');
        successBox.scrollIntoView({ block: 'center' });
      })
      .catch(function () {
        errorBox.classList.remove('hidden');
        errorBox.scrollIntoView({ block: 'center' });
      })
      .finally(function () {
        setBusy(false);
      });
  });
})();
