package notify

import (
	"fmt"
	"log"
	"traineesheep/feedservice/internal/middleware"
)

// NotifyUserConfirm отправляет уведомление пользователю о подтверждении почты
func NotifyUserConfirm(localAddr string, id int, username string, email string) {
	conifrmToken, tokenError := middleware.GenerateConfirmToken(id)

	if tokenError != nil {
		log.Printf("Не удалось сгенерировать токен для пользователя %s[id=%d]", username)
	} else {
		url := localAddr + "/confirm?token=" + conifrmToken
		msg := fmt.Sprintf("%s, перейдите по ссыслке для подтверждения регистрации перейдите по ссылке: %s",
			username, url)

		payload := map[string]interface{}{
			"notify_type": "user_register", // todo изменить на user_confirm
			"email":       email,
			"message":     msg,
			"telegram_id": 924956695,
		}

		sendPayload(payload)
	}
}
