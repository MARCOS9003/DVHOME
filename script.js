const API_URL = "https://script.google.com/macros/s/AKfycbxZ0ZUpiwGT-_c67PJM6mOEkr_e6zrQf3RCUbc7EyP2QtaWLoH-PImuysHbSM9eHeoOsQ/exec";
const DEFAULT_USERS = ["Marcos", "Jimena", "Mamá", "Papá", "Patricia"];

const UMBRALES = {
    "Pasear perro": 2,
    "Lavar perro": 60,
    "Hacer Cocina": 7,
    "Poner Mesa": 14,
    "Bajar basura": 14
};

let tareas = JSON.parse(localStorage.getItem('dvhome_tareas')) || [
    { nombre: "Pasear perro", puntos: 1 },
    { nombre: "Lavar perro", puntos: 1 },
    { nombre: "Hacer Cocina", puntos: 1 },
    { nombre: "Poner Mesa", puntos: 1 },
    { nombre: "Bajar basura", puntos: 1 }
];

let registros = [];
let miUsuario = localStorage.getItem('dvhome_mi_usuario') || "Marcos";

document.addEventListener('DOMContentLoaded', () => {
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
                puntos: Number(row[4])
            })).reverse(); 
            
            localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));
            renderAll();
        }
    } catch (error) {
        console.error("Error al cargar datos online, cargando caché local:", error);
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
}

document.getElementById('form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    const persona = document.getElementById('select-persona').value;
    const tareaNombre = document.getElementById('select-tarea').value;
    const fechaManual = document.getElementById('input-fecha').value;
    const tareaInfo = tareas.find(t => t.nombre === tareaNombre);
    
    const fechaRegistro = fechaManual ? new Date(fechaManual).toISOString() : new Date().toISOString();

    const nuevoRegistro = {
        id: Date.now(),
        fecha: fechaRegistro,
        persona: persona,
        tarea: tareaNombre,
        puntos: Number(tareaInfo.puntos)
    };
    
    registros.unshift(nuevoRegistro);
    localStorage.setItem('dvhome_registros_cache', JSON.stringify(registros));
    
    // Limpiar el campo de fecha tras enviar
    document.getElementById('input-fecha').value = "";
    
    renderAll();
    navigate('view-ranking', document.querySelectorAll('.tab-item')[0]);
    
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ tipo: 'nuevo_registro', ...nuevoRegistro })
        });
    } catch (error) {
        console.error("Error al guardar en la nube:", error);
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

function renderDetalles() {
    const selectDetalle = document.getElementById('select-detalle-tarea');
    if (!selectDetalle || !selectDetalle.value) return;
    const tareaObj = selectDetalle.value;
    
    const regs = registros.filter(r => r.tarea === tareaObj);
    
    // Recuento Total (Ranking por tarea)
    let counts = {};
    DEFAULT_USERS.forEach(u => counts[u] = 0);
    regs.forEach(r => counts[r.persona]++);
    
    const rankingTarea = Object.keys(counts)
        .map(nombre => ({nombre, total: counts[nombre]}))
        .sort((a,b) => b.total - a.total);
        
    const contenedorRank = document.getElementById('detalle-ranking');
    contenedorRank.innerHTML = '';
    
    rankingTarea.forEach(user => {
        if (user.total > 0) {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div class="item-main">${user.nombre}</div><div class="item-score" style="color:var(--text-primary); font-size: 16px;">${user.total} veces</div>`;
            contenedorRank.appendChild(div);
        }
    });
    
    if (contenedorRank.innerHTML === '') {
        contenedorRank.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Nadie ha registrado esta tarea todavía.</span></div>';
    }

    // Registro Histórico Específico
    const contenedorHist = document.getElementById('detalle-historial');
    contenedorHist.innerHTML = '';
    
    if (regs.length === 0) {
        contenedorHist.innerHTML = '<div class="list-item"><span class="item-main" style="color:var(--text-secondary);">Sin historial.</span></div>';
    } else {
        regs.forEach(reg => {
            const div = document.createElement('div');
            div.className = 'list-item';
            let fechaFormat = "Fecha desconocida";
            try {
                const fechaObj = new Date(reg.fecha);
                if (!isNaN(fechaObj)) {
                    fechaFormat = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
                }
            } catch (e) {}

            div.innerHTML = `
                <div>
                    <div class="item-main">${reg.persona}</div>
                    <div class="item-sub">${fechaFormat}</div>
                </div>
            `;
            contenedorHist.appendChild(div);
        });
    }
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

function renderHistorial() {
    const contenedor = document.getElementById('historial-list');
    contenedor.innerHTML = '';
    if (registros.length === 0) return contenedor.innerHTML = '<div class="list-item"><span class="item-main">Aún no hay tareas registradas.</span></div>';

    registros.forEach(reg => {
        const div = document.createElement('div');
        div.className = 'list-item';
        
        let fechaFormat = "Fecha desconocida";
        try {
            const fechaObj = new Date(reg.fecha);
            if (!isNaN(fechaObj)) {
                fechaFormat = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
            }
        } catch (e) {}

        div.innerHTML = `
            <div>
                <div class="item-main">${reg.tarea}</div>
                <div class="item-sub">${reg.persona} • ${fechaFormat}</div>
            </div>
            <div class="item-score" style="color:#8e8e93; font-size: 14px;">+${reg.puntos}</div>
        `;
        contenedor.appendChild(div);
    });
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