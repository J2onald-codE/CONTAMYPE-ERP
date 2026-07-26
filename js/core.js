// ══ CONFIGURACIÓN ═══════════════════════════════════════════════════════

const CLIENT_ID = '407598104224-tmtf4aeekucpi91o6md0f5gpnvhorvn6.apps.googleusercontent.com';

const SHEET_ID = '1mab4WBaUtmgki6ddZkXo4kt6TNiB1e6OW-cIUoWDCrI';

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwdMcLA_Mhr5a2BvnRGSHKWM14-5dy7JWwMcuAYbWxD0YyHOL6Y34ZQYstH4uNdT4dJTg/exec';

const WEBHOOK_TOKEN = 'contamype2026_x2Kp6mQzL0wRtN';


// ══ ROLES Y PERMISOS ═════════════════════════════════════════════════════

const HOJA_USUARIOS = 'USUARIOS';

const PERMISOS_POR_ROL = {
  ADMIN:        ['dashboard', 'ventas', 'compras', 'inventarios', 'productos', 'tesoreria', 'cxp', 'cxc', 'planilla', 'libros'],
  VENTAS:       ['dashboard', 'ventas', 'cxc', 'productos'],
  COMPRAS:      ['dashboard', 'compras', 'cxp', 'productos'],
  ALMACEN:      ['dashboard', 'inventarios', 'productos'],
  CONTABILIDAD: ['dashboard', 'tesoreria', 'cxp', 'cxc', 'planilla', 'libros']
};

let rolActual = null;

async function obtenerUsuarioAutorizado(accessToken) {
  const data = await llamarWebhookJSONP({
    token: WEBHOOK_TOKEN,
    accion: 'obtenerMiRol',
    accessToken: accessToken
  });
  if (data.status !== 'ok') return null;
  if (!PERMISOS_POR_ROL[data.rol]) return null; // rol no reconocido
  return { rol: data.rol, nombre: data.nombre || '' };
}

function aplicarPermisosDeRol(rol) {
  const permitidos = PERMISOS_POR_ROL[rol] || [];
  document.querySelectorAll('.nav-item').forEach(n => {
    const onclickAttr = n.getAttribute('onclick') || '';
    const match = onclickAttr.match(/showPage\('([a-z]+)'\)/);
    if (!match) return; // no es un link de módulo (ej: cerrar sesión)
    const pagina = match[1];
    n.style.display = permitidos.includes(pagina) ? '' : 'none';
  });

  document.querySelectorAll('.nav-section-title').forEach(titulo => {
    let hayVisible = false;
    let el = titulo.nextElementSibling;
    while (el && !el.classList.contains('nav-section-title')) {
      if (el.classList.contains('nav-item') && el.style.display !== 'none') {
        hayVisible = true;
        break;
      }
      el = el.nextElementSibling;
    }
    titulo.style.display = hayVisible ? '' : 'none';
  });
}


// ══ LOGIN ════════════════════════════════════════════════════════════════

let userInfo = null;

function iniciarLoginGoogle() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'email profile https://www.googleapis.com/auth/spreadsheets',
    callback: (response) => {
      if (response.error) {
        mostrarError('Error al iniciar sesión. Intenta nuevamente.');
        return;
      }
      currentAccessToken = response.access_token;
      // Obtener info del usuario
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${response.access_token}` }
      })
      .then(r => r.json())
      .then(user => {
        obtenerUsuarioAutorizado(response.access_token)
          .then(autorizado => {
            if (!autorizado) {
              mostrarError(`El correo ${user.email} no tiene acceso autorizado.`);
              return;
            }
            rolActual = autorizado.rol;
            userInfo = user;
            entrarAlSistema(user);
          })
          .catch(() => mostrarError('Error al verificar tus permisos. Intenta nuevamente.'));
      })
      .catch(() => mostrarError('Error al verificar tu cuenta.'));
    }
  });
  client.requestAccessToken();
}

function mostrarError(msg) {
  document.getElementById('error-msg').textContent = msg;
  document.getElementById('login-error').style.display = 'block';
}

function entrarAlSistema(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';

  // Datos del usuario en sidebar
  document.getElementById('user-name').textContent = user.name || 'Usuario';
  document.getElementById('user-email').textContent = user.email || '';

  const avatarEl = document.getElementById('user-avatar');
  if (user.picture) {
    avatarEl.innerHTML = `<img src="${user.picture}" alt="Avatar">`;
  } else {
    avatarEl.textContent = (user.name || 'U')[0].toUpperCase();
  }

  aplicarPermisosDeRol(rolActual);

  const permitidos = PERMISOS_POR_ROL[rolActual] || [];
  if (permitidos.includes('dashboard')) {
    cargarDashboard();
  } else if (permitidos.length > 0) {
    showPage(permitidos[0]); // si el rol no tiene Dashboard, entra al primer módulo permitido
  }
  iniciarReloj();
}

function cerrarSesion() {
  userInfo = null;
  rolActual = null;
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-error').style.display = 'none';
  google.accounts.id.disableAutoSelect();
}


// ══ RELOJ ════════════════════════════════════════════════════════════════

function iniciarReloj() {
  function actualizar() {
    const ahora = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('topbar-time').textContent =
      ahora.toLocaleDateString('es-PE', opciones);
  }
  actualizar();
  setInterval(actualizar, 60000);
}


// ══ NAVEGACIÓN ═══════════════════════════════════════════════════════════

const pageTitles = {
  dashboard: '📊 Dashboard',
  ventas: '💰 Registro de Ventas',
  compras: '🛒 Registro de Compras',
  inventarios: '📦 Inventarios',
  productos: '🏷️ Productos',
  tesoreria: '🏦 Tesorería',
  cxp: '📋 Cuentas por Pagar',
  cxc: '📋 Cuentas por Cobrar',
  planilla: '👥 Planilla',
  libros: '📚 Libros Contables'
};

function showPage(page) {
  if (rolActual && PERMISOS_POR_ROL[rolActual] && !PERMISOS_POR_ROL[rolActual].includes(page)) {
    alert('⛔ No tienes permiso para acceder a este módulo.');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${page}`).classList.add('active');
  window.scrollTo({top: 0, left: 0, behavior: 'instant'});
  const navEl = document.querySelector('.sidebar-nav');
  if (navEl) navEl.scrollTop = 0;
  document.getElementById('topbar-title').textContent = pageTitles[page] || page;

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') === `showPage('${page}')`) {
      n.classList.add('active');
    }
  });

  // Cerrar sidebar en móvil
  if (window.innerWidth <= 768) toggleSidebar(false);
}

