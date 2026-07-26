// ══ MÓDULO DE VENTAS ═════════════════════════════════════════════════════

let streamEscaner = null;

let scannerInterval = null;

function mostrarFormVenta() {
  document.getElementById('form-venta-container').style.display = 'block';
  // Fecha de hoy por defecto
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('v-fecha').value = hoy;
  document.getElementById('v-estado-cobro').value = 'PENDIENTE';
  toggleCreditoVenta();
  cargarProductos();
  cargarClientes();
  cargarListaVentas();
}

function cerrarFormVenta() {
  document.getElementById('form-venta-container').style.display = 'none';
  detenerEscaner();
  limpiarFormVenta();
}

function limpiarFormVenta() {
  ['v-fecha','v-fecha-venc','v-numero','v-nombre','v-ruc','v-producto',
   'v-codigo-barras','v-cantidad','v-precio','v-dias-credito',
   'v-requiere-revision','v-snapshot','v-estado-venc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('v-tipo-comprobante').value = '';
  document.getElementById('v-forma-pago').value = 'EFECTIVO';
  document.getElementById('v-tipo-pago').value = 'CONTADO';
  document.getElementById('v-estado-cobro').value = 'PENDIENTE';
  document.getElementById('v-dias-credito-group').style.display = 'none';
  document.getElementById('v-subtotal').textContent = 'S/. 0.00';
  document.getElementById('v-igv').textContent = 'S/. 0.00';
  document.getElementById('v-total').textContent = 'S/. 0.00';
  const msg = document.getElementById('venta-msg');
  if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
}

function toggleCreditoVenta() {
  const tipo = document.getElementById('v-tipo-pago').value;
  document.getElementById('v-dias-credito-group').style.display = tipo === 'CREDITO' ? 'block' : 'none';
  document.getElementById('v-estado-cobro').value = tipo === 'CREDITO' ? 'PENDIENTE' : 'COBRADO';
}

function calcularTotalesVenta() {
  const cantidad = parseFloat(document.getElementById('v-cantidad').value) || 0;
  const precio = parseFloat(document.getElementById('v-precio').value) || 0;
  const subtotal = Math.round(cantidad * precio * 100) / 100;
  const igv = Math.round(subtotal * 0.18 * 100) / 100;
  const total = Math.round((subtotal + igv) * 100) / 100;

  document.getElementById('v-subtotal').textContent = 'S/. ' + subtotal.toFixed(2);
  document.getElementById('v-igv').textContent = 'S/. ' + igv.toFixed(2);
  document.getElementById('v-total').textContent = 'S/. ' + total.toFixed(2);

  // Snapshot
  const snapshot = cantidad + '|' + precio + '|' + total;
  document.getElementById('v-snapshot').value = snapshot;
}

async function iniciarEscaner() {
  try {
    document.getElementById('scanner-container').style.display = 'block';
    document.getElementById('btn-iniciar-scan').style.display = 'none';
    document.getElementById('btn-detener-scan').style.display = 'inline-flex';

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    streamEscaner = stream;
    const video = document.getElementById('scanner-video');
    video.srcObject = stream;

    // Usar BarcodeDetector si está disponible (Chrome/Edge)
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'] });
      scannerInterval = setInterval(async () => {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const codigo = barcodes[0].rawValue;
            document.getElementById('v-codigo-barras').value = codigo;
            const encontrado = await buscarProductoPorCodigo(codigo);
            if (encontrado) detenerEscaner();
          }
        } catch(e) {}
      }, 500);
    } else {
      // Fallback: mostrar mensaje de ingreso manual
      mostrarScanResultado('⚠️ Escáner automático no disponible en este navegador. Ingresa el código manualmente.', false);
    }
  } catch(err) {
    mostrarScanResultado('❌ No se pudo acceder a la cámara. Verifica los permisos.', false);
    detenerEscaner();
  }
}

function detenerEscaner() {
  if (streamEscaner) {
    streamEscaner.getTracks().forEach(t => t.stop());
    streamEscaner = null;
  }
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
  }
  document.getElementById('scanner-container').style.display = 'none';
  document.getElementById('btn-iniciar-scan').style.display = 'inline-flex';
  document.getElementById('btn-detener-scan').style.display = 'none';
}

