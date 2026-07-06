package controller

import (
	"log"
	"strconv"
	"traineesheep/feedservice/internal/utils"
	"traineesheep/feedservice/internal/utils/notify"

	"github.com/gofiber/fiber/v2"
)

func (ctrl *Controller) SendConfrim(c *fiber.Ctx) error {
	userID := c.Query("user_id")

	if userID == "" {
		log.Println("Передан некорректный user_id")
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       "Некорректные данные",
			Success:    true,
			ErrMessage: "",
		})
	}

	userIDInt, userIDError := strconv.Atoi(userID)
	if userIDError != nil {
		log.Println("Передан некорректный user_id")
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       "Некорректные данные",
			Success:    true,
			ErrMessage: "",
		})
	}

	user, userError := ctrl.UserService.GetByID(userIDInt)
	if userError != nil {
		log.Println("Передан некорректный user_id")
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       "Некорректные данные",
			Success:    true,
			ErrMessage: "",
		})
	}

	localAddr := "http://" + utils.GetEnv("PUBLIC_HOST", c.Context().LocalAddr().String())
	notify.NotifyUserConfirm(localAddr, userIDInt, user.Username, user.Email)

	log.Printf("GET /send_confirm: Отправлено уведомление на почту %s", user.Email)
	return c.JSON(utils.ApiResponse{
		Data:       "Уведомление о подтверждении отправлено",
		Success:    true,
		ErrMessage: "",
	})
}
