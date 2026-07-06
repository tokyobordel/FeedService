import { getSavedUser } from '../index.js';

/**
 * Инициализирует обработчик кнопки повторной отправки письма подтверждения (`#repeat-confirm`).
 *
 * При клике отправляет GET-запрос на `/api/send_confirm` с ID сохранённого пользователя.
 * В случае ошибки выводит сообщение в элемент `#confirm-error`.
 *
 * @function initRepeatConfirmHandlers
 * @requires module:main.getSavedUser
 * @requires HTML-элементы с id: `repeat-confirm`, `confirm-error`.
 * @returns {void}
 *
 * @example
 * // Вызов после загрузки DOM
 * document.addEventListener('DOMContentLoaded', initRepeatConfirmHandlers);
 */
export function initRepeatConfirmHandlers() {
    const confirmBtn = document.getElementById('repeat-confirm');
    const confirmError = document.getElementById('confirm-error');

    confirmBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        confirmError.textContent = '';
        confirmBtn.disabled = true;

        const user = getSavedUser();

        if (user) {
            try {
                const response = await fetch('/api/send_confirm?user_id=' + user.id, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.err_message || 'Ошибка. Попробуйте позже');
                }
            } catch (err) {
                confirmError.textContent = err.message;
            }
        }
        confirmBtn.disabled = false;
    });
}