function mostrarScanResultado(msg, exito = true) {
  const el = document.getElementById('scan-resultado');
  el.style.display = 'block';
  el.style.color = exito ? 'var(--verde)' : 'var(--rojo)';
  el.style.borderColor = exito ? 'rgba(56,161,105,0.3)' : 'rgba(229,62,62,0.3)';
  el.textContent = msg;
  if (exito) setTimeout(() => { el.style.display = 'none'; }, 3000);
}

async function guardarVenta() {
  const btn = document.getElementById('btn-guardar-venta');
  const msg = document.getElementById('venta-msg');

  // Validar campos obligatorios
  const fecha = document.getElementById('v-fecha').value;
  const tipoComp = document.getElementById('v-tipo-comprobante').value;
  const nombre = document.getElementById('v-nombre').value.trim();
  const producto = document.getElementById('v-producto').value.trim();
  const cantidad = document.getElementById('v-cantidad').value;
  const precio = document.getElementById('v-precio').value;

  if (!fecha || !tipoComp || !nombre || !producto || !cantidad || !precio) {
    mostrarMensajeForm('venta-msg', 'error', '⚠️ Completa los campos obligatorios marcados con *');
    return;
  }
  if (parseFloat(cantidad) <= 0 || parseFloat(precio) <= 0) {
    mostrarMensajeForm('venta-msg', 'error', '⚠️ La cantidad y el precio deben ser mayores a 0.');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Guardando...';

  try {
    const subtotalNum = parseFloat(document.getElementById('v-subtotal').textContent.replace('S/. ', '')) || 0;
    const igvNum = parseFloat(document.getElementById('v-igv').textContent.replace('S/. ', '')) || 0;
    const totalNum = parseFloat(document.getElementById('v-total').textContent.replace('S/. ', '')) || 0;
    const tipoPago = document.getElementById('v-tipo-pago').value;
    const estadoCobro = tipoPago === 'CREDITO' ? 'PENDIENTE' : 'COBRADO';
    const snapshot = cantidad + '|' + precio + '|' + totalNum;

    // Fila a insertar: columnas A-Z según estructura
    // ID VENTA(A), N°CORR(B) → vacíos (Apps Script los llena)
    // C=Fecha emisión, D=Fecha venc, E=Tipo comp, F=Número,
    // G=Nombre, H=RUC, I=Producto, J=Cantidad, K=Precio,
    // L=Subtotal, M=IGV, N=Total, O=Forma pago,
    // P=CUENTA(vacío), Q=PROCESADO(vacío), R=ASIENTO(vacío), S=PROCESADO TES(vacío),
    // T=Requiere revisión, U=Snapshot, V=Tipo pago, W=Estado cobro,
    // X=Días crédito, Y=Fecha vencimiento(vacío), Z=Estado vencimiento(vacío)

    const fila = [
      '', // A - ID VENTA (Apps Script)
      '', // B - N°CORR (Apps Script)
      fecha, // C
      document.getElementById('v-fecha-venc').value, // D
      tipoComp, // E
      '', // F - Número (Apps Script lo asigna con candado, evita duplicados si dos ventas se guardan casi al mismo tiempo)
      nombre, // G
      document.getElementById('v-ruc').value, // H
      producto, // I
      cantidad, // J
      precio, // K
      subtotalNum, // L
      igvNum, // M
      totalNum, // N
      document.getElementById('v-forma-pago').value, // O
      '', // P - CUENTA (sistema)
      '', // Q - PROCESADO (sistema)
      '', // R - ASIENTO (sistema)
      '', // S - PROCESADO TES (sistema)
      document.getElementById('v-requiere-revision').value, // T
      snapshot, // U
      tipoPago, // V
      estadoCobro, // W
      document.getElementById('v-dias-credito').value || '', // X
      '', // Y - FECHA VENCIMIENTO (sistema)
      ''  // Z - ESTADO VENCIMIENTO (sistema)
    ];

    // Usar Google Apps Script Web App para escribir en el Sheet
    // Por ahora usamos el endpoint de Sheets API con token OAuth del usuario
    const accessToken = await obtenerAccessToken();

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/REGISTRO%20DE%20VENTAS!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [fila] })
    });

    if (resp.ok) {
      mostrarMensajeForm('venta-msg', 'ok', '✅ Venta guardada correctamente. El sistema la procesará en segundos.');
      limpiarFormVenta();
      setTimeout(() => cargarListaVentas(), 2000);
    } else {
      await lanzarErrorSheets(resp);
    }
  } catch(err) {
    mostrarMensajeForm('venta-msg', 'error', '❌ Error al guardar la venta: ' + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Guardar Venta';
  }
}

