// ══ INVENTARIO & KARDEX COMPLETO ══════════════════════════════════════════

let inventarioData = [];

let kardexProductoActual = null;

let kardexData = [];

function mostrarVistaInventario(vista) {
  ['inv-lista-view','inv-kardex-view','inv-ajuste-view','inv-conteo-view'].forEach(v => {
    document.getElementById(v).style.display = 'none';
  });
  document.getElementById('inv-' + vista + '-view').style.display = 'block';
}

function volverALista() {
  mostrarVistaInventario('lista');
  cargarInventarios();
}

function mostrarFormAjuste() {
  mostrarVistaInventario('ajuste');
  cargarSelectorProductos();
}

function mostrarConteoFisico() {
  mostrarVistaInventario('conteo');
  cargarConteoFisico();
}

async function cargarInventarios() {
  mostrarVistaInventario('lista');
  const tbody = document.getElementById('inv-tbody');
  const count = document.getElementById('inv-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const rows = await obtenerDatosProtegidos('obtenerInventarios');
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:32px; color:#A0AEC0;">No hay registros en inventario.</td></tr>';
      if (count) count.textContent = '0 productos'; return;
    }
    inventarioData = rows;
    renderInventario(inventarioData);
  } catch(err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:32px; color:var(--rojo);">❌ ${err.message}</td></tr>`;
  }
}

