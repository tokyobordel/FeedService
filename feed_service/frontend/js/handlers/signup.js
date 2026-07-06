/**
 * Инициализирует обработчик отправки формы регистрации (`#signupForm`).
 *
 * Выполняет клиентскую валидацию:
 * - Все поля (логин, email, пароль, подтверждение) обязательны.
 * - Пароль и подтверждение должны совпадать.
 * - Email должен соответствовать паттерну `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
 *
 * При успешной регистрации:
 * - Закрывает модальное окно регистрации (элемент с id `signupModal`).
 * - Открывает модальное окно подтверждения (элемент с id `confirmModal`).
 * - Сохраняет сессию через {@link module:main.saveSession}.
 * - Обновляет интерфейс вызовом {@link module:main.showLoggedInUI}
 *   и {@link module:main.toggleConfirmedUI}.
 *
 * Ошибки (сетевые, API или валидации) выводятся в элемент `#signupError`.
 *
 * @function initSignupHandlers
 * @requires module:main.closeModal
 * @requires module:main.openModal
 * @requires module:main.saveSession
 * @requires module:main.showLoggedInUI
 * @requires module:main.toggleConfirmedUI
 * @requires HTML-элементы с id: `signupForm`, `signupError`, `signupUsername`,
 *           `signupEmail`, `signupPassword`, `signupConfirm`,
 *           `signupModal`, `confirmModal`.
 * @returns {void}
 *
 * @example
 * // Вызов после загрузки DOM
 * document.addEventListener('DOMContentLoaded', initSignupHandlers);
 */
import { closeModal, openModal, saveSession, showLoggedInUI, toggleConfirmedUI } from '../index.js';

export function initSignupHandlers() {
    const signupForm = document.getElementById('signupForm');
    const signupError = document.getElementById('signupError');
    const signupModal = document.getElementById('signupModal');
    const confirmModal = document.getElementById('confirmModal');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signupError.textContent = '';
        e.submitter.disabled = true;

        const username = document.getElementById('signupUsername').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirm = document.getElementById('signupConfirm').value;

        if (!username || !email || !password || !confirm) {
            signupError.textContent = 'Заполните все обязательные поля';
            e.submitter.disabled = false;
            return;
        }

        if (password !== confirm) {
            signupError.textContent = 'Пароли не совпадают';
            e.submitter.disabled = false;
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            signupError.textContent = 'Введите корректный email';
            e.submitter.disabled = false;
            return;
        }

        const payload = { username, password, email };

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.err_message || 'Ошибка регистрации');
            }

            closeModal(signupModal);
            openModal(confirmModal);

            const { user } = data.data;
            if (!user) {
                throw new Error('Некорректный ответ сервера');
            }

            saveSession(user);
            showLoggedInUI(user);
            toggleConfirmedUI();
        } catch (err) {
            signupError.textContent = err.message;
        } finally {
            e.submitter.disabled = false;
        }
    });
}