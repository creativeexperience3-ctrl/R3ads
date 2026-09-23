/* ================================================================
   clinic-modules.js — Módulos contratados por clínica (Ancla).

   Cada clínica paga por lo que usa. Qué módulos tiene contratados vive
   en `/clinics/{clinicId}.modulos`, un mapa de banderas:

     modulos: { laboratorio: true, pruebasRapidas: false,
                constancias: true, ekg: false, historialCalendario: false }

   Solo R3ads (superadmin) puede escribir ese campo — es una decisión de
   facturación, no de la clínica. Las reglas de `/clinics/{clinicId}` ya
   son `allow write: if isSuperAdmin()`, así que no hace falta nada extra.

   SEMÁNTICA (a propósito, y documentada porque no es obvia):
   - Si el mapa `modulos` NO existe  -> TODO habilitado. Compatibilidad
     hacia atrás: las clínicas dadas de alta antes de que esto existiera
     no se quedan sin herramientas de un día para otro.
   - Si el mapa SÍ existe -> solo lo que está explícitamente en `true`
     queda habilitado. Un módulo ausente del mapa cuenta como apagado.
   El panel de alta de clínicas (Fase 4) siempre debe escribir el mapa
   completo, para que la ambigüedad no exista en la práctica. Por esto
   mismo las clínicas que ya tenían un mapa guardado ANTES de que
   `historialCalendario` existiera quedan con ese módulo apagado por
   defecto (el mapa no tiene la clave) — hay que prenderlo a mano desde
   portal-admin.html para las que correspondan al plan Completo.

   QUÉ NO ES CONFIGURABLE: expedientes, consultas/pendientes, búsqueda,
   edición, historial (la búsqueda de un paciente puntual — Etapa Básico
   la tiene igual que Completo), unificación y caja. Caja en particular
   NO es opcional aunque parezca un módulo: es el cierre del circuito de
   la consulta (`pendiente_caja` -> `completa`). Apagarla no oculta una
   pestaña, deja consultas sin poder cerrarse.
   `historialCalendario` SÍ es opcional — es solo la vista de calendario
   mensual dentro de la pestaña Historial (diferenciador del plan
   Completo); sin ella, Historial sigue funcionando vía búsqueda directa
   de paciente.

   ESTO NO ES UNA FRONTERA DE SEGURIDAD POR SÍ SOLO. Esconder botones en
   el cliente no impide que alguien escriba directo a Firestore. El
   candado real está en `firestore.rules` (ver `moduloActivo()` ahí); lo
   de acá es para que la interfaz no ofrezca lo que la clínica no pagó.
   ================================================================ */
(function (global) {
  'use strict';

  var OPCIONALES = ['laboratorio', 'pruebasRapidas', 'constancias', 'ekg', 'historialCalendario'];

  var _mods = null;        // null = todavía no se cargó
  var _promesa = null;     // para no pedir el doc dos veces por página

  /* Lee /clinics/{clinicId} una sola vez y cachea el mapa. Si la lectura
     falla (sin red, sin permisos), se resuelve en "todo habilitado": es
     preferible que la clínica siga trabajando a dejarla sin herramientas
     por un error transitorio. El candado de verdad son las reglas. */
  function cargar(clinicId) {
    if (_promesa) return _promesa;
    var db = typeof global.r3adsDb !== 'undefined' ? global.r3adsDb : null;
    if (!db || !clinicId) {
      _mods = null;
      _promesa = Promise.resolve(null);
      return _promesa;
    }
    _promesa = db.collection('clinics').doc(clinicId).get()
      .then(function (doc) {
        _mods = (doc.exists && doc.data().modulos) || null;
        return _mods;
      })
      .catch(function (err) {
        console.warn('[Ancla] No se pudo leer los módulos de la clínica:', err);
        _mods = null;
        return null;
      });
    return _promesa;
  }

  function activo(nombre) {
    if (OPCIONALES.indexOf(nombre) === -1) return true;  // núcleo: siempre
    if (!_mods) return true;                             // sin mapa: todo
    return _mods[nombre] === true;
  }

  /* Saca del DOM lo que pertenece a un módulo apagado. Se elimina en vez
     de ocultar con CSS para que no quede un botón invisible pero
     clickeable por teclado. */
  function aplicar(root) {
    var scope = root || document;
    var nodos = scope.querySelectorAll('[data-modulo]');
    for (var i = 0; i < nodos.length; i++) {
      var nombre = nodos[i].getAttribute('data-modulo');
      if (!activo(nombre) && nodos[i].parentNode) {
        nodos[i].parentNode.removeChild(nodos[i]);
      }
    }
  }

  /* Candado duro para las páginas que SON un módulo. Se llama desde el
     auth guard: si el módulo no está contratado, la página no arranca.
     Esto es lo que hace que no importe cuántos links apunten acá ni
     dónde se hayan generado — todos mueren en esta pantalla. */
  function exigir(nombre, etiqueta) {
    if (activo(nombre)) return true;
    document.body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px;text-align:center;font-family:system-ui">' +
      '<div><h1 style="color:#242F40;font-size:26px;margin:0 0 12px">Módulo no contratado</h1>' +
      '<p style="color:#6B7280;margin:0 0 24px;max-width:420px;line-height:1.6">' +
      'Tu clínica no tiene contratado el módulo de <b>' + (etiqueta || nombre) + '</b>. ' +
      'Si querés habilitarlo, escribinos.</p>' +
      '<a href="Expediente-Doctor.html" style="background:#242F40;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Volver al portal</a>' +
      '</div></div>';
    return false;
  }

  global.r3adsModulos = {
    cargar: cargar,
    activo: activo,
    aplicar: aplicar,
    exigir: exigir,
    OPCIONALES: OPCIONALES
  };
})(window);