function renderInventario(rows) {
  const tbody = document.getElementById('inv-tbody');
  const count = document.getElementById('inv-count');
  if (count) count.textContent = rows.length + ' producto(s)';

  let normal = 0, bajo = 0, agotado = 0;

  tbody.innerHTML = rows.map((row, idx) => {
    const stockFinal = parseFloat(row[7]||0);
    const stockMin = 5; // default mínimo
    const costoUnit = parseFloat(row[8]||0);
    const valorTotal = stockFinal * costoUnit;

    let estadoBadge, estadoClass;
    if (stockFinal <= 0) {
      estadoBadge = '<span class="badge badge-rojo">🚫 Agotado</span>';
      agotado++;
    } else if (stockFinal <= stockMin) {
      estadoBadge = '<span class="badge badge-amarillo">⚠️ Stock bajo</span>';
      bajo++;
    } else {
      estadoBadge = '<span class="badge badge-verde">✅ Normal</span>';
      normal++;
    }

    return `<tr>
      <td><b>${row[1]||'-'}</b></td>
      <td>${row[2]||'-'}</td>
      <td>${row[1]||'-'}</td>
      <td style="color:var(--verde); font-weight:600;">${parseFloat(row[5]||0).toFixed(0)}</td>
      <td style="color:var(--rojo); font-weight:600;">${parseFloat(row[6]||0).toFixed(0)}</td>
      <td style="font-weight:800; font-size:1rem;">${stockFinal.toFixed(0)}</td>
      <td>S/. ${costoUnit.toFixed(2)}</td>
      <td>S/. ${valorTotal.toFixed(2)}</td>
      <td>${estadoBadge}</td>
      <td>
        <div style="display:flex; gap:4px;">
          <button onclick="verKardex(this.dataset.codigo, this.dataset.nombre)" data-codigo="${row[1]||''}" data-nombre="${row[2]||''}" style="background:var(--azul-med);color:white;border:none;border-radius:6px;padding:4px 8px;font-size:0.72rem;cursor:pointer;">📋 Kardex</button>
          <button onclick="ajusteRapido(this.dataset.codigo, this.dataset.stock)" data-codigo="${row[1]||''}" data-stock="${stockFinal}" style="background:var(--amarillo);color:white;border:none;border-radius:6px;padding:4px 8px;font-size:0.72rem;cursor:pointer;">⚖️ Ajuste</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Actualizar KPIs
  document.getElementById('inv-total-productos').textContent = rows.length;
  document.getElementById('inv-stock-normal').textContent = normal;
  document.getElementById('inv-stock-bajo').textContent = bajo;
  document.getElementById('inv-stock-agotado').textContent = agotado;
}

function filtrarInventario() {
  const nombre = document.getElementById('inv-filtro-nombre').value.toLowerCase();
  const sector = document.getElementById('inv-filtro-sector').value.toLowerCase();
  const stockFiltro = document.getElementById('inv-filtro-stock').value;

  const filtrado = inventarioData.filter(row => {
    const matchNombre = !nombre || (row[2]||'').toLowerCase().includes(nombre) || (row[1]||'').toLowerCase().includes(nombre);
    const matchSector = !sector || (row[1]||'').toLowerCase().includes(sector);
    const stock = parseFloat(row[7]||0);
    const matchStock = !stockFiltro ||
      (stockFiltro === 'agotado' && stock <= 0) ||
      (stockFiltro === 'bajo' && stock > 0 && stock <= 5) ||
      (stockFiltro === 'normal' && stock > 5);
    return matchNombre && matchSector && matchStock;
  });

  renderInventario(filtrado);
}

async function verKardex(codigo, nombre) {
  kardexProductoActual = { codigo, nombre };
  mostrarVistaInventario('kardex');

  document.getElementById('kardex-nombre-producto').textContent = nombre || codigo;
  document.getElementById('kardex-codigo-producto').textContent = 'Código: ' + codigo;

  await cargarKardex(codigo);
}

async function cargarKardex(codigo) {
  const tbody = document.getElementById('kardex-tbody');
  const count = document.getElementById('kardex-count');
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';

  try {
    const datosKardex = await obtenerDatosProtegidos('obtenerKardex');

    if (!datosKardex) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:32px; color:#A0AEC0;">Sin movimientos en Kardex.</td></tr>';
      return;
    }

    // Filtrar por código de producto
    kardexData = datosKardex.filter(row => (row[2]||'').toString().trim() === codigo.toString().trim());

    if (kardexData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:32px; color:#A0AEC0;">Sin movimientos para este producto.</td></tr>';
      actualizarResumenKardex([]);
      return;
    }

    // Más reciente arriba
    const rows = [...kardexData].reverse();
    renderKardex(rows);
    actualizarResumenKardex(kardexData);

  } catch(err) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:32px; color:var(--rojo);">Error al cargar Kardex.</td></tr>';
  }
}

function renderKardex(rows) {
  const tbody = document.getElementById('kardex-tbody');
  const count = document.getElementById('kardex-count');
  if (count) count.textContent = rows.length + ' movimiento(s)';

  tbody.innerHTML = rows.map(row => {
    const tipo = (row[4]||'').trim();
    const estado = (row[13]||'ACTIVO').trim();
    const badgeTipo = tipo === 'ENTRADA' ? '<span class="badge badge-verde">⬆️ ENTRADA</span>' :
                      tipo === 'SALIDA' ? '<span class="badge badge-rojo">⬇️ SALIDA</span>' :
                      '<span class="badge badge-amarillo">⚖️ AJUSTE</span>';
    const badgeEstado = estado === 'ANULADO' ? '<span class="badge badge-rojo">ANULADO</span>' : '<span class="badge badge-verde">ACTIVO</span>';
    const rowStyle = estado === 'ANULADO' ? 'style="opacity:0.5; text-decoration:line-through;"' : '';

    return `<tr ${rowStyle}>
      <td>${row[1]||'-'}</td>
      <td>${badgeTipo}</td>
      <td style="font-weight:700;">${parseFloat(row[5]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[6]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[7]||0).toFixed(2)}</td>
      <td style="font-weight:700;">${parseFloat(row[8]||0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[9]||0).toFixed(2)}</td>
      <td>${row[10]||'-'}</td>
      <td>${row[12]||'-'}</td>
      <td>${badgeEstado}</td>
    </tr>`;
  }).join('');
}

function actualizarResumenKardex(rows) {
  const activos = rows.filter(r => (r[13]||'ACTIVO') !== 'ANULADO');
  const entradas = activos.filter(r => r[4] === 'ENTRADA').reduce((s,r) => s + parseFloat(r[5]||0), 0);
  const salidas = activos.filter(r => r[4] === 'SALIDA').reduce((s,r) => s + parseFloat(r[5]||0), 0);
  const saldo = entradas - salidas;
  const ultimoValor = activos.length > 0 ? parseFloat(activos[activos.length-1][9]||0) : 0;
  const ultimoCosto = activos.length > 0 ? parseFloat(activos[activos.length-1][6]||0) : 0;

  document.getElementById('kardex-stock-actual').textContent = saldo.toFixed(0);
  document.getElementById('kardex-valor-total').textContent = 'S/. ' + ultimoValor.toFixed(2);
  document.getElementById('kardex-costo-prom').textContent = 'S/. ' + ultimoCosto.toFixed(2);
  document.getElementById('kardex-total-entradas').textContent = entradas.toFixed(0);
  document.getElementById('kardex-total-salidas').textContent = salidas.toFixed(0);
  document.getElementById('kardex-saldo-actual').textContent = saldo.toFixed(0);
  document.getElementById('kardex-valor-inv').textContent = 'S/. ' + ultimoValor.toFixed(2);
}

function filtrarKardex() {
  const desde = document.getElementById('kardex-fecha-desde').value;
  const hasta = document.getElementById('kardex-fecha-hasta').value;
  const tipo = document.getElementById('kardex-filtro-tipo').value;

  let filtrado = [...kardexData].reverse();
  if (desde) filtrado = filtrado.filter(r => r[1] >= desde);
  if (hasta) filtrado = filtrado.filter(r => r[1] <= hasta);
  if (tipo) filtrado = filtrado.filter(r => (r[4]||'') === tipo);

  renderKardex(filtrado);
}

async function cargarSelectorProductos() {
  const select = document.getElementById('ajuste-producto');
  select.innerHTML = '<option value="">Cargando productos...</option>';
  try {
    const rows = await obtenerDatosProtegidos('obtenerInventarios');
    if (rows) {
      select.innerHTML = '<option value="">Seleccionar producto...</option>' +
        rows.map(row => `<option value="${row[1]||''}" data-stock="${row[7]||0}" data-costo="${row[8]||0}">${row[2]||row[1]||'-'} (Stock: ${parseFloat(row[7]||0).toFixed(0)})</option>`).join('');
    }
  } catch(e) {
    select.innerHTML = '<option value="">Error al cargar</option>';
  }
}

function cargarStockActual() {
  const select = document.getElementById('ajuste-producto');
  const opt = select.options[select.selectedIndex];
  if (opt && opt.dataset.stock !== undefined) {
    document.getElementById('ajuste-stock-actual').value = parseFloat(opt.dataset.stock).toFixed(0);
    document.getElementById('ajuste-costo').value = parseFloat(opt.dataset.costo || 0).toFixed(2);
  }
}

function ajusteRapido(btn_o_codigo, stockActual) {
  const codigo = typeof btn_o_codigo === 'string' ? btn_o_codigo : btn_o_codigo.dataset.codigo;
  const stock = typeof btn_o_codigo === 'string' ? stockActual : parseFloat(btn_o_codigo.dataset.stock);
  mostrarFormAjuste();
  setTimeout(() => {
    const select = document.getElementById('ajuste-producto');
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === codigo) {
        select.selectedIndex = i;
        cargarStockActual();
        break;
      }
    }
  }, 500);
}

async function guardarAjuste() {
  const btn = document.getElementById('btn-guardar-ajuste');
  const msg = document.getElementById('ajuste-msg');
  const producto = document.getElementById('ajuste-producto').value;
  const tipo = document.getElementById('ajuste-tipo').value;
  const cantidad = parseFloat(document.getElementById('ajuste-cantidad').value) || 0;
  const motivo = document.getElementById('ajuste-motivo').value;

  if (!producto || !tipo || !cantidad || !motivo) {
    mostrarMensajeForm('ajuste-msg', 'error', '⚠️ Producto, tipo, cantidad y motivo son obligatorios.');
    return;
  }
  if (cantidad <= 0) {
    mostrarMensajeForm('ajuste-msg', 'error', '⚠️ La cantidad debe ser mayor a 0.');
    return;
  }

  btn.disabled=true; btn.textContent='⏳ Guardando...';

  try {
    const accessToken = await obtenerAccessToken();
    const stockActual = parseFloat(document.getElementById('ajuste-stock-actual').value) || 0;
    const costo = parseFloat(document.getElementById('ajuste-costo').value) || 0;
    const costoTotal = cantidad * costo;
    const saldoNuevo = tipo === 'ENTRADA' ? stockActual + cantidad : stockActual - cantidad;
    const valorNuevo = saldoNuevo * costo;
    const fecha = new Date().toISOString().split('T')[0];
    const idMov = 'KAR-AJU-' + Date.now();

    // Registrar en KARDEX
    const filaKardex = [
      idMov, fecha, producto,
      document.getElementById('ajuste-producto').options[document.getElementById('ajuste-producto').selectedIndex].text.split(' (Stock')[0],
      'AJUSTE', cantidad, costo, costoTotal,
      saldoNuevo, valorNuevo, motivo,
      document.getElementById('ajuste-observacion').value,
      'AJUSTE', 'ACTIVO'
    ];

    const urlKardex = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/KARDEX!A:N:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const respKardex = await fetch(urlKardex, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [filaKardex] })
    });

    if (!respKardex.ok) {
      await lanzarErrorSheets(respKardex);
    }

    mostrarMensajeForm('ajuste-msg', 'ok', '✅ Ajuste registrado correctamente. El sistema actualizará el inventario.');

    setTimeout(() => volverALista(), 2000);

  } catch(err) {
    mostrarMensajeForm('ajuste-msg', 'error', '❌ Error al guardar el ajuste: ' + err.message);
  } finally { btn.disabled=false; btn.textContent='💾 Registrar ajuste'; }
}

async function cargarConteoFisico() {
  const tbody = document.getElementById('conteo-tbody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:24px;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';
  try {
    const rows = await obtenerDatosProtegidos('obtenerInventarios');
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:32px; color:#A0AEC0;">Sin productos en inventario.</td></tr>'; return;
    }
    tbody.innerHTML = rows.map((row, i) => `<tr>
      <td><b>${row[2]||row[1]||'-'}</b><br><span style="font-size:0.72rem; color:#A0AEC0;">${row[1]||''}</span></td>
      <td style="font-weight:700; color:var(--azul-oscuro);">${parseFloat(row[7]||0).toFixed(0)}</td>
      <td><input type="number" id="conteo-${i}" class="form-input" min="0" step="1" placeholder="0" data-codigo="${row[1]||''}" data-sistema="${row[7]||0}" oninput="calcularDiferencia(${i})" style="width:100px;"></td>
      <td id="dif-${i}" style="font-weight:700;">-</td>
    </tr>`).join('');
  } catch(err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--rojo);">Error al cargar.</td></tr>';
  }
}

function calcularDiferencia(i) {
  const input = document.getElementById(`conteo-${i}`);
  const sistema = parseFloat(input.dataset.sistema) || 0;
  const fisico = parseFloat(input.value) || 0;
  const dif = fisico - sistema;
  const el = document.getElementById(`dif-${i}`);
  el.textContent = (dif >= 0 ? '+' : '') + dif.toFixed(0);
  el.style.color = dif > 0 ? 'var(--verde)' : dif < 0 ? 'var(--rojo)' : 'var(--gris-texto)';
}

async function procesarConteoFisico() {
  const btn = document.getElementById('btn-procesar-conteo');
  const msg = document.getElementById('conteo-msg');
  btn.disabled=true; btn.textContent='⏳ Procesando...';

  try {
    const accessToken = await obtenerAccessToken();
    const inputs = document.querySelectorAll('[id^="conteo-"]');
    let ajustes = 0;

    for (const input of inputs) {
      const fisico = parseFloat(input.value);
      if (isNaN(fisico)) continue;
      const sistema = parseFloat(input.dataset.sistema) || 0;
      const diferencia = fisico - sistema;
      if (diferencia === 0) continue;

      const codigo = input.dataset.codigo;
      const tipo = diferencia > 0 ? 'ENTRADA' : 'SALIDA';
      const cantidad = Math.abs(diferencia);
      const idMov = 'KAR-CNT-' + Date.now() + '-' + ajustes;
      const fecha = new Date().toISOString().split('T')[0];

      const filaKardex = [
        idMov, fecha, codigo, codigo, 'AJUSTE',
        cantidad, 0, 0, fisico, 0,
        'CONTEO FISICO', '', 'CONTEO', 'ACTIVO'
      ];

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/KARDEX!A:N:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [filaKardex] })
      });
      ajustes++;
    }

    msg.style.display='block'; msg.style.background='#F0FFF4'; msg.style.color='var(--verde)';
    msg.style.border='1px solid rgba(56,161,105,0.3)';
    msg.textContent=`✅ ${ajustes} ajuste(s) procesados correctamente.`;
    setTimeout(() => volverALista(), 2000);

  } catch(err) {
    msg.style.display='block'; msg.style.background='#FFF5F5'; msg.style.color='var(--rojo)';
    msg.style.border='1px solid #FED7D7'; msg.textContent='❌ Error al procesar conteo.';
  } finally { btn.disabled=false; btn.textContent='✅ Procesar ajustes'; }
}

function exportarInventarioExcel() {
  if (!inventarioData || inventarioData.length === 0) { alert('No hay datos para exportar.'); return; }
  var headers = ['Codigo','Descripcion','Entradas','Salidas','Stock Final','Costo Unitario','Valor Total'];
  var csv = 'sep=,\n' + headers.join(',') + '\n';
  var filas = [];
  inventarioData.forEach(function(row) {
    var stock = parseFloat(row[7]||0);
    var costo = parseFloat(row[8]||0);
    csv += (row[1]||'') + ',' + (row[2]||'') + ',' + (row[5]||0) + ',' + (row[6]||0) + ',' + stock + ',' + costo + ',' + (stock*costo).toFixed(2) + '\n';
    filas.push([row[1]||'', row[2]||'', row[5]||0, row[6]||0, stock, costo, parseFloat((stock*costo).toFixed(2))]);
  });
  exportarExcelConEstilo(headers, filas, 'inventario_' + new Date().toISOString().split('T')[0] + '.xlsx', 'Inventario', csv);
}

function exportarInventarioPDF() {
  window.print();
}

function exportarKardexExcel() {
  if (!kardexData || kardexData.length === 0) { alert('No hay datos de Kardex para exportar.'); return; }
  var headers = ['ID','Fecha','Codigo','Nombre','Tipo','Cantidad','Costo Unit','Costo Total','Saldo Und','Saldo Valor','Motivo','Observacion','Origen','Estado'];
  var csv = 'sep=,\n' + headers.join(',') + '\n';
  kardexData.forEach(function(row) { csv += row.join(',') + '\n'; });
  exportarExcelConEstilo(headers, kardexData, 'kardex_' + (kardexProductoActual ? kardexProductoActual.codigo : '') + '_' + new Date().toISOString().split('T')[0] + '.xlsx', 'Kardex', csv);
}

function exportarKardexPDF() { window.print(); }
