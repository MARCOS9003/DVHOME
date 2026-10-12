// Tu URL real configurada
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

// Base por defecto con el nuevo orden
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

let tareasGuardadas = JSON.parse(localStorage.getItem('dvhome_tareas'));
let tareas = tareasGuardadas ? tareasGuardadas : tareasBase;

// Script para inyectar automáticamente las nuevas tareas en la caché vieja de los usuarios
if (tareasGuardadas) {
    const nuevas = ["Lavar coche (por fuera)", "Limpiar coche (interior)"];
    nuevas.forEach(n => {
        if (!tareas.find(t => t.nombre === n)) tareas.push({nombre: n, puntos: 1});
    });
    // Forzar a Pasear perro a que sea el primero siempre
    const idxPerro = tareas.findIndex(t => t.nombre === "Pasear perro");
    if (idxPerro > 0) {
        const perro = tareas.splice(idxPerro, 1)[0];
        tareas.unshift(perro);
    }
    localStorage.setItem('dvhome_tareas', JSON.stringify(tareas));
}

let registros = [];
let miUsuario = localStorage.getItem('dvhome_mi_usuario') || "Marcos";

document.addEventListener('DOMContentLoaded', () => {
    // 1. PRIMERO encendemos el escuchador del turno
    document.getElementById('select-tarea').addEventListener('change', (e) => {
        const groupTurno = document.getElementById('group-turno');
        if (e.target.value === 'Pasear perro') {
            groupTurno.style.display = 'block';
        } else {
            groupTurno.style.display = 'none';
        }
    });

    // 2. LUEGO cargamos las listas y datos
    initSelects();
    cargarDatosDesdeGoogle();
});

async function cargarDatosDesdeGoogle() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data.status === 'success') {
            registros = data.registros.map(row => ({
                id: row[0],
                fecha: row[1],
                tarea: row[2],
                persona: row[3],
                puntos: Number(row[4]),
                turno: row[5] || "" 
            })).reverse(); 

            localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));
            renderAll();
        }
    } catch (error) {
        console.error("Error online, cargando caché local:", error);
        registros = JSON.parse(localStorage.getItem('dvhome_registros_cache')) || [];
        renderAll();
    }
}

function renderAll() {
    renderRanking();
    renderHistorial();
    renderSugerencias();
    renderDetalles();
}

function navigate(viewId, tabElement) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    if (tabElement) {
        document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
        tabElement.classList.add('active');
    }
}

function initSelects() {
    const selectPersona = document.getElementById('select-persona');
    const selectMiUsuario = document.getElementById('select-mi-usuario');
    const selectDetalleTarea = document.getElementById('select-detalle-tarea');

    selectPersona.innerHTML = '';
    selectMiUsuario.innerHTML = '';

    DEFAULT_USERS.forEach(user => {
        let opt1 = document.createElement('option');
        opt1.value = user; opt1.textContent = user;
        selectPersona.appendChild(opt1);

        let opt2 = document.createElement('option');
        opt2.value = user; opt2.textContent = user;
        if (user === miUsuario) opt2.selected = true;
        selectMiUsuario.appendChild(opt2);
    });

    selectMiUsuario.addEventListener('change', (e) => {
        miUsuario = e.target.value;
        localStorage.setItem('dvhome_mi_usuario', miUsuario);
        renderSugerencias();
    });

    selectDetalleTarea.addEventListener('change', renderDetalles);
    actualizarDesplegableTareas();
}

function actualizarDesplegableTareas() {
    const selectTarea = document.getElementById('select-tarea');
    const selectDetalleTarea = document.getElementById('select-detalle-tarea');

    selectTarea.innerHTML = '';
    selectDetalleTarea.innerHTML = '';

    tareas.forEach(task => {
        let opt = document.createElement('option');
        opt.value = task.nombre;
        opt.textContent = `${task.nombre} (${task.puntos} pts)`;
        selectTarea.appendChild(opt);

        let optDetalle = document.createElement('option');
        optDetalle.value = task.nombre;
        optDetalle.textContent = task.nombre;
        selectDetalleTarea.appendChild(optDetalle);
    });

    selectTarea.dispatchEvent(new Event('change'));
}

