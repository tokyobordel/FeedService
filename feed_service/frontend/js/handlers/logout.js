/**
 * Удаляет данные пользователя из localStorage, очищая сессию.
 *
 * @function clearSession
 * @returns {void}
 *
 * @example
 * clearSession();
 * // После вызова localStorage не содержит ключ 'user'.
 */
export function clearSession() {
    localStorage.removeItem('user');
}

import { showGuestUI } from '../index.js';

/**
 * Инициализирует обработчик клика по кнопке выхода (`#btnLogout`).
 *
 * При клике:
 * - Отправляет POST-запрос на `/api/logout` для инвалидации сессии на сервере
 *   (ошибка запроса игнорируется).
 * - Очищает локальную сессию вызовом {@link module:handlers/logout.clearSession}.
 * - Обновляет интерфейс вызовом {@link module:main.showGuestUI}.
 *
 * @function initLogoutHandler
 * @requires module:main.showGuestUI
 * @requires HTML-элемент с id: `btnLogout`.
 * @returns {void}
 *
 * @example
 * // Вызов после загрузки DOM
 * document.addEventListener('DOMContentLoaded', initLogoutHandler);
 */
export function initLogoutHandler() {
    const btnLogout = document.getElementById('btnLogout');

    btnLogout.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            // игнорируем ошибку запроса
        }
        clearSession();
        showGuestUI();
    });
}