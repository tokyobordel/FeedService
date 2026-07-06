package controller

import (
	"log"
	"traineesheep/feedservice/internal/client/notify"
	"traineesheep/feedservice/internal/middleware"
	"traineesheep/feedservice/internal/utils"

	"github.com/gofiber/fiber/v2"
)

// Signup обрабатывает POST-запрос на регистрацию нового пользователя.
//
// Ожидает JSON с полями username, email и password.
// Проверяет уникальность имени пользователя, создаёт
// запись в базе данных и отправляет уведомление о регистрации.
//
// Возможные ответы:
//   - 201: { success: true, data: созданный_пользователь }
//   - 400: { success: false, err_message: описание ошибки разбора }
//   - 409: { success: false, err_message: "Пользователь с таким именем уже существует" }
//   - 500: { success: false, err_message: "Ошибка базы данных" или "Не удалось создать пользователя. " }
func (ctrl *Controller) Signup(c *fiber.Ctx) error {
	input, parseError := utils.ParseUserData(c, true)
	if parseError != nil {
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: parseError.Error(),
		})
	}

	isUserExists, dbError := ctrl.UserService.ExistsByUsername(input.Username)

	if dbError != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Ошибка базы данных",
		})
	}

	if isUserExists {
		return c.Status(fiber.StatusConflict).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Пользователь с таким именем уже существует",
		})
	}

	user, userError := ctrl.UserService.CreateUser(input)

	if userError != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Не удалось создать пользователя. ",
		})
	}

	localAddr := "http://" + utils.GetEnv("PUBLIC_HOST", c.Context().LocalAddr().String())
	notify.NotifyUserRegistered(localAddr, user.ID, user.Username, user.Email, input.Password)

	accessToken, err := middleware.GenerateAccessToken(user.ID)
	if err != nil {
		log.Println(err)
		return c.Status(fiber.StatusUnauthorized).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Ошибка создания access_token",
		})
	}

	refreshToken, err := middleware.GenerateRefreshToken(user.ID)
	if err != nil {
		log.Println(err)
		return c.Status(fiber.StatusUnauthorized).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Ошибка создания refresh_token",
		})
	}
	utils.SetTokens(c, accessToken, refreshToken)

	log.Printf("POST /signup: Пользователь %s зарегистрирован", user.Username)
	// Успешная регистрация – возвращаем созданного пользователя
	return c.Status(fiber.StatusCreated).JSON(utils.ApiResponse{
		Data: fiber.Map{
			"user": user,
		},
		Success:    true,
		ErrMessage: "",
	})
}