let ventasData = [];

async function cargarListaVentas() {
  const tbody = document.getElementById('ventas-tbody');
  const count = document.getElementById('ventas-count');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:24px; color:#A0AEC0;"><div class="loading"><div class="spinner"></div> Cargando...</div></td></tr>';

  try {
    const rows = await obtenerDatosProtegidos('obtenerVentas');

    if (!rows || rows.length === 0) {
      ventasData = [];
      tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:32px; color:#A0AEC0;">No hay ventas registradas aún.</td></tr>';
      if (count) count.textContent = '0 registros';
      return;
    }

    ventasData = rows;
    renderVentas(ventasData);

  } catch(err) {
    tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; padding:32px; color:var(--rojo);">❌ ${err.message}</td></tr>`;
    console.error(err);
  }
}

function renderVentas(rows) {
  const tbody = document.getElementById('ventas-tbody');
  const count = document.getElementById('ventas-count');
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:32px; color:#A0AEC0;">Sin resultados para este filtro.</td></tr>';
    if (count) count.textContent = '0 registros';
    return;
  }

  if (count) count.textContent = rows.length + ' registro(s)';

  tbody.innerHTML = rows.map(row => {
    const estadoCobro = (row[22] || '').trim();
    const tipoPago = (row[21] || '').trim();
    let badgeCobro = '';
    if (estadoCobro === 'COBRADO') badgeCobro = '<span class="badge badge-verde">COBRADO</span>';
    else if (estadoCobro === 'PENDIENTE') badgeCobro = '<span class="badge badge-amarillo">PENDIENTE</span>';
    else badgeCobro = '<span class="badge badge-azul">' + (estadoCobro || '-') + '</span>';

    let badgeTipo = tipoPago === 'CREDITO'
      ? '<span class="badge badge-rojo">CRÉDITO</span>'
      : '<span class="badge badge-verde">CONTADO</span>';

    return `<tr>
      <td>${row[2] || '-'}</td>
      <td>${row[4] || '-'}</td>
      <td>${row[5] || '-'}</td>
      <td>${row[6] || '-'}</td>
      <td>${row[8] || '-'}</td>
      <td>${row[9] || '-'}</td>
      <td>S/. ${parseFloat(row[10] || 0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[11] || 0).toFixed(2)}</td>
      <td>S/. ${parseFloat(row[12] || 0).toFixed(2)}</td>
      <td><b>S/. ${parseFloat(row[13] || 0).toFixed(2)}</b></td>
      <td>${row[14] || '-'}</td>
      <td>${badgeTipo}</td>
      <td>${badgeCobro}</td>
      <td>${row[23] || '-'}</td>
      <td>${row[24] || '-'}</td>
      <td>${row[25] || '-'}</td>
    </tr>`;
  }).join('');
}

function filtrarVentas() {
  const texto = (document.getElementById('v-filtro-texto').value || '').toLowerCase();
  const estado = document.getElementById('v-filtro-estado').value;

  const filtrado = ventasData.filter(row => {
    const comprobante = (row[5]||'').toString().toLowerCase();
    const cliente = (row[6]||'').toString().toLowerCase();
    const producto = (row[8]||'').toString().toLowerCase();
    const matchTexto = !texto || comprobante.includes(texto) || cliente.includes(texto) || producto.includes(texto);

    const estadoCobro = (row[22]||'').toString().trim();
    const matchEstado = !estado || estadoCobro === estado;

    return matchTexto && matchEstado;
  });

  renderVentas(filtrado);
}

