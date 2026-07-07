package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
	jwt "traineesheep/feedservice/internal/middleware"
	models "traineesheep/feedservice/internal/model"
	"traineesheep/feedservice/internal/utils"
	"traineesheep/feedservice/pkg/email"
)

type NotifyClient struct {
	BaseURL string
	Client  *http.Client
}

func NewNotifyClient(baseURL string) *NotifyClient {
	return &NotifyClient{
		BaseURL: baseURL,
		Client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (nsc *NotifyClient) NotifyRegisterForAdmin(username string, email string) error {
	payload := map[string]interface{}{
		"notify_type": "user_register",
		"email":       email,
		"message":     username + " зарегистрирован",
	}

	return nsc.SendPayload(payload)
}

// Методы для внутренней отправки уведомлений через внутренний сервис, а не внешний
func SendConfirmationEmail(user models.User) error {
	smtpData, smtpError := utils.GetSMTPData()
	if smtpError != nil {
		return smtpError
	}

	// Создаем токен
	conifrmToken, err := jwt.GenerateConfirmToken(user.ID)

	if err != nil {
		log.Printf("Не удалось сгенерировать токен для пользователя %s[id=%d]", user.Username)
	} else {
		emailHost := utils.GetEnv("EMAIL_HOST", "http://localhost:3000")
		url := emailHost + "/api/confirm?token=" + conifrmToken
		msg := fmt.Sprintf("%s, перейдите по ссылке для подтверждения регистрации перейдите по ссылке: %s",
			user.Username, url)
		smtp := email.NewSmtpDTO(smtpData["SMTP_EMAIL"],
			smtpData["SMTP_PASSWORD"],
			smtpData["SMTP_HOST"],
			smtpData["SMTP_PORT"])
		smtp.SendMessage([]string{user.Email}, msg, "user_confirm")
	}

	return err
}

func (nsc *NotifyClient) SendUserdataEmail(username string,
	passwordUnhashed string, passedEmail string) error {
	smtpData, smtpError := utils.GetSMTPData()
	if smtpError != nil {
		return smtpError
	}

	msg := fmt.Sprintf("Вы зарегистрированы в сервисе. Логин: %s, пароль: %s",
		username, passwordUnhashed)
	smtp := email.NewSmtpDTO(smtpData["SMTP_EMAIL"],
		smtpData["SMTP_PASSWORD"],
		smtpData["SMTP_HOST"],
		smtpData["SMTP_PORT"])
	smtp.SendMessage([]string{passedEmail}, msg, "user_register")

	return nil
}

func (nsc *NotifyClient) SendPayload(payload map[string]interface{}) error {
	if nsc.BaseURL == "" {
		log.Println("Уведомления отключены")
		return fmt.Errorf("Уведомления отключены")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Ошибка формирования уведомления: %v", err)
		return fmt.Errorf("Ошибка формирования уведомления")
	}

	resp, err := nsc.Client.Post(nsc.BaseURL+"/notify", "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("Ошибка отправки уведомления: %v", err)
		return fmt.Errorf("Ошибка отправки уведомления")
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("Уведомление не доставлено, статус: %d", resp.StatusCode)
		return fmt.Errorf("Уведомление не доставлено")
	} else {
		log.Printf("Уведомление отправлено")
		return nil
	}
}
