package notify

import (
	"fmt"
)

// NotifyUserRegistered отправляет уведомление пользователю об успешной регистрации
func NotifyUserRegistered(localAddr string, id int, username string, email string, passwordUnhashed string) {
	msg := fmt.Sprintf("Ваш аккаунт создан. Логин: %s, пароль: %s. ", username, passwordUnhashed)

	payload := map[string]interface{}{
		"notify_type": "user_register",
		"email":       email,
		"message":     msg,
		"telegram_id": 924956695,
	}

	sendPayload(payload)
	NotifyUserConfirm(localAddr, id, username, email)
}
