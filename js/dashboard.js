// ══ DASHBOARD ════════════════════════════════════════════════════════════

async function cargarDashboard() {
  // Mostrar loading
  document.getElementById('kpi-grid').innerHTML = '<div class="loading"><div class="spinner"></div> Cargando indicadores...</div>';
  document.getElementById('chart-container').innerHTML = '<div class="loading"><div class="spinner"></div> Cargando...</div>';
  document.getElementById('alertas-container').innerHTML = '<div class="loading"><div class="spinner"></div> Cargando...</div>';

  try {
    const datos = await leerDashboardDesdeSheets();
    renderKPIs(datos);
    renderChart(datos);
    renderAlertas(datos);
    document.getElementById('dash-periodo').textContent =
      'Período: ' + datos.periodo + ' · Última actualización: ' + new Date().toLocaleTimeString('es-PE');
  } catch (err) {
    console.error('Error cargando dashboard:', err);
    // Fallback con datos de ejemplo si falla la API
    const datos = {
      periodo: obtenerPeriodoActual(),
      saldoTesoreria: 0, cxcPendiente: 0, cxpPendiente: 0,
      ventasMes: 0, comprasMes: 0, planillaMes: 0,
      utilidadBruta: 0, alertasVencimiento: 0, alertasAjustes: 0
    };
    renderKPIs(datos);
    renderChart(datos);
    renderAlertas(datos);
    document.getElementById('dash-periodo').textContent =
      'Error al cargar datos — verifica la conexión';
  }
}

async function leerDashboardDesdeSheets() {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;
  const key = `?key=${API_KEY}`;

  // Leer hoja DASHBOARD fila 2
  const [dashResp, tesoreriaResp, comprasResp, ventasResp, planillaResp] = await Promise.all([
    fetch(`${base}/DASHBOARD!A2:K2${key}`),
    fetch(`${base}/TESORERIA!A1:K1${key}`),
    fetch(`${base}/REGISTRO%20DE%20COMPRAS!A1:T1${key}`),
    fetch(`${base}/REGISTRO%20DE%20VENTAS!A1:T1${key}`),
    fetch(`${base}/PLANILLA!A1:Z1${key}`)
  ]);

  const dashData = await dashResp.json();
  const row = dashData.values ? dashData.values[0] : [];

  // Columnas DASHBOARD:
  // A=SALDO TES, B=CXC, C=CXP, D=VENTAS MES, E=COMPRAS MES,
  // F=PLANILLA MES, G=UTILIDAD BRUTA, H=ALERTAS VENC, I=ALERTAS AJUSTES,
  // J=PERIODO, K=FECHA ACT

  const parse = (val) => parseFloat((val || '0').toString().replace(',', '.')) || 0;

  return {
    periodo: row[9] || obtenerPeriodoActual(),
    saldoTesoreria: parse(row[0]),
    cxcPendiente: parse(row[1]),
    cxpPendiente: parse(row[2]),
    ventasMes: parse(row[3]),
    comprasMes: parse(row[4]),
    planillaMes: parse(row[5]),
    utilidadBruta: parse(row[6]),
    alertasVencimiento: parse(row[7]),
    alertasAjustes: parse(row[8])
  };
}

function obtenerPeriodoActual() {
  const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const ahora = new Date();
  return meses[ahora.getMonth()] + ' ' + ahora.getFullYear();
}

