package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"
	"traineesheep/feedservice/internal/utils"
	_ "github.com/lib/pq"
)


func New() *sql.DB {
	var db *sql.DB

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		utils.GetEnv("DB_HOST", "localhost"),
		utils.GetEnv("DB_PORT", "5432"),
		utils.GetEnv("DB_USER", "postgres"),
		utils.GetEnv("DB_PASSWORD", "123"),
		utils.GetEnv("DB_NAME", "postgres"),
		utils.GetEnv("DB_SSLMODE", "disable"),
	)

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Не удалось открыть БД: %v", err)
	}

	// Настройка пула соединений
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err = db.Ping(); err != nil {
		log.Fatalf("Нет соединения с БД: %v", err)
	}

	log.Println("Подключение к базе данных установлено")

	return db
}