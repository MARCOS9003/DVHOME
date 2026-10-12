const API_URL = "https://script.google.com/macros/s/AKfycbxZ0ZUpiwGT-_c67PJM6mOEkr_e6zrQf3RCUbc7EyP2QtaWLoH-PImuysHbSM9eHeoOsQ/exec";
const DEFAULT_USERS = ["Marcos", "Jimena", "Mamá", "Papá", "Patricia"];

const UMBRALES = {
    "Pasear perro": 2,
    "Lavar perro": 60,
    "Hacer Cocina": 7,
    "Poner Mesa": 14,
    "Bajar basura": 14,
    "Lavaplatos": 3,
    "Tender Lavadora": 7,
    "Lavar coche (por fuera)": 30,
    "Limpiar coche (interior)": 30
};

let tareasBase = [
    { nombre: "Pasear perro", puntos: 1 },
    { nombre: "Lavar coche (por fuera)", puntos: 1 },
    { nombre: "Limpiar coche (interior)", puntos: 1 },
    { nombre: "Hacer Cocina", puntos: 1 },
    { nombre: "Lavar perro", puntos: 1 },
    { nombre: "Poner Mesa", puntos: 1 },
    { nombre: "Bajar basura", puntos: 1 },
    { nombre: "Lavaplatos", puntos: 1 },
    { nombre: "Tender Lavadora", puntos: 1 }
];

let tareasGuardadas = [];
try {
    const rawTareas = localStorage.getItem('dvhome_tareas');
    if (rawTareas) tareasGuardadas = JSON.parse(rawTareas);
} catch(e) { console.error("Error leyendo caché de tareas"); }

let tareas = (Array.isArray(tareasGuardadas) && tareasGuardadas.length > 0) ? tareasGuardadas : tareasBase;

if (Array.isArray(tareas)) {
    const nuevas = ["Lavar coche (por fuera)", "Limpiar coche (interior)"];
    nuevas.forEach(n => {
        if (!tareas.find(t => t.nombre === n)) tareas.push({nombre: n, puntos: 1});
    });
    const idxPerro = tareas.findIndex(t => t.nombre === "Pasear perro");
    if (idxPerro > 0) {
        const perro = tareas.splice(idxPerro, 1)[0];
        tareas.unshift(perro);
    }
    localStorage.setItem('dvhome_tareas', JSON.stringify(tareas));
}

let registros = [];
let reservas = [];
try {
    const rawReservas = localStorage.getItem('dvhome_reservas_cache');
    if(rawReservas) reservas = JSON.parse(rawReservas);
    if(!Array.isArray(reservas)) reservas = [];
} catch(e) {}

let miUsuario = localStorage.getItem('dvhome_mi_usuario') || "Marcos";
let vistaTurnos = 'agenda';
let fechaCalendario = new Date();

document.addEventListener('DOMContentLoaded', () => {
    try {
        document.getElementById('select-tarea').addEventListener('change', (e) => {
            const groupTurno = document.getElementById('group-turno');
            if(groupTurno) groupTurno.style.display = (e.target.value === 'Pasear perro') ? 'block' : 'none';
        });
        initSelects();
    } catch(e) { console.error("Error iniciando selects", e); }
    
    cargarDatosDesdeGoogle();
});

async function cargarDatosDesdeGoogle() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data.status === 'success') {
            registros = (data.registros || [])
                .filter(row => row && row[0]) 
                .map(row => ({
                    id: row[0], fecha: row[1] || new Date().toISOString(), tarea: row[2] || "", persona: row[3] || "", puntos: Number(row[4] || 0), turno: row[5] || "" 
                })).reverse(); 
            localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));

            if (data.turnos) {
                reservas = (data.turnos || [])
                    .filter(row => row && row[0])
                    .map(row => ({
                        id: row[0], fecha: row[1] || new Date().toISOString(), espacio: row[2] || "", persona: row[3] || "", turno: row[4] || ""
                    })).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
                localStorage.setItem('dvhome_reservas_cache', JSON.stringify(reservas));
            }
        }
    } catch (error) {
        try { registros = JSON.parse(localStorage.getItem('dvhome_registros_cache')) || []; } catch(e){ registros = []; }
        try { reservas = JSON.parse(localStorage.getItem('dvhome_reservas_cache')) || []; } catch(e){ reservas = []; }
    } finally {
        renderAll();
    }
}

