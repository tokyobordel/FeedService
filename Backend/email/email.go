package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
)

type SmtpDTO struct {
	Email    string
	Password string
	Host     string
	Port     string
}

func NewSmtpDTO(e string, p string, h string, port string) *SmtpDTO {
	return &SmtpDTO{
		Email:    e,
		Password: p,
		Host:     h,
		Port:     port,
	}
}

func (s SmtpDTO) SendMessage(receiverEmails []string, message []byte) {
	tlsConfig := &tls.Config{
		ServerName: s.Host,
	}

	conn, err := tls.Dial("tcp", s.Host+":"+s.Port, tlsConfig)
	if err != nil {
		fmt.Print("подключение TLS:", err.Error())
		return
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		fmt.Printf("создание клиента: %w", err)
		return
	}
	defer client.Quit()

	auth := smtp.PlainAuth("", s.Email, s.Password, s.Host)
	if err = client.Auth(auth); err != nil {
		fmt.Printf("аутентификация: %w", err)
		return
	}

	if err = client.Mail(s.Email); err != nil {
		fmt.Printf("отправитель: %w", err)
		return
	}

	for _, rcpt := range receiverEmails {
		if err = client.Rcpt(rcpt); err != nil {
			fmt.Printf("получатель %s: %w", rcpt, err)
			return
		}
	}

	w, err := client.Data()
	if err != nil {
		fmt.Printf("открытие Data: %w", err)
		return
	}
	defer w.Close()

	temp_message := string(message)
	temp_message = strings.ReplaceAll(temp_message, "<b>", "")
	temp_message = strings.ReplaceAll(temp_message, "</b>", "")
	byte_temp_message := []byte(temp_message)

	_, err = w.Write(byte_temp_message)
	if err != nil {
		fmt.Printf("запись письма: %w", err)
		return
	}
}
