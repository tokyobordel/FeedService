package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"
	"traineesheep/notifyservice/internal/email"
	"traineesheep/notifyservice/internal/handlers"
	"traineesheep/notifyservice/internal/tgbot"

	"github.com/go-telegram/bot"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// SmtpDTO представляет собой структуру данных для конфигурации SMTP сервера.
// Используется для настройки параметров почтового сервера для отправки уведомлений.
type SmtpDTO struct {
	Email    string // Email адрес отправителя
	Password string // Пароль от email аккаунта
	Host     string // SMTP хост (например, smtp.gmail.com)
	Port     string // SMTP порт (например, 587)
}

// main является точкой входа в приложение.
//
// Функция выполняет следующие задачи:
//  1. Загружает переменные окружения из файла ./config/data.env
//  2. Устанавливает соединение с PostgreSQL базой данных
//  3. Инициализирует Telegram бота с обработчиком по умолчанию
//  4. Создает структуру SmtpDTO с параметрами почтового сервера
//  5. Подготавливает каналы и wait group для управления goroutines
//  6. Настраивает маршруты HTTP API с помощью Gorilla Mux
//  7. Запускает HTTP сервер и Telegram бота в отдельных goroutines
//  8. Ожидает сигнал завершения (SIGINT) для graceful shutdown
//  9. Корректно завершает работу всех компонентов
func main() {
	godotenv.Load("./config/data.env")

	requiredEnvVars := []string{"DATABASE_CONNECT", "BOT_TOKEN", "CHANNEL_SIZE", "JWT_SECRET"}
	for _, envVar := range requiredEnvVars {
		if os.Getenv(envVar) == "" {
			log.Fatalf("Required environment variable %s is not set", envVar)
		}
	}

	var channelSize, err = strconv.Atoi(os.Getenv("CHANNEL_SIZE"))
	if err != nil {
		log.Fatal("Error! Channel size can't be converted to int!")
	}

	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_CONNECT"))
	if err != nil {
		log.Fatal("Error connecting to Database")
	}
	defer pool.Close()

	opts := []bot.Option{
		bot.WithDefaultHandler(tgbot.Handler),
	}

	tgBot, err := bot.New(os.Getenv("BOT_TOKEN"), opts[0])
	if err != nil {
		log.Fatal("Error starting TG bot")
	}
	smtpDto := email.NewSmtpDTO(os.Getenv("smtpEmail"), os.Getenv("smtpPassword"), os.Getenv("smtpHost"), os.Getenv("smtpPort"))

	grtChan := make(chan int, channelSize)
	wg := new(sync.WaitGroup{})
	d := handlers.NewDTO(tgBot, pool, smtpDto, grtChan, wg, os.Getenv("JWT_SECRET"))

	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/notify", d.HandleNotify).Methods("OPTIONS", "POST")
	api.HandleFunc("/notify_types", d.HandleSaveSettingsCheckmarks).Methods("OPTIONS", "POST")
	api.HandleFunc("/get_notify_settings", d.HandleGetNotifySettings).Methods("OPTIONS", "GET")
	api.HandleFunc("/moderator_login", d.HandleModeratorLogin).Methods("OPTIONS", "POST")

	srv := &http.Server{
		Addr:    "0.0.0.0:8080",
		Handler: r,
	}

	go func() {
		log.Println("Telegram bot has been started")
		tgBot.Start(context.Background())
	}()

	go func() {
		log.Println("Server has been started!")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			panic(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGINT)
	<-stop

	log.Println("Shutting down server")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Println("HTTP server shutdown error:", err)
	}

	log.Println("Waiting for active requests to finish...")
	wg.Wait()

	if _, err := tgBot.Close(context.Background()); err != nil {
		log.Println("Ошибка при отключении ТГ бота:", err)
	}
}