function renderAll() {
    try { renderRanking(); } catch(e) {}
    try { renderHistorial(); } catch(e) {}
    try { renderSugerencias(); } catch(e) {}
    try { renderDetalles(); } catch(e) {}
    try { renderTurnos(); } catch(e) {}
}

function navigate(viewId, tabElement) {
    try {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        const targetView = document.getElementById(viewId);
        if(targetView) targetView.classList.add('active');

        if (tabElement) {
            document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
            tabElement.classList.add('active');
        }
    } catch(e) {}
}

function initSelects() {
    const selectPersona = document.getElementById('select-persona');
    const selectMiUsuario = document.getElementById('select-mi-usuario');
    const selectDetalleTarea = document.getElementById('select-detalle-tarea');

    if(selectPersona) selectPersona.innerHTML = '';
    if(selectMiUsuario) selectMiUsuario.innerHTML = '';

    DEFAULT_USERS.forEach(user => {
        if(selectPersona) {
            let opt1 = document.createElement('option');
            opt1.value = user; opt1.textContent = user;
            selectPersona.appendChild(opt1);
        }

        if(selectMiUsuario) {
            let opt2 = document.createElement('option');
            opt2.value = user; opt2.textContent = user;
            if (user === miUsuario) opt2.selected = true;
            selectMiUsuario.appendChild(opt2);
        }
    });

    if(selectMiUsuario) {
        selectMiUsuario.addEventListener('change', (e) => {
            miUsuario = e.target.value;
            localStorage.setItem('dvhome_mi_usuario', miUsuario);
            try { renderSugerencias(); } catch(err){}
        });
    }

    if(selectDetalleTarea) selectDetalleTarea.addEventListener('change', renderDetalles);
    actualizarDesplegableTareas();
}

function actualizarDesplegableTareas() {
    const selectTarea = document.getElementById('select-tarea');
    const selectDetalleTarea = document.getElementById('select-detalle-tarea');
    if(selectTarea) selectTarea.innerHTML = '';
    if(selectDetalleTarea) selectDetalleTarea.innerHTML = '';

    if (Array.isArray(tareas)) {
        tareas.forEach(task => {
            if(selectTarea) {
                let opt = document.createElement('option');
                opt.value = task.nombre;
                opt.textContent = `${task.nombre} (${task.puntos} pts)`;
                selectTarea.appendChild(opt);
            }
            if(selectDetalleTarea) {
                let optDetalle = document.createElement('option');
                optDetalle.value = task.nombre;
                optDetalle.textContent = task.nombre;
                selectDetalleTarea.appendChild(optDetalle);
            }
        });
    }
    if(selectTarea) selectTarea.dispatchEvent(new Event('change'));
}

document.getElementById('form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    const persona = document.getElementById('select-persona').value;
    const tareaNombre = document.getElementById('select-tarea').value;
    const fechaManual = document.getElementById('input-fecha').value;
    const tareaInfo = tareas.find(t => t.nombre === tareaNombre) || {puntos: 1};

    let fechaRegistro;
    let turnoSeleccionado = "";

    if (tareaNombre === 'Pasear perro') {
        turnoSeleccionado = document.getElementById('select-turno').value;
        const fechaBase = fechaManual ? new Date(fechaManual) : new Date();

        if (turnoSeleccionado === "Mañana") fechaBase.setHours(10, 0, 0);
        else if (turnoSeleccionado === "Tarde") fechaBase.setHours(17, 0, 0);
        else if (turnoSeleccionado === "Noche") fechaBase.setHours(22, 0, 0);

        fechaRegistro = fechaBase.toISOString();
    } else {
        fechaRegistro = fechaManual ? new Date(fechaManual).toISOString() : new Date().toISOString();
    }

    const nuevoRegistro = {
        id: Date.now(),
        fecha: fechaRegistro,
        persona: persona,
        tarea: tareaNombre,
        puntos: Number(tareaInfo.puntos),
        turno: turnoSeleccionado
    };

    registros.unshift(nuevoRegistro);
    localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));

    document.getElementById('input-fecha').value = "";
    document.getElementById('select-turno').value = "Mañana";

    renderAll();
    const tabInicio = document.querySelectorAll('.tab-item')[0];
    if(tabInicio) navigate('view-ranking', tabInicio);

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ tipo: 'nuevo_registro', ...nuevoRegistro })
        });
    } catch (error) {}
});

