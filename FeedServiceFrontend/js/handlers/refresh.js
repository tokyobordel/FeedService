import { clearSession } from "./logout";

/**
 * Обновляет токен доступа, отправляя GET-запрос на `/api/refresh`.
 *
 * Ожидает, что сервер вернёт JSON с полями `success: true` и `data`, содержащей
 * `access_token` и `user`. При успехе вызывает глобальную {@link saveSession} для
 * сохранения обновлённых данных пользователя.
 *
 * В случае любой ошибки (сетевой, некорректный ответ, отсутствие токена/пользователя)
 * вызывает {@link clearSession} и выводит сообщение в консоль.
 *
 * @async
 * @function refreshAccessToken
 * @global
 * @requires clearSession - функция из модуля `./logout` для очистки сессии.
 * @requires window.saveSession - глобальная функция для сохранения данных пользователя
 *           (см. {@link initSigninHandlers}).
 * @returns {Promise<void>} Промис, который разрешается после обработки ответа или ошибки.
 *
 * @example
 * // Вызов при старте приложения для проверки валидности сессии
 * refreshAccessToken().then(() => {
 *   console.log('Токен обновлён или сессия очищена');
 * });
 */
export async function refreshAccessToken() {
    try {
        const response = await fetch('/api/refresh', {
            method: 'GET',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            clearSession()
            throw new Error(data.err_message || 'Токен некорректный');
        }

        // data.data должен содержать { access_token, user }
        const {access_token, user} = data.data;
        if (!access_token || !user) {
            clearSession()
            throw new Error('Некорректный ответ сервера');
        }

        // Сохраняем сессию
        saveSession(user);
    } catch (err) {
        clearSession()
        console.log(err.message);
    }
}