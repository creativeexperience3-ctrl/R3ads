/* ============================================================
   R3ADS · Acceso al panel interno
   Punto de entrada unico: autentica y manda a admin.html.
   Quien protege los datos son las reglas de Firestore; esta
   pantalla solo evita mostrar un panel que no podria cargar nada.
   ============================================================ */

const btnEntrar  = document.getElementById('btnEntrar');
const loginError = document.getElementById('loginError');
const loginEstado = document.getElementById('loginEstado');

function mostrarError(texto) {
  loginError.textContent = texto;
  loginError.hidden = false;
  loginEstado.hidden = true;
  btnEntrar.hidden = false;
}

// admin.js rebota hasta aca con ?e=acceso cuando la cuenta no es admin.
if (new URLSearchParams(location.search).get('e') === 'acceso') {
  mostrarError('Esa cuenta de Google no tiene acceso al panel. Entrá con la cuenta de R3ADS.');
}

if (!window.r3Configurado || !window.r3Auth) {
  btnEntrar.disabled = true;
  mostrarError('Firebase todavía no está configurado. Falta la config del proyecto en firebase-init.js.');
} else {
  btnEntrar.addEventListener('click', async () => {
    loginError.hidden = true;
    btnEntrar.disabled = true;
    try {
      await window.r3Auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      // El redirect lo hace onAuthStateChanged, no hace falta nada mas aca.
    } catch (err) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        mostrarError('No se pudo iniciar sesión: ' + (err.message || err.code));
      }
      btnEntrar.disabled = false;
    }
  });

  // Al cargar, Firebase todavia no sabe si hay sesion: se muestra el aviso
  // de "verificando" en lugar del boton, para no parpadear entre las dos.
  btnEntrar.hidden = true;
  loginEstado.hidden = false;

  window.r3Auth.onAuthStateChanged(async (user) => {
    if (!user) {
      loginEstado.hidden = true;
      btnEntrar.hidden = false;
      btnEntrar.disabled = false;
      return;
    }
    if (!window.R3_ADMINS.includes(user.email)) {
      const correo = user.email;
      await window.r3Auth.signOut();
      mostrarError(`La cuenta ${correo} no tiene acceso al panel.`);
      return;
    }
    loginEstado.textContent = 'Entrando…';
    loginEstado.hidden = false;
    btnEntrar.hidden = true;
    location.replace('admin.html');
  });
}
