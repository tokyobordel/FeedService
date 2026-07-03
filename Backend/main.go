package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"
	"traineesheep/notifyservice/email"
	"traineesheep/notifyservice/handlers"
	"traineesheep/notifyservice/tgbot"

	"github.com/go-telegram/bot"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type TempDTO struct {
	Content string
	Chat_ID int
	Smtp    SmtpDTO
}

type SmtpDTO struct {
	Email    string
	Password string
	Host     string
	Port     string
}

func NewTempDTO(content string, chat_id int) TempDTO {
	return TempDTO{Content: content, Chat_ID: chat_id}
}

func main() {
	godotenv.Load("./config/data.env")

	var channel_size, _ = strconv.Atoi(os.Getenv("CHANNEL_SIZE"))

	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_CONNECT"))
	//conn, err := pgx.Connect(context.Background(), os.Getenv("DATABASE_CONNECT"))
	if err != nil {
		panic(err)
	}
	//defer conn.Close(context.Background())
	defer pool.Close()

	opts := []bot.Option{
		bot.WithDefaultHandler(tgbot.Handler),
	}

	bot, err := bot.New(os.Getenv("BOT_TOKEN"), opts[0])
	if err != nil {
		panic(err)
	}
	smtpDto := email.NewSmtpDTO(os.Getenv("smtpEmail"), os.Getenv("smtpPassword"), os.Getenv("smtpHost"), os.Getenv("smtpPort"))

	grtChan := make(chan int, channel_size)
	wg := &sync.WaitGroup{}
	d := handlers.NewDTO(pool, bot, smtpDto, grtChan, wg)

	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/notify", d.HandleNotify).Methods("OPTIONS", "POST")
	api.HandleFunc("/notify_types", d.HandleSaveSettingsCheckmarks).Methods("OPTIONS", "POST")
	api.HandleFunc("/get_notify_settings", d.HandleGetNotifySettings).Methods("OPTIONS", "GET")
	//r.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))

	srv := &http.Server{
		Addr:    "0.0.0.0:8080",
		Handler: r,
	}

	go func() {
		fmt.Println("Telegram bot has been started")
		bot.Start(context.Background())
	}()

	go func() {
		fmt.Println("Server has been started!")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			panic(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGINT)
	<-stop

	fmt.Println("Shutting down server")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		fmt.Println("HTTP server shutdown error:", err)
	}

	fmt.Println("Waiting for active requests to finish...")
	wg.Wait()

	if _, err := bot.Close(context.Background()); err != nil {
		fmt.Println("Tg bot close error:", err)
	}
}
