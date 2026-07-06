package models

import (
	"time"
)

// User представляет зарегистрированного пользователя.
//
// Содержит идентификатор, имя, email, дату создания и пароль.
// Пароль (Password) не сериализуется в JSON (json:"-") и предназначен
// только для внутренней обработки.
type User struct {
	ID          int       `json:"id"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	IsConfirmed bool      `json:"is_confirmed"`
	CreatedAt   time.Time `json:"created_at"`
	Password    string    `json:"-"`
}
