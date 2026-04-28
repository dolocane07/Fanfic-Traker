const state = {
    user: null,
    fanfics: [],
    currentPage: 1,
    fanficsPerPage: 5
};

const formFanfic = document.getElementById('formFanfic');
const urlInput = document.getElementById('url');
const finishedDateInput = document.getElementById('finishedDate');
const userStarsInput = document.getElementById('userStars');
const estado = document.getElementById('estado');
const listaFanfics = document.getElementById('listaFanfics');
const paginacionFanfics = document.getElementById('paginacionFanfics');
const stats = document.getElementById('stats');
const contadorFanfics = document.getElementById('contadorFanfics');
const authStatus = document.getElementById('authStatus');
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const heroSection = document.getElementById('heroSection');
const authEstado = document.getElementById('authEstado');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');

registerForm.addEventListener('submit', manejarRegistro);
loginForm.addEventListener('submit', manejarLogin);
formFanfic.addEventListener('submit', guardarFanfic);
listaFanfics.addEventListener('click', manejarClicksBiblioteca);
listaFanfics.addEventListener('submit', manejarEdicionFanfic);
paginacionFanfics.addEventListener('click', manejarPaginacionBiblioteca);
authStatus.addEventListener('click', manejarAccionesSesion);

async function init() {
    finishedDateInput.valueAsDate = new Date();
    userStarsInput.value = '5';
    await cargarSesion();
}

async function cargarSesion() {
    try {
        const { data } = await solicitar('/api/auth/session');
        actualizarSesion(data.loggedIn ? data.user : null);
        if (data.loggedIn) {
            await cargarBibliotecaCompleta();
        }
    } catch (error) {
        actualizarSesion(null);
        authEstado.textContent = error.message;
    }
}

async function manejarRegistro(evento) {
    evento.preventDefault();
    authEstado.textContent = 'Creando cuenta...';

    try {
        const { response, data } = await solicitar('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: document.getElementById('registerUsername').value.trim(),
                email: document.getElementById('registerEmail').value.trim(),
                password: document.getElementById('registerPassword').value
            })
        });

        if (!response.ok || !data.ok) {
            throw new Error(data.detalle || data.mensaje || 'No se pudo crear la cuenta');
        }

        registerForm.reset();
        authEstado.textContent = 'Cuenta creada. Ya puedes usar tu biblioteca.';
        actualizarSesion(data.user);
        await cargarBibliotecaCompleta();
    } catch (error) {
        authEstado.textContent = error.message;
    }
}

async function manejarLogin(evento) {
    evento.preventDefault();
    authEstado.textContent = 'Entrando...';

    try {
        const { response, data } = await solicitar('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                identifier: document.getElementById('loginIdentifier').value.trim(),
                password: document.getElementById('loginPassword').value
            })
        });

        if (!response.ok || !data.ok) {
            throw new Error(data.detalle || data.mensaje || 'No se pudo iniciar sesion');
        }

        loginForm.reset();
        authEstado.textContent = 'Sesion iniciada.';
        actualizarSesion(data.user);
        await cargarBibliotecaCompleta();
    } catch (error) {
        authEstado.textContent = error.message;
    }
}

async function manejarAccionesSesion(evento) {
    const boton = evento.target.closest('[data-action="logout"]');
    if (!boton) {
        return;
    }

    try {
        await solicitar('/api/auth/logout', { method: 'POST' });
    } finally {
        actualizarSesion(null);
        estado.textContent = '';
        authEstado.textContent = 'Sesion cerrada.';
    }
}

