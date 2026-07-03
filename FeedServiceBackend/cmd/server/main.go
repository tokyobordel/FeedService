package main

import (
	"log"
	"traineesheep/feedservice/internal/app"
	"traineesheep/feedservice/internal/controller"
	"traineesheep/feedservice/internal/database"
	"traineesheep/feedservice/internal/utils"
	"traineesheep/feedservice/internal/repository"
	"traineesheep/feedservice/internal/service"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	config := utils.GetEnv("DEPLOYMENT_CONFIG", "development")
	
	godotenv.Load(config + ".env")
	
	log.Printf("FeedServiceBackend: загружен %s конфиг\n", config)

	db := database.New() // соединяемся с БД

	database.Migrate(db) // инициализируем таблицы

	app := app.New() // создаём и конфигурируем fiber-приложение

	// Настройка сервисов и DAO
	userDAO := repository.NewUserDAO(db)
	userService := service.NewUserService(userDAO)

	feedDAO := repository.NewFeedDAO(db)
	feedService := service.NewFeedService(feedDAO)

	tokenDAO := repository.NewTokenDAO(db)
	tokenService := service.NewTokenService(tokenDAO)

	// Задаем маршрутизацию
	controller.Create(app, userService, feedService, tokenService)

	app.Listen(utils.GetEnv("BACKEND_HOST", ":8080"))
}