document.getElementById('form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    const persona = document.getElementById('select-persona').value;
    const tareaNombre = document.getElementById('select-tarea').value;
    const fechaManual = document.getElementById('input-fecha').value;
    const tareaInfo = tareas.find(t => t.nombre === tareaNombre);

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
    navigate('view-ranking', document.querySelectorAll('.tab-item')[0]);

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ tipo: 'nuevo_registro', ...nuevoRegistro })
        });
    } catch (error) {
        console.error("Error guardando en la nube:", error);
    }
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

// NUEVO: Función para abrir el Modal de Editar
function abrirModalEditar(id) {
    const reg = registros.find(r => r.id === id);
    if (!reg) return;

    document.getElementById('edit-id').value = reg.id;
    
    // Llenar select persona
    const selectPersona = document.getElementById('edit-persona');
    selectPersona.innerHTML = '';
    DEFAULT_USERS.forEach(user => {
        let opt = document.createElement('option');
        opt.value = user; opt.textContent = user;
        if(user === reg.persona) opt.selected = true;
        selectPersona.appendChild(opt);
    });

    // Controlar Turno
    if (reg.tarea === 'Pasear perro') {
        document.getElementById('edit-group-turno').style.display = 'block';
        document.getElementById('edit-turno').value = reg.turno || 'Mañana';
    } else {
        document.getElementById('edit-group-turno').style.display = 'none';
    }

    // Adaptar la fecha al input local
    try {
        const d = new Date(reg.fecha);
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, 16);
        document.getElementById('edit-fecha').value = localISOTime;
    } catch(e) {
        console.error("Error adaptando fecha", e);
    }

    document.getElementById('modal-editar-registro').style.display = 'block';
}

// NUEVO: Guardar edición
document.getElementById('form-editar-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-id').value);
    const persona = document.getElementById('edit-persona').value;
    const fechaManual = document.getElementById('edit-fecha').value;
    
    const idx = registros.findIndex(r => r.id === id);
    if (idx === -1) return;

    registros[idx].persona = persona;
    registros[idx].fecha = new Date(fechaManual).toISOString();
    
    if (registros[idx].tarea === 'Pasear perro') {
        registros[idx].turno = document.getElementById('edit-turno').value;
    }

    localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));
    document.getElementById('modal-editar-registro').style.display = 'none';
    renderAll();

    // Enviar a Google Apps Script
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ 
                tipo: 'editar_registro', 
                id: id, 
                persona: persona, 
                fecha: registros[idx].fecha, 
                turno: registros[idx].turno 
            })
        });
    } catch(e) { console.error(e); }
});

// NUEVO: Botón Eliminar
document.getElementById('btn-eliminar-registro').addEventListener('click', async () => {
    if(confirm("¿Seguro que quieres borrar este registro? Esta acción actualizará los puntos.")) {
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
        } catch(e) { console.error(e); }
    }
});

