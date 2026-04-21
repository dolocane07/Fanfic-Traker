const formFanfic = document.getElementById('formFanfic');
const urlInput = document.getElementById('url');
const finishedDateInput = document.getElementById('finishedDate');
const userStarsInput = document.getElementById('userStars');
const estado = document.getElementById('estado');
const listaFanfics = document.getElementById('listaFanfics');
const stats = document.getElementById('stats');
const contadorFanfics = document.getElementById('contadorFanfics');

formFanfic.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    estado.textContent = 'Importando datos desde AO3...';

    try {
        const respuesta = await fetch('api/fanfics/importar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: urlInput.value.trim(),
                finishedDate: finishedDateInput.value,
                userStars: Number(userStarsInput.value)
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.ok) {
            throw new Error(datos.mensaje || 'No se pudo guardar el fanfic');
        }

        estado.textContent = `Fanfic guardado: ${datos.fanfic.titulo}`;
        formFanfic.reset();
        finishedDateInput.valueAsDate = new Date();
        userStarsInput.value = '5';

        await cargarFanfics();
        await cargarEstadisticas();
    } catch (error) {
        estado.textContent = error.message;
    }
});

async function cargarFanfics() {
    listaFanfics.innerHTML = '<div class="mensaje neutro">Cargando fanfics...</div>';

    try {
        const respuesta = await fetch('api/fanfics');
        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.ok) {
            throw new Error(datos.mensaje || 'No se pudieron cargar los fanfics');
        }

        contadorFanfics.textContent = `${datos.fanfics.length} fanfic(s) guardado(s)`;

        if (datos.fanfics.length === 0) {
            listaFanfics.innerHTML = `
                <article class="empty-card">
                    <p class="empty-card__eyebrow">Biblioteca vacia</p>
                    <h3>Todavia no has guardado ningun fanfic</h3>
                    <p>
                        Empieza importando un enlace de AO3 para crear tu primera ficha. Cuando tengas varios,
                        esta seccion empezara a sentirse como una biblioteca de verdad.
                    </p>
                    <div class="empty-card__chips">
                        <span class="tag">Relationships</span>
                        <span class="tag">Fandoms</span>
                        <span class="tag">Warnings</span>
                        <span class="tag">Rating</span>
                    </div>
                </article>
            `;
            return;
        }

        listaFanfics.innerHTML = datos.fanfics.map(renderFanfic).join('');
    } catch (error) {
        listaFanfics.innerHTML = `<div class="mensaje error">${error.message}</div>`;
    }
}

async function cargarEstadisticas() {
    stats.innerHTML = '<div class="mensaje neutro">Cargando estadisticas...</div>';

    try {
        const respuesta = await fetch('api/estadisticas');
        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.ok) {
            throw new Error(datos.mensaje || 'No se pudieron cargar las estadisticas');
        }

        if (!datos.enabled) {
            stats.innerHTML = `
                <article class="empty-card empty-card--stats">
                    <p class="empty-card__eyebrow">Stats locked</p>
                    <h3>${datos.totalFanfics}/10 fanfics guardados</h3>
                    <p>${datos.mensaje}</p>
                    <div class="progress">
                        <span class="progress__bar" style="width: ${Math.min((datos.totalFanfics / 10) * 100, 100)}%"></span>
                    </div>
                </article>
            `;
            return;
        }

        stats.innerHTML = renderStats(datos);
    } catch (error) {
        stats.innerHTML = `<div class="mensaje error">${error.message}</div>`;
    }
}

function renderFanfic(fanfic) {
    return `
        <article class="fanfic-card">
            <div class="fanfic-card__top">
                <div>
                    <h3>${escapeHtml(fanfic.titulo)}</h3>
                    <p class="autor">por ${escapeHtml(fanfic.autor)}</p>
                </div>
                <div class="stars">${'★'.repeat(fanfic.userStars)}${'☆'.repeat(5 - fanfic.userStars)}</div>
            </div>

            <div class="meta-grid">
                <p><strong>AO3 rating:</strong> ${escapeHtml(fanfic.ao3Rating)}</p>
                <p><strong>Words:</strong> ${fanfic.wordCount.toLocaleString('es-ES')}</p>
                <p><strong>Finished:</strong> ${escapeHtml(fanfic.finishedDate)}</p>
                <p><strong>Link:</strong> <a href="${escapeHtml(fanfic.ao3Url)}" target="_blank" rel="noopener noreferrer">Abrir en AO3</a></p>
            </div>

            ${renderTagGroup('Warnings', fanfic.warnings)}
            ${renderTagGroup('Parejas', fanfic.relationships)}
            ${renderTagGroup('Fandoms', fanfic.fandoms)}
            ${renderTagGroup('Categorias', fanfic.categories)}
        </article>
    `;
}

function renderTagGroup(titulo, items) {
    if (!items || items.length === 0) {
        return `
            <div class="tag-group">
                <p class="tag-title">${titulo}</p>
                <p class="tag-empty">Sin datos</p>
            </div>
        `;
    }

    return `
        <div class="tag-group">
            <p class="tag-title">${titulo}</p>
            <div class="tags">
                ${items.map(item => `<span class="tag">${escapeHtml(item)}</span>`).join('')}
            </div>
        </div>
    `;
}

function renderStats(datos) {
    return `
        <div class="stats-grid">
            <article class="stat-card">
                <h3>Total</h3>
                <p class="stat-big">${datos.totalFanfics}</p>
            </article>
            <article class="stat-card">
                <h3>Media de palabras</h3>
                <p class="stat-big">${Number(datos.averageWords).toLocaleString('es-ES')}</p>
            </article>
        </div>

        <div class="stats-lists">
            ${renderRanking('Parejas mas leidas', datos.topRelationships)}
            ${renderRanking('Fandoms mas leidos', datos.topFandoms)}
            ${renderRanking('Warnings mas comunes', datos.topWarnings)}
        </div>

        <div class="stats-lists">
            ${renderBreakdown('AO3 ratings', datos.ao3Ratings)}
            ${renderBreakdown('Tus estrellas', datos.userStars)}
            ${renderBreakdown('Categorias', datos.categories)}
        </div>
    `;
}

function renderRanking(titulo, items) {
    const contenido = !items || items.length === 0
        ? '<li>Sin datos</li>'
        : items.map(item => `<li><span>${escapeHtml(item.name)}</span><strong>${item.count}</strong></li>`).join('');

    return `
        <article class="ranking-card">
            <h3>${titulo}</h3>
            <ol>${contenido}</ol>
        </article>
    `;
}

function renderBreakdown(titulo, mapa) {
    const entries = Object.entries(mapa || {});
    const contenido = entries.length === 0
        ? '<li>Sin datos</li>'
        : entries.map(([clave, valor]) => `<li><span>${escapeHtml(clave)}</span><strong>${valor}</strong></li>`).join('');

    return `
        <article class="ranking-card">
            <h3>${titulo}</h3>
            <ul>${contenido}</ul>
        </article>
    `;
}

function escapeHtml(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

finishedDateInput.valueAsDate = new Date();
userStarsInput.value = '5';
cargarFanfics();
cargarEstadisticas();