async function guardarFanfic(evento) {
    evento.preventDefault();
    estado.textContent = 'Importando datos desde AO3...';

    try {
        const { response, data } = await solicitar('/api/fanfics/importar', {
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

        if (!response.ok || !data.ok) {
            throw new Error(data.detalle || data.mensaje || 'No se pudo guardar el fanfic');
        }

        estado.textContent = `Fanfic guardado: ${data.fanfic.titulo}`;
        formFanfic.reset();
        finishedDateInput.valueAsDate = new Date();
        userStarsInput.value = '5';

        await cargarBibliotecaCompleta();
    } catch (error) {
        estado.textContent = error.message;
    }
}

async function cargarBibliotecaCompleta() {
    await Promise.all([cargarFanfics(), cargarEstadisticas()]);
}

async function cargarFanfics() {
    listaFanfics.innerHTML = '<div class="mensaje neutro">Cargando fanfics...</div>';
    paginacionFanfics.innerHTML = '';

    try {
        const { response, data } = await solicitar('/api/fanfics');

        if (!response.ok || !data.ok) {
            throw new Error(data.detalle || data.mensaje || 'No se pudieron cargar los fanfics');
        }

        contadorFanfics.textContent = `${data.fanfics.length} fanfic(s) guardado(s)`;
        state.fanfics = data.fanfics;

        if (data.fanfics.length === 0) {
            state.currentPage = 1;
            listaFanfics.innerHTML = `
                <article class="empty-card">
                    <p class="empty-card__eyebrow">Biblioteca vacia</p>
                    <h3>Todavia no has guardado ningun fanfic</h3>
                    <p>
                        Empieza importando un enlace de AO3 para crear tu primera ficha. Cada entrada se guardara
                        solo en tu cuenta y luego podras editarla o borrarla.
                    </p>
                    <div class="empty-card__chips">
                        <span class="tag">Cuenta privada</span>
                        <span class="tag">Detalle deslizable</span>
                        <span class="tag">Editar</span>
                        <span class="tag">Borrar</span>
                    </div>
                </article>
            `;
            paginacionFanfics.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(state.fanfics.length / state.fanficsPerPage);
        state.currentPage = Math.min(state.currentPage, totalPages);
        renderPaginaBiblioteca();
    } catch (error) {
        listaFanfics.innerHTML = `<div class="mensaje error">${escapeHtml(error.message)}</div>`;
        paginacionFanfics.innerHTML = '';
    }
}

async function cargarEstadisticas() {
    stats.innerHTML = '<div class="mensaje neutro">Cargando estadisticas...</div>';

    try {
        const { response, data } = await solicitar('/api/estadisticas');

        if (!response.ok || !data.ok) {
            throw new Error(data.detalle || data.mensaje || 'No se pudieron cargar las estadisticas');
        }

        if (!data.enabled) {
            stats.innerHTML = `
                <article class="empty-card empty-card--stats">
                    <p class="empty-card__eyebrow">Stats locked</p>
                    <h3>${data.totalFanfics}/10 fanfics guardados</h3>
                    <p>${escapeHtml(data.mensaje)}</p>
                    <div class="progress">
                        <span class="progress__bar" style="width: ${Math.min((data.totalFanfics / 10) * 100, 100)}%"></span>
                    </div>
                </article>
            `;
            return;
        }

        stats.innerHTML = renderStats(data);
    } catch (error) {
        stats.innerHTML = `<div class="mensaje error">${escapeHtml(error.message)}</div>`;
    }
}

function manejarClicksBiblioteca(evento) {
    const toggleButton = evento.target.closest('[data-action="toggle-details"]');
    if (toggleButton) {
        const card = toggleButton.closest('.fanfic-card');
        const expandida = card.classList.toggle('expanded');
        toggleButton.textContent = expandida ? '−' : '+';
        toggleButton.setAttribute('aria-label', expandida ? 'Ocultar detalles' : 'Ver detalles');
        toggleButton.setAttribute('title', expandida ? 'Ocultar detalles' : 'Ver detalles');
        return;
    }

    const deleteButton = evento.target.closest('[data-action="delete-fanfic"]');
    if (deleteButton) {
        borrarFanfic(Number(deleteButton.dataset.fanficId));
    }
}

function manejarPaginacionBiblioteca(evento) {
    const pageButton = evento.target.closest('[data-action="go-page"]');
    if (!pageButton) {
        return;
    }

    state.currentPage = Number(pageButton.dataset.page);
    renderPaginaBiblioteca();
}

async function manejarEdicionFanfic(evento) {
    const form = evento.target.closest('.edit-form');
    if (!form) {
        return;
    }

    evento.preventDefault();

    const fanficId = Number(form.dataset.fanficId);
    const finishedDate = form.querySelector('[name="finishedDate"]').value;
    const userStars = Number(form.querySelector('[name="userStars"]').value);
    const feedback = form.querySelector('.edit-form__feedback');
    feedback.textContent = 'Guardando cambios...';

    try {
        const { response, data } = await solicitar('/api/fanfics/actualizar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fanficId, finishedDate, userStars })
        });

        if (!response.ok || !data.ok) {
            throw new Error(data.detalle || data.mensaje || 'No se pudo actualizar');
        }

        feedback.textContent = 'Cambios guardados.';
        await cargarBibliotecaCompleta();
    } catch (error) {
        feedback.textContent = error.message;
    }
}

async function borrarFanfic(fanficId) {
    if (!confirm('¿Seguro que quieres borrar esta entrada de tu biblioteca?')) {
        return;
    }

    try {
        const { response, data } = await solicitar('/api/fanfics/eliminar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fanficId })
        });

        if (!response.ok || !data.ok) {
            throw new Error(data.detalle || data.mensaje || 'No se pudo borrar la entrada');
        }

        await cargarBibliotecaCompleta();
    } catch (error) {
        estado.textContent = error.message;
    }
}

function actualizarSesion(user) {
    state.user = user;
    appSection.classList.toggle('hidden', !user);
    authSection.classList.toggle('hidden', Boolean(user));
    heroSection.classList.toggle('hidden', Boolean(user));

    if (user) {
        authStatus.innerHTML = `
            <div class="session-pill">
                <span class="session-pill__label">Conectada como</span>
                <strong>${escapeHtml(user.username)}</strong>
            </div>
            <button class="boton-ghost" type="button" data-action="logout">Cerrar sesion</button>
        `;
        contadorFanfics.textContent = '';
    } else {
        state.fanfics = [];
        state.currentPage = 1;
        authStatus.innerHTML = `
            <div class="session-pill">
                <span class="session-pill__label">Estado</span>
                <strong>Invitada</strong>
            </div>
        `;
        listaFanfics.innerHTML = '';
        paginacionFanfics.innerHTML = '';
        stats.innerHTML = '';
        contadorFanfics.textContent = '';
    }
}

function renderPaginaBiblioteca() {
    const start = (state.currentPage - 1) * state.fanficsPerPage;
    const end = start + state.fanficsPerPage;
    const paginaActual = state.fanfics.slice(start, end);
    const totalPages = Math.ceil(state.fanfics.length / state.fanficsPerPage);

    listaFanfics.innerHTML = paginaActual.map(renderFanfic).join('');
    paginacionFanfics.innerHTML = totalPages > 1 ? renderPaginacion(totalPages) : '';
}

function renderPaginacion(totalPages) {
    const botones = Array.from({ length: totalPages }, (_, index) => {
        const page = index + 1;
        const activeClass = page === state.currentPage ? ' is-active' : '';

        return `
            <button
                class="paginacion-fanfics__boton${activeClass}"
                type="button"
                data-action="go-page"
                data-page="${page}"
                aria-label="Ir a la pagina ${page}"
            >${page}</button>
        `;
    }).join('');

    return `<div class="paginacion-fanfics__inner">${botones}</div>`;
}

function renderFanfic(fanfic) {
    return `
        <article class="fanfic-card" data-fanfic-id="${fanfic.id}">
            <div class="fanfic-card__top">
                <div>
                    <p class="fanfic-card__eyebrow">${escapeHtml(fanfic.ao3Rating)}</p>
                    <h3>${escapeHtml(fanfic.titulo)}</h3>
                    <p class="autor">por ${escapeHtml(fanfic.autor)}</p>
                </div>

                <div class="fanfic-card__summary">
                    <div class="stars">${'★'.repeat(fanfic.userStars)}${'☆'.repeat(5 - fanfic.userStars)}</div>
                    <button
                        class="boton-ghost boton-ghost--icon"
                        type="button"
                        data-action="toggle-details"
                        aria-label="Ver detalles"
                        title="Ver detalles"
                    >+</button>
                </div>
            </div>

            <div class="fanfic-details">
                <div class="fanfic-details__inner">
                    <div class="meta-grid">
                        <p><strong>AO3 rating:</strong> ${escapeHtml(fanfic.ao3Rating)}</p>
                        <p><strong>Words:</strong> ${fanfic.wordCount.toLocaleString('es-ES')}</p>
                        <p><strong>Fecha terminada:</strong> ${escapeHtml(fanfic.finishedDate)}</p>
                        <p><strong>AO3 URL:</strong> <a href="${escapeHtml(fanfic.ao3Url)}" target="_blank" rel="noopener noreferrer">Abrir en AO3</a></p>
                    </div>

                    ${renderTagGroup('Warnings', fanfic.warnings)}
                    ${renderTagGroup('Parejas', fanfic.relationships)}
                    ${renderTagGroup('Fandoms', fanfic.fandoms)}
                    ${renderTagGroup('Categorias', fanfic.categories)}

                    <form class="edit-form" data-fanfic-id="${fanfic.id}">
                        <div class="edit-form__fields">
                            <label class="campo">
                                <span>Fecha terminada</span>
                                <input type="date" name="finishedDate" value="${escapeHtml(fanfic.finishedDate)}" required>
                            </label>
                            <label class="campo">
                                <span>Estrellas</span>
                                <select name="userStars" required>
                                    ${renderStarOptions(fanfic.userStars)}
                                </select>
                            </label>
                        </div>
                        <div class="edit-form__actions">
                            <button class="boton-secundario" type="submit">Guardar cambios</button>
                            <button class="danger-button" type="button" data-action="delete-fanfic" data-fanfic-id="${fanfic.id}">Borrar entrada</button>
                        </div>
                        <p class="edit-form__feedback"></p>
                    </form>
                </div>
            </div>
        </article>
    `;
}

function renderStarOptions(actual) {
    return [5, 4, 3, 2, 1].map(valor => `
        <option value="${valor}" ${valor === actual ? 'selected' : ''}>${valor} estrella${valor === 1 ? '' : 's'}</option>
    `).join('');
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

async function solicitar(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options
    });

    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (response.status === 401) {
        actualizarSesion(null);
    }

    return { response, data };
}

function escapeHtml(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

init();