function renderDetalles() {
    const selectDetalle = document.getElementById('select-detalle-tarea');
    if (!selectDetalle || !selectDetalle.value) return;
    const tareaObj = selectDetalle.value;

    const regs = registros.filter(r => r.tarea === tareaObj);

    document.getElementById('det-total-veces').textContent = regs.length;

    if(regs.length > 0) {
        const ultimaFecha = new Date(regs[0].fecha);
        const diasPasados = Math.floor((new Date() - ultimaFecha) / (1000 * 60 * 60 * 24));

        let textoUltima = "";
        if (diasPasados === 0) textoUltima = "Hoy";
        else if (diasPasados === 1) textoUltima = "Ayer";
        else textoUltima = `Hace ${diasPasados} días`;

        document.getElementById('det-ultima-vez').textContent = textoUltima;
        document.getElementById('det-ultima-vez').style.fontSize = "20px";
    } else {
        document.getElementById('det-ultima-vez').textContent = "--";
    }

    let counts = {};
    DEFAULT_USERS.forEach(u => counts[u] = 0);
    regs.forEach(r => counts[r.persona]++);

    const rankingTarea = Object.keys(counts)
        .map(nombre => ({nombre, total: counts[nombre]}))
        .sort((a,b) => b.total - a.total);

    const contenedorRank = document.getElementById('detalle-ranking');
    contenedorRank.innerHTML = '';

    rankingTarea.forEach((user, index) => {
        if (user.total > 0) {
            const div = document.createElement('div');
            div.className = 'list-item';
            let medalla = index === 0 ? '👑' : '';
            div.innerHTML = `
                <div class="item-main">${medalla} ${user.nombre}</div>
                <div class="item-score" style="color:var(--text-primary); font-size: 16px;">${user.total} veces</div>
            `;
            contenedorRank.appendChild(div);
        }
    });

    if (contenedorRank.innerHTML === '') {
        contenedorRank.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Nadie la ha realizado todavía.</span></div>';
    }

    const contenedorHist = document.getElementById('detalle-historial');
    contenedorHist.innerHTML = '';

    if (regs.length === 0) {
        contenedorHist.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Sin historial.</span></div>';
    } else {
        regs.forEach(reg => {
            const div = document.createElement('div');
            div.className = 'list-item clickable-row'; // Añadida clase
            div.onclick = () => abrirModalEditar(reg.id); // Llama a la edición

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
    contenedor.innerHTML = '';
    if (registros.length === 0) return contenedor.innerHTML = '<div class="list-item"><span class="item-main">Aún no hay tareas.</span></div>';

    registros.forEach(reg => {
        const div = document.createElement('div');
        div.className = 'list-item clickable-row'; // Añadida clase
        div.onclick = () => abrirModalEditar(reg.id); // Llama a la edición

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
    contenedor.innerHTML = '';
    let sugerenciasAtrasadas = [];

    tareas.forEach(t => {
        const limiteDias = UMBRALES[t.nombre] || 7; 
        const misRegistros = registros.filter(r => r.persona === miUsuario && r.tarea === t.nombre);

        if (misRegistros.length === 0) {
            sugerenciasAtrasadas.push({ nombre: t.nombre, texto: "Nunca realizada", limite: limiteDias });
        } else {
            const fechaUltima = new Date(misRegistros[0].fecha);
            const diasPasados = Math.floor((new Date() - fechaUltima) / (1000 * 60 * 60 * 24));

            if (diasPasados >= limiteDias) {
                sugerenciasAtrasadas.push({ nombre: t.nombre, texto: `Hace ${diasPasados} días`, limite: limiteDias });
            }
        }
    });

    if (sugerenciasAtrasadas.length === 0) {
        document.getElementById('sugerencias-container').style.display = 'none';
    } else {
        document.getElementById('sugerencias-container').style.display = 'block';
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

    let scores = {};
    DEFAULT_USERS.forEach(u => scores[u] = { puntos: 0, tareas: 0 });

    registros.forEach(reg => {
        if(scores[reg.persona]) {
            scores[reg.persona].puntos += reg.puntos;
            scores[reg.persona].tareas += 1;
        }
    });

    const ranking = Object.keys(scores)
        .map(nombre => ({ nombre, ...scores[nombre] }))
        .sort((a, b) => b.puntos - a.puntos);

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

// ==========================================
// NUEVO MÓDULO: TURNOS Y RESERVAS (AGENDA)
// ==========================================

let reservas = JSON.parse(localStorage.getItem('dvhome_reservas_cache')) || [];

// Modificamos la función cargarDatosDesdeGoogle para que también traiga las reservas
async function cargarDatosDesdeGoogle() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data.status === 'success') {
            registros = data.registros.map(row => ({
                id: row[0], fecha: row[1], tarea: row[2], persona: row[3], puntos: Number(row[4]), turno: row[5] || "" 
            })).reverse(); 
            localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));

            // Cargar turnos si existen en la respuesta de Google
            if (data.turnos) {
                reservas = data.turnos.map(row => ({
                    id: row[0], fecha: row[1], espacio: row[2], persona: row[3], turno: row[4]
                })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // Ordenados por fecha
                localStorage.setItem('dvhome_reservas_cache', JSON.stringify(reservas));
            }

            renderAll();
        }
    } catch (error) {
        console.error("Error online, cargando caché local:", error);
        registros = JSON.parse(localStorage.getItem('dvhome_registros_cache')) || [];
        renderAll();
    }
}

// Añadimos renderTurnos al ciclo principal de pintado
const oldRenderAll = renderAll;
renderAll = function() {
    oldRenderAll();
    renderTurnos();
};

function abrirModalTurno() {
    // Llenar el selector de persona del modal
    const selectPersona = document.getElementById('turno-persona');
    selectPersona.innerHTML = '';
    DEFAULT_USERS.forEach(user => {
        let opt = document.createElement('option');
        opt.value = user; opt.textContent = user;
        if(user === miUsuario) opt.selected = true;
        selectPersona.appendChild(opt);
    });
    
    // Poner por defecto la fecha de hoy
    document.getElementById('turno-fecha').valueAsDate = new Date();
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
    // Ordenar para que los más recientes/futuros salgan bien en la agenda
    reservas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    localStorage.setItem('dvhome_reservas_cache', JSON.stringify(reservas));
    
    document.getElementById('modal-reservar-turno').style.display = 'none';
    renderTurnos();

    // Guardar en la nube
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ tipo: 'nuevo_turno', ...nuevaReserva })
        });
    } catch (error) { console.error("Error guardando reserva en la nube:", error); }
});

