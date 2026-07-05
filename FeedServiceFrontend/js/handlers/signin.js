/**
 * Инициализирует обработчик отправки формы входа (`#signinForm`).
 *
 * Выполняет клиентскую валидацию: поля логина и пароля обязательны.
 *
 * При успешном входе:
 * - сохраняет сессию пользователя через {@link window.saveSession},
 * - обновляет интерфейс вызовом {@link showLoggedInUI},
 * - закрывает модальное окно через {@link closeModal} (предполагается,
 *   что форма находится в модальном окне, доступном через глобальную
 *   переменную `signinModal`).
 *
 * Ошибки (сетевые, API, отсутствие обязательных данных в ответе)
 * выводятся в элемент `#signinError`.
 *
 * @function initSigninHandlers
 * @global
 * @requires HTML-элементы с id: `signinForm`, `signinError`, `signinUsername`,
 *           `signinPassword`.
 * @requires {HTMLElement} signinModal - глобальная переменная, содержащая
 *           DOM-элемент модального окна, которое будет закрыто после успешного входа.
 * @requires {function} showLoggedInUI - глобальная функция для обновления
 *           интерфейса после входа, принимает объект пользователя.
 * @requires {function} closeModal - глобальная функция для закрытия
 *           переданного модального окна.
 * @returns {void}
 *
 * @example
 * // Вызов после загрузки DOM
 * document.addEventListener('DOMContentLoaded', initSigninHandlers);
 */
export function initSigninHandlers() {
    const signinForm = document.getElementById('signinForm');
    const signinError = document.getElementById('signinError');

    // Сохраняем токены и пользователя в localStorage
    window.saveSession = (user) => {
        localStorage.setItem('user', JSON.stringify(user));
    }

    signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signinError.textContent = '';

        const username = document.getElementById('signinUsername').value.trim();
        const password = document.getElementById('signinPassword').value;

        if (!username || !password) {
            signinError.textContent = 'Заполните все поля';
            return;
        }

        try {
            const response = await fetch('/api/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.err_message || 'Ошибка входа');
            }

            // data.data должен содержать { access_token, refresh_token, user }
            const { access_token, refresh_token, user } = data.data;
            if (!access_token || !refresh_token || !user) {
                throw new Error('Некорректный ответ сервера');
            }

            // Сохраняем сессию
            saveSession(user);

            // Обновляем UI
            showLoggedInUI(user);

            closeModal(signinModal);
        } catch (err) {
            signinError.textContent = err.message;
        }
    });
}