document.getElementById('form-nueva-tarea').addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('input-nueva-tarea').value;
    const puntos = document.getElementById('input-puntos-tarea').value;
    tareas.push({ nombre: nombre, puntos: Number(puntos) });
    localStorage.setItem('dvhome_tareas', JSON.stringify(tareas));
    actualizarDesplegableTareas();
    document.getElementById('modal-nueva-tarea').style.display = 'none';
    document.getElementById('form-nueva-tarea').reset();
    renderAll();
});

function abrirModalEditar(id) {
    const reg = registros.find(r => r.id === id);
    if (!reg) return;

    document.getElementById('edit-id').value = reg.id;
    const selectPersona = document.getElementById('edit-persona');
    selectPersona.innerHTML = '';
    DEFAULT_USERS.forEach(user => {
        let opt = document.createElement('option');
        opt.value = user; opt.textContent = user;
        if(user === reg.persona) opt.selected = true;
        selectPersona.appendChild(opt);
    });

    if (reg.tarea === 'Pasear perro') {
        document.getElementById('edit-group-turno').style.display = 'block';
        document.getElementById('edit-turno').value = reg.turno || 'Mañana';
    } else {
        document.getElementById('edit-group-turno').style.display = 'none';
    }

    try {
        const d = new Date(reg.fecha);
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, 16);
        document.getElementById('edit-fecha').value = localISOTime;
    } catch(e) {}

    document.getElementById('modal-editar-registro').style.display = 'block';
}

document.getElementById('form-editar-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-id').value);
    const persona = document.getElementById('edit-persona').value;
    const fechaManual = document.getElementById('edit-fecha').value;
    
    const idx = registros.findIndex(r => r.id === id);
    if (idx === -1) return;

    registros[idx].persona = persona;
    registros[idx].fecha = new Date(fechaManual).toISOString();
    if (registros[idx].tarea === 'Pasear perro') registros[idx].turno = document.getElementById('edit-turno').value;

    localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));
    document.getElementById('modal-editar-registro').style.display = 'none';
    renderAll();

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ tipo: 'editar_registro', id: id, persona: persona, fecha: registros[idx].fecha, turno: registros[idx].turno })
        });
    } catch(e) {}
});

document.getElementById('btn-eliminar-registro').addEventListener('click', async () => {
    if(confirm("¿Seguro que quieres borrar este registro?")) {
        const id = parseInt(document.getElementById('edit-id').value);
        registros = registros.filter(r => r.id !== id);
        localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));
        document.getElementById('modal-editar-registro').style.display = 'none';
        renderAll();
        
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ tipo: 'eliminar_registro', id: id })
            });
        } catch(e) {}
    }
});

// --- SISTEMA DE TURNOS Y CALENDARIO ---
function abrirModalTurno() {
    const selectPersona = document.getElementById('turno-persona');
    selectPersona.innerHTML = '';
    DEFAULT_USERS.forEach(user => {
        let opt = document.createElement('option');
        opt.value = user; opt.textContent = user;
        if(user === miUsuario) opt.selected = true;
        selectPersona.appendChild(opt);
    });
    
    try {
        const hoy = new Date();
        const tzOffset = hoy.getTimezoneOffset() * 60000;
        const localISO = new Date(hoy - tzOffset).toISOString().split('T')[0];
        document.getElementById('turno-fecha').value = localISO;
    } catch(e){}
    
    document.getElementById('modal-reservar-turno').style.display = 'block';
}

document.getElementById('form-nuevo-turno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevaReserva = {
        id: Date.now(),
        persona: document.getElementById('turno-persona').value,
        espacio: document.getElementById('turno-espacio').value,
        turno: document.getElementById('turno-horario').value,
        fecha: document.getElementById('turno-fecha').value
    };

    reservas.push(nuevaReserva);
    reservas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    localStorage.setItem('dvhome_reservas_cache', JSON.stringify(reservas));
    
    document.getElementById('modal-reservar-turno').style.display = 'none';
    renderTurnos();

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ tipo: 'nuevo_turno', ...nuevaReserva })
        });
    } catch (error) {}
});