function renderTurnos() {
    const agendaContenedor = document.getElementById('agenda-turnos');
    const recuentoContenedor = document.getElementById('recuento-turnos');
    const filtro = document.getElementById('filtro-espacio').value;

    let reservasFiltradas = reservas;
    if (filtro !== "Todos") {
        reservasFiltradas = reservas.filter(r => r.espacio === filtro);
    }

    // 1. Pintar Agenda (Agrupada por día)
    agendaContenedor.innerHTML = '';
    if (reservasFiltradas.length === 0) {
        agendaContenedor.innerHTML = '<div class="list-item"><span class="item-main">No hay reservas registradas.</span></div>';
    } else {
        // Agrupar por fecha
        const grupos = {};
        reservasFiltradas.forEach(r => {
            const dateStr = r.fecha.split('T')[0]; // YYYY-MM-DD
            if(!grupos[dateStr]) grupos[dateStr] = [];
            grupos[dateStr].push(r);
        });

        // Ordenar fechas de más reciente a más antigua
        const fechasOrdenadas = Object.keys(grupos).sort((a,b) => new Date(b) - new Date(a));

        fechasOrdenadas.forEach(fecha => {
            // Cabecera de Día
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

            // Turnos de ese día
            grupos[fecha].forEach(reg => {
                let iconoTurno = reg.turno === "Mañana" ? "🌅" : (reg.turno === "Tarde" ? "☀️" : "🌙");
                const div = document.createElement('div');
                div.className = 'list-item';
                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">${iconoTurno}</span>
                        <div>
                            <div class="item-main">${reg.persona}</div>
                            <div class="item-sub">${reg.espacio} • ${reg.turno}</div>
                        </div>
                    </div>
                `;
                agendaContenedor.appendChild(div);
            });
        });
    }

    // 2. Pintar Recuento (Estadísticas de uso)
    let counts = {};
    DEFAULT_USERS.forEach(u => counts[u] = 0);
    reservasFiltradas.forEach(r => {
        if(counts[r.persona] !== undefined) counts[r.persona]++;
    });

    const rankingUso = Object.keys(counts)
        .map(nombre => ({nombre, total: counts[nombre]}))
        .sort((a,b) => b.total - a.total);

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
