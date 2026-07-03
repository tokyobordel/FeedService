package notify

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"
	"traineesheep/feedservice/internal/utils"
)

// sendPayload - отправка уведомления в NotificationService
func sendPayload(payload map[string]interface{}) {
    notifyURL := utils.GetEnv("NOTIFY_URL", "")
    if notifyURL == "" {
        log.Println("Уведомления отключены")
        return;
    }
    
    body, err := json.Marshal(payload)
    if err != nil {
        log.Printf("Ошибка формирования уведомления: %v", err)
        return
    }

    client := &http.Client{Timeout: 5 * time.Second}
    resp, err := client.Post(notifyURL, "application/json", bytes.NewReader(body))
    if err != nil {
        log.Printf("Ошибка отправки уведомления: %v", err)
        return
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        log.Printf("Уведомление не доставлено, статус: %d", resp.StatusCode)
    } else {
        log.Printf("Уведомление отправлено")
    }
}