// NUEVO: Funciones de EDICIÓN DE TURNOS
function abrirModalEditarTurno(id) {
    const reserva = reservas.find(r => r.id === id);
    if (!reserva) return;

    document.getElementById('edit-turno-id').value = reserva.id;
    
    const selectPersona = document.getElementById('edit-turno-persona');
    selectPersona.innerHTML = '';
    DEFAULT_USERS.forEach(user => {
        let opt = document.createElement('option');
        opt.value = user; opt.textContent = user;
        if(user === reserva.persona) opt.selected = true;
        selectPersona.appendChild(opt);
    });

    document.getElementById('edit-turno-espacio').value = reserva.espacio || 'Cuarto de juegos';
    document.getElementById('edit-turno-horario').value = reserva.turno || 'Mañana';

    try {
        let dateStr = "";
        if (reserva.fecha && reserva.fecha.includes && reserva.fecha.includes('T')) {
            dateStr = reserva.fecha.split('T')[0];
        } else if (reserva.fecha) {
            dateStr = new Date(reserva.fecha).toISOString().split('T')[0];
        }
        document.getElementById('edit-turno-fecha').value = dateStr;
    } catch(e) {}

    document.getElementById('modal-editar-turno').style.display = 'block';
}

document.getElementById('form-editar-turno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-turno-id').value);
    const persona = document.getElementById('edit-turno-persona').value;
    const espacio = document.getElementById('edit-turno-espacio').value;
    const turno = document.getElementById('edit-turno-horario').value;
    const fecha = document.getElementById('edit-turno-fecha').value;
    
    const idx = reservas.findIndex(r => r.id === id);
    if (idx === -1) return;

    reservas[idx].persona = persona;
    reservas[idx].espacio = espacio;
    reservas[idx].turno = turno;
    reservas[idx].fecha = fecha; // String YYYY-MM-DD

    reservas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    localStorage.setItem('dvhome_reservas_cache', JSON.stringify(reservas));
    document.getElementById('modal-editar-turno').style.display = 'none';
    renderTurnos();

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                tipo: 'editar_turno', 
                id: id, 
                persona: persona, 
                espacio: espacio, 
                turno: turno, 
                fecha: fecha 
            })
        });
    } catch(e) {}
});

document.getElementById('btn-eliminar-turno').addEventListener('click', async () => {
    if(confirm("¿Seguro que quieres borrar esta reserva?")) {
        const id = parseInt(document.getElementById('edit-turno-id').value);
        reservas = reservas.filter(r => r.id !== id);
        localStorage.setItem('dvhome_reservas_cache', JSON.stringify(reservas));
        document.getElementById('modal-editar-turno').style.display = 'none';
        renderTurnos();
        
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ tipo: 'eliminar_turno', id: id })
            });
        } catch(e) {}
    }
});

// LOGICA DE VISTAS TURNOS
function setVistaTurnos(vista) {
    vistaTurnos = vista;
    const btnAgenda = document.getElementById('btn-vista-agenda');
    const btnCal = document.getElementById('btn-vista-calendario');
    if(btnAgenda) btnAgenda.className = vista === 'agenda' ? 'btn-active' : 'btn-inactive';
    if(btnCal) btnCal.className = vista === 'calendario' ? 'btn-active' : 'btn-inactive';
    
    const cAgenda = document.getElementById('vista-agenda-container');
    const cCal = document.getElementById('vista-calendario-container');
    if(cAgenda) cAgenda.style.display = vista === 'agenda' ? 'block' : 'none';
    if(cCal) cCal.style.display = vista === 'calendario' ? 'block' : 'none';
    
    renderTurnos();
}

function cambiarMes(delta) {
    fechaCalendario.setMonth(fechaCalendario.getMonth() + delta);
    renderTurnos();
}

