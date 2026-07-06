/**
 * Инициализирует обработчик отправки формы регистрации (`#signupForm`).
 *
 * Выполняет клиентскую валидацию:
 * - Все поля (логин, email, пароль, подтверждение) обязательны.
 * - Пароль и подтверждение должны совпадать.
 * - Email должен соответствовать паттерну `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
 *
 * При успешной регистрации вызывает {@link closeModal} для закрытия модального окна
 * (предполагается, что форма находится внутри модального окна, на которое ссылается
 * глобальная переменная `signupModal`).
 *
 * Ошибки (сетевые, API или валидации) выводятся в элемент `#signupError`.
 *
 * @function initSignupHandlers
 * @global
 * @requires HTML-элементы с id: `signupForm`, `signupError`, `signupUsername`,
 *           `signupEmail`, `signupPassword`, `signupConfirm`.
 * @requires {HTMLElement} signupModal - глобальная переменная, содержащая
 *           DOM-элемент модального окна, которое будет закрыто после успешной регистрации.
 * @requires closeModal - глобальная функция для закрытия модального окна.
 * @returns {void}
 *
 * @example
 * // Вызов после загрузки DOM
 * document.addEventListener('DOMContentLoaded', initSignupHandlers);
 */
export function initSignupHandlers() {
    const signupForm = document.getElementById('signupForm');
    const signupError = document.getElementById('signupError');
    const confirmModal = document.getElementById('confirmModal');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signupError.textContent = '';

        const username = document.getElementById('signupUsername').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirm = document.getElementById('signupConfirm').value;

        // Валидация
        if (!username || !email || !password || !confirm) {
            signupError.textContent = 'Заполните все обязательные поля';
            return;
        }

        if (password !== confirm) {
            signupError.textContent = 'Пароли не совпадают';
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            signupError.textContent = 'Введите корректный email';
            return;
        }

        const payload = {
            username,
            password,
            email,
        };

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

            closeModal(signupModal); // форма сбросится

            openModal(confirmModal)

            // data.data должен содержать { user }
            const { user } = data.data;
            if (!user) {
                throw new Error('Некорректный ответ сервера');
            }

            // Сохраняем сессию
            saveSession(user);

            // Обновляем UI
            showLoggedInUI(user);

            toggleConfirmedUI()
        } catch (err) {
            signupError.textContent = err.message;
        }
    });
}