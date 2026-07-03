package models

import (
	"time"
)

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email  	  string    `json:"email"`
	TgChatId  string    `json:"tg_chat_id"`
	CreatedAt time.Time `json:"post_id"`
	Password  string    `json:"-"`
}