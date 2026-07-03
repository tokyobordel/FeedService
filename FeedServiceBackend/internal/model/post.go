package models

type Post struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	Username    string    `json:"username,omitempty"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CreatedAt   string	  `json:"created_at"`
	Images      []int  	  `json:"images,omitempty"`
}