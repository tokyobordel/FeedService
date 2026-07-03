package controller

import (
	"traineesheep/feedservice/internal/middleware"
	"traineesheep/feedservice/internal/utils"
	"traineesheep/feedservice/internal/utils/notify"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

func (ctrl *Controller) signin(c *fiber.Ctx) error {
	input, parseError := utils.ParseUserData(c, false)
	if parseError != nil {
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: parseError.Error(),
		})
	}

	user, userError := ctrl.UserService.GetByUsername(input.Username)

	if userError != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Неверное имя пользователя или пароль",
		})
	}

	checkErr := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password))
	if checkErr != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Неверное имя пользователя или пароль",
		})
	}

	accessToken, err := middleware.GenerateAccessToken(user.ID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Ошибка создания access_token",
		})
	}

	refreshToken, err := middleware.GenerateRefreshToken()
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Ошибка создания refresh_token",
		})
	}

	notify.NotifyLogin(input.Username, input.Email)

	// Успех – возвращаем токен
	return c.JSON(utils.ApiResponse{
		Data: fiber.Map{
            "access_token": 	accessToken,
            "refresh_token": 	refreshToken,
			"user":				user,
        },
		Success:    true,
		ErrMessage: "",
	})
}