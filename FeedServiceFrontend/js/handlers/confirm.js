export function initRepeatConfirmHandlers() {
    const confirmBtn = document.getElementById('repeat-confirm');
    const confirmError = document.getElementById('confirm-error');

    confirmBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        signupError.textContent = '';

        const user = getSavedUser()

        if(user) {
            try {
                const response = await fetch('/api/send_confirm?user_id=' + user.id, {
                    method: 'GET',
                    headers: {'Content-Type': 'application/json'},
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.err_message || 'Ошибка. Попробуйте позже');
                }
            } catch (err) {
                confirmError.textContent = err.message;
            }
        }
    });
}