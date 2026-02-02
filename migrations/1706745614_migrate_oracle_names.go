package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// Migrate existing data: copy name to oracle_name, set name to github_username
		// For verified users (those with github_username), their current "name" is actually
		// the Oracle name, so we move it to oracle_name and set name to the human's github_username
		records, err := app.FindAllRecords("oracles")
		if err != nil {
			return err
		}

		for _, record := range records {
			githubUsername := record.GetString("github_username")
			oracleName := record.GetString("oracle_name")

			// Only migrate if:
			// 1. Has github_username (verified user)
			// 2. oracle_name is empty (not yet migrated)
			if githubUsername != "" && oracleName == "" {
				currentName := record.GetString("name")
				record.Set("oracle_name", currentName)
				record.Set("name", githubUsername)
				if err := app.Save(record); err != nil {
					return err
				}
			}
		}

		return nil
	}, func(app core.App) error {
		// Rollback: swap back
		records, err := app.FindAllRecords("oracles")
		if err != nil {
			return err
		}

		for _, record := range records {
			oracleName := record.GetString("oracle_name")
			if oracleName != "" {
				record.Set("name", oracleName)
				record.Set("oracle_name", "")
				if err := app.Save(record); err != nil {
					return err
				}
			}
		}

		return nil
	})
}