function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.contains('open');
  const open = force !== undefined ? force : !isOpen;
  sidebar.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
}


// ══ AUTENTICACIÓN DE PETICIONES (token de acceso) ══════════════════════

let currentAccessToken = null;

async function obtenerAccessToken() {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'email profile https://www.googleapis.com/auth/spreadsheets',
      callback: (response) => {
        if (response.error) reject(response.error);
        else { currentAccessToken = response.access_token; resolve(response.access_token); }
      }
    });
    if (currentAccessToken) resolve(currentAccessToken);
    else client.requestAccessToken({ prompt: '' });
  });
}


// ══ HELPERS COMPARTIDOS (formularios, errores, webhook, exportación) ═══

function mostrarMensajeForm(elId, tipo, texto) {
  const msg = document.getElementById(elId);
  if (!msg) return;
  msg.style.display = 'block';
  msg.style.padding = '10px 14px';
  msg.style.borderRadius = '8px';
  if (tipo === 'ok') {
    msg.style.background = '#F0FFF4';
    msg.style.color = 'var(--verde)';
    msg.style.border = '1px solid rgba(56,161,105,0.3)';
  } else {
    msg.style.background = '#FFF5F5';
    msg.style.color = 'var(--rojo)';
    msg.style.border = '1px solid #FED7D7';
  }
  msg.textContent = texto;
}

async function lanzarErrorSheets(resp) {
  let detalle = 'Error HTTP ' + resp.status;
  try {
    const data = await resp.json();
    if (data && data.error && data.error.message) detalle = data.error.message;
  } catch (e) { /* la respuesta no era JSON, nos quedamos con el status */ }
  throw new Error(detalle);
}

function llamarWebhookJSONP(params) {
  return new Promise((resolve, reject) => {
    const callbackName = 'webhookCb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    let resuelto = false;

    window[callbackName] = function(data) {
      resuelto = true;
      resolve(data);
      delete window[callbackName];
      script.remove();
    };

    const timeoutId = setTimeout(() => {
      if (!resuelto) {
        delete window[callbackName];
        script.remove();
        reject(new Error('Tiempo de espera agotado (30s). Verifica tu conexión o que el bloqueador de anuncios/Brave Shields no esté bloqueando script.google.com'));
      }
    }, 30000);

    const original = window[callbackName];
    window[callbackName] = function(data) {
      clearTimeout(timeoutId);
      original(data);
    };

    const urlParams = new URLSearchParams({ ...params, callback: callbackName });
    script.src = `${WEBHOOK_URL}?${urlParams.toString()}`;
    script.onerror = () => {
      clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
      reject(new Error('No se pudo cargar el script del servidor (posible bloqueo del navegador/extensión hacia script.google.com)'));
    };
    document.body.appendChild(script);
  });
}

async function obtenerDatosProtegidos(accion) {
  const accessToken = await obtenerAccessToken();
  const data = await llamarWebhookJSONP({
    token: WEBHOOK_TOKEN,
    accion: accion,
    accessToken: accessToken
  });
  if (data.status !== 'ok') {
    throw new Error(data.message || 'No autorizado');
  }
  return data.values || [];
}

function descargarArchivo(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

function exportarExcelConEstilo(headers, filas, nombreArchivo, nombreHoja, csvFallback) {
  if (typeof XLSX === 'undefined') {
    console.error('xlsx-js-style no cargó, usando CSV como respaldo.');
    descargarArchivo(csvFallback, nombreArchivo.replace('.xlsx', '.csv'), 'text/csv');
    return;
  }

  try {
    const datos = [headers, ...filas];
    const ws = XLSX.utils.aoa_to_sheet(datos);

    const estiloEncabezado = {
      font: { name: 'Arial', bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF1A3A8F' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'FFB0B0B0' } },
        bottom: { style: 'thin', color: { rgb: 'FFB0B0B0' } },
        left: { style: 'thin', color: { rgb: 'FFB0B0B0' } },
        right: { style: 'thin', color: { rgb: 'FFB0B0B0' } }
      }
    };

    for (let col = 0; col < headers.length; col++) {
      const celda = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[celda]) ws[celda].s = estiloEncabezado;
    }

    ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.toString().length + 4) }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    XLSX.writeFile(wb, nombreArchivo);

  } catch (err) {
    console.error('Error generando Excel con estilo, usando CSV como respaldo:', err);
    descargarArchivo(csvFallback, nombreArchivo.replace('.xlsx', '.csv'), 'text/csv');
  }
}
