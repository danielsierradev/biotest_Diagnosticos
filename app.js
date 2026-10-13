/* BioTest Diagnósticos v2 - sitio de práctica (datos ficticios, guardados en el navegador).
   Secciones: 1 Utilidades | 2 Datos | 3 Registro de eventos | 4 Sesión | 5 Pacientes
              6 Órdenes | 7 Facturación y panel | 8 Consulta pública | 9 Inicio */
(function () {
  "use strict";

  /* ===== 1. UTILIDADES ===== */
  var $ = function (id) { return document.getElementById(id); };
  var VISTAS = ["ingreso", "pacientes", "ordenes", "facturacion", "panel", "historias", "consulta"];
  var PRECIOS = { "Hemograma": 25000, "Perfil lipídico": 40000, "Glicemia en ayunas": 15000, "Uroanálisis": 20000 };
  var USUARIOS = { operador01: { clave: "Operador2026!", rol: "operador" }, paciente01: { clave: "Biotest2026!", rol: "paciente" } };
  var ESTADOS = ["Recibido", "En proceso", "Listo"];

  function msg(id, texto, tipo) { var e = $(id); e.textContent = texto; e.className = "mensaje" + (tipo ? " " + tipo : ""); }
  function err(campo, texto) {
    var c = $(campo); $("e-" + campo).textContent = texto;
    if (texto) { c.classList.add("invalido"); } else { c.classList.remove("invalido"); }
    return !texto;
  }
  function celda(fila, texto) { var td = document.createElement("td"); td.textContent = texto; fila.appendChild(td); return td; } // textContent: evita inyección de código
  function boton(texto, id, fn) { var b = document.createElement("button"); b.type = "button"; b.textContent = texto; b.id = id; b.addEventListener("click", fn); return b; }
  function pad(n, l) { return String(n).padStart(l, "0"); }
  function enmascarar(doc) { return doc.length <= 4 ? doc : "*".repeat(doc.length - 4) + doc.slice(-4); }
  function sinConexion() { return $("modo-sin-conexion").checked; }

  /* ===== 2. DATOS (localStorage) ===== */
  var CLAVE = "biotest_v2";
  function semilla() {
    return {
      seq: { pac: 1, ord: 1, fac: 0 },
      pacientes: [{ id: "PAC-0001", nombre: "Paciente de Prueba", cedula: "1005123456", edad: 30 }],
      ordenes: [{ codigo: "ORD-000001", pacienteId: "PAC-0001", examen: "Hemograma", estado: "Listo", obs: "Sin novedades.", facturada: false }],
      facturas: []
    };
  }
  function leer() {
    try { var g = localStorage.getItem(CLAVE); if (g) { return JSON.parse(g); } } catch (e) { /* sin almacenamiento */ }
    return semilla();
  }
  function escribir(db) { try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch (e) { /* ignorar */ } }
  function paciente(db, id) { return db.pacientes.filter(function (p) { return p.id === id; })[0]; }

  // Toda escritura pasa por aquí: si no hay conexión no se guarda nada (evita pérdida o duplicidad).
  function transaccion(msgId, fn) {
    if (sinConexion()) {
      msg(msgId, "No se pudo guardar: no hay conexión. No se guardó ningún dato, inténtalo de nuevo.", "fallo");
      log("Guardado fallido por falta de conexión", "error");
      return false;
    }
    var db = leer(), ok;
    try { ok = fn(db); } catch (e) { msg(msgId, e.message, "fallo"); log(e.message, "error"); return false; }
    escribir(db); msg(msgId, ok, "exito"); log(ok); renderTodo();
    return true;
  }

  /* ===== 3. REGISTRO DE EVENTOS (consola y window.biotestLog) ===== */
  window.biotestLog = [];
  function log(texto, tipo) {
    var linea = new Date().toISOString() + " " + texto;
    window.biotestLog.push({ tipo: tipo || "info", texto: texto });
    if (tipo === "error") { console.error("[BioTest] " + linea); } else { console.info("[BioTest] " + linea); }
  }
  window.addEventListener("error", function (e) { log("Excepción: " + e.message, "error"); });

  /* ===== 4. SESIÓN, ROLES E INACTIVIDAD ===== */
  var LIMITE_S = parseInt(new URLSearchParams(location.search).get("inactividad"), 10) || 60; // ?inactividad=10 para pruebas
  var sesion = null;
  try { sesion = JSON.parse(sessionStorage.getItem("biotest_sesion")); } catch (e) { sesion = null; }
  var ultimaActividad = Date.now();

  function esOperador() { return sesion && sesion.rol === "operador"; }

  function mostrarVista(v) {
    VISTAS.forEach(function (x) {
      $("vista-" + x).hidden = x !== v;
      $("nav-" + x).classList.toggle("activo", x === v);
    });
    if (v === "historias") { renderHistorias(); }
    log("Vista abierta: " + v);
  }

  function aplicarSesion() {
    var op = esOperador();
    ["pacientes", "ordenes", "facturacion", "panel"].forEach(function (v) { $("nav-" + v).disabled = !op; });
    $("nav-historias").disabled = !sesion;
    $("btn-salir").hidden = !sesion;
    $("usuario-activo").hidden = !sesion;
    $("sesion-restante").hidden = !sesion;
    $("usuario-activo").textContent = sesion ? "Sesión: " + sesion.usuario + " (" + sesion.rol + ")" : "";
  }

  function cerrarSesion(aviso) {
    sesion = null; sessionStorage.removeItem("biotest_sesion");
    aplicarSesion(); mostrarVista("ingreso");
    $("form-login").reset(); $("login-error").textContent = aviso || "";
    log(aviso || "Sesión cerrada");
  }

  ["click", "keydown"].forEach(function (ev) { document.addEventListener(ev, function () { ultimaActividad = Date.now(); }); });
  setInterval(function () {
    if (!sesion) { return; }
    var resta = LIMITE_S - Math.floor((Date.now() - ultimaActividad) / 1000);
    $("sesion-restante").textContent = "Expira en " + Math.max(resta, 0) + " s";
    if (resta <= 0) { cerrarSesion("Sesión expirada por inactividad. Ingresa de nuevo."); }
  }, 1000);

  document.querySelectorAll(".menu button").forEach(function (b) {
    b.addEventListener("click", function () { if (!b.disabled) { mostrarVista(b.getAttribute("data-vista")); } });
  });
  $("btn-salir").addEventListener("click", function () { cerrarSesion(""); });
  $("btn-mostrar-clave").addEventListener("click", function () {
    var c = $("login-clave"), ver = c.type === "text";
    c.type = ver ? "password" : "text"; this.textContent = ver ? "Mostrar" : "Ocultar";
  });

  var fallos = 0, bloqueo = null;
  $("form-login").addEventListener("submit", function (e) {
    e.preventDefault();
    if ($("btn-ingresar").disabled) { return; }
    var u = $("login-usuario").value.trim(), c = $("login-clave").value;
    $("login-error").textContent = "";
    var a = err("login-usuario", u ? "" : "Escribe tu usuario."), b = err("login-clave", c ? "" : "Escribe tu contraseña.");
    if (!a || !b) { return; }
    var cuenta = USUARIOS[u];
    if (cuenta && cuenta.clave === c) {
      fallos = 0; sesion = { usuario: u, rol: cuenta.rol };
      sessionStorage.setItem("biotest_sesion", JSON.stringify(sesion));
      ultimaActividad = Date.now(); aplicarSesion(); mostrarVista(esOperador() ? "ordenes" : "historias");
      log("Ingreso correcto: " + u); return;
    }
    fallos += 1; log("Ingreso fallido (" + fallos + ")", "error");
    if (fallos >= 3) {
      var s = 30; $("btn-ingresar").disabled = true;
      bloqueo = setInterval(function () {
        s -= 1;
        if (s <= 0) { clearInterval(bloqueo); fallos = 0; $("btn-ingresar").disabled = false; $("login-error").textContent = ""; }
        else { $("login-error").textContent = "Cuenta bloqueada temporalmente. Intenta de nuevo en " + s + " segundos."; }
      }, 1000);
      $("login-error").textContent = "Cuenta bloqueada temporalmente. Intenta de nuevo en 30 segundos.";
    } else { $("login-error").textContent = "Usuario o contraseña incorrectos. Te quedan " + (3 - fallos) + " intentos."; }
  });

  /* ===== 5. PACIENTES ===== */
  $("form-paciente").addEventListener("submit", function (e) {
    e.preventDefault(); msg("msg-paciente", "");
    var n = $("p-nombre").value.trim(), c = $("p-cedula").value.trim(), ed = $("p-edad").value.trim();
    var v = [
      err("p-nombre", /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]{3,60}$/.test(n) ? "" : "El nombre debe tener entre 3 y 60 letras, sin números."),
      err("p-cedula", /^\d{6,10}$/.test(c) ? "" : "La cédula debe tener entre 6 y 10 dígitos numéricos."),
      err("p-edad", /^\d{1,3}$/.test(ed) && +ed <= 120 ? "" : "La edad debe ser un número entre 0 y 120.")
    ];
    if (v.indexOf(false) !== -1) { msg("msg-paciente", "Revisa los campos marcados.", "fallo"); return; }
    if (transaccion("msg-paciente", function (db) {
      if (db.pacientes.some(function (p) { return p.cedula === c; })) { throw new Error("Ya existe un paciente con esa cédula."); }
      db.seq.pac += 1; var id = "PAC-" + pad(db.seq.pac, 4);
      db.pacientes.push({ id: id, nombre: n, cedula: c, edad: +ed });
      return "Paciente registrado con ID " + id + ".";
    })) { $("form-paciente").reset(); }
  });

  function renderPacientes(db) {
    var cuerpo = $("cuerpo-pacientes"); cuerpo.innerHTML = "";
    db.pacientes.forEach(function (p) {
      var f = document.createElement("tr");
      [p.id, p.nombre, p.cedula, p.edad].forEach(function (t) { celda(f, t); }); cuerpo.appendChild(f);
    });
    var sel = $("o-paciente"), actual = sel.value; sel.innerHTML = "";
    var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "Selecciona un paciente"; sel.appendChild(o0);
    db.pacientes.forEach(function (p) {
      var o = document.createElement("option"); o.value = p.id; o.textContent = p.id + " - " + p.nombre; sel.appendChild(o);
    });
    sel.value = actual;
  }

  /* ===== 6. ÓRDENES ===== */
  var enEdicion = null;

  $("form-orden").addEventListener("submit", function (e) {
    e.preventDefault(); msg("msg-orden", "");
    var pid = $("o-paciente").value, ex = $("o-examen").value, obs = $("o-obs").value.trim();
    var v = [err("o-paciente", pid ? "" : "Selecciona un paciente."), err("o-examen", ex ? "" : "Selecciona un examen.")];
    if (v.indexOf(false) !== -1) { msg("msg-orden", "Revisa los campos marcados.", "fallo"); return; }
    if (transaccion("msg-orden", function (db) {
      db.seq.ord += 1; var cod = "ORD-" + pad(db.seq.ord, 6);
      db.ordenes.push({ codigo: cod, pacienteId: pid, examen: ex, estado: "Recibido", obs: obs, facturada: false });
      return "Orden " + cod + " guardada con estado Recibido.";
    })) { $("o-examen").value = ""; $("o-obs").value = ""; }
  });

  function avanzar(cod) {
    transaccion("msg-orden", function (db) {
      var o = db.ordenes.filter(function (x) { return x.codigo === cod; })[0], i = ESTADOS.indexOf(o.estado);
      if (i >= ESTADOS.length - 1) { throw new Error("La orden " + cod + " ya está en su estado final."); }
      o.estado = ESTADOS[i + 1]; return "La orden " + cod + " pasó a " + o.estado + ".";
    });
  }

  function facturar(cod) {
    transaccion("msg-orden", function (db) {
      var o = db.ordenes.filter(function (x) { return x.codigo === cod; })[0];
      if (o.facturada) { throw new Error("La orden " + cod + " ya fue enviada a facturación."); }
      db.seq.fac += 1; var fid = "FAC-" + pad(db.seq.fac, 6);
      db.facturas.push({ id: fid, orden: cod, pacienteId: o.pacienteId, valor: PRECIOS[o.examen] || 0 });
      o.facturada = true; return "Orden " + cod + " enviada a facturación (" + fid + ").";
    });
  }

  function abrirEdicion(cod) {
    if (!esOperador()) { msg("msg-orden", "Solo un operador puede modificar órdenes.", "fallo"); return; }
    var o = leer().ordenes.filter(function (x) { return x.codigo === cod; })[0];
    enEdicion = cod; $("edit-titulo").textContent = "Modificar observaciones de " + cod;
    $("edit-obs").value = o.obs; msg("msg-edicion", ""); $("panel-edicion").hidden = false; $("edit-obs").focus();
  }
  $("btn-guardar-obs").addEventListener("click", function () {
    if (!esOperador()) { msg("msg-edicion", "No tienes permiso para modificar órdenes.", "fallo"); return; }
    var nuevo = $("edit-obs").value.trim();
    transaccion("msg-edicion", function (db) {
      db.ordenes.filter(function (x) { return x.codigo === enEdicion; })[0].obs = nuevo;
      return "Observaciones de " + enEdicion + " actualizadas.";
    });
  });
  $("btn-cancelar-obs").addEventListener("click", function () { $("panel-edicion").hidden = true; });

  function verReporte(cod) {
    var db = leer(), o = db.ordenes.filter(function (x) { return x.codigo === cod; })[0], p = paciente(db, o.pacienteId);
    if (o.estado !== "Listo") { msg("msg-orden", "El reporte de " + cod + " aún no está disponible: la orden está " + o.estado + ".", "fallo"); return; }
    $("rep-titulo").textContent = "Reporte de resultados " + cod;
    var dl = $("rep-datos"); dl.innerHTML = "";
    [["Paciente", p.nombre], ["Cédula", p.cedula], ["Examen", o.examen], ["Estado", o.estado], ["Observaciones", o.obs || "Sin observaciones"]]
      .forEach(function (par) {
        var dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = par[0]; dd.textContent = par[1];
        dl.appendChild(dt); dl.appendChild(dd);
      });
    $("panel-reporte").hidden = false; msg("msg-orden", "");
  }
  $("btn-imprimir").addEventListener("click", function () { window.print(); });

  // Filtro por código: solo letras, números y guiones (previene inyección)
  $("filtro-id").addEventListener("input", renderOrdenes);

  function renderOrdenes() {
    var t0 = performance.now(), db = leer(), txt = $("filtro-id").value.trim().toUpperCase();
    if (!err("filtro-id", /^[A-Z0-9-]*$/.test(txt) ? "" : "Solo se permiten letras, números y guiones.")) { return; }
    var cuerpo = $("cuerpo-ordenes"), n = 0; cuerpo.innerHTML = "";
    db.ordenes.forEach(function (o) {
      if (txt && o.codigo.indexOf(txt) === -1) { return; }
      n += 1; var f = document.createElement("tr"), p = paciente(db, o.pacienteId);
      celda(f, o.codigo); celda(f, p ? p.nombre : "-"); celda(f, o.examen); celda(f, o.estado); celda(f, o.obs || "-");
      var acc = celda(f, "");
      acc.appendChild(boton("Avanzar estado", "btn-avanzar-" + o.codigo, function () { avanzar(o.codigo); }));
      acc.appendChild(boton("Editar", "btn-editar-" + o.codigo, function () { abrirEdicion(o.codigo); }));
      acc.appendChild(boton("Facturar", "btn-facturar-" + o.codigo, function () { facturar(o.codigo); }));
      acc.appendChild(boton("Reporte", "btn-reporte-" + o.codigo, function () { verReporte(o.codigo); }));
      cuerpo.appendChild(f);
    });
    $("filtro-cuenta").textContent = n;
    $("tiempo-filtro").textContent = Math.round(performance.now() - t0);
    window.biotestMetricas.filtroMs = performance.now() - t0;
  }

  // Exportación a CSV (UTF-8 con BOM para conservar tildes en Excel)
  $("btn-exportar").addEventListener("click", function () {
    var db = leer(), filas = [["Orden", "Paciente", "Cedula", "Examen", "Estado", "Observaciones", "Facturada"]];
    db.ordenes.forEach(function (o) {
      var p = paciente(db, o.pacienteId) || { nombre: "", cedula: "" };
      filas.push([o.codigo, p.nombre, p.cedula, o.examen, o.estado, o.obs, o.facturada ? "Si" : "No"]);
    });
    var csv = filas.map(function (f) {
      return f.map(function (c) {
        c = String(c); if (/^[=+\-@]/.test(c)) { c = "'" + c; } // evita fórmulas en Excel
        return '"' + c.replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "biotest_ordenes.csv"; document.body.appendChild(a); a.click(); a.remove();
    msg("msg-orden", "Se exportaron " + db.ordenes.length + " órdenes en biotest_ordenes.csv.", "exito"); log("Exportación CSV");
  });

  $("btn-masivo").addEventListener("click", function () {
    transaccion("msg-orden", function (db) {
      var exs = Object.keys(PRECIOS);
      for (var i = 0; i < 200; i++) {
        db.seq.ord += 1;
        db.ordenes.push({ codigo: "ORD-" + pad(db.seq.ord, 6), pacienteId: "PAC-0001", examen: exs[i % exs.length], estado: ESTADOS[i % 3], obs: "Carga de prueba " + (i + 1), facturada: false });
      }
      return "Se cargaron 200 órdenes de prueba.";
    });
  });
  $("btn-reiniciar").addEventListener("click", function () {
    escribir(semilla()); $("panel-edicion").hidden = true; $("panel-reporte").hidden = true;
    renderTodo(); msg("msg-orden", "Datos restablecidos a los valores iniciales.", "aviso"); log("Datos restablecidos");
  });

  /* ===== 7. FACTURACIÓN, PANEL E HISTORIAS ===== */
  function renderFacturas(db) {
    var c = $("cuerpo-facturas"); c.innerHTML = "";
    db.facturas.forEach(function (f) {
      var tr = document.createElement("tr"), p = paciente(db, f.pacienteId);
      celda(tr, f.id); celda(tr, f.orden); celda(tr, p ? p.nombre : "-"); celda(tr, f.valor.toLocaleString("es-CO")); c.appendChild(tr);
    });
  }
  function renderPanel(db) {
    var cnt = function (e) { return db.ordenes.filter(function (o) { return o.estado === e; }).length; };
    $("p-total").textContent = db.ordenes.length; $("p-recibido").textContent = cnt("Recibido");
    $("p-proceso").textContent = cnt("En proceso"); $("p-listo").textContent = cnt("Listo");
    $("p-facturadas").textContent = db.ordenes.filter(function (o) { return o.facturada; }).length;
    $("p-actualizado").textContent = new Date().toLocaleTimeString("es-CO");
  }
  function renderHistorias() {
    var ok = esOperador(); $("historias-denegado").hidden = ok; $("historias-contenido").hidden = !ok;
    if (!ok) { log("Acceso denegado a historias clínicas", "error"); return; }
    var db = leer(), c = $("cuerpo-historias"); c.innerHTML = "";
    db.pacientes.forEach(function (p) {
      var tr = document.createElement("tr");
      celda(tr, p.nombre); celda(tr, p.cedula); celda(tr, p.edad);
      celda(tr, db.ordenes.filter(function (o) { return o.pacienteId === p.id; }).map(function (o) { return o.codigo + " (" + o.estado + ")"; }).slice(0, 5).join(", "));
      c.appendChild(tr);
    });
  }

  /* ===== 8. CONSULTA PÚBLICA (documento enmascarado) ===== */
  var consultado = null;
  function pintarConsulta() {
    if (!consultado) { return; }
    var db = leer(), o = db.ordenes.filter(function (x) { return x.codigo === consultado; })[0];
    if (!o) { return; }
    var p = paciente(db, o.pacienteId);
    $("c-titulo").textContent = "Orden " + o.codigo; $("c-paciente").textContent = p.nombre;
    $("c-documento").textContent = enmascarar(p.cedula); $("c-examen").textContent = o.examen; $("c-estado").textContent = o.estado;
    $("consulta-panel").hidden = false;
  }
  $("form-consulta").addEventListener("submit", function (e) {
    e.preventDefault(); $("consulta-panel").hidden = true; msg("msg-consulta", ""); consultado = null;
    var cod = $("c-codigo").value.trim().toUpperCase();
    if (!err("c-codigo", /^ORD-\d{6}$/.test(cod) ? "" : "Usa el formato ORD- seguido de 6 dígitos.")) { return; }
    var t0 = performance.now(); $("cargando").hidden = false; $("btn-consultar").disabled = true;
    setTimeout(function () {
      $("cargando").hidden = true; $("btn-consultar").disabled = false;
      var existe = leer().ordenes.some(function (o) { return o.codigo === cod; });
      if (!existe) { msg("msg-consulta", "No encontramos una orden con ese código. Verifica el dato e inténtalo de nuevo.", "fallo"); }
      else { consultado = cod; pintarConsulta(); }
      var ms = Math.round(performance.now() - t0); $("tiempo-consulta").textContent = ms; window.biotestMetricas.consultaMs = ms;
    }, 300);
  });

  /* ===== 9. INICIO Y SINCRONIZACIÓN ===== */
  window.biotestMetricas = { cargaMs: 0, consultaMs: 0, filtroMs: 0 };
  function renderTodo() {
    var db = leer(); renderPacientes(db); renderOrdenes(); renderFacturas(db); renderPanel(db); pintarConsulta();
    if (!$("vista-historias").hidden) { renderHistorias(); }
  }
  window.addEventListener("storage", function (e) { if (e.key === CLAVE) { renderTodo(); log("Datos sincronizados desde otra pestaña"); } });
  window.addEventListener("load", function () {
    var ms = Math.round(performance.now()); window.biotestMetricas.cargaMs = ms; $("carga-ms").textContent = ms; log("Página cargada en " + ms + " ms");
  });

  renderTodo(); aplicarSesion();
  mostrarVista(sesion ? (esOperador() ? "ordenes" : "historias") : "ingreso");
})();