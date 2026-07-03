package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"traineesheep/notifyservice/email"
	"traineesheep/notifyservice/errs"
	"traineesheep/notifyservice/tgbot"
	"traineesheep/notifyservice/webhook_handler"

	"github.com/go-telegram/bot"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DTO struct {
	sql_connection *pgxpool.Pool
	bot            *bot.Bot
	smtp           *email.SmtpDTO
	grtsChannels   chan int
	wg             *sync.WaitGroup
}

func NewDTO(conn *pgxpool.Pool, token *bot.Bot, smtp *email.SmtpDTO, channel chan int, wg *sync.WaitGroup) *DTO {
	return &DTO{sql_connection: conn, bot: token, smtp: smtp, grtsChannels: channel, wg: wg}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type ResponseData struct { // структура ответа
	Success       bool     `json:"success"`
	Error_message string   `json:"err_message"`
	Data          Recipent `json:"data"`
}

type WebhookData struct {
	Url               string   `json:"url"`
	NotificationTypes []string `json:"notificationTypes"`
}

type Recipent struct {
	Email       string `json:"email"`
	Notify_Type string `json:"notify_type"`
	Message     string `json:"message"`
	Telegram    int64  `json:"telegram_id"`
}

type MsgDTO struct {
	Content string
	Chat_id int64
}

type NotifyTypeMessenger struct {
	NotifyType   string `json:"notify_type"`
	WantEmail    bool   `json:"want_email"`
	WantTelegram bool   `json:"want_telegram"`
	WantWebhook  bool   `json:"want_webhook"`
}

type NotifyTypeMessengerList struct {
	Data        []NotifyTypeMessenger `json:"data"`
	WebhookData WebhookData           `json:"webhookData"`
}

func enableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// Функция для отправки уведомлений
func (d DTO) HandleNotify(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Ограничиваем количество одновременно запущенных горутин
	// Чтобы обрабатывать одновременно за раз не больше CHANNEL_SIZE
	d.wg.Add(1)
	defer d.wg.Done()

	grtChan := d.grtsChannels
	grtChan <- 1
	defer func() { <-grtChan }()

	sql_conn := d.sql_connection

	var req Recipent

	body_data, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Println(errs.ErrReadingRequestMessage, err.Error())
		return
	}

	if err := json.Unmarshal(body_data, &req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Println(errs.ErrJsonUnmarshal, err.Error())
		return
	}

	var tg_user_id int64 = req.Telegram
	var user_email string = req.Email

	// Если пользователь зарегался, то добавляю в свою базу его почту и tg_id
	// Если этот tg_id был указан
	if req.Notify_Type == "user_register" {
		query := `INSERT INTO client (email, telegram_id) VALUES ($1, $2)`
		if _, err := sql_conn.Exec(context.Background(), query, user_email, tg_user_id); err != nil {
			fmt.Println("err:", err)
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("При попытке добавить данные в базу произошла ошибка: " + err.Error()))
		}
	}
	if req.Notify_Type == "user_email_confirmation" {
		var emails_to_send []string
		notification_message := req.Message
		emails_to_send = append(emails_to_send, user_email)
		d.smtp.SendMessage(emails_to_send, []byte(notification_message))
		return
	}

	var want_email bool
	var want_telegram bool
	var want_webhook bool
	var url string

	emails_to_send := make([]string, 0)

	// Получаем значения переключателей куда мы хотим получить уведомление
	query := `SELECT want_email, want_telegram, want_webhook, webhook_url FROM notify_type_message
	WHERE notify_type = $1`

	row := sql_conn.QueryRow(context.Background(), query, req.Notify_Type)
	row.Scan(&want_email, &want_telegram, &want_webhook, &url)

	notification_message := req.Message

	// Если мы хотим уведомление в ТГ
	if want_telegram {
		msgDto := tgbot.NewMsgDTO(notification_message, tg_user_id)
		msgDto.HandleSendMessage(d.bot, context.Background())
	}

	// Если мы хотим уведомление по Email
	if want_email {
		emails_to_send = append(emails_to_send, user_email)
		d.smtp.SendMessage(emails_to_send, []byte(notification_message))
	}

	// Если мы хотим уведомление по Webhook
	if want_webhook {
		webhook_handler.SendWebhookMessage(url, []byte(notification_message))
	}
}

// Функция для сохранения переключателей, куда мы хотим получать уведомления
func (d DTO) HandleSaveSettingsCheckmarks(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	sql_conn := d.sql_connection

	body_byte, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(errs.ErrReadingRequestMessage + err.Error()))
		return
	}

	var json_list NotifyTypeMessengerList
	if err := json.Unmarshal(body_byte, &json_list); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(errs.ErrJsonUnmarshal + err.Error()))
		return
	}

	fmt.Println("Был произведен запрос:", json_list)

	// После того как получили данные записываем их в базу, не создавая дубликаты
	for _, elem := range json_list.Data {
		query := `INSERT INTO notify_type_message (notify_type, want_telegram, want_email, want_webhook)
    		VALUES ($1, $2, $3, $4)
    		ON CONFLICT (notify_type) DO UPDATE SET
        	want_telegram = EXCLUDED.want_telegram,
        	want_email = EXCLUDED.want_email,
			want_webhook = EXCLUDED.want_webhook;`

		_, err := sql_conn.Exec(context.Background(), query, elem.NotifyType, elem.WantTelegram, elem.WantEmail, elem.WantWebhook)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
			return
		}
	}

	for _, elem := range json_list.WebhookData.NotificationTypes {
		query := `UPDATE notify_type_message SET webhook_url = $1 WHERE notify_type = $2`

		if _, err := sql_conn.Exec(context.Background(), query, json_list.WebhookData.Url, elem); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	fmt.Println("Я успешно записал настройки")
}

// Функция для получения настроек перключателей куда мы хотим получать уведомление
// (нужно для того чтобы при обновлении страницы модератора восстанавливались значения
// переключателей которые уже сейчас лежат в базе)
func (d DTO) HandleGetNotifySettings(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var json_list = make([]NotifyTypeMessenger, 0)

	sql_conn := d.sql_connection

	query := `SELECT notify_type, want_telegram, want_email, want_webhook FROM notify_type_message`
	rows, err := sql_conn.Query(context.Background(), query)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Println(err.Error())
		return
	}

	for rows.Next() {
		var notify_type string
		var want_email bool
		var want_telegram bool
		var want_webhook bool
		rows.Scan(&notify_type, &want_telegram, &want_email, &want_webhook)
		json_list = append(json_list, NotifyTypeMessenger{
			NotifyType:   notify_type,
			WantEmail:    want_email,
			WantTelegram: want_telegram,
			WantWebhook:  want_webhook,
		})
	}

	var json_data_list = NotifyTypeMessengerList{
		Data: json_list,
	}

	resp_byte, err := json.MarshalIndent(json_data_list, "", "    ")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Println("Error while trying to marshal indent:", err.Error())
		return
	}

	if _, err := w.Write(resp_byte); err != nil {
		fmt.Println(errs.ErrWritingToRespBody)
		return
	}

	fmt.Println("Я успешно получил настройки")
}
