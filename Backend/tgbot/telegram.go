package tgbot

import (
	"context"
	"fmt"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

type MsgDTO struct {
	Content string
	Chat_ID int64
}

func NewMsgDTO(content string, chat_id int64) *MsgDTO {
	return &MsgDTO{
		Content: content,
		Chat_ID: chat_id,
	}
}

func (d MsgDTO) HandleSendMessage(b *bot.Bot, ctx context.Context) {
	if _, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:    d.Chat_ID,
		Text:      d.Content,
		ParseMode: models.ParseModeHTML,
	}); err != nil {
		fmt.Println("Error:", err.Error())
	}
}

func Handler(ctx context.Context, b *bot.Bot, update *models.Update) {

}
