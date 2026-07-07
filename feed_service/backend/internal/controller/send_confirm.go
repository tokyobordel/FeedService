package controller

import (
	"log"
	client "traineesheep/feedservice/internal/client/notify"
	"traineesheep/feedservice/internal/utils"

	"github.com/gofiber/fiber/v2"
)

func (ctrl *Controller) SendConfirm(c *fiber.Ctx) error {
	userID, ok := c.Locals("user").(int)

	if !ok {
		log.Println("Отсутствует ID внутри контекста")
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       nil,
			Success:    false,
			ErrMessage: "Некорректные данные",
		})
	}

	user, userError := ctrl.UserService.GetByID(userID)
	if userError != nil {
		log.Println("Передан некорректный user_id")
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       "Некорректные данные",
			Success:    true,
			ErrMessage: "",
		})
	}

	sendError := client.SendConfirmationEmail(user)
	if sendError != nil {
		log.Printf("GET /send_confirm: Ошибка отправки уведомления на почту %s")
		return c.Status(fiber.StatusBadRequest).JSON(utils.ApiResponse{
			Data:       "Ошибка отправки уведомления на почту. Попробуй позж",
			Success:    true,
			ErrMessage: "",
		})
	}

	log.Printf("GET /send_confirm: Отправлено уведомление на почту %s", user.Email)
	return c.JSON(utils.ApiResponse{
		Data:       "Уведомление о подтверждении отправлено",
		Success:    true,
		ErrMessage: "",
	})
}