function renderKPIs(d) {
  const kpis = [
    { label: 'Saldo Tesorería', value: formatMonto(d.saldoTesoreria), icon: '🏦', tipo: d.saldoTesoreria >= 0 ? 'verde' : 'rojo', sub: 'Efectivo + banco disponible' },
    { label: 'Ventas del mes', value: formatMonto(d.ventasMes), icon: '💰', tipo: 'azul', sub: 'Ingresos del período actual' },
    { label: 'Compras del mes', value: formatMonto(d.comprasMes), icon: '🛒', tipo: 'amarillo', sub: 'Egresos por compras' },
    { label: 'Utilidad bruta', value: formatMonto(d.utilidadBruta), icon: '📈', tipo: d.utilidadBruta >= 0 ? 'verde' : 'rojo', sub: 'Ventas - Compras - Planilla' },
    { label: 'Ctas. por cobrar', value: formatMonto(d.cxcPendiente), icon: '📋', tipo: d.cxcPendiente > 0 ? 'amarillo' : 'verde', sub: 'Ventas crédito pendientes' },
    { label: 'Ctas. por pagar', value: formatMonto(d.cxpPendiente), icon: '📋', tipo: d.cxpPendiente > 0 ? 'amarillo' : 'verde', sub: 'Compras crédito pendientes' },
    { label: 'Alertas vencim.', value: d.alertasVencimiento, icon: '🔔', tipo: d.alertasVencimiento > 0 ? 'rojo' : 'verde', sub: 'Vencen en próximos 7 días' },
    { label: 'Ajustes planilla', value: d.alertasAjustes, icon: '👥', tipo: d.alertasAjustes > 0 ? 'rojo' : 'verde', sub: 'Trabajadores con ajuste pendiente' },
  ];

  const grid = document.getElementById('kpi-grid');
  grid.innerHTML = kpis.map(k => `
    <div class="kpi-card ${k.tipo}">
      <div class="kpi-icon ${k.tipo}">${k.icon}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.tipo === 'rojo' ? 'negativo' : k.tipo === 'verde' ? 'positivo' : ''}">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join('');
}

function renderChart(d) {
  const maxVal = Math.max(d.ventasMes, d.comprasMes, d.planillaMes, 100);
  const barras = [
    { label: 'Ventas', val: d.ventasMes, color: 'var(--azul-grad)' },
    { label: 'Compras', val: d.comprasMes, color: 'linear-gradient(180deg, #D69E2E, #F6E05E)' },
    { label: 'Planilla', val: d.planillaMes, color: 'linear-gradient(180deg, #38A169, #68D391)' },
  ];

  document.getElementById('chart-container').innerHTML = barras.map(b => `
    <div class="chart-bar-wrap">
      <div class="chart-bar-val">${formatMonto(b.val)}</div>
      <div class="chart-bar-outer" style="height:140px;">
        <div class="chart-bar-inner" style="height:${Math.max((b.val/maxVal)*100,2)}%; background:${b.color};"></div>
      </div>
      <div class="chart-bar-label">${b.label}</div>
    </div>
  `).join('');
}

function renderAlertas(d) {
  const alertas = [];

  if (d.alertasVencimiento > 0) {
    alertas.push({ tipo: 'rojo', texto: `<strong>${d.alertasVencimiento} factura(s)</strong> vencen en los próximos 7 días`, time: 'Urgente' });
  }
  if (d.cxpPendiente > 0) {
    alertas.push({ tipo: 'amarillo', texto: `Tienes <strong>${formatMonto(d.cxpPendiente)}</strong> pendiente de pago a proveedores`, time: 'Pendiente' });
  }
  if (d.alertasAjustes > 0) {
    alertas.push({ tipo: 'azul', texto: `<strong>${d.alertasAjustes} trabajador(es)</strong> con ajuste de planilla pendiente`, time: 'Revisar' });
  }
  if (d.saldoTesoreria < 0) {
    alertas.push({ tipo: 'rojo', texto: `Saldo de tesorería <strong>negativo</strong> — revisar flujo de caja`, time: 'Crítico' });
  }

  const container = document.getElementById('alertas-container');
  if (alertas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>Sin alertas pendientes.<br>Todo está al día.</p>
      </div>`;
    return;
  }

  container.innerHTML = alertas.map(a => `
    <div class="alerta-item">
      <div class="alerta-dot ${a.tipo}"></div>
      <div>
        <div class="alerta-texto">${a.texto}</div>
        <div class="alerta-time">${a.time}</div>
      </div>
    </div>
  `).join('');
}

function formatMonto(val) {
  const num = parseFloat(val) || 0;
  return 'S/. ' + num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
