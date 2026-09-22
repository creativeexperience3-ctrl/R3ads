/* ============================================================
   R3ADS · Hub del panel interno
   Mismo guard de sesión que admin.js: exige estar en R3_ADMINS
   (ver firebase-init.js) o rebota a login.html. Esta pantalla no
   lee Firestore, solo agrupa accesos a los paneles internos.
   ============================================================ */

const vistaCargando = document.getElementById('vistaCargando');
const vistaHub      = document.getElementById('vistaHub');
const adminUsuario  = document.getElementById('adminUsuario');
const btnSalir      = document.getElementById('btnSalir');

if (!window.r3Configurado || !window.r3Auth) {
  vistaCargando.textContent =
    'Firebase todavía no está configurado. Falta la config del proyecto en firebase-init.js.';
} else {
  btnSalir.addEventListener('click', async () => {
    await window.r3Auth.signOut();
    location.replace('login.html');
  });

  window.r3Auth.onAuthStateChanged(async (user) => {
    if (!user) {
      location.replace('login.html');
      return;
    }
    if (!window.R3_ADMINS.includes(user.email)) {
      await window.r3Auth.signOut();
      location.replace('login.html?e=acceso');
      return;
    }
    adminUsuario.textContent = user.email;
    adminUsuario.hidden = false;
    btnSalir.hidden = false;
    vistaCargando.hidden = true;
    vistaHub.hidden = false;
  });
}