function renderTurnos() {
    const agendaContenedor = document.getElementById('agenda-turnos');
    const recuentoContenedor = document.getElementById('recuento-turnos');
    const filtroEl = document.getElementById('filtro-espacio');
    const filtro = filtroEl ? filtroEl.value : "Todos";

    if(!agendaContenedor || !recuentoContenedor) return;

    let reservasFiltradas = reservas;
    if (filtro !== "Todos") reservasFiltradas = reservas.filter(r => r.espacio === filtro);

    // 1. RENDER AGENDA 
    agendaContenedor.innerHTML = '';
    if (reservasFiltradas.length === 0) {
        agendaContenedor.innerHTML = '<div class="list-item"><span class="item-main">No hay reservas.</span></div>';
    } else {
        const grupos = {};
        reservasFiltradas.forEach(r => {
            try {
                let dateStr = "";
                if (r.fecha && r.fecha.includes && r.fecha.includes('T')) dateStr = r.fecha.split('T')[0]; 
                else if (r.fecha) dateStr = new Date(r.fecha).toISOString().split('T')[0];
                
                if (dateStr) {
                    if(!grupos[dateStr]) grupos[dateStr] = [];
                    grupos[dateStr].push(r);
                }
            } catch(e) {}
        });

        const fechasOrdenadas = Object.keys(grupos).sort((a,b) => new Date(b) - new Date(a));

        fechasOrdenadas.forEach(fecha => {
            try {
                const d = new Date(fecha);
                const formatoDia = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                const headerDiv = document.createElement('div');
                headerDiv.style.padding = "10px 15px";
                headerDiv.style.backgroundColor = "#f2f2f7";
                headerDiv.style.fontWeight = "bold";
                headerDiv.style.color = "var(--accent-color)";
                headerDiv.style.textTransform = "capitalize";
                headerDiv.style.borderBottom = "1px solid #e5e5ea";
                headerDiv.textContent = formatoDia;
                agendaContenedor.appendChild(headerDiv);

                grupos[fecha].forEach(reg => {
                    let iconoTurno = reg.turno === "Mañana" ? "🌅" : (reg.turno === "Tarde" ? "☀️" : "🌙");
                    const div = document.createElement('div');
                    div.className = 'list-item clickable-row';
                    div.onclick = () => abrirModalEditarTurno(reg.id); // NUEVO: Click
                    div.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 24px;">${iconoTurno}</span>
                            <div>
                                <div class="item-main">${reg.persona}</div>
                                <div class="item-sub">${reg.espacio} • ${reg.turno}</div>
                            </div>
                        </div>
                        <div class="item-sub" style="font-size:18px;">✏️</div>
                    `;
                    agendaContenedor.appendChild(div);
                });
            } catch(e) {}
        });
    }

    // 2. RENDER CALENDARIO 
    const gridCal = document.getElementById('calendar-days');
    if(gridCal) {
        gridCal.innerHTML = '';
        try {
            const year = fechaCalendario.getFullYear();
            const month = fechaCalendario.getMonth();
            const mesLabel = document.getElementById('mes-actual-label');
            if(mesLabel) mesLabel.textContent = fechaCalendario.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            
            const firstDayIndex = new Date(year, month, 1).getDay(); 
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
            
            for(let i=0; i<startDay; i++) {
                gridCal.innerHTML += `<div class="cal-day empty"></div>`;
            }
            
            let hoyStr = "";
            try { hoyStr = new Date().toISOString().split('T')[0]; } catch(e){}

            for(let i=1; i<=daysInMonth; i++) {
                const dateObj = new Date(year, month, i);
                const tzOffset = dateObj.getTimezoneOffset() * 60000;
                const dateStr = new Date(dateObj - tzOffset).toISOString().split('T')[0];
                
                let isToday = (dateStr === hoyStr) ? 'today' : '';
                
                const resDia = reservasFiltradas.filter(r => {
                    try {
                        let rDateStr = "";
                        if (r.fecha && r.fecha.includes && r.fecha.includes('T')) rDateStr = r.fecha.split('T')[0];
                        else if (r.fecha) rDateStr = new Date(r.fecha).toISOString().split('T')[0];
                        return rDateStr === dateStr;
                    } catch(e) { return false; }
                });
                
                let reservasHTML = '';
                resDia.forEach(r => {
                    let icon = r.turno === "Mañana" ? "🌅" : (r.turno === "Tarde" ? "☀️" : "🌙");
                    let shortName = r.persona ? r.persona.substring(0, 4) : "";
                    // NUEVO: Clickable label inside calendar
                    reservasHTML += `<div class="cal-reserva" onclick="abrirModalEditarTurno(${r.id})" style="cursor:pointer;">${icon} ${shortName}</div>`;
                });
                
                gridCal.innerHTML += `
                    <div class="cal-day ${isToday}">
                        <div class="cal-date">${i}</div>
                        ${reservasHTML}
                    </div>
                `;
            }
        } catch(e) {}
    }

    // 3. RENDER RECUENTO
    let counts = {};
    DEFAULT_USERS.forEach(u => counts[u] = 0);
    reservasFiltradas.forEach(r => {
        if(counts[r.persona] !== undefined) counts[r.persona]++;
    });

    const rankingUso = Object.keys(counts).map(nombre => ({nombre, total: counts[nombre]})).sort((a,b) => b.total - a.total);
    recuentoContenedor.innerHTML = '';
    rankingUso.forEach((user, index) => {
        if (user.total > 0) {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-main">${index === 0 ? '👑' : ''} ${user.nombre}</div>
                <div class="item-score" style="color:#1c1c1e;">${user.total} usos</div>
            `;
            recuentoContenedor.appendChild(div);
        }
    });
}

// ---------------- RESTO DEL RENDER DE TAREAS (SIN CAMBIOS) ---------------- //
function renderDetalles() {
    const selectDetalle = document.getElementById('select-detalle-tarea');
    const contenedorRank = document.getElementById('detalle-ranking');
    const contenedorHist = document.getElementById('detalle-historial');
    if (!selectDetalle || !selectDetalle.value || !contenedorRank || !contenedorHist) return;
    
    const tareaObj = selectDetalle.value;
    const regs = registros.filter(r => r.tarea === tareaObj);

    document.getElementById('det-total-veces').textContent = regs.length;

    if(regs.length > 0) {
        try {
            const ultimaFecha = new Date(regs[0].fecha);
            const diasPasados = Math.floor((new Date() - ultimaFecha) / (1000 * 60 * 60 * 24));
            let textoUltima = (diasPasados === 0) ? "Hoy" : ((diasPasados === 1) ? "Ayer" : `Hace ${diasPasados} días`);
            document.getElementById('det-ultima-vez').textContent = textoUltima;
            document.getElementById('det-ultima-vez').style.fontSize = "20px";
        } catch(e){}
    } else {
        document.getElementById('det-ultima-vez').textContent = "--";
    }

    let counts = {};
    DEFAULT_USERS.forEach(u => counts[u] = 0);
    regs.forEach(r => { if(counts[r.persona] !== undefined) counts[r.persona]++; });

    const rankingTarea = Object.keys(counts).map(nombre => ({nombre, total: counts[nombre]})).sort((a,b) => b.total - a.total);

    contenedorRank.innerHTML = '';
    rankingTarea.forEach((user, index) => {
        if (user.total > 0) {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-main">${index === 0 ? '👑' : ''} ${user.nombre}</div>
                <div class="item-score" style="color:var(--text-primary); font-size: 16px;">${user.total} veces</div>
            `;
            contenedorRank.appendChild(div);
        }
    });

    if (contenedorRank.innerHTML === '') {
        contenedorRank.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Nadie la ha realizado todavía.</span></div>';
    }

    contenedorHist.innerHTML = '';
    if (regs.length === 0) {
        contenedorHist.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Sin historial.</span></div>';
    } else {
        regs.forEach(reg => {
            const div = document.createElement('div');
            div.className = 'list-item clickable-row'; 
            div.onclick = () => abrirModalEditar(reg.id); 
            let fechaFormat = "Fecha desconocida";
            try {
                const fechaObj = new Date(reg.fecha);
                if (!isNaN(fechaObj)) fechaFormat = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
            } catch (e) {}

            const turnoBadge = reg.turno ? `<span class="badge-turno">${reg.turno}</span>` : "";
            div.innerHTML = `
                <div>
                    <div class="item-main">${reg.persona} ${turnoBadge}</div>
                    <div class="item-sub">${fechaFormat}</div>
                </div>
                <div class="item-sub" style="font-size:18px;">✏️</div>
            `;
            contenedorHist.appendChild(div);
        });
    }
}

function renderHistorial() {
    const contenedor = document.getElementById('historial-list');
    if(!contenedor) return;
    contenedor.innerHTML = '';
    
    if (registros.length === 0) {
        contenedor.innerHTML = '<div class="list-item"><span class="item-main">Aún no hay tareas.</span></div>';
        return;
    }

    registros.forEach(reg => {
        const div = document.createElement('div');
        div.className = 'list-item clickable-row'; 
        div.onclick = () => abrirModalEditar(reg.id); 

        let fechaFormat = "Fecha desconocida";
        try {
            const fechaObj = new Date(reg.fecha);
            if (!isNaN(fechaObj)) fechaFormat = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
        } catch (e) {}

        const turnoBadge = reg.turno ? `<span class="badge-turno">${reg.turno}</span>` : "";
        div.innerHTML = `
            <div>
                <div class="item-main">${reg.tarea} ${turnoBadge}</div>
                <div class="item-sub">${reg.persona} • ${fechaFormat}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="item-score" style="color:#8e8e93; font-size: 14px;">+${reg.puntos}</div>
                <div class="item-sub" style="font-size:18px;">✏️</div>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

function renderSugerencias() {
    const contenedor = document.getElementById('sugerencias-list');
    const containerWrapper = document.getElementById('sugerencias-container');
    if(!contenedor || !containerWrapper) return;
    
    contenedor.innerHTML = '';
    let sugerenciasAtrasadas = [];

    if (Array.isArray(tareas)) {
        tareas.forEach(t => {
            const limiteDias = UMBRALES[t.nombre] || 7; 
            const misRegistros = registros.filter(r => r.persona === miUsuario && r.tarea === t.nombre);

            if (misRegistros.length === 0) {
                sugerenciasAtrasadas.push({ nombre: t.nombre, texto: "Nunca realizada", limite: limiteDias });
            } else {
                try {
                    const fechaUltima = new Date(misRegistros[0].fecha);
                    const diasPasados = Math.floor((new Date() - fechaUltima) / (1000 * 60 * 60 * 24));
                    if (diasPasados >= limiteDias) {
                        sugerenciasAtrasadas.push({ nombre: t.nombre, texto: `Hace ${diasPasados} días`, limite: limiteDias });
                    }
                } catch(e){}
            }
        });
    }

    if (sugerenciasAtrasadas.length === 0) {
        containerWrapper.style.display = 'none';
    } else {
        containerWrapper.style.display = 'block';
        sugerenciasAtrasadas.forEach(sug => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div>
                    <div class="item-main">${sug.nombre}</div>
                    <div class="item-sub">Umbral: ${sug.limite} días</div>
                </div>
                <div class="sugerencia-alerta">${sug.texto}</div>
            `;
            contenedor.appendChild(div);
        });
    }
}

function renderRanking() {
    const contenedorList = document.getElementById('ranking-list');
    const contenedorLider = document.getElementById('lider-semana');
    if(!contenedorList || !contenedorLider) return;

    let scores = {};
    DEFAULT_USERS.forEach(u => scores[u] = { puntos: 0, tareas: 0 });

    registros.forEach(reg => {
        if(scores[reg.persona]) {
            scores[reg.persona].puntos += reg.puntos;
            scores[reg.persona].tareas += 1;
        }
    });

    const ranking = Object.keys(scores).map(nombre => ({ nombre, ...scores[nombre] })).sort((a, b) => b.puntos - a.puntos);

    if (ranking[0].tareas > 0) {
        contenedorLider.innerHTML = `
            <h3 style="color: #d4af37; font-size: 14px; text-transform: uppercase;">👑 Líder Actual</h3>
            <h2 style="font-size: 24px; margin: 5px 0;">${ranking[0].nombre}</h2>
            <p style="font-size: 14px; color: #666;">${ranking[0].puntos} puntos en ${ranking[0].tareas} tareas</p>
        `;
    } else {
        contenedorLider.innerHTML = '<p>Nadie ha hecho tareas aún.</p>';
    }

    contenedorList.innerHTML = '';
    ranking.forEach((user, index) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        let medalla = (index + 1) + 'º';
        if(index === 0) medalla = '🥇';
        if(index === 1) medalla = '🥈';
        if(index === 2) medalla = '🥉';

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 20px; font-weight: bold; width: 25px; text-align: center;">${medalla}</span>
                <div>
                    <div class="item-main">${user.nombre}</div>
                    <div class="item-sub">${user.tareas} tareas realizadas</div>
                </div>
            </div>
            <div class="item-score" style="color: #1c1c1e;">${user.puntos} pts</div>
        `;
        contenedorList.appendChild(div);
    });
}