function exportarVentasExcel() {
  if (!ventasData || ventasData.length === 0) { alert('No hay datos para exportar.'); return; }
  var headers = ['Fecha','Comprobante','Cliente','Producto','Cantidad','Subtotal','IGV','Total','Forma Pago','Tipo Pago','Estado Cobro'];
  var csv = 'sep=,\n' + headers.join(',') + '\n';
  var filas = [];
  ventasData.forEach(function(row) {
    csv += (row[2]||'') + ',' + (row[5]||'') + ',' + (row[6]||'') + ',' + (row[8]||'') + ',' + (row[9]||'') + ',' +
      parseFloat(row[10]||0).toFixed(2) + ',' + parseFloat(row[11]||0).toFixed(2) + ',' + parseFloat(row[13]||0).toFixed(2) + ',' +
      (row[14]||'') + ',' + (row[21]||'') + ',' + (row[22]||'') + '\n';
    filas.push([row[2]||'', row[5]||'', row[6]||'', row[8]||'', row[9]||'', parseFloat(row[10]||0), parseFloat(row[11]||0), parseFloat(row[13]||0), row[14]||'', row[21]||'', row[22]||'']);
  });
  exportarExcelConEstilo(headers, filas, 'ventas_' + new Date().toISOString().split('T')[0] + '.xlsx', 'Ventas', csv);
}

function exportarVentasPDF() {
  window.print();
}


// ══ NÚMERO DE COMPROBANTE AUTOMÁTICO ════════════════════════════════════

async function generarNumeroComprobante() {
  const tipo = document.getElementById('v-tipo-comprobante').value;
  if (!tipo) return;

  const series = {
    'FACTURA': 'F001',
    'BOLETA': 'B001',
    'TICKET': 'T001',
    'NOTA DE CREDITO': 'NC01',
    'NOTA DE DEBITO': 'ND01'
  };

  const serie = series[tipo];
  if (!serie) return;

  const campoNumero = document.getElementById('v-numero');
  campoNumero.value = 'Generando...';

  try {
    const rows = await obtenerDatosProtegidos('obtenerVentas');

    let maxCorr = 0;
    if (rows) {
      rows.forEach(row => {
        const num = (row[5] || '').toString();
        if (num.startsWith(serie)) {
          const partes = num.split('-');
          if (partes.length === 2) {
            const n = parseInt(partes[1], 10);
            if (!isNaN(n) && n > maxCorr) maxCorr = n;
          }
        }
      });
    }

    const siguiente = maxCorr + 1;
    const numeroFinal = serie + '-' + ('00000000' + siguiente).slice(-8);
    campoNumero.value = numeroFinal;
  } catch(err) {
    campoNumero.value = serie + '-00000001';
    console.error('Error generando número:', err);
  }
}


// ══ BUSCAR CLIENTE POR RUC/DNI ══════════════════════════════════════════

let clientesCache = [];

async function cargarClientes() {
  if (clientesCache.length > 0) return;
  try {
    const rows = await obtenerDatosProtegidos('obtenerClientes');
    if (rows) {
      clientesCache = rows.map(row => ({
        codigo: (row[0] || '').toString().trim(),
        nombre: (row[1] || '').toString().trim(),
        ruc: (row[2] || '').toString().trim(),
        direccion: (row[3] || '').toString().trim()
      }));
    }
  } catch(e) {
    console.error('Error cargando clientes:', e);
  }
}

function buscarCliente(rucDni) {
  if (!rucDni || rucDni.length < 8) return;
  
  if (clientesCache.length === 0) {
    cargarClientes().then(() => buscarCliente(rucDni));
    return;
  }

  const busqueda = rucDni.toString().trim();
  const cliente = clientesCache.find(c => 
    c.ruc === busqueda || c.codigo === busqueda
  );

  if (cliente) {
    document.getElementById('v-nombre').value = cliente.nombre;
    document.getElementById('v-nombre').style.background = '#F0FFF4';
    document.getElementById('v-nombre').style.borderColor = 'var(--verde)';
  } else {
    document.getElementById('v-nombre').style.background = '';
    document.getElementById('v-nombre').style.borderColor = '';
  }
}
