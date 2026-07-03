package webhook_handler

import (
	"bytes"
	"fmt"
	"net/http"
)

func SendWebhookMessage(url string, body_byte []byte) {
	client := &http.Client{}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body_byte))
	if err != nil {
		fmt.Println("Error while trying to create new request", err.Error())
		return
	}

	// response не получаем потому что он нам не нужен
	_, err = client.Do(req)
	if err != nil {
		fmt.Println("Error while trying to exec request:", err.Error())
		return
	}

	fmt.Println("Я отправил запрос на сайт", url)
}
