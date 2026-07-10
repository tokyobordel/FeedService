package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"traineesheep/notifyservice/internal/database"
	"traineesheep/notifyservice/internal/errs"
	"traineesheep/notifyservice/internal/tgbot"
	"traineesheep/notifyservice/internal/types"
	"traineesheep/notifyservice/internal/webhook_handler"
	"traineesheep/notifyservice/pkg/email"

	"github.com/oklog/ulid/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var logMessage string

var TelegramID int64

// HandleNotify обрабатывает POST-запросы на отправку уведомлений.
//
// Endpoint: POST /api/notify
//
// Тело запроса должно содержать JSON с данными уведомления.
// Функция проверяет JWT токен, извлекает данные из запроса
// и запускает горутину для отправки уведомлений через различные каналы.
//
// Возможные коды ответа:
//   - 200: уведомление успешно принято к отправке
//   - 400: неверный формат запроса
//   - 401: невалидный или отсутствующий JWT токен
//   - 500: внутренняя ошибка сервера

// HandleNotify godoc
// @Summary Отправка уведомления
// @Description Принимает запрос на отправку уведомления пользователю по указанному типу.
// @Description Поддерживает отправку по Email, Telegram и Webhook в зависимости от настроек.
// @Description Требует JWT-токен в заголовке Authorization (если не требуется, уберите @Security).
// @Tags Notifications
// @Accept json
// @Produce json
// @Param request body types.Recipent true "Данные для отправки уведомления"
// @Success 200 {object} types.ResponseData "Уведомление успешно отправлено"
// @Failure 400 {object} types.ResponseData "Неверный формат запроса или недопустимый тип уведомления"
// @Failure 401 {object} types.ResponseData "Неавторизован (отсутствует или невалидный JWT токен)"
// @Failure 500 {object} types.ResponseData "Внутренняя ошибка сервера"
// @Router /api/notify [post]
// @Security ApiKeyAuth
func HandleNotify(w http.ResponseWriter, r *http.Request) {
	uid := ulid.Make()

	var response types.ResponseData
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	var req types.Recipent

	enableCors(w)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Ограничиваем количество одновременно запущенных горутин
	// Чтобы обрабатывать одновременно за раз не больше WORKER_COUNT
	Wg.Add(1)
	defer Wg.Done()

	grtChan := GrtChannels
	grtChan <- 1
	defer func() { <-grtChan }()

	body_data, err := io.ReadAll(r.Body)
	if err != nil {
		response.Success = false
		response.ErrorMessage = errs.ErrReadingRequestMessage + err.Error()
		responseByte, _ := json.MarshalIndent(response, "", "    ")
		w.WriteHeader(http.StatusInternalServerError)
		log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), response.ErrorMessage))
		if _, err := w.Write(responseByte); err != nil {
			log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), errs.ErrWritingToRespBody))
		}
		return
	}

	if err := json.Unmarshal(body_data, &req); err != nil {
		response.Success = false
		response.ErrorMessage = errs.ErrJsonUnmarshal + err.Error()
		responseByte, _ := json.MarshalIndent(response, "", "    ")
		log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), response.ErrorMessage))
		w.WriteHeader(http.StatusBadRequest)
		if _, err := w.Write(responseByte); err != nil {
			log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), errs.ErrWritingToRespBody))
		}
		return
	}

	logMessage = fmt.Sprintf("Был получен запрос на тип %v\n", req.NotifyType)
	log.Info().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
	logMessage = fmt.Sprintf("Сообщение для отправки: \"%v\"\n", req.Message)
	log.Info().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))

	//var tgUserId int64 = 924956695 // ВРЕМЕННО ЗАХАРДКОЖЕН ID ДО РЕАЛИЗАЦИИ ПОЛУЧЕНИЯ ИЗ ЧАТА
	var userEmail string = req.Email

	var isAllowed bool = false

	rows, err := database.GetNotifyTypes(types.Ctx)
	if err != nil {
		log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), err.Error()))
		return
	}

	if len(notifyTypesAllowed) == 0 {
		for rows.Next() {
			var temp string
			rows.Scan(&temp)
			notifyTypesAllowed = append(notifyTypesAllowed, temp)
		}
	}

	for _, elem := range notifyTypesAllowed {
		if elem == req.NotifyType {
			isAllowed = true
			break
		}
	}

	if !isAllowed {
		response.Success = false
		response.ErrorMessage = fmt.Sprintf("Недопустимый тип уведомления! %v", req.NotifyType)
		responseByte, _ := json.MarshalIndent(response, "", "    ")
		log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), response.ErrorMessage))
		w.WriteHeader(http.StatusBadRequest)
		if _, err := w.Write(responseByte); err != nil {
			log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), errs.ErrWritingToRespBody))
			return
		}
		return
	}

	// Если пользователь зарегался, то добавляю в свою базу его почту и user_id и выхожу
	if req.NotifyType == "user_register" {
		if err := database.AddEmail(types.Ctx, userEmail); err != nil {
			response.Success = false
			response.ErrorMessage = "При попытке добавить данные в базу произошла ошибка: " + err.Error()
			responseByte, _ := json.MarshalIndent(response, "", "    ")
			log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), response.ErrorMessage))
			w.WriteHeader(http.StatusBadRequest)
			if _, err := w.Write(responseByte); err != nil {
				log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), errs.ErrWritingToRespBody))
				return
			}
			return
		}
		logMessage = "Регистрация пользователя успешна. Добавление в базу!\n"
		log.Info().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
		return // выходим, я больше не отправляю такие сообщения
	}

	var checks types.CheckboxesParams

	emailsToSend := make([]string, 0)

	// Получаем значения переключателей куда мы хотим получить уведомление
	err, checks = database.GetCheckboxSettings(types.Ctx, req.NotifyType)
	if err != nil {
		logMessage = fmt.Sprintf("При обращении к базе данных произошла ошибка %v\n", err)
		log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
		return
	}

	notificationMessage := req.Message

	// Если мы хотим уведомление в ТГ
	if checks.WantTelegram {
		if err := tgbot.SendMessage(TgBot, types.Ctx, TelegramID, notificationMessage); err != nil {
			logMessage = fmt.Sprintf("Ошибка при отправке пользователю уведомления в Telegram: %v", err)
			log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
		} else {
			logMessage = fmt.Sprintf("Сообщение было доставлено в Telegram пользователю с id %v\n", TelegramID)
			log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
		}
	}

	// Если мы хотим уведомление по Email
	if checks.WantEmail {
		emailsToSend = append(emailsToSend, userEmail)
		if err := email.SendMessage(emailsToSend, notificationMessage, req.NotifyType); err != nil {
			logMessage = fmt.Sprintf("Ошибка при отправке сообщения на почту: %v\n", err)
			log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
		} else {
			logMessage = fmt.Sprintf("Сообщение было доставлено на почту %v\n", userEmail)
			log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
		}
	}

	// Если мы хотим уведомление по Webhook
	if len(checks.WantWebhook) != 0 {
		for _, url := range checks.WantWebhook {
			if err := webhook_handler.SendWebhookMessage(url, []byte(notificationMessage)); err != nil {
				logMessage = fmt.Sprintf("Ошибка при отправке сообщения на адрес %v: %v\n", url, err)
				log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
			} else {
				logMessage = fmt.Sprintf("Сообщение было доставлено на Webhook с URL %v\n", url)
				log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
			}
		}
	}

	response.Success = true
	response.ErrorMessage = ""
	responseByte, _ := json.MarshalIndent(response, "", "    ")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(responseByte); err != nil {
		log.Error().Msg(fmt.Sprintf("%v %v", uid.String(), errs.ErrWritingToRespBody))
		return
	}
	logMessage = "Отправка сообщений была успешно завершена!"
	log.Info().Msg(fmt.Sprintf("%v %v", uid.String(), logMessage))
}
