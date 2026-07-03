package controller

import (
	"traineesheep/feedservice/internal/middleware"
	"traineesheep/feedservice/internal/service"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	UserService *service.UserService
	FeedService *service.FeedService
	TokenService *service.TokenService
}


func Create(app *fiber.App, us *service.UserService, 
		fs *service.FeedService, ts *service.TokenService) {
	// Инициализация контроллера. Через него реализовано прокидывание контекста
	ctrl := &Controller{
		UserService: us,
		FeedService: fs,
		TokenService: ts,
	}

	// Загрузка всей отсортированной ленты
	app.Get("/feed", ctrl.Feed)

	// Загрузка отсортированной ленты пользователя
	// app.Get("/feed?user_id=:userID", ctrl.UserFeed)

	// Вход
	app.Post("/signin", ctrl.signin)

	// Регистрация
	app.Post("/signup", ctrl.signup)

	// Удаление токена у пользователя
	app.Post("/logout", ctrl.Logout)

	// Загрузка изображений
	app.Post("/upload", middleware.AuthRequired, ctrl.Upload)
}