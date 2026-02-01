package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// Add GitHub OAuth fields to oracles collection
		oracles, err := app.FindCollectionByNameOrId("oracles")
		if err != nil {
			return err
		}

		// github_username: GitHub username (e.g., "natwaribhop")
		oracles.Fields.Add(&core.TextField{Name: "github_username", Max: 100})

		// github_repo: Full repo path in "owner/repo" format
		oracles.Fields.Add(&core.TextField{Name: "github_repo", Max: 200})

		// github_id: GitHub user ID for linking accounts
		oracles.Fields.Add(&core.TextField{Name: "github_id", Max: 50})

		return app.Save(oracles)
	}, nil)
}
