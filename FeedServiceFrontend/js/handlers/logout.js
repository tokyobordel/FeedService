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

/**
 * Инициализирует обработчик клика по кнопке выхода (`#btnLogout`).
 *
 * При клике:
 * - Отправляет POST-запрос на `/api/logout` для инвалидации сессии на сервере
 *   (ошибка запроса игнорируется).
 * - Очищает локальную сессию вызовом {@link clearSession}.
 * - Обновляет интерфейс вызовом глобальной функции {@link showGuestUI}.
 *
 * @function initLogoutHandler
 * @global
 * @requires HTML-элемент с id: `btnLogout`.
 * @requires {function} showGuestUI - глобальная функция для отображения
 *           гостевого интерфейса.
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
        }
        clearSession();
        showGuestUI();
    });
}